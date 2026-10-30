import { useState } from "react"
import Icon from "./Icon"
import { keyOf, playItem, useLibrary } from "@/lib/library"
import { usePlayer } from "@/lib/player"

export function LikeButton({ item }) {
  const lib = useLibrary()
  const liked = lib.isLiked(item)
  return (
    <button type="button" className={`icon-btn like ${liked ? "on" : ""}`} aria-label={liked ? "Unlike" : "Like"} aria-pressed={liked}
      data-testid={`like-${keyOf(item)}`} onClick={(e) => { e.stopPropagation(); lib.toggleLike(item) }}>
      <Icon name="heart" />
    </button>
  )
}

export function AddToPlaylist({ item }) {
  const lib = useLibrary()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState("")
  return (
    <div className="add-pl">
      <button type="button" className="icon-btn" aria-label="Add to playlist" data-testid={`add-pl-${keyOf(item)}`}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); setDone("") }}><Icon name="plus" /></button>
      {open && (
        <div className="add-pl-menu" onClick={(e) => e.stopPropagation()} data-testid="add-pl-menu">
          {lib.playlists.length === 0 && <span>No playlists yet — create one in Profile.</span>}
          {lib.playlists.map((p) => (
            <button key={p.id} type="button" data-testid={`add-pl-option-${p.id}`}
              onClick={async () => { await lib.addToPlaylist(p.id, item); setDone(p.name) }}>{p.name}</button>
          ))}
          {done && <em>Added to {done}</em>}
        </div>
      )}
    </div>
  )
}

export default function SongItem({ item, rank, extra, onOpen }) {
  const player = usePlayer()
  const current = player.track?.item && keyOf(player.track.item) === keyOf(item)
  return (
    <div className={`song-item ${current ? "current" : ""}`} data-testid={`song-item-${keyOf(item)}`}>
      {rank && <span className="rp-rank">{rank}</span>}
      {item.artwork ? <img src={item.artwork} alt="" /> : <span className="rp-art-fallback">♪</span>}
      <button type="button" className="song-item-text" onClick={() => (onOpen ? onOpen(item) : playItem(player, item))}>
        <strong>{item.title}</strong><em>{item.artist}{item.kind === "track" ? " · NewMusiq release" : item.kind === "video" ? " · YouTube" : ""}</em>
      </button>
      {extra}
      <LikeButton item={item} />
      <AddToPlaylist item={item} />
      <button type="button" className="icon-btn play" aria-label="Play" data-testid={`play-${keyOf(item)}`} onClick={() => playItem(player, item)}>
        <Icon name={current && player.isPlaying ? "pause" : "play"} />
      </button>
    </div>
  )
}
