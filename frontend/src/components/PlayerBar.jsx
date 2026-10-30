import { useEffect, useState } from "react"
import Icon from "./Icon"
import Lyrics from "./Lyrics"
import ListenerComments from "./ListenerComments"
import { PREVIEW_SECONDS, usePlayer } from "@/lib/player"
import { AddToPlaylist, LikeButton } from "./SongItem"
import { useApi } from "@/lib/profile"

function SyncedLyrics({ trackId, time }) {
  const api = useApi()
  const [data, setData] = useState(null)
  useEffect(() => { api(`/tracks/${trackId}/lyrics`).then((r) => r.json()).then(setData).catch(() => {}) }, [api, trackId])
  if (!data?.lines?.length) return null
  const active = data.lines.reduce((a, l, i) => (l.t <= time ? i : a), -1)
  return (
    <div className="lyrics-lines" data-testid="synced-lyrics">
      {data.lines.map((l, i) => <p key={i} className={i === active ? "active" : i < active ? "passed" : ""}>{l.text}</p>)}
    </div>
  )
}

const DEMO_DURATION = 238
const DEMO_COVER = "https://images.unsplash.com/photo-1706512199237-06867557fb85?auto=format&fit=crop&w=500&q=88"
const formatTime = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` }

function useDemo(active) {
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(74)
  useEffect(() => {
    const pause = () => setIsPlaying(false)
    window.addEventListener("nm-release-play", pause)
    return () => window.removeEventListener("nm-release-play", pause)
  }, [])
  useEffect(() => {
    if (!isPlaying || !active) return
    const t = setInterval(() => setProgress((c) => (c >= DEMO_DURATION ? 0 : c + 1)), 1000)
    return () => clearInterval(t)
  }, [isPlaying, active])
  return { isPlaying, setIsPlaying, progress, setProgress }
}

export default function PlayerBar() {
  const player = usePlayer()
  const real = player.track
  const demo = useDemo(!real)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const open = () => setExpanded(true)
    window.addEventListener("nm-open-player", open)
    return () => window.removeEventListener("nm-open-player", open)
  }, [])

  const isPlaying = real ? player.isPlaying : demo.isPlaying
  const duration = real ? (real.preview ? (real.previewSeconds || PREVIEW_SECONDS) : player.duration) : DEMO_DURATION
  const progress = real ? Math.min(player.time, duration || 0) : demo.progress
  const togglePlay = real ? player.toggle : () => demo.setIsPlaying((p) => !p)
  const seek = real ? player.seek : demo.setProgress
  const cover = real ? real.cover : DEMO_COVER

  return (
    <div className={`player-bottom-bar ${expanded ? "expanded" : ""}`} data-testid="player-bar"
      onClick={(e) => { if (!expanded && !e.target.closest(".transport, .timeline")) setExpanded(true) }}>
      {expanded && (
        <button className="collapse-player" type="button" aria-label="Collapse player"
          data-testid="player-collapse-button" onClick={() => setExpanded(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7" /></svg>
        </button>
      )}
      <div className="bottom-song-summary">
        <div className="mini-album" data-testid="player-cover">
          {cover ? <img src={cover} alt="Track cover" /> : <div className="mini-album-fallback">♪</div>}
        </div>
        <div className="track-heading">
          <p data-testid="player-kicker">{real ? (real.preview ? `${real.previewSeconds || PREVIEW_SECONDS}-second preview` : real.location || "New release") : "Worlds Between Us"}</p>
          <button className="expand-player-title" type="button" aria-expanded={expanded}
            data-testid="player-track-title" onClick={() => setExpanded(true)}>{real ? real.title : "Golden Moon"}</button>
          <a href="#artist" data-testid="player-artist-link">{real ? real.artist_name : "Maya Sol"}</a>
        </div>
        {real?.item && <div className="bar-actions" onClick={(e) => e.stopPropagation()}><LikeButton item={real.item} /><AddToPlaylist item={real.item} /></div>}
      </div>
      <div className="transport">
        <button type="button" aria-label="Restart track" data-testid="player-prev-button" onClick={() => seek(0)}>
          <Icon name="previous" />
        </button>
        <button className="play-pause" type="button" aria-label={isPlaying ? "Pause" : "Play"}
          data-testid="player-play-pause-button" onClick={togglePlay}>
          <Icon name={isPlaying ? "pause" : "play"} />
        </button>
        <button type="button" aria-label="Next track" data-testid="player-next-button" onClick={() => seek(0)}>
          <Icon name="next" />
        </button>
      </div>
      <div className="timeline">
        <input aria-label="Song progress" type="range" min="0" max={duration || 0} step="0.1" value={progress}
          data-testid="player-progress" onChange={(e) => seek(Number(e.target.value))}
          style={{ "--progress": `${duration ? (progress / duration) * 100 : 0}%` }} />
        <div>
          <span data-testid="player-elapsed">{formatTime(progress)}</span>
          <span>-{formatTime((duration || 0) - progress)}</span>
        </div>
      </div>
      {expanded && !real && <Lyrics progress={demo.progress} duration={DEMO_DURATION} />}
      {expanded && real && (
        <div className="expanded-lyrics release-details" data-testid="release-details">
          <p className="player-kicker">Now playing</p>
          <h2>{real.title}</h2>
          <p className="lyrics-credit">{real.artist_name}{real.location ? ` · ${real.location}` : ""}</p>
          {real.item?.kind === "track" && <SyncedLyrics trackId={real.id} time={player.time} />}
          {real.preview && !real.previewSeconds && <p className="lyrics-credit">Subscribe to Standard Listener to hear the full track.</p>}
        </div>
      )}
      {expanded && <ListenerComments />}
    </div>
  )
}
