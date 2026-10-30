import os, json, sys, urllib.request, urllib.error
from dotenv import load_dotenv; load_dotenv("/app/backend/.env")
SK = os.environ["CLERK_SECRET_KEY"]
def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))
email = sys.argv[1] if len(sys.argv) > 1 else "listener+clerk_test@example.com"
found = bapi("/users?email_address=" + urllib.request.quote(email), method="GET")
user = found[0] if found else bapi("/users", {"email_address": [email], "password": "Test-pass-12345!", "skip_password_checks": True})
session = bapi("/sessions", {"user_id": user["id"]})
token = bapi(f"/sessions/{session['id']}/tokens", {"expires_in_seconds": 3600})["jwt"]
ticket = bapi("/sign_in_tokens", {"user_id": user["id"], "expires_in_seconds": 3600})["token"]
print(json.dumps({"user_id": user["id"], "token": token, "ticket": ticket}))
