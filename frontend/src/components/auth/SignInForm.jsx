import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useSignIn } from "@clerk/react"
import { setRemember } from "@/lib/remember"

const BACKEND_URL = import.meta.env.REACT_APP_BACKEND_URL

const errText = (error) => error?.errors?.[0]?.longMessage || error?.errors?.[0]?.message || error?.message || "Sign-in failed. Try again."

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" width="20" height="20">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

export default function SignInForm() {
  const { signIn } = useSignIn()
  const navigate = useNavigate()
  const [id, setId] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [remember, setRememberOn] = useState(true)
  const [step, setStep] = useState("login")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const finish = async () => {
    setRemember(remember)
    const { error } = await signIn.finalize({ navigate: () => navigate("/") })
    if (error) throw error
  }

  const afterFirstFactor = async () => {
    if (signIn.status === "complete") return finish()
    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const { error } = await signIn.mfa.sendEmailCode()
      if (error) throw error
      return setStep("code")
    }
    throw new Error("Sign-in needs another step. Use 'Forgot password?' to continue.")
  }

  const run = (fn) => async (e) => {
    e.preventDefault()
    setBusy(true); setError("")
    try { await fn() } catch (err) { setError(errText(err)) }
    setBusy(false)
  }

  const submitLogin = run(async () => {
    const ident = id.trim()
    if (ident.includes("@")) {
      const { error } = await signIn.password({ identifier: ident, password })
      if (error) throw error
      return afterFirstFactor()
    }
    const res = await fetch(`${BACKEND_URL}/api/auth/username-sign-in`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: ident, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.detail || "Sign-in failed. Try again.")
    const { error } = await signIn.ticket({ ticket: data.ticket })
    if (error) throw error
    return afterFirstFactor()
  })

  const submitCode = run(async () => {
    const { error } = await signIn.mfa.verifyEmailCode({ code: code.trim() })
    if (error) throw error
    return afterFirstFactor()
  })

  const google = run(async () => {
    const { error } = await signIn.sso({ strategy: "oauth_google", redirectUrl: "/", redirectCallbackUrl: "/sign-in/sso-callback" })
    if (error) throw error
  })

  if (step === "code") return (
    <form className="nm-signin" onSubmit={submitCode} data-testid="signin-code-form">
      <h2>Check your email</h2>
      <p className="nm-signin-note">We sent a 6-digit code to confirm it's you.</p>
      <label htmlFor="signin-code">Verification code</label>
      <input id="signin-code" inputMode="numeric" autoComplete="one-time-code" value={code}
        onChange={(e) => setCode(e.target.value)} required data-testid="signin-code-input" />
      {error && <p className="nm-signin-error" role="alert" data-testid="signin-error">{error}</p>}
      <button type="submit" disabled={busy} data-testid="signin-code-submit">{busy ? "Checking…" : "Verify and sign in"}</button>
      <button type="button" className="text-link nm-signin-back" onClick={() => { setStep("login"); setCode("") }} data-testid="signin-code-back">Use a different account</button>
    </form>
  )

  return (
    <form className="nm-signin" onSubmit={submitLogin} data-testid="signin-form">
      <h2>Sign in</h2>
      <label htmlFor="signin-identifier">Email or username</label>
      <input id="signin-identifier" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)}
        placeholder="you@example.com or username" required data-testid="signin-identifier-input" />
      <div className="nm-signin-row">
        <label htmlFor="signin-password">Password</label>
        <Link to="/sign-in/reset" className="nm-signin-forgot" data-testid="signin-forgot-link">Forgot password?</Link>
      </div>
      <div className="nm-pw">
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
      </label>
      {error && <p className="nm-signin-error" role="alert" data-testid="signin-error">{error}</p>}
      <div id="clerk-captcha" />
      <button type="submit" disabled={busy || !signIn} data-testid="signin-submit-button">{busy ? "Signing in…" : "Sign In"}</button>
      <div className="nm-signin-divider"><span>or</span></div>
      <button type="button" className="nm-social" onClick={google} disabled={busy || !signIn} data-testid="signin-google-button">
        <GoogleMark />Continue with Google
      </button>
    </form>
  )
}
