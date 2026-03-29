# Apply SQLite3 monkey-patch for ChromaDB compatibility on older Linux environments (like Azure App Services)
import sys
try:
    import pysqlite3
    sys.modules["sqlite3"] = sys.modules.pop("pysqlite3")
except ImportError:
    pass

from flask import Flask, jsonify
from backend.database.db import db
from backend.config import DB_USER, DB_HOST, DB_PASSWORD, DB_NAME, JWT_SECRET_KEY, PERSISTENT_DIR
import os
from datetime import timedelta
from flask_jwt_extended import JWTManager
import threading
from backend.services.job_processor import process_pending_jobs

from flask_cors import CORS
from backend.routes.auth_routes import auth_bp
from backend.routes.job_routes import job_bp
from backend.routes.resume_routes import resume_bp
from backend.routes.analysis_routes import analysis_bp
from backend.routes.settings_routes import settings_bp
from backend.routes.chat_routes import chat_bp
from backend.routes.mail_routes import mail_bp
from backend.routes.resume_generate_route import resume_gen_bp

app = Flask(__name__)
print("App Start - Version 1.0.3 - Migration Fix")


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
    
    print("Database Migration: STARTING...")
    
    # helper for specific table migrations
    def safe_add_column(table_name, col_name, col_type_sql):
        try:
            if table_name in inspector.get_table_names():
                columns_data = inspector.get_columns(table_name)
                columns = [c["name"].lower() for c in columns_data]
                
                if col_name.lower() not in columns:
                    print(f"Migration: Column {col_name} MISSING from {table_name}. Attempting to add...")
                    # ALWAYS quote table name for safety against reserved words
                    quoted_table = f'"{table_name}"'
                    db.session.execute(text(f'ALTER TABLE {quoted_table} ADD COLUMN {col_name} {col_type_sql}'))
                    db.session.commit()
                    print(f"Migration SUCCESS: Added {col_name} to {table_name}")
                else:
                    # Column already exists, log it occasionally or ignore
                    pass
            else:
                print(f"Migration Warning: Table {table_name} not found in database.")
        except Exception as e:
            print(f"Migration Error on {table_name}.{col_name}: {e}")
            db.session.rollback()

    # User table migrations
    safe_add_column("user", "reset_token", "VARCHAR(255)")
    safe_add_column("user", "reset_token_expiry", "TIMESTAMP")

    # Jobs table migrations
    safe_add_column("jobs", "is_parsed", "BOOLEAN DEFAULT FALSE")
    safe_add_column("jobs", "raw_content", "TEXT")
    safe_add_column("jobs", "error_message", "TEXT")
    safe_add_column("jobs", "retry_count", "INTEGER DEFAULT 0")

    # Resume table migrations
    safe_add_column("resume", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    safe_add_column("resume", "structured_details", "TEXT")

    # Analysis table migrations (CRITICAL FIX)
    safe_add_column("analysis", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")

    # Column type updates (mostly for Postgres)
    if "jobs" in inspector.get_table_names():
        for col in ["job_title", "job_id", "company", "location", "job_type", "progress", "experience_required"]:
            try:
                if "postgresql" in str(db.engine.url):
                    db.session.execute(text(f'ALTER TABLE jobs ALTER COLUMN "{col}" TYPE TEXT'))
                    db.session.commit()
            except Exception as e:
                pass # Ignore if it fails on SQLite which doesn't support ALTER COLUMN

    # Cleanup orphaned records
    try:
        if "analysis" in inspector.get_table_names() and "jobs" in inspector.get_table_names():
            db.session.execute(text('DELETE FROM "analysis" WHERE job_id NOT IN (SELECT id FROM "jobs")'))
            db.session.commit()
    except Exception as e:
        print(f"Cleanup error: {e}")
        db.session.rollback()

    print("Database Migration: FINISHED.")



with app.app_context():
    # EXPLICIT MODEL IMPORTS - Essential for db.create_all() to see them!
    from backend.models.user_model import User
    from backend.models.job_model import Jobs
    from backend.models.resume_model import Resume
    from backend.models.analysis_model import Analysis

    # NUCLEAR OPTION: Recreate database if environment variable is set
    if os.environ.get("RECREATE_DB") == "true":
        print("!!! WARNING: RECREATE_DB is TRUE. Dropping and recreating all tables... !!!")
        try:
            db.drop_all()
            db.create_all()
            print("!!! Database tables RECREATED successfully from latest models !!!")
        except Exception as e:
            print(f"Failed to recreate database: {e}")
            db.session.rollback()
    else:
        # Standard startup: Ensure tables exist
        db.create_all()
        try:
            check_migrations()
        except Exception as e:
            print(f"Global Migration system error: {e}")
            db.session.rollback()
    
    # FINAL VERIFICATION LOG (Visible in Azure logs)
    try:
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        if "analysis" in inspector.get_table_names():
            cols = [c["name"] for c in inspector.get_columns("analysis")]
            print(f"Database Schema Verified: Table 'analysis' has columns: {cols}")
    except Exception:
        pass

jwt = JWTManager(app)


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    """
    Automatic user verification on every protected request.
    If the user has been deleted from the DB, this returns None,
    which triggers a 401 Unauthorized automatically.
    """
    from backend.models.user_model import User
    try:
        identity = jwt_data["sub"]
        print(f"DEBUG: Authenticating user ID: {identity}")
        user = db.session.get(User, int(identity))
        if not user:
            print(f"DEBUG: User ID {identity} not found in DB!")
            logging.warning(f"JWT identity {identity} not found in database.")
        return user
    except Exception as e:
        print(f"DEBUG: Auth error: {e}")
        return None


@jwt.unauthorized_loader
@jwt.invalid_token_loader
def unauthorized_callback(error_string):
    """Return JSON for unauthorized/invalid requests so frontend can log out."""
    print(f"DEBUG: Denying access. Reason: {error_string}")
    return jsonify({"error": "Unauthorized", "details": str(error_string)}), 401

app.register_blueprint(auth_bp)
app.register_blueprint(job_bp)
app.register_blueprint(resume_bp)
app.register_blueprint(analysis_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(mail_bp)
app.register_blueprint(resume_gen_bp)


if __name__ == "__main__":
    import os
    # Start the background worker thread only in the main process (not the reloader child)
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        worker = threading.Thread(target=process_pending_jobs, args=(app,), daemon=True)
        worker.start()
        print("Background worker started.")
        
    app.run(debug=True, port=5001, use_reloader=True)