import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useClerk } from "@clerk/react"
import { useApi, useProfile } from "@/lib/profile"

export default function AccountSettings() {
  const navigate = useNavigate()
  const api = useApi()
  const { signOut } = useClerk()
  const { profile } = useProfile()
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    setStatus("Deleting your account...")
    try {
      await api("/me", { method: "DELETE" })
      localStorage.removeItem("nm_plan")
      await signOut({ redirectUrl: "/sign-in" })
    } catch (e) {
      setStatus(e.message)
      setBusy(false)
    }
  }

  return (
    <div className="account-settings" data-testid="account-settings">
      <section className="settings-card">
        <div>
          <p className="settings-label">Subscription</p>
          <strong data-testid="settings-current-plan">{profile?.plan_name || "No active plan"}</strong>
        </div>
        <button type="button" className="settings-button" onClick={() => navigate("/subscribe")} data-testid="settings-change-plan">
          Change subscription
        </button>
      </section>
      <section className="settings-card danger">
        <div>
          <p className="settings-label">Delete account</p>
          <span>Cancels your subscription and permanently removes your profile, comments and tracks.</span>
        </div>
        {!confirming ? (
          <button type="button" className="settings-button danger" onClick={() => setConfirming(true)} data-testid="settings-delete-account">
            Delete account
          </button>
        ) : (
          <div className="confirm-row">
            <button type="button" className="settings-button" disabled={busy} onClick={() => setConfirming(false)} data-testid="settings-delete-cancel">
              Keep account
            </button>
            <button type="button" className="settings-button danger solid" disabled={busy} onClick={remove} data-testid="settings-delete-confirm">
              {busy ? "Deleting..." : "Yes, delete forever"}
            </button>
          </div>
        )}
      </section>
      <p className="status" aria-live="polite" data-testid="settings-status">{status}</p>
    </div>
  )
}
