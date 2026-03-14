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
        llm = get_llm(data, temperature=0.2)
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
    existing = Analysis.query.filter_by(job_id=job_id).first()
    
    if existing:
        # Check if analysis is stale (compare with resume uploaded_at or created_at)
        # Use whichever is newer or available
        resume_time = resume.uploaded_at or resume.created_at
        is_stale = False
        if resume_time and existing.created_at:
            # Add a small buffer (e.g. 5 seconds) to avoid false positives during same-process execution
            if resume_time > existing.created_at:
                is_stale = True

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


    prompt = compare_prompt(
        resume.text_chunk,
        job_text
    )

    try:
        answer = llm.invoke(prompt)
    except Exception as e:
        return jsonify({"error": handle_llm_error(e)}), 500

    try:
        # The LLM should return a JSON string, let's parse it
        raw_content = answer.content
        if isinstance(raw_content, list):
            raw_content = " ".join([str(p.get("text", p)) if isinstance(p, dict) else str(p) for p in raw_content])
            
        import re
        match = re.search(r"\{.*\}", str(raw_content), re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

        score = parsed.get("score") or parsed.get("match_score") or parsed.get("Match Score") or parsed.get("matchScore") or 0
        matched = parsed.get("matched_skills") or parsed.get("Matched Skills") or parsed.get("matchedSkills") or []
        missing = parsed.get("missing_skills") or parsed.get("Missing Skills") or parsed.get("missingSkills") or []
        suggestions = parsed.get("suggestions") or parsed.get("Suggestions") or []
        summary = parsed.get("evaluation_summary") or parsed.get("Evaluation summary") or {}

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
        # fallback to raw content if parsing fails completely, although db save won't happen
        return jsonify({"analysis": answer.content})