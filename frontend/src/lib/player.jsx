import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useApi, useProfile } from "@/lib/profile"

export const PREVIEW_SECONDS = 15
const PlayerContext = createContext(null)

async function blobUrl(api, path) {
  return URL.createObjectURL(await (await api(path)).blob())
}

export function PlayerProvider({ children }) {
  const api = useApi()
  const { profile } = useProfile()
  const listener = (profile?.plan_level || 0) >= 1
  const audio = useRef(null)
  const urls = useRef([])
  const [track, setTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loadingId, setLoadingId] = useState(null)
  const [error, setError] = useState("")

  const release = () => { urls.current.forEach(URL.revokeObjectURL); urls.current = [] }
  useEffect(() => () => { audio.current?.pause(); release() }, [])

  const play = useCallback(async (t) => {
    if (track?.id === t.id && audio.current?.src) {
      if (audio.current.paused) { await audio.current.play() } else { audio.current.pause() }
      return
    }
    setLoadingId(t.id)
    setError("")
    try {
      const preview = !listener
      const src = await blobUrl(api, `/tracks/${t.id}/${preview ? "preview" : "audio"}`)
      const cover = t.has_cover ? await blobUrl(api, `/tracks/${t.id}/cover`).catch(() => "") : ""
      release()
      urls.current = [src, cover].filter(Boolean)
      audio.current.src = src
      setTrack({ ...t, cover, preview, item: { kind: "track", ref_id: t.id, title: t.title, artist: t.artist_name, artwork: "", preview_url: "" } })
      api(`/tracks/${t.id}/play`, { method: "POST" }).catch(() => {})
      setTime(0)
      await audio.current.play()
      window.dispatchEvent(new Event("nm-release-play"))
    } catch (e) {
      setError(e.message || "Couldn't play this track.")
    } finally {
      setLoadingId(null)
    }
  }, [api, listener, track])

  const playSong = useCallback(async (song) => {
    const id = `it-${song.id}`
    setError("")
    if (!listener) return setError("Subscribe to Standard Listener to play songs.")
    if (track?.id === id && audio.current?.src) {
      if (audio.current.paused) { await audio.current.play() } else { audio.current.pause() }
      return
    }
    release()
    audio.current.src = song.preview_url
    setTrack({ id, title: song.title, artist_name: song.artist, cover: song.artwork, preview: true,
      previewSeconds: 30, location: "Apple Music preview",
      item: { kind: "song", ref_id: String(song.id), title: song.title, artist: song.artist, artwork: song.artwork || "", preview_url: song.preview_url || "" } })
    setTime(0)
    try {
      await audio.current.play()
      window.dispatchEvent(new Event("nm-release-play"))
    } catch {
      setError("Couldn't play this preview.")
    }
  }, [listener, track])

  const toggle = useCallback(() => {
    if (!audio.current?.src) return
    if (audio.current.paused) audio.current.play()
    else audio.current.pause()
  }, [])

  const seek = useCallback((t) => { if (audio.current) audio.current.currentTime = t }, [])

  const value = { track, isPlaying, time, duration, loadingId, error, play, playSong, toggle, seek, listener }
  return (
    <PlayerContext.Provider value={value}>
      <audio ref={audio} data-testid="release-audio"
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} />
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
