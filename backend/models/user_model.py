from backend.database.db import db

class User(db.Model):

    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    password = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    reset_token = db.Column(db.String(255), index=True)
    reset_token_expiry = db.Column(db.DateTime)