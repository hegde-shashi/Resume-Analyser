from flask import Flask
from backend.database.db import db
from backend.config import DB_USER, DB_HOST, DB_PASSWORD, DB_NAME, JWT_SECRET_KEY
from flask_jwt_extended import JWTManager
from backend.routes.auth_routes import auth_bp
from backend.routes.job_routes import job_bp
from backend.routes.resume_routes import resume_bp
from backend.routes.analysis_routes import analysis_bp
from backend.routes.settings_routes import settings_bp

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
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

if __name__ == "__main__":
    app.run(debug=True, port=5001)