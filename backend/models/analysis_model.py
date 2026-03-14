from backend.database.db import db

class Analysis(db.Model):

    __tablename__ = "analysis"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Integer)
    matched_skills = db.Column(db.JSON)
    missing_skills = db.Column(db.JSON)
    suggestions = db.Column(db.JSON)
    evaluation_summary = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, server_default=db.func.now())