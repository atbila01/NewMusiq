import os
os.chdir("/app/frontend/src")


def ed(p, pairs):
    s = open(p).read()
    for a, b in pairs:
        assert a in s, (p, a[:60])
        s = s.replace(a, b, 1)
    open(p, "w").write(s)


ed("App.jsx", [
    ('import { ProfileProvider, useProfile } from "@/lib/profile"', 'import { ProfileProvider, useProfile } from "@/lib/profile"\nimport { RememberGuard } from "@/lib/remember"'),
    ('        <ProfileProvider>\n', '        <RememberGuard />\n        <ProfileProvider>\n'),
    ('if (!profile.plan_level && !profile.browsing) return', 'if (!profile.plan_level) return'),
])
ed("components/PlanPicker.jsx", [
    ('export default function PlanPicker({ value, onChange, currentPlan, allowBrowse = true }) {', 'export default function PlanPicker({ value, onChange, currentPlan }) {'),
    ('''      {allowBrowse && (
        <button type="button" className={`browse-option ${value === "browse" ? "selected" : ""}`}
          aria-pressed={value === "browse"} data-testid="plan-browse-option" onClick={() => onChange("browse")}>
          No thanks, I'm just browsing
          <span>Explore the globe for free. No music, releases or comments.</span>
        </button>
      )}
''', ''),
])
ed("components/Subscribe.jsx", [
    ('''    if (plan === "browse") {
      try {
        await api("/me/browse", { method: "POST" })
        await refresh()
        navigate("/", { replace: true })
      } catch (e) { setStatus(e.message); setBusy(false) }
      return
    }
''', ''),
    ('backTo={current || profile?.browsing ? "/" : null}', 'backTo={current ? "/" : null}'),
    (' allowBrowse={!current}', ''),
    ('{busy ? "One moment..." : plan === "browse" ? "Start Browsing" : "Continue to Payment"}', '{busy ? "One moment..." : "Continue to Payment"}'),
])
ed("components/ProfileSetup.jsx", [
    ('const needsPlan = !profile?.plan_level && !profile?.browsing', 'const needsPlan = !profile?.plan_level'),
    ('''      if (needsPlan && plan === "browse") {
        await api("/me/browse", { method: "POST" })
        await refresh()
        navigate("/", { replace: true })
        return
      }
''', ''),
    ('(plan === "browse" ? "Start Browsing" : "Continue to Payment")', '"Continue to Payment"'),
])
ed("lib/profile.jsx", [
    ('export const getSavedPlan = () => localStorage.getItem(PLAN_KEY) || "standard"',
     'export const getSavedPlan = () => ["standard", "pro", "artist"].find((p) => p === localStorage.getItem(PLAN_KEY)) || "standard"'),
])
ed("components/screens/SettingsScreen.jsx", [('"Browsing (free)"', '"No plan"')])
ed("components/screens/ProfileScreen.jsx", [('profile?.plan_name || "Browsing"', 'profile?.plan_name || "No plan"')])
ed("components/Sidebar.jsx", [('(profile?.browsing ? "Browsing" : "Listener")', '"Listener"')])
ed("components/auth/SignInForm.jsx", [
    ('import { useSignIn } from "@clerk/react"', 'import { useSignIn } from "@clerk/react"\nimport { setRemember } from "@/lib/remember"'),
    ('  const [code, setCode] = useState("")', '  const [code, setCode] = useState("")\n  const [showPw, setShowPw] = useState(false)\n  const [remember, setRememberOn] = useState(true)'),
    ('    const { error } = await signIn.finalize({ navigate: () => navigate("/") })',
     '    setRemember(remember)\n    const { error } = await signIn.finalize({ navigate: () => navigate("/") })'),
    ('''      <input id="signin-password" type="password" autoComplete="current-password" value={password}
        onChange={(e) => setPassword(e.target.value)} required data-testid="signin-password-input" />''',
     '''      <div className="nm-pw">
        <input id="signin-password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} required data-testid="signin-password-input" />
        <button type="button" className="nm-pw-eye" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw}
          aria-label={showPw ? "Hide password" : "Show password"} data-testid="signin-password-toggle">
          <EyeIcon off={showPw} />
        </button>
      </div>
      <label className="nm-remember" data-testid="signin-remember-label">
        <input type="checkbox" checked={remember} onChange={(e) => setRememberOn(e.target.checked)} data-testid="signin-remember-checkbox" />
        <span>Remember me</span>
      </label>'''),
    ('export default function SignInForm() {', '''function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

export default function SignInForm() {'''),
])
with open("extra.css", "a") as f:
    f.write('''.nm-pw { position: relative; }
.nm-pw input { width: 100%; padding-right: 48px; }
.nm-signin .nm-pw-eye { position: absolute; top: 4px; right: 4px; display: grid; place-items: center; width: 38px; height: 38px; margin: 0; padding: 0; color: #e9dcc6; background: transparent; border: 0; border-radius: 8px; box-shadow: none; }
.nm-signin .nm-pw-eye:hover { color: #f2d689; background: rgb(255 255 255 / 6%); transform: none; }
.nm-signin .nm-remember { display: flex; align-items: center; gap: 10px; margin: -4px 0 16px; cursor: pointer; text-transform: none; }
.nm-signin .nm-remember input { width: 18px; height: 18px; margin: 0; accent-color: #e3b14c; }
''')
p = "/app/backend/server.py"
s = open(p).read()
s = s.replace('browsing=bool(doc.get("browsing")) and not level,', 'browsing=False,')
a = s.index('@api_router.post("/me/browse"')
b = s.index('return profile_out(doc, user["user_id"])', a) + len('return profile_out(doc, user["user_id"])\n')
s = s[:a] + s[b:]
open(p, "w").write(s)
print("edits ok")
