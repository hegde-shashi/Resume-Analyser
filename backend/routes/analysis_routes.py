from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.services.job_services import build_job_context
from backend.database.db import db
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.database.chroma_db import get_resume_retriever
from backend.ai.llm_client import get_llm
from backend.ai.prompt_template import compare_prompt


analysis_bp = Blueprint("analysis", __name__)

@analysis_bp.route("/analyze_job", methods=["POST"])
@jwt_required()
def analyze_job():

    data = request.get_json()

    user_id = get_jwt_identity()

    job_id = data["job_id"]

    llm = get_llm(data)

    job = Jobs.query.filter_by(
        id=job_id,
        user_id=user_id
    ).first()

    if not job:
        return {"error": "Job not found"}, 404

    job_text = build_job_context(job)

    resume = Resume.query.filter_by(user_id=user_id).first()

    prompt = compare_prompt(
        resume.text_chunk,
        job_text
    )

    answer = llm.invoke(prompt)

    return jsonify({"analysis": answer.content})