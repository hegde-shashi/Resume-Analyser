from backend.database.db import db

class Resume(db.Model):

    __tablename__ = "resume"
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    filename = db.Column(db.String(200))
    uploaded_at = db.Column(db.DateTime)
    text_chunk = db.Column(db.Text)
    chroma_collection = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, server_default=db.func.now())