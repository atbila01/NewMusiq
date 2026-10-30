import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import Screen from "./Screen"
import SongItem from "../SongItem"
import { Avatar } from "../Sidebar"
import { useApi, useProfile } from "@/lib/profile"
import { keyOf, useLibrary } from "@/lib/library"

function PlaylistArt({ p }) {
  const api = useApi()
  const [url, setUrl] = useState("")
  useEffect(() => {
    if (!p.has_cover) return
    let made = ""
    api(`/me/playlists/${p.id}/cover`).then((r) => r.blob()).then((b) => { made = URL.createObjectURL(b); setUrl(made) }).catch(() => {})
    return () => made && URL.revokeObjectURL(made)
  }, [api, p.id, p.has_cover])
  const img = url || p.items?.[0]?.artwork
  return <span className="playlist-art">{img ? <img src={img} alt="" /> : "♪"}</span>
}

function CreatePlaylistModal({ onClose }) {
  const lib = useLibrary()
  const [name, setName] = useState("")
  const [cover, setCover] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return setErr("Give your playlist a name.")
    setBusy(true)
    try { await lib.createPlaylist(name.trim(), cover); onClose() } catch (x) { setErr(x.message); setBusy(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={create} data-testid="playlist-modal">
        <h2>New playlist</h2>
        <label className="file-pick big cover-pick playlist-cover-pick">
          {cover ? <img src={URL.createObjectURL(cover)} alt="Cover preview" /> : <span>Add a cover</span>}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] || null)} data-testid="playlist-cover-input" />
        </label>
        <label htmlFor="pl-name">Name</label>
        <input id="pl-name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} data-testid="playlist-name-input" />
        <p className="status">{err}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose} data-testid="playlist-modal-cancel">Cancel</button>
          <button type="submit" disabled={busy} data-testid="playlist-create-button">{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </div>
  )
}

function Playlists() {
  const lib = useLibrary()
  const [modal, setModal] = useState(false)
  const [open, setOpen] = useState(null)
  return (
    <section className="screen-section" data-testid="profile-playlists">
      <div className="section-head">
        <h2>Your playlists</h2>
        <button type="button" className="add-round" aria-label="Create playlist" onClick={() => setModal(true)} data-testid="playlist-add-button">+</button>
      </div>
      {modal && <CreatePlaylistModal onClose={() => setModal(false)} />}
      <div className="playlist-grid">
        <button type="button" className={`playlist-card ${open === "liked" ? "open" : ""}`} data-testid="playlist-liked"
          onClick={() => setOpen(open === "liked" ? null : "liked")}>
          <span className="playlist-art liked-art">♥</span>
          <strong>Liked Songs</strong><em>{lib.likes.length} songs</em>
        </button>
        {lib.playlists.map((p) => (
          <button key={p.id} type="button" className={`playlist-card ${open === p.id ? "open" : ""}`} data-testid={`playlist-${p.id}`}
            onClick={() => setOpen(open === p.id ? null : p.id)}>
            <PlaylistArt p={p} />
            <strong>{p.name}</strong><em>{p.items.length} songs</em>
          </button>
        ))}
      </div>
      {open === "liked" && (
        <div className="playlist-detail" data-testid="playlist-detail">
          <div className="playlist-detail-head"><h3>Liked Songs</h3></div>
          {lib.likes.length ? <div className="song-list">{lib.likes.map((l) => <SongItem key={l.key} item={l} />)}</div>
            : <p className="rp-muted">Tap the heart on any song to save it here.</p>}
        </div>
      )}
      {lib.playlists.filter((p) => p.id === open).map((p) => (
        <div key={p.id} className="playlist-detail" data-testid="playlist-detail">
          <div className="playlist-detail-head">
            <h3>{p.name}</h3>
            <button type="button" className="ghost-btn" onClick={() => { lib.deletePlaylist(p.id); setOpen(null) }} data-testid="playlist-delete">Delete playlist</button>
          </div>
          {p.items.length ? <div className="song-list">{p.items.map((it) => (
            <SongItem key={keyOf(it)} item={it} extra={<button type="button" className="ghost-btn small" onClick={() => lib.removeFromPlaylist(p.id, it)}>Remove</button>} />
          ))}</div> : <p className="rp-muted">Add songs with the + button on any song.</p>}
        </div>
      ))}
    </section>
  )
}

export default function ProfileScreen() {
  const api = useApi()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const lib = useLibrary()
  const [visits, setVisits] = useState([])
  const [comments, setComments] = useState([])

  useEffect(() => {
    api("/me/visits").then((r) => r.json()).then((d) => Array.isArray(d) && setVisits(d)).catch(() => {})
    api("/me/comments").then((r) => r.json()).then((d) => Array.isArray(d) && setComments(d)).catch(() => {})
  }, [api])

  return (
    <Screen kicker="Your library" title={profile?.username || "Profile"} testId="profile-screen"
      actions={<div className="profile-head-meta"><Avatar className="profile-avatar big" /><span>{profile?.plan_name || "No plan"}</span></div>}>
      <Playlists />
      <section className="screen-section" data-testid="profile-places">
        <h2>Most visited places</h2>
        {visits.length ? <div className="rp-chips">{visits.map((v) => (
          <button key={v.country + v.state} type="button" className="rp-chip" data-testid="profile-place"
            onClick={() => navigate("/", { state: { focus: v } })}>{v.state || v.country}<span>{v.count}</span></button>
        ))}</div> : <p className="rp-muted">Click places on the globe to explore their music.</p>}
      </section>
      <section className="screen-section" data-testid="profile-comments">
        <h2>Your comments</h2>
        {comments.length ? comments.map((c) => (
          <button key={c.id} type="button" className="comment-link" data-testid="profile-comment"
            onClick={() => navigate("/", { state: c.region ? { focus: c.region } : { openPlayer: true } })}>
            <strong>{c.region ? (c.region.state || c.region.country) : "Golden Moon · Maya Sol"}</strong>
            <span>{c.message}</span>
            <em>{c.status === "approved" ? "Visible to everyone" : c.status === "hidden" ? "Hidden by moderators" : "Awaiting review"}</em>
          </button>
        )) : <p className="rp-muted">Comments you leave will show up here.</p>}
      </section>
    </Screen>
  )
}
