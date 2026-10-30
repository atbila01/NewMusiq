import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useApi, useProfile } from "@/lib/profile"

const TABS = ["pending", "approved", "hidden"]
const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

export function Comments() {
  const api = useApi()
  const [tab, setTab] = useState("pending")
  const [items, setItems] = useState(null)

  const load = useCallback(() => {
    setItems(null)
    api(`/admin/comments?status=${tab}`).then((r) => r.json()).then(setItems).catch(() => setItems([]))
  }, [api, tab])
  useEffect(() => { load() }, [load])

  async function setStatus(id, status) {
    await api(`/admin/comments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    setItems((list) => list.filter((c) => c.id !== id))
  }

  return (
    <section className="admin-card" data-testid="admin-comments">
      <h2>Listener comments</h2>
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}>{t}</button>
        ))}
      </div>
      {items === null ? <p className="panel-text">Loading…</p> : items.length === 0 ? (
        <p className="panel-text" data-testid="admin-comments-empty">Nothing here.</p>
      ) : items.map((c) => (
        <article className="admin-row" key={c.id} data-testid="admin-comment-row">
          <div>
            <strong>{c.display_name}</strong> <span>{dateFmt.format(new Date(c.created_at))}</span>
            <p>{c.message}</p>
          </div>
          <div className="admin-actions">
            {tab !== "approved" && <button type="button" onClick={() => setStatus(c.id, "approved")} data-testid={`admin-approve-${c.id}`}>Approve</button>}
            {tab !== "hidden" && <button type="button" className="ghost" onClick={() => setStatus(c.id, "hidden")} data-testid={`admin-hide-${c.id}`}>Hide</button>}
          </div>
        </article>
      ))}
    </section>
  )
}

export function Users() {
  const api = useApi()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const load = useCallback(() => { api("/users").then((r) => r.json()).then(setData).catch(() => {}) }, [api])
  useEffect(() => { load() }, [load])

  async function change(userId, role) {
    setError("")
    try {
      await api(`/users/${userId}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) })
      load()
    } catch (e) { setError(e.message) }
  }

  return (
    <section className="admin-card" data-testid="admin-users">
      <h2>People</h2>
      {error && <p className="status">{error}</p>}
      {data?.users.map((u) => (
        <article className="admin-row" key={u.user_id} data-testid="admin-user-row">
          <div><strong>{u.username || "(no profile)"}</strong> <span>{u.email}</span></div>
          <select value={u.role} onChange={(e) => change(u.user_id, e.target.value)} data-testid={`admin-role-${u.user_id}`}>
            {data.roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </article>
      ))}
    </section>
  )
}

export default function AdminPage() {
  const { role } = useProfile()
  const navigate = useNavigate()
  return (
    <main className="admin-page" data-testid="admin-page">
      <header>
        <button type="button" className="account-back" onClick={() => navigate("/")} data-testid="admin-back"><span aria-hidden="true" />Back</button>
        <h1>Admin</h1>
      </header>
      {role === "admin" ? <><Comments /><Users /></> : (
        <p className="panel-text" data-testid="admin-denied">You don't have admin access.</p>
      )}
    </main>
  )
}
