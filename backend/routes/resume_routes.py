from flask import Blueprint, request, jsonify
import logging

from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.db import db
from backend.models.resume_model import Resume
from backend.services.resume_parser import get_resume_text
from backend.database.chroma_db import store_resume_embeddings, delete_resume_embeddings
from backend.services.resume_check import validate_resume
from backend.services.resume_extractor import extract_resume_details
from backend.ai.llm_client import get_llm, handle_llm_error

resume_bp = Blueprint("resume", __name__)


@resume_bp.route("/upload_resume", methods=["POST"])
@jwt_required()
def upload_resume():
    user_id  = int(get_jwt_identity())
    data     = request.get_json() or {}
    file_b64 = data.get("file")
    file_name = data.get("file_name", "resume.pdf")

    if not file_b64:
        return {"error": "No file provided"}, 400

    try:
        # Parse file → list of text strings
        chunks = get_resume_text(file_b64, file_name)

        if not chunks:
            return {"error": "Could not extract text from the file"}, 400

        # 1. Read chunks and validate
        llm = get_llm(data)
        sample_text = " ".join(chunks)[:2000]
        if not validate_resume(llm, sample_text):
            return {"error": "Uploaded file does not appear to be a resume"}, 400

        # 2. Prepare new data
        full_text = "\n\n".join(chunks)
        new_resume = Resume(
            user_id=user_id,
            filename=file_name,
            text_chunk=full_text
        )

        # 3. Handle existing resume replacement
        existing = Resume.query.filter_by(user_id=user_id).first()
        
        # 4. Store NEW embeddings and update DB in one go
        try:
            # We clear and re-store in the same user-specific collection
            delete_resume_embeddings(user_id)
            api_key = data.get('api_key') if data.get('mode') == 'user' else None
            collection_name = store_resume_embeddings(chunks, user_id, api_key=api_key)
            
            new_resume.chroma_collection = collection_name
            
            if existing:
                db.session.delete(existing)
            
            db.session.add(new_resume)
            db.session.commit()
            
            return jsonify({"message": "Resume uploaded successfully"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"Failed to store resume: {str(e)}"}), 500

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": handle_llm_error(e)}), 500


@resume_bp.route("/get_resume", methods=["GET"])
@jwt_required()
def get_resume():
    user_id = int(get_jwt_identity())
    resume  = Resume.query.filter_by(user_id=user_id).first()

    if not resume:
        return {"resume_exists": False}

    return {
        "resume_exists": True,
        "resume_name": resume.filename,
        "created_at": resume.created_at.strftime("%d/%m/%Y %H:%M:%S")
    }


@resume_bp.route("/delete_resume", methods=["DELETE"])
@jwt_required()
def delete_resume():
    user_id = int(get_jwt_identity())
    resume  = Resume.query.filter_by(user_id=user_id).first()

    if not resume:
        return {"error": "Resume not found"}, 404

    try:
        delete_resume_embeddings(user_id)
        db.session.delete(resume)
        db.session.commit()
        return {"message": "Resume deleted"}
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting resume: {e}")
        return {"error": "Failed to delete resume. Please try again."}, 500


@resume_bp.route("/get_resume_details", methods=["POST"])
@jwt_required()
def get_resume_details():
    user_id = int(get_jwt_identity())
    resume = Resume.query.filter_by(user_id=user_id).first()
    
    if not resume:
        return {"error": "Resume not found. Please upload a resume first."}, 404
        
    data = request.get_json() or {}
    force_refresh = data.get("force_refresh", False)
    
    if resume.structured_details and not force_refresh:
        details = resume.structured_details
        if isinstance(details, str):
            import json
            try:
                details = json.loads(details)
            except Exception:
                details = {}
        return jsonify(details)
        
    try:
        llm = get_llm(llm_config)
        details = extract_resume_details(llm, resume.text_chunk)
        
        resume.structured_details = details
        db.session.commit()
        
        return jsonify(details)
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error extracting resume details: {e}")
        return {"error": "Failed to extract details from resume."}, 500


@resume_bp.route("/update_resume_details", methods=["POST"])
@jwt_required()
def update_resume_details():
    user_id = int(get_jwt_identity())
    resume = Resume.query.filter_by(user_id=user_id).first()
    
    if not resume:
        return {"error": "Resume record not found."}, 404
        
    data = request.get_json()
    if not data:
        return {"error": "No data provided."}, 400
        
    try:
        current_details = resume.structured_details or {}
        if isinstance(current_details, str):
            import json
            try:
                current_details = json.loads(current_details)
            except Exception:
                current_details = {}
            
        current = dict(current_details)
        current.update(data)
        resume.structured_details = current
        db.session.commit()
        
        return jsonify({"message": "Details updated successfully", "details": current})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating resume details: {e}")
        return {"error": "Failed to update details."}, 500