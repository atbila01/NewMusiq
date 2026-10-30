import { useEffect, useRef, useState } from "react"
import Screen from "./Screen"
import Icon from "../Icon"
import SongItem from "../SongItem"
import { useApi } from "@/lib/profile"
import { itemFromTrack, itemFromVideo } from "@/lib/library"

function HumButton({ onResult }) {
  const api = useApi()
  const [state, setState] = useState("idle")
  const rec = useRef(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setState("thinking")
        const body = new FormData()
        body.append("audio", new Blob(chunks, { type: mr.mimeType || "audio/webm" }), "hum.webm")
        try { onResult(await (await api("/search/hum", { method: "POST", body })).json()) }
        catch (e) { onResult({ songs: [], message: e.message }) }
        setState("idle")
      }
      rec.current = mr
      mr.start()
      setState("recording")
      setTimeout(() => mr.state === "recording" && mr.stop(), 10000)
    } catch {
      onResult({ songs: [], message: "Microphone access is needed to sing or hum a song." })
    }
  }

  const label = { idle: "Sing or hum", recording: "Listening… tap to stop", thinking: "Finding your song…" }[state]
  return (
    <button type="button" className={`hum-btn ${state}`} disabled={state === "thinking"} data-testid="search-hum-button"
      onClick={() => (state === "recording" ? rec.current?.stop() : start())}>
      <Icon name="mic" />{label}
    </button>
  )
}

export default function SearchScreen() {
  const api = useApi()
  const [mode, setMode] = useState("songs")
  const [q, setQ] = useState("")
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (mode !== "songs" || q.trim().length < 2) return
    const t = setTimeout(async () => {
      setBusy(true)
      try { setRes(await (await api(`/search?q=${encodeURIComponent(q.trim())}`)).json()) } catch { setRes({ songs: [], releases: [] }) }
      setBusy(false)
    }, 450)
    return () => clearTimeout(t)
  }, [q, mode, api])

  async function findByLyrics(e) {
    e.preventDefault()
    if (mode !== "lyrics" || q.trim().length < 3) return
    setBusy(true)
    try { setRes(await (await api("/search/lyrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q.trim() }) })).json()) }
    catch (err) { setRes({ songs: [], message: err.message }) }
    setBusy(false)
  }

  return (
    <Screen kicker="Find anything" title="Search" testId="search-screen">
      <form className="search-bar" onSubmit={findByLyrics}>
        <Icon name="search" />
        <input value={q} onChange={(e) => setQ(e.target.value)} data-testid="search-input"
          placeholder={mode === "songs" ? "What do you want to listen to?" : "Type any lyrics you remember…"} />
        {mode === "lyrics" && <button type="submit" data-testid="search-lyrics-submit">Find song</button>}
      </form>
      <div className="search-modes">
        {[["songs", "Songs & artists"], ["lyrics", "By lyrics"]].map(([m, l]) => (
          <button key={m} type="button" className={mode === m ? "active" : ""} data-testid={`search-mode-${m}`}
            onClick={() => { setMode(m); setRes(null) }}>{l}</button>
        ))}
        <HumButton onResult={(r) => { setMode("lyrics"); setRes(r) }} />
      </div>
      {busy && <p className="rp-muted">Searching…</p>}
      {res?.heard && <p className="rp-muted" data-testid="search-heard">We heard: “{res.heard}”</p>}
      {res?.message && <p className="status" data-testid="search-message">{res.message}</p>}
      {res?.releases?.length > 0 && (
        <section className="screen-section">
          <h2>On NewMusiq</h2>
          <div className="song-list">{res.releases.map((t) => <SongItem key={t.id} item={itemFromTrack(t)} />)}</div>
        </section>
      )}
      {res && (
        <section className="screen-section">
          <h2>{mode === "lyrics" ? "Best matches" : "Songs"}</h2>
          <p className="rp-muted">Official videos from YouTube</p>
          {(res.songs ?? []).length ? <div className="song-list" data-testid="search-results">{res.songs.map((s) => <SongItem key={s.video_id} item={itemFromVideo(s)} />)}</div>
            : !busy && <p className="rp-muted" data-testid="search-empty">No songs found.</p>}
        </section>
      )}
    </Screen>
  )
}
