from flask import Blueprint, request, jsonify
import logging

from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.services.job_services import build_job_context
from backend.database.db import db
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.database.chroma_db import get_resume_retriever
from backend.ai.llm_client import get_llm, handle_llm_error
from backend.ai.prompt_template import compare_prompt
import json
from backend.models.analysis_model import Analysis
analysis_bp = Blueprint("analysis", __name__)

@analysis_bp.route("/analyze_job", methods=["POST"])
@jwt_required()
def analyze_job():

    data = request.get_json() or {}
    if not data or "job_id" not in data:
        return jsonify({"error": "Missing job_id in request"}), 400

    job_id = data["job_id"]
    user_id = int(get_jwt_identity())

    try:
        llm = get_llm(data, temperature=0.5)
    except Exception as e:
        return jsonify({"error": handle_llm_error(e)}), 400


    force_reanalyze = data.get("force_reanalyze", False)

    job = Jobs.query.filter_by(
        id=job_id,
        user_id=user_id
    ).first()

    if not job:
        return jsonify({"error": "Job not found"}), 404

    resume = Resume.query.filter_by(user_id=user_id).first()
    if not resume:
        return jsonify({"error": "Please upload a resume first to analyze this job"}), 400

    # Check if analysis exists
    try:
        existing = Analysis.query.filter_by(job_id=job_id).first()
    except Exception as e:
        logging.warning(f"Could not query analysis table: {e}")
        existing = None
    
    if existing:
        # Check if analysis is stale (compare with resume uploaded_at or created_at)
        is_stale = False
        try:
            resume_time = resume.uploaded_at or resume.created_at
            if resume_time and hasattr(existing, 'created_at') and existing.created_at:
                if resume_time > existing.created_at:
                    is_stale = True
        except Exception as e:
            logging.warning(f"Stale check failed (likely missing column): {e}")
            is_stale = False

        if is_stale and not force_reanalyze:
            return jsonify({
                "is_stale": True,
                "analysis": {
                    "score": existing.score,
                    "matched_skills": existing.matched_skills,
                    "missing_skills": existing.missing_skills,
                    "suggestions": existing.suggestions,
                    "evaluation_summary": existing.evaluation_summary
                }
            })
        
        if not is_stale:
            return jsonify({
                "analysis": {
                    "score": existing.score,
                    "matched_skills": existing.matched_skills,
                    "missing_skills": existing.missing_skills,
                    "suggestions": existing.suggestions,
                    "evaluation_summary": existing.evaluation_summary
                }
            })
        
        # If we reach here, it means is_stale is True AND force_reanalyze is True
        db.session.delete(existing)
        db.session.commit()

    job_text = build_job_context(job)


    try:
        from backend.agents.graph import create_maarga_graph
        from langchain_core.messages import HumanMessage
        import json
        
        agent_app = create_maarga_graph()
        
        parsed_resume_details = {}
        if hasattr(resume, 'structured_details') and resume.structured_details:
            if isinstance(resume.structured_details, str):
                try: parsed_resume_details = json.loads(resume.structured_details)
                except: pass
            else: parsed_resume_details = resume.structured_details

        # Prepare LLM config from request data
        llm_config = {
            "model": data.get("model") or data.get("selected_model"),
            "mode": data.get("mode") or ("user" if data.get("api_key") else "default"),
            "api_key": data.get("api_key")
        }

        initial_state = {
            "messages": [HumanMessage(content="Analyze skill gap for this job")],
            "resume_text": resume.text_chunk,
            "parsed_resume": parsed_resume_details,
            "job_description": job_text,
            "parsed_jd": None,
            "skill_gap_report": None,
            "research_data": None,
            "generated_resume": None,
            "career_advice": None,
            "llm_config": llm_config,
            "user_intent": "analyze_skill_gap",
            "attempts": {},
        }
        
        result = agent_app.invoke(initial_state)
        parsed = result.get("skill_gap_report", {})
        
        try:
            score_raw = parsed.get("score") or parsed.get("match_score") or 0
            score = int(score_raw) if str(score_raw).isdigit() else 0
        except (ValueError, TypeError):
            score = 0
            
        matched = parsed.get("matched_skills", [])
        missing = parsed.get("missing_skills", [])
        suggestions = parsed.get("suggestions", [])
        summary = parsed.get("evaluation_summary", {})

        # Save to DB
        new_analysis = Analysis(
            job_id=job_id,
            score=score,
            matched_skills=matched,
            missing_skills=missing,
            suggestions=suggestions,
            evaluation_summary=summary
        )
        db.session.add(new_analysis)
        db.session.commit()

        return jsonify({
            "analysis": {
                "score": score,
                "matched_skills": matched,
                "missing_skills": missing,
                "suggestions": suggestions,
                "evaluation_summary": summary
            }
        })

    except Exception as e:
        logging.error(f"Error parsing or saving LLM response: {e}")
        return jsonify({"analysis": {"error": str(e)}})