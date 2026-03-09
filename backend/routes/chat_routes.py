from flask import Blueprint, request, Response, stream_with_context, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.ai.llm_client import get_llm, handle_llm_error
from backend.ai.prompt_template import chat_prompt
from backend.services.job_services import build_job_context

from backend.database.chroma_db import get_resume_retriever

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        llm = get_llm(data, streaming=True, temperature=0.6)

        job = Jobs.query.filter_by(
            id=data["job_id"],
            user_id=user_id
        ).first()

        resume = Resume.query.filter_by(user_id=user_id).first()
        history = data.get("history", [])

        question = data.get("question")

        # prompt = chat_prompt(
        #     resume.text_chunk if resume else "No resume provided.",
        #     job,
        #     history,
        #     data["question"]
        # )
        job_description = build_job_context(job)


        history_text = ""

        for msg in history:

            if msg["role"] == "user":
                history_text += f"User: {msg['content']}\n"

            if msg["role"] == "assistant":
                history_text += f"Assistant: {msg['content']}\n"

        
        prompt = chat_prompt().partial(
            company=job.company,
            role=job.job_title,
            progress=job.progress,
            job_description=job_description,
            history_text=history_text
        )

        retriever = get_resume_retriever(user_id)
        docs = retriever.invoke(question)
        context_text = "\n\n".join([doc.page_content for doc in docs])

        chain = prompt | llm

        def generate():
            try:
                for chunk in chain.stream({"input": question, "context": context_text}):
                    if chunk.content:
                        yield chunk.content
            except Exception as e:
                yield f"\n\n⚠️ {handle_llm_error(e)}"

        return Response(stream_with_context(generate()), mimetype='text/plain')
    except Exception as e:
        return jsonify({"error": handle_llm_error(e)}), 400