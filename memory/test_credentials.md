# Test Credentials (Clerk dev instance, preview only)

- Test user (Artist plan + admin role set directly in preview DB): listener+clerk_test@example.com / Test-pass-12345!  username "alexmorgan"
- Browsing test account: newbie+clerk_test@example.com / Test-pass-12345! (username "newbie", no plan -> lands on /subscribe; browsing mode removed)
- Any `+clerk_test` email signing up gets verification code `424242` (no real email sent).
- Headless browsers are blocked by Clerk bot protection for password sign-in/sign-up. Use a sign-in ticket instead:
  `/root/.venv/bin/python /app/scripts/clerk_test_user.py [email]` -> prints {user_id, token (API bearer, 1h), ticket}
  Open `<preview_url>/sign-in?__clerk_ticket=<ticket>` (tickets are single-use).
- Set a plan without paying (test only): mongosh newmusiq --eval 'db.profiles.updateOne({user_id:"<id>"},{$set:{plan:"standard|pro|artist"}})'
- Stripe test card: 4242 4242 4242 4242, any future expiry, any CVC.

- Username sign-in works on /sign-in form: alexmorgan / Test-pass-12345! (headless OK via username path)
