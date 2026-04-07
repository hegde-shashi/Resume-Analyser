from flask import Blueprint, request, Response, stream_with_context, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.ai.llm_client import get_llm, handle_llm_error
from backend.ai.prompt_template import chat_prompt
from backend.services.job_services import build_job_context
from backend.database.chroma_db import get_resume_retriever
from backend.tools.tool_registry import TOOLS
from langgraph.prebuilt import create_react_agent
from backend.agents.interview_graph import build_interview_graph


chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        llm = get_llm(data, streaming=True, temperature=0.6, enable_tools=True)

        try:
            db_job_id = int(data["job_id"])
            db_user_id = int(user_id)
        except (ValueError, TypeError):
            db_job_id = data["job_id"]
            db_user_id = user_id

        job = Jobs.query.filter_by(
            id=db_job_id,
            user_id=db_user_id
        ).first()

        if not job:
            return jsonify({"error": f"Job with ID {data['job_id']} not found or access denied."}), 404

        resume = Resume.query.filter_by(user_id=db_user_id).first()
        history = data.get("history", [])

        question = data.get("question", "")
        
        # Check for slash commands in the question
        is_interview_mode = question.strip().startswith("/interview")
        is_normal_mode = question.strip().startswith("/normal")
        
        if is_interview_mode:
            # Strip the command from the actual question
            question = question.strip().replace("/interview", "", 1).strip()
            # If nothing left, use a default prompt for start of interview
            if not question:
                question = "Start the interview."
        elif is_normal_mode:
            question = question.strip().replace("/normal", "", 1).strip()
            if not question:
                question = "Hello"

        job_description = build_job_context(job)

        history_text = ""

        for msg in history:

            if msg["role"] == "user":
                history_text += f"User: {msg['content']}\n"

            if msg["role"] == "assistant":
                history_text += f"Assistant: {msg['content']}\n"

        
        retriever = get_resume_retriever(user_id)
        docs = retriever.invoke(question)
        context_text = "\n\n".join([doc.page_content for doc in docs])

        # Fill the system prompt part with all available info
        # We use the system message part from our template
        system_prompt_template = chat_prompt().messages[0].prompt.template
        
        # Add ID information to helps tools
        id_context = f"\n\n--- CRITICAL: CURRENT IDs FOR TOOLS ---\nUser ID: {user_id}\nJob ID: {data['job_id']}\n---"
        
        full_system_prompt = system_prompt_template.format(
            company=job.company,
            role=job.job_title,
            progress=job.progress,
            job_description=job_description,
            history_text=history_text,
            context=context_text
        ) + id_context

        mode = data.get("mode", "default")
        if is_interview_mode:
            mode = "interview" 
        elif is_normal_mode:
            mode = "default"

        if mode == "interview":
            app_graph = build_interview_graph(llm)
            
            # Identify the last question asked by the assistant to evaluate the current answer
            last_question = ""
            for msg in reversed(history):
                # Search for the most recent question asked by assistant
                if msg["role"] == "assistant":
                    content = msg["content"]
                    # If it was an interview chunk, it might have 'Next Question' header
                    if "Next Question" in content:
                        last_question = content.split("Next Question")[-1].strip()
                    elif "?" in content:
                        last_question = content.strip()
                    if last_question:
                        break

            initial_state = {
                "role": job.job_title,
                "job_description": job_description,
                "question": last_question,
                "answer": question,
                "feedback": ""
            }

            def generate_interview():
                try:
                    # Run the interview graph
                    final_state = app_graph.invoke(initial_state)
                    
                    feedback = final_state.get("feedback", "")
                    
                    # Intercept topic change feedback to make it user-friendly
                    if "TOPIC_CHANGE:" in feedback:
                        topic = feedback.replace("TOPIC_CHANGE:", "").strip()
                        yield f"🔄 *Topic changed to: {topic}*\n\n".encode('utf-8')
                    elif feedback and last_question:
                        yield f"### Feedback on your answer:\n{feedback}\n\n".encode('utf-8')
                    
                    # Yield the new question
                    if final_state.get("question"):
                        yield f"### Next Question:\n{final_state['question']}".encode('utf-8')
                        
                except Exception as e:
                    yield f"\n\n⚠️ {handle_llm_error(e)}".encode('utf-8')

            return Response(stream_with_context(generate_interview()), mimetype='text/plain')


        # LangGraph ReAct agent is the modern replacement for initialize_agent/AgentExecutor
        # It automatically handles tool-calling if the LLM supports it
        # We use the 'prompt' argument (replaces state_modifier in some versions)
        agent_executor = create_react_agent(
            model=llm,
            tools=TOOLS,
            prompt=full_system_prompt
        )

        def generate():
            try:
                # LangGraph stream returns updates from different nodes (agent, tools, etc.)
                # We want the 'agent' node output which contains the message chunks
                for update in agent_executor.stream(
                    {"messages": [("human", question)]},
                    stream_mode="updates"
                ):
                    # In LangGraph, the agent node returns message objects
                    if "agent" in update:
                        messages = update["agent"].get("messages", [])
                        for msg in messages:
                            content = getattr(msg, "content", "")
                            if content:
                                if isinstance(content, list):
                                    # Extract text from multi-part content if it's a list
                                    text_parts = []
                                    for part in content:
                                        if isinstance(part, dict) and "text" in part:
                                            text_parts.append(part["text"])
                                        elif isinstance(part, str):
                                            text_parts.append(part)
                                    content = "".join(text_parts)
                                
                                if isinstance(content, str) and content:
                                    yield content.encode('utf-8')
            except Exception as e:
                yield f"\n\n⚠️ {handle_llm_error(e)}".encode('utf-8')

        return Response(stream_with_context(generate()), mimetype='text/plain')
    except Exception as e:
        return jsonify({"error": handle_llm_error(e)}), 400