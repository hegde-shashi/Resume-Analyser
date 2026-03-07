from flask import Flask
from backend.routes.job_routes import job_bp
from backend.database.db import db
from backend.config import DB_USER, DB_HOST, DB_PASSWORD, DB_NAME

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

with app.app_context():
    db.create_all()

app.register_blueprint(job_bp)

if __name__ == "__main__":
    app.run(debug=True)