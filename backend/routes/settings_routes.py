from flask import Blueprint, request, jsonify
from backend.ai.llm_client import check_llm
from backend.config import GOOGLE_API_KEY

settings_bp = Blueprint("settings", __name__)

@settings_bp.route("/check_models", methods=["POST"])
def check_models():
    data = request.get_json() or {}
    mode    = data.get("mode", "default")
    api_key = data.get("api_key") if mode == "user" else GOOGLE_API_KEY

    if not api_key:
        return jsonify({"error": "No API key provided"}), 400

    try:
        models = check_llm(api_key)
        return jsonify({"models": models})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
