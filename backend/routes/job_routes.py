from flask import Blueprint, request, jsonify
from backend.models.job_model import Jobs
from backend.database.db import db 
from backend.services.job_scrapper import scrape_job
from backend.ai.prompt_template import job_description_prompt
from backend.ai.llm_client import get_llm
import json
import re


job_bp = Blueprint('job', __name__)

@job_bp.route('/parse_job', methods=['POST'])
def parse_job():

    data = request.json
    link = data['job_link']

    try:
        clean_html = scrape_job(link)
    except Exception as e:
        return jsonify({
            "scrape_success": False,
            "message": "Could not scrape job page. Please paste job description."
        })


    if not clean_html or any(phrase in clean_html.lower() for phrase in ["access denied", "don't have permission"]):
        return jsonify({
            "scrape_success": False,
            "message": "Could not scrape job page. Please paste job description."
        })
    else:
        try:
            llm = get_llm(data)

            chain = job_description_prompt() | llm

            parsed_data = chain.invoke({
                "job_text": clean_html
            })
            response_text = parsed_data.content
            try:
                parsed_data = json.loads(response_text)
            except:
                match = re.search(r"\{.*\}", response_text, re.DOTALL)
                parsed_data = json.loads(match.group()) if match else {}

        except Exception as e:
            return jsonify({
                "success": False,
                "message": "Please try again after some time."
            })

    return jsonify({
        "scrape_success": True,
        "job_data": parsed_data
    })


@job_bp.route('/parse_jd_txt', methods=['POST']) 
def parse_jd():
    jd = request.json['job_description']

    try:
        llm = get_llm(data)

        chain = job_description_prompt() | llm

        parsed_data = chain.invoke({
            "job_text": clean_html
        })
        response_text = parsed_data.content
        try:
            parsed_data = json.loads(response_text)
        except:
            match = re.search(r"\{.*\}", response_text, re.DOTALL)
            parsed_data = json.loads(match.group()) if match else {}

    except Exception as e:
        return jsonify({
            "success": False,
            "message": "Please try again after some time."
        })
        

@job_bp.route("/save_job", methods=["POST"])
def save_job():

    data = request.json

    job = Jobs(**data)

    db.session.add(job)
    db.session.commit()

    return {"message": "Job saved"}


@job_bp.route("/get_jobs", methods=["GET"])
def get_jobs():

    jobs = Jobs.query.all()

    result = []

    for job in jobs:
        result.append({
            "id": job.id,
            "job_title": job.job_title,
            "job_id": job.job_id,
            "company": job.company,
            "location": job.location,
            "experience_required": job.experience_required,
            "skills_required": job.skills_required,
            "preferred_skills": job.preferred_skills,
            "responsibilities": job.responsibilities,
            "education": job.education,
            "job_type": job.job_type,
            "progress": job.progress
        })

    return jsonify(result)


@job_bp.route("/delete_job/<int:job_id>", methods=["DELETE"])
def delete_job(job_id):

    job = Jobs.query.get(job_id)

    db.session.delete(job)
    db.session.commit()

    return {"message": "Job deleted"}



@job_bp.route("/update_progress", methods=["POST"])
def update_progress():

    data = request.json

    job = Jobs.query.get(data["job_id"])

    job.progress = data["progress"]

    db.session.commit()

    return {"message": "Progress updated"}