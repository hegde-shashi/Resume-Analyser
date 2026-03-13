from flask import Blueprint, request, jsonify
import logging

from backend.models.job_model import Jobs
from backend.database.db import db
from backend.services.job_scrapper import scrape_job
from backend.ai.prompt_template import job_description_prompt
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.ai.llm_client import get_llm, handle_llm_error
import json
import re
from backend.models.analysis_model import Analysis
import threading
from flask import current_app
from backend.services.job_processor import process_job_task
from backend.utils.utils import clean


job_bp = Blueprint('job', __name__)

# Fields that belong in the DB (others like model/mode/api_key are stripped)
JOB_FIELDS = {
    'job_link', 'job_title', 'job_id', 'company', 'location',
    'experience_required', 'skills_required', 'preferred_skills',
    'responsibilities', 'education', 'job_type', 'progress',
    'is_parsed', 'raw_content'
}


def parse_llm_response(text):
    """Clean and parse JSON from LLM response using regex."""
    if not isinstance(text, str):
        text = str(text)
    
    try:
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
        return jsonify({"scrape_success": True, "llm_free": True, "job_data": parsed_data})
    except Exception as e:
        # If LLM fails (traffic/free limit), we still return success but with raw content
        return jsonify({
            "scrape_success": True, 
            "llm_free": False, 
            "raw_content": clean_html,
            "message": "AI is busy. Job saved for background processing."
        })

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
        return jsonify({"scrape_success": True, "llm_free": True, "job_data": parsed_data})
    except Exception as e:
        return jsonify({
            "scrape_success": True, 
            "llm_free": False, 
            "raw_content": jd,
            "message": "AI is busy. Job saved for background processing."
        })

    return jsonify({"scrape_success": True, "job_data": parsed_data})


@job_bp.route("/save_job", methods=["POST"])
@jwt_required()
def save_job():
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    # Only pass fields that exist on the model
    # Handle mappings for extension/frontend compatibility
    if 'title' in data and 'job_title' not in data:
        data['job_title'] = data['title']
    if 'experience' in data and 'experience_required' not in data:
        data['experience_required'] = data['experience']
    # Map job_description alias to raw_content
    if 'job_description' in data and 'raw_content' not in data:
        data['raw_content'] = data['job_description']
        
    job_data = {k: v for k, v in data.items() if k in JOB_FIELDS}
    if 'raw_content' in job_data and job_data['raw_content']:
        job_data['raw_content'] = clean(job_data['raw_content'])

    # Stringify list fields so they fit in Text columns
    for field in ('skills_required', 'preferred_skills', 'responsibilities', 'education', 'experience_required'):
        if isinstance(job_data.get(field), list):
            job_data[field] = ", ".join(str(i) for i in job_data[field])

    try:
        # Default is_parsed to True if we already have job_title (immediate success)
        # Otherwise if job_title is missing, it's definitely pending
        is_parsed = data.get('is_parsed')
        if is_parsed is None:
            is_parsed = True if job_data.get('job_title') else False
            
        llm_config = {
            "model": data.get("model") or data.get("selected_model") or "gemini-2.5-flash-lite",
            "mode": "user" if data.get("api_key") else "default",
            "api_key": data.get("api_key")
        }


        job = Jobs(user_id=user_id, **job_data)
        job.is_parsed = is_parsed
        db.session.add(job)
        db.session.commit()


        # START IMMEDIATE BACKGROUND PARSE if not already parsed
        if not is_parsed:
            logging.info(f"Starting background parse for Job {job.id}")
            thread = threading.Thread(
                target=process_job_task, 
                args=(current_app._get_current_object(), job.id, llm_config)
            )
            thread.start()



        return jsonify({"message": "Job saved", "job_id": job.id, "is_parsed": job.is_parsed, "error": job.error_message})

    except Exception as e:
        logging.error(f"Error saving job: {e}")
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
            "is_parsed": job.is_parsed,
            "error_message": job.error_message,
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

    job.progress = data["progress"]
    db.session.commit()
    return {"message": "Progress updated"}


@job_bp.route("/reprocess_job", methods=["POST"])
@jwt_required()
def reprocess_job():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    job_id = data.get("job_id")

    job = Jobs.query.filter_by(id=job_id, user_id=user_id).first()
    if not job:
        return jsonify({"error": "Job not found"}), 404

    # Reset job state
    job.is_parsed = False
    job.error_message = None
    job.retry_count = 0
    db.session.commit()

    # Get configuration from frontend request (NOT stored in DB)
    llm_config = {
        "model": data.get("model") or data.get("selected_model") or "gemini-2.5-flash-lite",
        "mode": "user" if data.get("api_key") else "default",
        "api_key": data.get("api_key")
    }

    # Start immediate processing with user's transient key
    thread = threading.Thread(
        target=process_job_task, 
        args=(current_app._get_current_object(), job.id, llm_config)
    )
    thread.start()

    return jsonify({"message": "Retry started"})