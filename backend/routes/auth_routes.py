from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
from backend.models.user_model import User
from backend.database.db import db

auth_bp = Blueprint("auth", __name__)

bcrypt = Bcrypt()

@auth_bp.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    hashed_password = bcrypt.generate_password_hash(
        data["password"]
    ).decode("utf-8")

    user = User(
        username=data["username"],
        email=data["email"],
        password=hashed_password
    )

    db.session.add(user)
    db.session.commit()

    return {"message": "User created"}


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