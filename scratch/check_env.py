import os
from dotenv import load_dotenv

load_dotenv()
jwt_secret = os.getenv("JWT_SECRET")
print(f"JWT_SECRET found: {jwt_secret is not None}")
if jwt_secret:
    print(f"JWT_SECRET length: {len(jwt_secret)}")
    print(f"JWT_SECRET starts/ends with quotes: {jwt_secret.startswith('\"') and jwt_secret.endswith('\"')}")
