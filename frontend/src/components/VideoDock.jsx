import { useEffect, useState } from "react"
import { LikeButton, AddToPlaylist } from "./SongItem"

export default function VideoDock() {
  const [item, setItem] = useState(null)
  useEffect(() => {
    const open = (e) => setItem(e.detail)
    window.addEventListener("nm-play-video", open)
    return () => window.removeEventListener("nm-play-video", open)
  }, [])
  if (!item) return null
  return (
    <div className="video-dock" data-testid="video-dock">
      <div className="rp-video-frame">
        <iframe title={item.title} allowFullScreen allow="autoplay; encrypted-media; picture-in-picture" data-testid="video-dock-iframe"
          src={`https://www.youtube-nocookie.com/embed/${item.ref_id}?autoplay=1&rel=0&modestbranding=1`} />
      </div>
      <div className="video-dock-meta">
        <div><strong>{item.title}</strong><em>{item.artist}</em></div>
        <LikeButton item={item} />
        <AddToPlaylist item={item} />
        <a href={`https://www.youtube.com/watch?v=${item.ref_id}`} target="_blank" rel="noreferrer" data-testid="video-dock-youtube">YouTube</a>
        <button type="button" className="icon-btn" aria-label="Close video" onClick={() => setItem(null)} data-testid="video-dock-close">×</button>
      </div>
    </div>
  )
}
