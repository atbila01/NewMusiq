import { useState } from "react"
import { useClerk } from "@clerk/react"
import AuthLayout from "./AuthLayout"
import PlanPicker from "./PlanPicker"
import { useNavigate } from "react-router-dom"
import { getSavedPlan, savePlan, useApi, useCheckout, useProfile } from "@/lib/profile"

export default function Subscribe() {
  const { profile, refresh } = useProfile()
  const api = useApi()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const checkout = useCheckout()
  const current = profile?.plan || null
  const [plan, setPlan] = useState(() => current || getSavedPlan())
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const choose = (p) => { setPlan(p); savePlan(p); setStatus("") }

  async function go() {
    if (plan === current) return setStatus("That's already your plan.")
    setBusy(true)
    setStatus("Taking you to secure checkout...")
    try { await checkout(plan) } catch (e) { setStatus(e.message); setBusy(false) }
  }

  return (
    <AuthLayout mode="create" title={current ? "Change Your Plan" : "Start Listening"} backTo={current ? "/" : null}
      aside={<PlanPicker value={plan} onChange={choose} currentPlan={current} />}>
      <div className="subscribe-box" data-testid="subscribe-box">
        <p className="subscribe-copy">
          {current
            ? <>You're on <strong data-testid="subscribe-current-plan">{profile.plan_name}</strong>. Pick a new plan — your old subscription is cancelled once the new one is paid.</>
            : <>To use NewMusiq you need at least the <strong>Standard Listener</strong> plan. Pick a plan on the right to continue.</>}
        </p>
        <button type="button" disabled={busy} onClick={go} data-testid="subscribe-continue-button">
          {busy ? "One moment..." : "Continue to Payment"}
        </button>
        <p className="status" aria-live="polite" data-testid="subscribe-status">{status}</p>
        {!current && (
          <p className="create-account">
            <button type="button" className="text-link" data-testid="subscribe-sign-out"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}>Sign out</button>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}
