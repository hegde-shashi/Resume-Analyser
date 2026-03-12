from dotenv import load_dotenv
import os

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
JWT_SECRET_KEY = os.getenv("JWT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL")

# Define persistent storage location
# Azure App Service sets WEBSITE_SITE_NAME automatically. /home is the persistent network share.
IS_AZURE = os.getenv("WEBSITE_SITE_NAME") is not None
PERSISTENT_DIR = "/home/data" if IS_AZURE else "./local_data"

# Ensure the directory exists before any database tries to use it
os.makedirs(PERSISTENT_DIR, exist_ok=True)
