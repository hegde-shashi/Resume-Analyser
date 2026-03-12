# Apply SQLite3 monkey-patch for ChromaDB compatibility on older Linux environments (like Azure App Services)
import sys
try:
    import pysqlite3
    sys.modules["sqlite3"] = sys.modules.pop("pysqlite3")
except ImportError:
    pass

from flask import Flask
from backend.database.db import db
from backend.config import DB_USER, DB_HOST, DB_PASSWORD, DB_NAME, JWT_SECRET_KEY, PERSISTENT_DIR
import os
from datetime import timedelta
from flask_jwt_extended import JWTManager

from flask_cors import CORS
from backend.routes.auth_routes import auth_bp
from backend.routes.job_routes import job_bp
from backend.routes.resume_routes import resume_bp
from backend.routes.analysis_routes import analysis_bp
from backend.routes.settings_routes import settings_bp
from backend.routes.chat_routes import chat_bp
from backend.routes.mail_routes import mail_bp

app = Flask(__name__)

# Very important: Enable CORS so frontend domain can talk to backend domain!
CORS(app)

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
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=30)



db.init_app(app)

def check_migrations():
    """Ensure database schema is up to date on startup."""
    from sqlalchemy import inspect, text
    inspector = inspect(db.engine)
    
    # Check for missing columns in 'user' table
    if "user" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("user")]
        
        if "reset_token" not in columns:
            print("Migration: Adding reset_token to user table...")
            db.session.execute(text('ALTER TABLE "user" ADD COLUMN reset_token VARCHAR(255)'))
            db.session.commit()
            
        if "reset_token_expiry" not in columns:
            print("Migration: Adding reset_token_expiry to user table...")
            # Use TIMESTAMP for Postgres, will work for SQLite too
            db.session.execute(text('ALTER TABLE "user" ADD COLUMN reset_token_expiry TIMESTAMP'))
            db.session.commit()

with app.app_context():
    db.create_all()
    try:
        check_migrations()
    except Exception as e:
        print(f"Migration error: {e}")
        db.session.rollback()

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