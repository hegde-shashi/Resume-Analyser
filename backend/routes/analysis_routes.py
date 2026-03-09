from flask import Blueprint, request, jsonify
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

    data = request.get_json()

    user_id = int(get_jwt_identity())

    job_id = data["job_id"]

    try:
        llm = get_llm(data, temperature=0.2)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    job = Jobs.query.filter_by(
        id=job_id,
        user_id=user_id
    ).first()

    if not job:
        return {"error": "Job not found"}, 404

    # Check if analysis exists
    existing = Analysis.query.filter_by(job_id=job_id).first()
    if existing:
        return jsonify({
            "analysis": {
                "score": existing.score,
                "matched_skills": existing.matched_skills,
                "missing_skills": existing.missing_skills,
                "suggestions": existing.suggestions,
                "evaluation_summary": existing.evaluation_summary
            }
        })

    job_text = build_job_context(job)

    resume = Resume.query.filter_by(user_id=user_id).first()

    if not resume:
        return {"error": "Please upload a resume first to analyze this job"}, 400

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
        import re
        raw_content = answer.content
        match = re.search(r'\{[\s\S]*\}', raw_content)
        parsed = json.loads(match.group(0)) if match else json.loads(raw_content)

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
        import logging
        logging.error(f"Error parsing or saving LLM response: {e}")
        # fallback to raw content if parsing fails completely, although db save won't happen
        return jsonify({"analysis": answer.content})