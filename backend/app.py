from flask import Flask
from backend.database.db import db
from backend.config import DB_USER, DB_HOST, DB_PASSWORD, DB_NAME, JWT_SECRET_KEY, PERSISTENT_DIR
import os
from flask_jwt_extended import JWTManager
from backend.routes.auth_routes import auth_bp
from backend.routes.job_routes import job_bp
from backend.routes.resume_routes import resume_bp
from backend.routes.analysis_routes import analysis_bp
from backend.routes.settings_routes import settings_bp
from backend.routes.chat_routes import chat_bp
from backend.routes.mail_routes import mail_bp

app = Flask(__name__)

# Intelligent Database Configuration
if DB_HOST and DB_USER and DB_PASSWORD and DB_NAME:
    # Use PostgreSQL if credentials are provided
    app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
else:
    # Fallback to local SQLite inside the persistent file storage
    sqlite_path = os.path.join(PERSISTENT_DIR, "database.sqlite")
    # For Windows/Linux pathing, use absolute path format required by SQLAlchemy
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.abspath(sqlite_path)}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = JWT_SECRET_KEY

db.init_app(app)

with app.app_context():
    db.create_all()

jwt = JWTManager(app)

app.register_blueprint(auth_bp)
app.register_blueprint(job_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(analysis_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(mail_bp)

if __name__ == "__main__":
    app.run(debug=True, port=5001)