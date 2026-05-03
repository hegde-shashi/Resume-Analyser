"""
Supervisor Agent — Routes requests to the right specialist agent.
This is the orchestrator that decides which agent handles what.
"""

from langchain_google_genai import ChatGoogleGenerativeAI
from backend.agents.state import MaargaState
from backend.config import GOOGLE_API_KEY as GEMINI_API_KEY
GEMINI_MODEL = "gemini-1.5-flash"


def supervisor_node(state: MaargaState) -> dict:
    """
    Supervisor analyzes user intent and routes to the right agent.
    Returns updated state with next_agent set.
    """
    from backend.agents.utils import get_llm
    llm = get_llm(state.get("llm_config"))

    # Get the latest user message
    last_message = state["messages"][-1].content if state["messages"] else ""

    # Check what data is already available
    has_resume = bool(state.get("parsed_resume"))
    has_jd = bool(state.get("parsed_jd"))
    has_skill_gap = bool(state.get("skill_gap_report"))
    has_research = bool(state.get("research_data"))
    has_generated_resume = bool(state.get("generated_resume"))
    user_intent = state.get("user_intent")

    # [OPTIMIZATION] Shortcut for simple extraction tasks
    if user_intent == "extract_resume" and has_resume:
        print("[SUPERVISOR] Resume extraction complete. Finishing.")
        return {"next_agent": "FINISH"}
    
    if user_intent == "extract_resume" and not has_resume:
        print("[SUPERVISOR] Resume not yet parsed. Routing to analyzer.")
        return {"next_agent": "resume_analyzer", "last_agent": "resume_analyzer", "attempts": {"resume_analyzer": 1}}

    # [OPTIMIZATION] Shortcut for skill gap analysis
    if user_intent == "analyze_skill_gap":
        if has_skill_gap:
            print("[SUPERVISOR] Skill gap report ready. Finishing.")
            return {"next_agent": "FINISH"}
        if not has_jd:
            print("[SUPERVISOR] JD not yet parsed. Routing to analyzer.")
            return {"next_agent": "resume_analyzer"}
        if has_jd and not has_skill_gap:
            print("[SUPERVISOR] JD parsed, computing gap. Routing to skill_gap.")
            return {"next_agent": "skill_gap"}

    from backend.ai.prompt_template import get_supervisor_prompt
    
    prompt = get_supervisor_prompt(
        has_resume=has_resume,
        has_jd=has_jd,
        has_skill_gap=has_skill_gap,
        has_research=has_research,
        has_generated_resume=has_generated_resume,
        last_message=last_message
    )

    print(f"\n[SUPERVISOR] Analyzing state and routing...")
    response = llm.invoke(prompt)
    
    content = response.content
    if isinstance(content, list):
        content = " ".join([str(c.get('text', c)) if isinstance(c, dict) else str(c) for c in content])
        
    next_agent = content.strip().lower().replace('"', '')
    print(f"[SUPERVISOR] Next Agent Decision: {next_agent}")

    # Validate agent name
    valid_agents = ["resume_analyzer", "skill_gap", "resume_generator",
                    "research", "career_advisor", "finish", "FINISH"]

    # Loop Detection Logic
    last_agent = state.get("last_agent")
    attempts = state.get("attempts") or {}
    
    # If the same agent is called again but didn't produce the expected data, stop
    if next_agent == "resume_analyzer" and last_agent == "resume_analyzer" and not has_resume:
        print(f"[SUPERVISOR] Loop detected for resume_analyzer. Stopping.")
        next_agent = "FINISH"
    
    # Global max attempts per agent
    agent_attempts = attempts.get(next_agent, 0)
    if agent_attempts >= 2:
        print(f"[SUPERVISOR] Max attempts reached for {next_agent}. Stopping.")
        next_agent = "FINISH"

    if next_agent not in valid_agents:
        next_agent = "career_advisor"  # fallback

    # Update attempts for the NEXT agent
    attempts[next_agent] = attempts.get(next_agent, 0) + 1
    
    return {"next_agent": next_agent, "last_agent": next_agent, "attempts": attempts}