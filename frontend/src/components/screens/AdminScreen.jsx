import { useEffect, useState } from "react"
import Screen from "./Screen"
import { Comments, Users } from "../AdminPage"
import { useApi, useProfile } from "@/lib/profile"

const TABS = ["Comments", "Feedback", "Subscriptions", "Content", "People"]

function useList(path) {
  const api = useApi()
  const [data, setData] = useState(null)
  const load = () => api(path).then((r) => r.json()).then(setData).catch(() => setData([]))
  useEffect(() => { load() }, [path]) // eslint-disable-line react-hooks/exhaustive-deps
  return [data, load, api]
}

function Feedback() {
  const [items, load, api] = useList("/admin/feedback")
  const set = async (id, status) => {
    await api(`/admin/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    load()
  }
  return (
    <section className="admin-card" data-testid="admin-feedback">
      <h2>Contact Us messages</h2>
      {!items ? <p className="rp-muted">Loading…</p> : items.length === 0 ? <p className="rp-muted">No messages yet.</p> : items.map((f) => (
        <article className="admin-row" key={f.id} data-testid="admin-feedback-row">
          <div>
            <strong>{f.topic}</strong> <span>{f.username} · {f.email} · {new Date(f.created_at).toLocaleDateString()}</span>
            <p>{f.message}</p>
          </div>
          <button type="button" className={f.status === "open" ? "" : "ghost"} onClick={() => set(f.id, f.status === "open" ? "resolved" : "open")}
            data-testid={`admin-feedback-toggle-${f.id}`}>{f.status === "open" ? "Mark resolved" : "Reopen"}</button>
        </article>
      ))}
    </section>
  )
}

function Subscriptions() {
  const [data] = useList("/admin/subscriptions")
  if (!data) return <p className="rp-muted">Loading…</p>
  return (
    <section className="admin-card" data-testid="admin-subscriptions">
      <h2>Subscriptions</h2>
      <div className="admin-stats">
        <div><strong data-testid="admin-mrr">${data.monthly_revenue?.toFixed(2)}</strong><span>Monthly revenue</span></div>
        {Object.entries(data.counts || {}).map(([k, v]) => <div key={k}><strong>{v}</strong><span>{k}</span></div>)}
      </div>
      {data.users?.map((u) => (
        <article className="admin-row" key={u.user_id} data-testid="admin-sub-row">
          <div><strong>{u.username || "(no username)"}</strong> <span>{u.email}</span></div>
          <span className="plan-pill">{u.plan_name}{u.subscription_status && u.plan ? ` · ${u.subscription_status}` : ""}</span>
        </article>
      ))}
    </section>
  )
}

function Content() {
  const [items, load, api] = useList("/admin/tracks")
  const toggle = async (t) => {
    await api(`/admin/tracks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: !t.is_deleted }) })
    load()
  }
  return (
    <section className="admin-card" data-testid="admin-content">
      <h2>Artist uploads</h2>
      {!items ? <p className="rp-muted">Loading…</p> : items.map((t) => (
        <article className="admin-row" key={t.id} data-testid="admin-track-row">
          <div>
            <strong>{t.title}</strong> <span>{t.artist_name} · {t.release_type === "album" ? `Album: ${t.album_title}` : "Single"} · {t.location}</span>
          </div>
          <button type="button" className={t.is_deleted ? "" : "ghost"} onClick={() => toggle(t)} data-testid={`admin-track-toggle-${t.id}`}>
            {t.is_deleted ? "Restore" : "Hide"}
          </button>
        </article>
      ))}
    </section>
  )
}

export default function AdminScreen() {
  const { role } = useProfile()
  const [tab, setTab] = useState("Comments")
  if (role !== "admin") return <Screen kicker="Admin" title="Admin" testId="admin-screen"><p className="rp-muted" data-testid="admin-denied">You don't have admin access.</p></Screen>
  const Panel = { Comments, Feedback, Subscriptions, Content, People: Users }[tab]
  return (
    <Screen kicker="Manage NewMusiq" title="Admin" testId="admin-screen">
      <div className="search-modes">
        {TABS.map((t) => <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)} data-testid={`admin-section-${t.toLowerCase()}`}>{t}</button>)}
      </div>
      <Panel />
    </Screen>
  )
}
