from flask import Blueprint, request, jsonify, send_file, after_this_request
import os
import re
import json
from backend.ai.prompt_template import (
    get_resume_structured_prompt, 
    get_form_ai_prompt, 
    get_job_specific_prompt
)
from backend.services.ai_service import call_llm_and_parse_json
from backend.services.resume_generator import generate_resume
from backend.services.basic_job_mode import mode_form_basic
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.user_model import User
from backend.models.resume_model import Resume

resume_gen_bp = Blueprint("resume_gen", __name__)

@resume_gen_bp.route("/resume/preview", methods=["POST"])
@jwt_required()
def resume_preview():
    user_id = int(get_jwt_identity())
    
    # Handle both multipart/form-data and JSON
    if request.is_json:
        data_in = request.json or {}
    else:
        data_in = request.form

    mode = data_in.get("mode")
    llm_config = data_in.get("llm_config")
    
    if llm_config and isinstance(llm_config, str):
        try:
            llm_config = json.loads(llm_config)
        except:
            llm_config = None

    data = {}
    resume_text = ""
    
    if mode in ["resume_structured", "job_specific"]:
        existing = Resume.query.filter_by(user_id=user_id).first()
        if existing:
            resume_text = existing.text_chunk
        else:
            return jsonify({"error": "No resume found. Please go to the Resume page and upload one."}), 400

    if mode == "resume_structured":
        prompt = get_resume_structured_prompt(resume_text)
        data = call_llm_and_parse_json(prompt, llm_config, temperature=0.7)

    elif mode == "form_basic":
        data = mode_form_basic(data_in)

    elif mode == "form_ai":
        prompt = get_form_ai_prompt(data_in)
        data = call_llm_and_parse_json(prompt, llm_config, temperature=0.7)

    elif mode == "job_specific":
        jd = data_in.get("job_description")
        if not jd:
            return jsonify({"error": "Job description is required for this mode"}), 400
            
        from backend.ai.prompt_template import get_resume_rewrite_prompt
        
        parsed_resume_details = {}
        if existing and hasattr(existing, 'structured_details') and existing.structured_details:
            if isinstance(existing.structured_details, str):
                try: parsed_resume_details = json.loads(existing.structured_details)
                except: pass
            else: parsed_resume_details = existing.structured_details

        prompt = get_resume_rewrite_prompt(parsed_resume_details, jd)
        data = call_llm_and_parse_json(prompt, llm_config, temperature=0.7)

    if not data:
        return jsonify({"error": "Failed to generate resume data"}), 500

    return jsonify({"success": True, "data": data})

@resume_gen_bp.route("/resume/generate-resume", methods=["POST"])
@jwt_required()
def generate_resume_api():
    data = request.json or {}
    if not data:
        return jsonify({"error": "No data provided"}), 400

    user_id = get_jwt_identity()
    file_path = generate_resume(data, user_id=user_id)
    user = User.query.get(user_id)
    
    safe_name = re.sub(r'[^a-zA-Z0-9_]', '', user.username.replace(" ", "_"))
    filename = f"{safe_name}.docx"

    @after_this_request
    def remove_file(response):
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print("Error deleting temp file:", e)
        return response

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename
    )