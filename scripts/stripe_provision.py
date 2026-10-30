import json, os, urllib.request, urllib.error, stripe
base = os.environ.get("INTEGRATION_PROXY_URL") or "https://integrations.emergentagent.com"
job_id = "ca449499-41e9-4927-b9a7-f22c66d85807"
key = "sk-emergent-301D48c4c7dA4Ee55E"
req = urllib.request.Request(base + "/stripe/sandboxes", data=json.dumps({"job_id": job_id}).encode(),
    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req) as r: sb = json.load(r)
except urllib.error.HTTPError as e:
    print("FAIL", e.code, e.read().decode()); raise SystemExit(1)
stripe.api_key = sb["sandbox_secret_key"]
country = stripe.Account.retrieve()["country"]
print(json.dumps({"country": country, "onboarding_url": sb.get("onboarding_url"), "account": sb.get("sandbox_account_id")}))
env = "/app/backend/.env"
cur = open(env).read()
add = {"STRIPE_SECRET_KEY": sb["sandbox_secret_key"], "STRIPE_PUBLISHABLE_KEY": sb["sandbox_publishable_key"],
       "STRIPE_ACCOUNT_ID": sb["sandbox_account_id"], "STRIPE_WEBHOOK_SECRET": sb["preview_webhook_secret"], "STRIPE_MODE": "test"}
lines = [l for l in cur.splitlines() if l.split("=",1)[0] not in add]
lines += [f"{k}={v}" for k, v in add.items()]
open(env, "w").write("\n".join(lines) + "\n")
