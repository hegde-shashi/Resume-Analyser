from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.db import db
from backend.models.resume_model import Resume
from backend.services.resume_parser import get_resume_text
from backend.database.chroma_db import store_resume_embeddings, delete_resume_embeddings
from backend.services.resume_check import validate_resume
from backend.ai.llm_client import get_llm

resume_bp = Blueprint("resume", __name__)


@resume_bp.route("/upload_resume", methods=["POST"])
@jwt_required()
def upload_resume():
    data     = request.get_json()
    user_id  = get_jwt_identity()
    file_b64 = data.get("file")
    file_name = data.get("file_name", "resume.pdf")

    if not file_b64:
        return {"error": "No file provided"}, 400

    try:
        # Parse file → list of text strings
        chunks = get_resume_text(file_b64, file_name)

        if not chunks:
            return {"error": "Could not extract text from the file"}, 400

        # Validate it's a resume (pass first 2000 chars as a string)
        llm = get_llm(data)
        sample_text = " ".join(chunks)[:2000]
        if not validate_resume(llm, sample_text):
            return {"error": "Uploaded file does not appear to be a resume"}, 400

        # Remove existing resume
        existing = Resume.query.filter_by(user_id=user_id).first()
        if existing:
            delete_resume_embeddings(user_id)
            db.session.delete(existing)
            db.session.commit()

        # Store embeddings
        collection_name = store_resume_embeddings(chunks, user_id)

        # Save to DB
        full_text = "\n\n".join(chunks)
        resume = Resume(
            user_id=user_id,
            filename=file_name,
            chroma_collection=collection_name,
            text_chunk=full_text
        )
        db.session.add(resume)
        db.session.commit()

        return jsonify({"message": "Resume uploaded successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@resume_bp.route("/get_resume", methods=["GET"])
@jwt_required()
def get_resume():
    user_id = get_jwt_identity()
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
    user_id = get_jwt_identity()
    resume  = Resume.query.filter_by(user_id=user_id).first()

    if not resume:
        return {"error": "Resume not found"}, 404

    delete_resume_embeddings(user_id)
    db.session.delete(resume)
    db.session.commit()

    return {"message": "Resume deleted"}