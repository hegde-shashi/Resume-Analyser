from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# # User Model
# class Users(db.Model):

#     id = db.Column(db.Integer, primary_key=True)
#     username = db.Column(db.String(100))
#     email = db.Column(db.String(120), unique=True)
#     password = db.Column(db.String(200))


# # Resume Model
# class Resume(db.Model):

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer)
#     filename = db.Column(db.String(200))
#     uploaded_at = db.Column(db.DateTime)



# # Job Model
# class Jobs(db.Model):

#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer)
#     job_link = db.Column(db.Text)
#     job_title = db.Column(db.String(200))
#     job_id = db.Column(db.String(30))
#     company = db.Column(db.String(200))
#     location = db.Column(db.String(200))
#     experience_required = db.Column(db.String)
#     skills_required = db.Column(db.Text)
#     preferred_skills = db.Column(db.Text)
#     responsibilities = db.Column(db.Text)
#     education = db.Column(db.Text)
#     job_type = db.Column(db.String(200))
#     progress = db.Column(db.String(50))
#     created_at = db.Column(db.DateTime)


# # Anylyse Model
# class Analysis(db.Model):

#     id = db.Column(db.Integer, primary_key=True)
#     job_id = db.Column(db.Integer)
#     score = db.Column(db.Integer)
#     matched_skills = db.Column(db.JSON)
#     missing_skills = db.Column(db.JSON)
#     suggestions = db.Column(db.JSON)
#     evaluation_summary = db.Column(db.JSON)

# with app.app_context():
#     db.create_all()