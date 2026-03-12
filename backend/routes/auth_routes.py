from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from backend.models.user_model import User
from backend.models.resume_model import Resume
from backend.models.job_model import Jobs
from backend.database.chroma_db import delete_resume_embeddings
from werkzeug.security import generate_password_hash, check_password_hash
from backend.database.db import db
from datetime import datetime, timedelta
from backend.config import FRONTEND_URL
import secrets


auth_bp = Blueprint("auth", __name__)

bcrypt = Bcrypt()

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    
    # If username not provided, use part of email
    username = data.get("username") or email.split('@')[0]

    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return {"error": "An account with this email already exists."}, 400

    if not password:
        return {"error": "Password is required."}, 400

    hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

    try:
        user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(user)
        db.session.commit()

        return {"message": "User created"}, 201
    except Exception as e:
        db.session.rollback()
        # Fallback error message
        return {"error": "Registration failed. This email might already be in use."}, 400


@auth_bp.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    user = User.query.filter_by(email=data["email"]).first()

    if not user:
        return {"error": "User not found"}, 404

    if not bcrypt.check_password_hash(user.password, data["password"]):
        return {"error": "Invalid password"}, 401

    token = create_access_token(identity=str(user.id))

    return {
        "token": token,
        "user_id": user.id,
        "username": user.username
    }


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    data = request.json

    old_password = data.get("old_password")
    new_password = data.get("new_password")

    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    if not bcrypt.check_password_hash(user.password, old_password):
        return jsonify({"error": "Old password incorrect"}), 400

    user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")
    # Clear reset token if they happened to have one
    user.reset_token = None
    user.reset_token_expiry = None

    db.session.commit()

    return jsonify({"message": "Password updated successfully"})


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():

    data = request.json
    email = data.get("email")

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    token = secrets.token_urlsafe(32)

    user.reset_token = token
    user.reset_token_expiry = datetime.utcnow() + timedelta(minutes=10)

    db.session.commit()

    reset_link = f"{FRONTEND_URL}/reset-password/{token}"

    return jsonify({
        "reset_link": reset_link
    })



@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():

    data = request.json
    token = data.get("token")
    new_password = data.get("password")

    user = User.query.filter_by(reset_token=token).first()

    if not user:
        return jsonify({"error": "Invalid token"}), 400

    if user.reset_token_expiry < datetime.utcnow():
        # clear token since it is no longer valid
        user.reset_token = None
        user.reset_token_expiry = None
        db.session.commit()
        return jsonify({"error": "Token expired"}), 400

    user.password = bcrypt.generate_password_hash(new_password).decode("utf-8")

    # clear token
    user.reset_token = None
    user.reset_token_expiry = None

    db.session.commit()

    return jsonify({
        "message": "Password reset successful",
        "token": create_access_token(identity=str(user.id)),
        "user_id": user.id,
        "username": user.username
    })


@auth_bp.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_user():

    user_id = get_jwt_identity()

    user = User.query.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    # Delete related data
    Resume.query.filter_by(user_id=user_id).delete()
    Jobs.query.filter_by(user_id=user_id).delete()
    delete_resume_embeddings(user_id)

    db.session.delete(user)
    db.session.commit()

    return jsonify({"message": "User and all related data deleted"})