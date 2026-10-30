import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import AuthLayout from "./AuthLayout"
import { API, useProfile } from "@/lib/profile"

export function PaymentSuccess() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refresh } = useProfile()
  const [state, setState] = useState("checking")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const sessionId = params.get("session_id")
    if (!sessionId) return setState("missing")
    let tries = 0
    const poll = async () => {
      tries += 1
      try {
        const data = await (await fetch(`${API}/payments/status/${sessionId}`)).json()
        if (data.payment_status === "paid") {
          setState("paid")
          await refresh().catch(() => {})
          return
        }
        if (data.status === "expired" || data.payment_status === "failed") return setState("failed")
      } catch {}
      if (tries >= 10) return setState("timeout")
      setTimeout(poll, 2000)
    }
    poll()
  }, [params, refresh])

  const copy = {
    checking: "Confirming your payment...",
    paid: "You're all set! Your plan is active.",
    failed: "That payment didn't go through. Please try again.",
    timeout: "We're still confirming your payment. Refresh in a moment.",
    missing: "We couldn't find that payment.",
  }[state]

  return (
    <AuthLayout mode="login" title="Payment" backTo={null}>
      <div className="subscribe-box" data-testid="payment-result">
        <p className={`payment-message ${state}`} data-testid="payment-status-message">{copy}</p>
        {state === "paid" && (
          <button type="button" onClick={() => navigate("/", { replace: true })} data-testid="payment-start-listening">
            Start Listening
          </button>
        )}
        {(state === "failed" || state === "missing" || state === "timeout") && (
          <button type="button" onClick={() => navigate("/subscribe")} data-testid="payment-back-to-plans">Back to plans</button>
        )}
      </div>
    </AuthLayout>
  )
}

export function PaymentCancel() {
  const navigate = useNavigate()
  return (
    <AuthLayout mode="login" title="Payment Cancelled" backTo={null}>
      <div className="subscribe-box" data-testid="payment-cancelled">
        <p className="payment-message">No charge was made. You can pick a plan whenever you're ready.</p>
        <button type="button" onClick={() => navigate("/subscribe")} data-testid="payment-cancel-back">Back to plans</button>
      </div>
    </AuthLayout>
  )
}
