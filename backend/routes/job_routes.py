from flask import Blueprint, request, jsonify
from backend.models.job_model import Jobs
from backend.database.db import db
from backend.services.job_scrapper import scrape_job
from backend.ai.prompt_template import job_description_prompt
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.ai.llm_client import get_llm, handle_llm_error
import json
import re
from backend.models.analysis_model import Analysis


job_bp = Blueprint('job', __name__)

# Fields that belong in the DB (others like model/mode/api_key are stripped)
JOB_FIELDS = {
    'job_link', 'job_title', 'job_id', 'company', 'location',
    'experience_required', 'skills_required', 'preferred_skills',
    'responsibilities', 'education', 'job_type', 'progress'
}


def parse_llm_response(text):
    """Try to parse JSON from LLM response."""
    # Ensure we are working with a string
    if isinstance(text, list):
        # Join parts if the LLM returned multiple content blocks
        text = " ".join([str(p.get("text", p)) if isinstance(p, dict) else str(p) for p in text])
    
    if not isinstance(text, str):
        text = str(text)

    try:
        # 1. Try direct JSON parse
        return json.loads(text.strip())
    except Exception:
        try:
            # 2. Try cleaning markdown markers
            cleaned = text.replace("```json", "").replace("```", "").strip()
            return json.loads(cleaned)
        except Exception:
            try:
                # 3. Last resort: regex search for the first { } block
                match = re.search(r"\{.*\}", text, re.DOTALL)
                return json.loads(match.group()) if match else {}
            except Exception:
                return {}


@job_bp.route('/parse_job', methods=['POST'])
def parse_job():
    data = request.json
    link = data.get('job_link', '')

    try:
        clean_html = scrape_job(link)
    except Exception:
        return jsonify({"scrape_success": False, "message": "Could not scrape job page. Please paste job description."})

    if not clean_html or any(phrase in clean_html.lower() for phrase in ["access denied", "don't have permission", "max challenge attempts"]):
        return jsonify({"scrape_success": False, "message": "Could not scrape job page. Please paste job description."})

    try:
        llm = get_llm(data)
        chain = job_description_prompt() | llm
        result = chain.invoke({"job_text": clean_html})
        parsed_data = parse_llm_response(result.content)
    except Exception as e:
        return jsonify({"scrape_success": False, "message": handle_llm_error(e)})

    return jsonify({"scrape_success": True, "job_data": parsed_data})


@job_bp.route('/parse_jd_txt', methods=['POST'])
def parse_jd():
    data = request.json
    jd   = data.get('job_description', '')

    try:
        llm = get_llm(data)
        chain = job_description_prompt() | llm
        result = chain.invoke({"job_text": jd})
        parsed_data = parse_llm_response(result.content)
    except Exception as e:
        return jsonify({"scrape_success": False, "message": handle_llm_error(e)})

    return jsonify({"scrape_success": True, "job_data": parsed_data})


@job_bp.route("/save_job", methods=["POST"])
@jwt_required()
def save_job():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    # Only pass fields that exist on the model
    job_data = {k: v for k, v in data.items() if k in JOB_FIELDS}

    # Stringify list fields so they fit in Text columns
    for field in ('skills_required', 'preferred_skills', 'responsibilities', 'education', 'experience_required'):
        if isinstance(job_data.get(field), list):
            job_data[field] = ", ".join(str(i) for i in job_data[field])

    try:
        job = Jobs(user_id=user_id, **job_data)
        db.session.add(job)
        db.session.commit()
        return jsonify({"message": "Job saved", "job_id": job.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@job_bp.route("/get_jobs", methods=["GET"])
@jwt_required()
def get_jobs():
    user_id = int(get_jwt_identity())
    jobs = Jobs.query.filter_by(user_id=user_id).order_by(Jobs.created_at.desc()).all()

    result = []
    for index, job in enumerate(jobs, start=1):
        # Fetch the latest analysis for this job to show match score if available
        analysis = Analysis.query.filter_by(job_id=job.id).first()
        match_score = analysis.score if analysis else None

        result.append({
            "ui_index": index,
            "id": job.id,
            "job_title": job.job_title,
            "job_id": job.job_id,
            "job_link": job.job_link,
            "company": job.company,
            "location": job.location,
            "experience_required": job.experience_required,
            "skills_required": job.skills_required,
            "preferred_skills": job.preferred_skills,
            "responsibilities": job.responsibilities,
            "education": job.education,
            "job_type": job.job_type,
            "progress": job.progress,
            "matchScore": match_score,
            "created_at": job.created_at.strftime("%d/%m/%Y %H:%M:%S") if job.created_at else "",
        })

    return jsonify(result)


@job_bp.route("/delete_job/<int:job_id>", methods=["DELETE"])
@jwt_required()
def delete_job(job_id):
    user_id = int(get_jwt_identity())
    job = Jobs.query.filter_by(id=job_id, user_id=user_id).first()

    if not job:
        return {"error": "Job not found"}, 404

    db.session.delete(job)
    db.session.commit()
    return {"message": "Job deleted successfully"}


@job_bp.route("/update_progress", methods=["POST"])
@jwt_required()
def update_progress():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    job = Jobs.query.filter_by(id=data["job_id"], user_id=user_id).first()

    if not job:
        return {"error": "Job not found"}, 404

    job.progress = data.get("progress", job.progress)
    db.session.commit()
    return {"message": "Job updated successfully"}