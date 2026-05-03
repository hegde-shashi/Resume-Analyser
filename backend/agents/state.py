"""
Shared state across ALL agents.
This is the "memory" that enables inter-agent communication.
Every agent reads from and writes to this state.
"""

from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class MaargaState(TypedDict):
    """Central state shared across all agents"""

    # ── Conversation History ──
    messages: Annotated[list, add_messages]

    # ── User Inputs ──
    resume_text: Optional[str]          # Raw resume text
    job_description: Optional[str]      # Raw JD text

    # ── NLP Parsed Data (written by Resume Analyzer) ──
    parsed_resume: Optional[dict]       # Structured JSON from NLP parser
    parsed_jd: Optional[dict]           # Structured JSON from JD parser

    # ── Analysis Results (written by respective agents) ──
    skill_gap_report: Optional[dict]    # Written by Skill Gap Agent
    match_score: Optional[float]        # Resume-JD match percentage
    research_data: Optional[dict]       # Written by Research Agent
    generated_resume: Optional[dict]     # Written by Resume Generator Agent (Structured JSON)
    career_advice: Optional[str]        # Written by Career Advisor Agent

    # ── Configuration ──
    llm_config: Optional[dict]          # Model and API key config from frontend

    # ── Routing ──
    next_agent: Optional[str]           # Supervisor decides this
    user_intent: Optional[str]          # What the user wants
    last_agent: Optional[str]           # Track last agent to prevent loops
    attempts: Optional[dict]            # Track agent call counts