import { useState } from "react"
import { useNavigate } from "react-router-dom"
import Screen from "./Screen"
import { useApi, useProfile } from "@/lib/profile"
import { findCountryLocation } from "@/lib/earthMaps"
import { findStateLocation } from "@/lib/regions"

const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac"

function guessPlace(text) {
  for (const p of text.split(",").map((x) => x.trim()).filter(Boolean).reverse()) {
    const hit = findStateLocation(p) || findCountryLocation(p)
    if (hit) return hit
  }
  return null
}

export default function UploadScreen() {
  const api = useApi()
  const navigate = useNavigate()
  const { profile } = useProfile()
  const [f, setF] = useState({ title: "", featured: "", release_type: "single", album_title: "", lyrics: "",
    location: [profile?.state, profile?.country].filter(Boolean).join(", ") })
  const [audio, setAudio] = useState(null)
  const [cover, setCover] = useState(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  if ((profile?.plan_level || 0) < 3) return <Screen kicker="Artist Studio" title="Upload" testId="upload-screen"><p className="rp-muted">Uploading needs the Artist plan.</p></Screen>

  async function submit(e) {
    e.preventDefault()
    if (!f.title.trim() || !audio) return setStatus("Add a title and an audio file.")
    if (f.release_type === "album" && !f.album_title.trim()) return setStatus("Give the album a title.")
    if (audio.size > 25 * 1024 * 1024) return setStatus("Audio must be under 25 MB.")
    const body = new FormData()
    Object.entries(f).forEach(([k, v]) => body.append(k, v))
    const guess = guessPlace(f.location)
    if (guess) { body.append("lat", guess.latitude); body.append("lon", guess.longitude) }
    body.append("audio", audio)
    if (cover) body.append("cover", cover)
    setBusy(true)
    setStatus("Uploading…")
    try {
      await api("/tracks", { method: "POST", body })
      setStatus(f.lyrics.trim() ? "Published! AI is now matching your lyrics to the audio." : "Published!")
      setTimeout(() => navigate("/studio"), 1600)
    } catch (err) { setStatus(err.message); setBusy(false) }
  }

  return (
    <Screen kicker="Artist Studio" title="Upload a song" testId="upload-screen"
      actions={<button type="button" className="ghost-btn" onClick={() => navigate("/studio")} data-testid="upload-back">Back to Studio</button>}>
      <form className="screen-form upload-form" onSubmit={submit} data-testid="upload-form">
        <div className="upload-files">
          <label className="file-pick big">
            <span>{audio ? audio.name : "Choose your song (MP3, WAV, M4A…)"}</span>
            <input type="file" accept={AUDIO_ACCEPT} onChange={(e) => setAudio(e.target.files?.[0] || null)} data-testid="upload-audio-input" />
          </label>
          <label className="file-pick big cover-pick">
            {cover ? <img src={URL.createObjectURL(cover)} alt="Cover preview" /> : <span>Album cover</span>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] || null)} data-testid="upload-cover-input" />
          </label>
        </div>
        <label htmlFor="u-title">Title</label>
        <input id="u-title" maxLength={100} value={f.title} onChange={set("title")} data-testid="upload-title-input" />
        <label htmlFor="u-feat">Featured artists (optional)</label>
        <input id="u-feat" maxLength={200} placeholder="e.g. Ava Cruz, DJ Rio" value={f.featured} onChange={set("featured")} data-testid="upload-featured-input" />
        <div className="two-col">
          <div>
            <label htmlFor="u-type">Release type</label>
            <select id="u-type" value={f.release_type} onChange={set("release_type")} data-testid="upload-type-select">
              <option value="single">Single</option><option value="album">Part of an album</option>
            </select>
          </div>
          {f.release_type === "album" && (
            <div>
              <label htmlFor="u-album">Album title</label>
              <input id="u-album" maxLength={120} value={f.album_title} onChange={set("album_title")} data-testid="upload-album-input" />
            </div>
          )}
        </div>
        <label htmlFor="u-loc">Where it's from</label>
        <input id="u-loc" maxLength={120} value={f.location} onChange={set("location")} data-testid="upload-location-input" />
        <label htmlFor="u-lyrics">Lyrics (one line per row)</label>
        <textarea id="u-lyrics" rows={10} value={f.lyrics} onChange={set("lyrics")} data-testid="upload-lyrics-input"
          placeholder="Paste your lyrics here. AI listens to your song and times each line automatically." />
        <button type="submit" disabled={busy} data-testid="upload-submit">{busy ? "Publishing…" : "Publish"}</button>
        <p className="status success" data-testid="upload-status">{status}</p>
      </form>
    </Screen>
  )
}
