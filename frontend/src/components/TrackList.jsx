import { useEffect, useState } from "react"
import { useApi } from "@/lib/profile"
import { usePlayer } from "@/lib/player"

export function Cover({ track }) {
  const api = useApi()
  const [url, setUrl] = useState("")
  useEffect(() => {
    if (!track.has_cover) return
    let made = ""
    api(`/tracks/${track.id}/cover`).then((r) => r.blob()).then((b) => { made = URL.createObjectURL(b); setUrl(made) }).catch(() => {})
    return () => made && URL.revokeObjectURL(made)
  }, [api, track.id, track.has_cover])
  return <div className="track-cover">{url ? <img src={url} alt="" /> : <span>♪</span>}</div>
}

export default function TrackList({ tracks, onDelete, emptyText }) {
  const player = usePlayer()

  if (!tracks.length) return <p className="panel-text" data-testid="track-list-empty">{emptyText}</p>
  return (
    <div className="track-list" data-testid="track-list">
      {player.error && <p className="status" data-testid="track-play-error">{player.error}</p>}
      {tracks.map((t) => {
        const current = player.track?.id === t.id
        const label = player.loadingId === t.id ? "…" : current && player.isPlaying ? "Pause" : player.listener ? "Play" : "Preview"
        return (
          <article className={`track-row ${current ? "current" : ""}`} key={t.id} data-testid="track-row">
            <Cover track={t} />
            <div className="track-info">
              <strong>{t.title}</strong>
              <span>{t.artist_name}{t.location ? ` · ${t.location}` : ""}</span>
            </div>
            <button type="button" className="track-play" data-testid={`track-play-${t.id}`} onClick={() => player.play(t)}>
              {label}
            </button>
            {onDelete && t.mine && (
              <button type="button" className="track-delete" data-testid={`track-delete-${t.id}`} onClick={() => onDelete(t)}>
                Remove
              </button>
            )}
          </article>
        )
      })}
    </div>
  )
}
