import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useApi } from "@/lib/profile"

const LibraryContext = createContext(null)

export const itemFromSong = (s) => ({ kind: "song", ref_id: String(s.id), title: s.title, artist: s.artist, artwork: s.artwork || "", preview_url: s.preview_url || "" })
export const itemFromTrack = (t) => ({ kind: "track", ref_id: t.id, title: t.title, artist: t.artist_name, artwork: "", preview_url: "" })
export const itemFromVideo = (v) => ({ kind: "video", ref_id: v.video_id, title: v.song_title || v.title, artist: v.artist || v.channel || "", artwork: v.thumbnail || "", preview_url: "" })
export const keyOf = (item) => `${item.kind}:${item.ref_id}`

export function playItem(player, item) {
  if (item.kind === "video") {
    if (player.isPlaying && player.track) player.toggle()
    window.dispatchEvent(new Event("nm-release-play"))
    return window.dispatchEvent(new CustomEvent("nm-play-video", { detail: item }))
  }
  if (item.kind === "track") return player.play({ id: item.ref_id, title: item.title, artist_name: item.artist, has_cover: true })
  return player.playSong({ id: item.ref_id, title: item.title, artist: item.artist, artwork: item.artwork, preview_url: item.preview_url })
}

export function LibraryProvider({ children }) {
  const api = useApi()
  const [likes, setLikes] = useState([])
  const [playlists, setPlaylists] = useState([])

  const reload = useCallback(() => {
    api("/me/likes").then((r) => r.json()).then(setLikes).catch(() => {})
    api("/me/playlists").then((r) => r.json()).then(setPlaylists).catch(() => {})
  }, [api])
  useEffect(() => { reload() }, [reload])

  const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const isLiked = (item) => likes.some((l) => l.key === keyOf(item))
  const toggleLike = async (item) => {
    if (isLiked(item)) await api(`/me/likes/${encodeURIComponent(keyOf(item))}`, { method: "DELETE" })
    else await api("/me/likes", json("POST", item))
    reload()
  }
  const createPlaylist = async (name, cover) => {
    const body = new FormData()
    body.append("name", name)
    if (cover) body.append("cover", cover)
    await api("/me/playlists", { method: "POST", body })
    reload()
  }
  const addToPlaylist = async (pid, item) => { await api(`/me/playlists/${pid}/items`, json("POST", item)); reload() }
  const removeFromPlaylist = async (pid, item) => { await api(`/me/playlists/${pid}/items/${encodeURIComponent(keyOf(item))}`, { method: "DELETE" }); reload() }
  const deletePlaylist = async (pid) => { await api(`/me/playlists/${pid}`, { method: "DELETE" }); reload() }

  return (
    <LibraryContext.Provider value={{ likes, playlists, isLiked, toggleLike, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist, reload }}>
      {children}
    </LibraryContext.Provider>
  )
}

export const useLibrary = () => useContext(LibraryContext)
