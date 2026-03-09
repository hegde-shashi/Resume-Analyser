from backend.database.db import db

class Jobs(db.Model):

    __tablename__ = "jobs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    job_link = db.Column(db.Text)
    job_title = db.Column(db.String(200))
    job_id = db.Column(db.String(30))
    company = db.Column(db.String(200))
    location = db.Column(db.String(200))
    experience_required = db.Column(db.String)
    skills_required = db.Column(db.Text)
    preferred_skills = db.Column(db.Text)
    responsibilities = db.Column(db.Text)
    education = db.Column(db.Text)
    job_type = db.Column(db.String(200))
    progress = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, server_default=db.func.now())