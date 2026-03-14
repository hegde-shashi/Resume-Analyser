from backend.database.db import db

class Jobs(db.Model):

    __tablename__ = "jobs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    job_link = db.Column(db.Text)
    job_title = db.Column(db.Text)
    job_id = db.Column(db.Text)
    company = db.Column(db.Text)
    location = db.Column(db.Text)
    experience_required = db.Column(db.Text)
    skills_required = db.Column(db.Text)
    preferred_skills = db.Column(db.Text)
    responsibilities = db.Column(db.Text)
    education = db.Column(db.Text)
    job_type = db.Column(db.Text)
    progress = db.Column(db.Text)
    is_parsed = db.Column(db.Boolean, default=False)
    error_message = db.Column(db.Text)
    retry_count = db.Column(db.Integer, default=0)
    raw_content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, server_default=db.func.now())