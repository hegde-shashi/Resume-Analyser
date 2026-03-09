from flask import Blueprint, request, Response, stream_with_context, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.job_model import Jobs
from backend.models.resume_model import Resume
from backend.ai.llm_client import get_llm, handle_llm_error
from backend.ai.prompt_template import chat_prompt

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        llm = get_llm(data)

        job = Jobs.query.filter_by(
            id=data["job_id"],
            user_id=user_id
        ).first()

        resume = Resume.query.filter_by(user_id=user_id).first()
        history = data.get("history", [])

        prompt = chat_prompt(
            resume.text_chunk if resume else "No resume provided.",
            job,
            history,
            data["question"]
        )

        def generate():
            try:
                for chunk in llm.stream(prompt):
                    if chunk.content:
                        yield chunk.content
            except Exception as e:
                yield f"\n\n⚠️ {handle_llm_error(e)}"

        return Response(stream_with_context(generate()), mimetype='text/plain')
    except Exception as e:
        return jsonify({"error": handle_llm_error(e)}), 400