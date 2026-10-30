import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useClerk } from "@clerk/react"
import Screen from "./Screen"
import AccountSettings from "../AccountSettings"
import { useApi, useProfile } from "@/lib/profile"

function Toggle({ id, label, hint, value, onChange }) {
  return (
    <div className="set-row">
      <div><strong>{label}</strong>{hint && <span>{hint}</span>}</div>
      <button type="button" role="switch" aria-checked={value} className={`switch ${value ? "on" : ""}`} data-testid={`setting-${id}`}
        onClick={() => onChange(id, !value)}><span /></button>
    </div>
  )
}

function Row({ title, hint, children }) {
  return <div className="set-row"><div><strong>{title}</strong>{hint && <span>{hint}</span>}</div>{children}</div>
}

export default function SettingsScreen() {
  const api = useApi()
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { profile } = useProfile()
  const [s, setS] = useState(null)
  const [saved, setSaved] = useState("")

  useEffect(() => { api("/me/settings").then((r) => r.json()).then(setS).catch(() => {}) }, [api])

  async function change(key, value) {
    setS((cur) => ({ ...cur, [key]: value }))
    try {
      await api("/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) })
      setSaved("Saved")
      setTimeout(() => setSaved(""), 1200)
    } catch { setSaved("Couldn't save") }
  }

  return (
    <Screen kicker="Preferences" title="Settings" testId="settings-screen" actions={<span className="saved-flag" data-testid="settings-saved">{saved}</span>}>
      {!s ? <p className="rp-muted">Loading…</p> : (
        <>
          <section className="set-group">
            <h2>Account</h2>
            <Row title={profile?.username} hint={profile?.email}>
              <button type="button" className="ghost-btn" onClick={() => navigate("/complete-profile")} data-testid="settings-edit-profile">Edit profile</button>
            </Row>
            <Row title="Plan" hint={profile?.plan_name || "No plan"}>
              <button type="button" className="ghost-btn" onClick={() => navigate("/subscribe")} data-testid="settings-manage-plan">Manage plan</button>
            </Row>
          </section>
          <section className="set-group">
            <h2>Playback</h2>
            <Toggle id="autoplay" label="Autoplay" hint="Keep playing similar music when your queue ends" value={s.autoplay} onChange={change} />
            <Row title="Crossfade" hint={`${s.crossfade} seconds`}>
              <input type="range" min="0" max="12" value={s.crossfade} onChange={(e) => change("crossfade", Number(e.target.value))} data-testid="setting-crossfade" />
            </Row>
            <Toggle id="normalize" label="Normalize volume" hint="Same volume level for all songs" value={s.normalize} onChange={change} />
            <Row title="Audio quality" hint="Higher quality uses more data">
              <select value={s.audio_quality} onChange={(e) => change("audio_quality", e.target.value)} data-testid="setting-audio-quality">
                {["low", "normal", "high", "very high"].map((q) => <option key={q} value={q}>{q[0].toUpperCase() + q.slice(1)}</option>)}
              </select>
            </Row>
            <Toggle id="explicit" label="Allow explicit content" hint="Turn off to skip songs marked explicit" value={s.explicit} onChange={change} />
          </section>
          <section className="set-group">
            <h2>Notifications</h2>
            <Toggle id="notify_releases" label="New releases" hint="From artists you like" value={s.notify_releases} onChange={change} />
            <Toggle id="notify_comments" label="Comment replies" value={s.notify_comments} onChange={change} />
            <Toggle id="notify_email" label="Email updates" value={s.notify_email} onChange={change} />
          </section>
          <section className="set-group">
            <h2>Privacy & social</h2>
            <Toggle id="private_session" label="Private session" hint="Hide what you're listening to" value={s.private_session} onChange={change} />
            <Toggle id="show_activity" label="Share listening activity" value={s.show_activity} onChange={change} />
          </section>
          <section className="set-group">
            <h2>Language</h2>
            <Row title="App language">
              <select value={s.language} onChange={(e) => change("language", e.target.value)} data-testid="setting-language">
                {["English", "Español", "Français", "Deutsch", "Português", "日本語"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </Row>
          </section>
          <section className="set-group">
            <h2>About</h2>
            <Row title="Version" hint="NewMusiq 1.0" />
            <Row title="Sign out">
              <button type="button" className="ghost-btn" onClick={() => signOut({ redirectUrl: "/sign-in" })} data-testid="settings-sign-out">Sign out</button>
            </Row>
            <AccountSettings />
          </section>
        </>
      )}
    </Screen>
  )
}
