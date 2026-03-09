from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.ai.llm_client import get_llm
from backend.ai.prompt_template import mail_prompt, cover_letter_prompt
from backend.models.user_model import User
from backend.services.job_services import build_job_context

mail_bp = Blueprint("mail", __name__)

@mail_bp.route("/generate_mail", methods=["POST"])
@jwt_required()
def generate_mail():

    user_id = get_jwt_identity()

    data = request.get_json()

    llm = get_llm(data, temperature=0.6)

    job = Jobs.query.filter_by(
        id=data["job_id"],
        user_id=user_id
    ).first()

    user = User.query.filter_by(id=user_id).first()

    job_text = build_job_context(job)

    candidate_name = user.username

    prompt = mail_prompt(
        candidate_name,
        job_text,
        job.progress
    )

    result = llm.invoke(prompt)

    return jsonify({
        "mail": result.content
    })

@mail_bp.route("/generate_cover_letter", methods=["POST"])
@jwt_required()
def generate_cover_letter():

    user_id = get_jwt_identity()

    data = request.get_json()

    llm = get_llm(data, temperature=0.6)

    job = Jobs.query.filter_by(
        id=data["job_id"],
        user_id=user_id
    ).first()

    resume = Resume.query.filter_by(user_id=user_id).first()

    user = User.query.filter_by(id=user_id).first()

    job_text = build_job_context(job)

    candidate_name = user.username

    prompt = cover_letter_prompt(
        candidate_name,
        resume.text_chunk,
        job,
    )

    result = llm.invoke(prompt)

    return jsonify({
        "cover_letter": result.content
    })
