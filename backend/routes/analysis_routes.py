from flask import Blueprint, request, jsonify
import logging

from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.services.job_services import build_job_context
from backend.database.db import db
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.database.chroma_db import get_resume_retriever, delete_resume_embeddings
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
        from backend.services.ai_service import call_llm_and_parse_json
        from backend.ai.prompt_template import get_skill_gap_prompt
        
        parsed_resume_details = {}
        if hasattr(resume, 'structured_details') and resume.structured_details:
            if isinstance(resume.structured_details, str):
                try: parsed_resume_details = json.loads(resume.structured_details)
                except: pass
            else: parsed_resume_details = resume.structured_details
        
        # If structured details are missing, use the raw text chunk
        resume_data = parsed_resume_details if parsed_resume_details else resume.text_chunk
        
        # Prepare LLM config from request data
        llm_config = data or {}

        prompt = get_skill_gap_prompt(resume_data, job_text)
        parsed = call_llm_and_parse_json(prompt, llm_config, temperature=0)
        
        if not parsed or (not parsed.get("score") and not parsed.get("matched_skills") and not parsed.get("evaluation_summary")):
             return jsonify({"error": "AI failed to generate analysis. This may be due to high traffic or an invalid API key. Please try again."}), 500

        try:
            score_raw = parsed.get("score") or parsed.get("match_score") or 0
            # Handle cases where score might be a string like "75/100"
            if isinstance(score_raw, str) and '/' in score_raw:
                score_raw = score_raw.split('/')[0]
            score = int(score_raw) if str(score_raw).strip().isdigit() else 0
        except (ValueError, TypeError):
            score = 0
            
        matched = parsed.get("matched_skills", [])
        missing = parsed.get("missing_skills", [])
        suggestions = parsed.get("suggestions", [])
        summary = parsed.get("evaluation_summary", "")

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