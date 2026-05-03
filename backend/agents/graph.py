from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.agents.state import MaargaState
from backend.agents.supervisor import supervisor_node
from backend.config import GOOGLE_API_KEY
from backend.ai.prompt_template import get_skill_gap_prompt, get_resume_rewrite_prompt, get_career_advisor_prompt
import json

from backend.agents.utils import get_llm

def resume_analyzer_node(state: MaargaState):
    """
    Analyzes resume and JD. Extracts structured JSON and match score.
    """
    print(f"\n[AGENT] Running Resume Analyzer...")
    llm = get_llm(state.get("llm_config"))
    
    # Normally we'd call extract_resume_details and parse_job_description from backend.services
    # For now we'll do a simple LLM call if not parsed
    parsed_resume = state.get("parsed_resume")
    parsed_jd = state.get("parsed_jd")
    resume_text = state.get("resume_text", "")
    jd_text = state.get("job_description", "")
    
    updates = {}
    
    if resume_text and not parsed_resume:
        from backend.services.resume_extractor import extract_resume_details
        parsed_resume = extract_resume_details(llm, resume_text)
        updates["parsed_resume"] = parsed_resume
        
    if jd_text and not parsed_jd:
        prompt = f"Extract required skills, nice to have skills, and job title from this JD as JSON. JD: {jd_text[:2000]}"
        response = llm.invoke(prompt)
        try:
            content = response.content
            if isinstance(content, list):
                content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
            if not isinstance(content, str):
                content = str(content)
            
            # Robust JSON extraction
            text = content.replace('```json', '').replace('```', '').strip()
            start = text.find('{')
            end = text.rfind('}') + 1
            if start != -1 and end > 0:
                text = text[start:end]
            
            parsed_jd = json.loads(text)
        except Exception as e:
            print(f"[ERROR] Failed to parse JD JSON: {e}")
            parsed_jd = {"raw": response.content}
        updates["parsed_jd"] = parsed_jd
        
    return updates

def skill_gap_node(state: MaargaState):
    """
    Computes missing skills between Resume and JD.
    """
    print(f"\n[AGENT] Running Skill Gap Specialist...")
    llm = get_llm(state.get("llm_config"))
    
    parsed_resume = state.get("parsed_resume", {})
    parsed_jd = state.get("parsed_jd", {})
    
    prompt = get_skill_gap_prompt(parsed_resume, parsed_jd)
    
    response = llm.invoke(prompt)
    try:
        content = response.content
        if isinstance(content, list):
            content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
        if not isinstance(content, str):
            content = str(content)
            
        # Robust JSON extraction
        text = content.replace('```json', '').replace('```', '').strip()
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end > 0:
            text = text[start:end]
            
        skill_gap = json.loads(text)
    except Exception as e:
        print(f"[ERROR] Failed to parse Skill Gap JSON: {e}")
        skill_gap = {"score": 0, "matched_skills": [], "missing_skills": [], "suggestions": ["Could not parse response"], "evaluation_summary": {}}
        
    return {"skill_gap_report": skill_gap}

def resume_generator_node(state: MaargaState):
    """
    Generates an optimized resume.
    """
    print(f"\n[AGENT] Running Resume Generator Agent...")
    llm = get_llm(state.get("llm_config"))
    parsed_resume = state.get("parsed_resume", {})
    skill_gap = state.get("skill_gap_report", {})
    
    prompt = get_resume_rewrite_prompt(parsed_resume, skill_gap)
    
    response = llm.invoke(prompt)
    try:
        content = response.content
        if isinstance(content, list):
            content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
        if not isinstance(content, str):
            content = str(content)
            
        # Robust JSON extraction
        text = content.replace('```json', '').replace('```', '').strip()
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end > 0:
            text = text[start:end]
            
        generated = json.loads(text)
    except Exception as e:
        print(f"[ERROR] Failed to parse Generated Resume JSON: {e}")
        generated = {"error": "Could not generate structured resume", "raw": response.content}
        
    return {"generated_resume": generated}

def research_node(state: MaargaState):
    """
    Searches web for company or role info using Web Tool.
    """
    print(f"\n[AGENT] Running Research Specialist (Web Search)...")
    from backend.agents.web_tool import search_web
    
    last_msg = state["messages"][-1].content
    # In a real setup, we'd use function calling. Here we'll do a simple text query extraction.
    try:
        results = search_web(last_msg)
    except Exception as e:
        results = str(e)
        
    return {"research_data": {"query": last_msg, "results": results}}

def career_advisor_node(state: MaargaState):
    """
    Provides conversational advice.
    """
    print(f"\n[AGENT] Running Career Advisor Agent...")
    llm = get_llm(state.get("llm_config"))
    last_msg = state["messages"][-1].content if state.get("messages") else ""
    
    prompt = get_career_advisor_prompt(
        has_parsed_resume=bool(state.get("parsed_resume")),
        has_skill_gap_report=bool(state.get("skill_gap_report")),
        research_data=state.get("research_data", ""),
        last_msg=last_msg
    )
    
    response = llm.invoke(prompt)
    return {"career_advice": response.content}


def create_maarga_graph():
    """
    Builds the state graph for the multi-agent system.
    """
    workflow = StateGraph(MaargaState)
    
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("resume_analyzer", resume_analyzer_node)
    workflow.add_node("skill_gap", skill_gap_node)
    workflow.add_node("resume_generator", resume_generator_node)
    workflow.add_node("research", research_node)
    workflow.add_node("career_advisor", career_advisor_node)
    
    workflow.set_entry_point("supervisor")
    
    for node in ["resume_analyzer", "skill_gap", "resume_generator", "research", "career_advisor"]:
        workflow.add_edge(node, "supervisor")
        
    def route_from_supervisor(state: MaargaState):
        next_node = state.get("next_agent", "FINISH")
        if next_node == "FINISH" or next_node == "finish":
            return END
        return next_node
        
    workflow.add_conditional_edges("supervisor", route_from_supervisor)
    
    app = workflow.compile()
    return app
