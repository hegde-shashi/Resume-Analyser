from backend.database.db import db

class Resume(db.Model):

    __tablename__ = "resume"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    filename = db.Column(db.String(200))
    uploaded_at = db.Column(db.DateTime)