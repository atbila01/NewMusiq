import { Link, useNavigate } from "react-router-dom"
import GlobeMark from "./GlobeMark"

export default function AuthLayout({ mode = "login", title, backTo, aside, footer, children }) {
  const navigate = useNavigate()
  const isCreate = mode === "create"
  const back = backTo === undefined ? (isCreate ? "/sign-in" : null) : backTo

  return (
    <main className={`login-page ${isCreate ? "create-mode" : ""} ${aside ? "with-aside" : ""}`} data-testid={`auth-page-${mode}`}>
      <section className="login-panel" aria-label="Account">
        {back && (
          <button className="account-back" type="button" data-testid="auth-back-button" onClick={() => navigate(back)}>
            <span aria-hidden="true" />
            Back
          </button>
        )}
        <div className="login-shell">
          <Link className="wordmark" to="/" aria-label="NewMusiq home" data-testid="auth-wordmark">NewMusiq</Link>
          <div className="form-block">
            <p className="eyebrow">Your music home</p>
            {title && <h1 data-testid="auth-title">{title}</h1>}
            <div className="clerk-slot">{children}</div>
            {footer}
          </div>
        </div>
      </section>
      <section className={`brand-panel ${aside ? "plans-panel" : ""}`} aria-label={aside ? "Subscription plans" : "Explore the world through music"}>
        {aside || (
          <>
            <GlobeMark />
            <p>Explore the World Through Music</p>
          </>
        )}
      </section>
    </main>
  )
}
