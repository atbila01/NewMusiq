import { useEffect, useState } from "react"
import { useApi } from "@/lib/profile"
import { usePlayer } from "@/lib/player"
import { regionPattern } from "@/lib/patterns"
import { LikeButton, AddToPlaylist } from "./SongItem"

function useFetch(path) {
  const api = useApi()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [n, setN] = useState(0)
  useEffect(() => {
    setData(null); setError("")
    api(path).then((r) => r.json()).then(setData).catch((e) => setError(e.message))
  }, [api, path, n])
  return { data, error, retry: () => setN((x) => x + 1) }
}

function Loading({ error, retry, text = "Loading…" }) {
  return (
    <div className="rp-muted">
      {error || text}
      {error && retry && <button type="button" className="ghost-btn small rp-retry" onClick={retry} data-testid="region-retry">Try again</button>}
    </div>
  )
}

function SongRow({ song, rank, onOpen }) {
  return (
    <button type="button" className="rp-song" onClick={() => onOpen(song)} data-testid="region-song">
      {rank && <span className="rp-rank">{rank}</span>}
      <span className="rp-art-fallback">▶</span>
      <span className="rp-song-text"><strong>{song.title || "Top song"}</strong><em>{song.artist}{song.local_tie ? ` · ${song.local_tie}` : song.genre ? ` · ${song.genre}` : ""}</em></span>
    </button>
  )
}

function VideoView({ song }) {
  const player = usePlayer()
  const { data, error, retry } = useFetch(`/music/video?artist=${encodeURIComponent(song.artist)}&title=${encodeURIComponent(song.title || song.artist)}`)
  useEffect(() => {
    if (data && player.isPlaying) { player.track ? player.toggle() : window.dispatchEvent(new Event("nm-release-play")) }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading error={error} retry={retry} text="Finding the official video…" />
  const item = { kind: "video", ref_id: data.video_id, title: song.title || data.video_title, artist: song.artist, artwork: data.thumbnail, preview_url: "" }
  return (
    <div className="rp-video" data-testid="region-video">
      <div className="rp-video-frame">
        <iframe title={data.video_title} data-testid="region-video-iframe" allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          src={`https://www.youtube-nocookie.com/embed/${data.video_id}?autoplay=1&rel=0&modestbranding=1`} />
      </div>
      <div className="rp-video-meta">
        <div>
          <h3>{song.title || data.video_title}</h3>
          <p className="rp-artist">{song.artist}</p>
          <p className="rp-muted">{data.video_title}</p>
        </div>
        <div className="rp-actions">
          <LikeButton item={item} />
          <AddToPlaylist item={item} />
          <a href={`https://www.youtube.com/watch?v=${data.video_id}`} target="_blank" rel="noreferrer" data-testid="region-video-youtube">Open on YouTube</a>
        </div>
      </div>
    </div>
  )
}

function HeritageView({ genreId, regionKey, onOpen }) {
  const { data, error, retry } = useFetch(`/music/heritage/${genreId}?region_key=${encodeURIComponent(regionKey)}`)
  if (!data) return <Loading error={error} retry={retry} />
  return (
    <div data-testid="region-heritage-detail">
      <h3 className="rp-title">{data.name}</h3>
      <p className="rp-summary" data-testid="region-heritage-summary">{data.summary}</p>
      <p className="rp-label">Songs from this region</p>
      <div className="rp-list">{data.songs.map((s, i) => <SongRow key={i} song={s} onOpen={onOpen} />)}</div>
    </div>
  )
}

function PlaylistView({ genre, onOpen }) {
  return (
    <div data-testid="region-playlist">
      <h3 className="rp-title">{genre.name} Playlist</h3>
      <p className="rp-muted">{genre.description} · {genre.songs.length} songs</p>
      <div className="rp-list">{genre.songs.map((s, i) => <SongRow key={i} song={s} rank={i + 1} onOpen={onOpen} />)}</div>
    </div>
  )
}

function Overview({ data, onView }) {
  const updated = data.updated_at ? new Date(data.updated_at).toLocaleDateString([], { dateStyle: "medium" }) : ""
  return (
    <div className="rp-overview">
      <section data-testid="region-heritage">
        <p className="rp-label">Music genres from this area</p>
        {data.heritage.length ? (
          <div className="rp-chips">
            {data.heritage.map((g) => (
              <button key={g.id} type="button" className="rp-chip" onClick={() => onView({ type: "heritage", id: g.id })}
                data-testid={`region-heritage-${g.id}`}>{g.name}</button>
            ))}
          </div>
        ) : <p className="rp-muted">Genre stories for this area are coming soon.</p>}
      </section>
      <section data-testid="region-top-genres">
        <p className="rp-label">Top genre playlists this week</p>
        <div className="rp-playlists">
          {data.top_genres.map((g, i) => (
            <button key={g.name} type="button" className={`rp-playlist tone-${i % 5}`} onClick={() => onView({ type: "playlist", genre: g })}
              data-testid={`region-genre-${g.name.replace(/\W+/g, "-").toLowerCase()}`}>
              <span className="rp-pl-art">♪</span>
              <strong>{g.name}</strong>
              <em>{g.songs.length} songs · {g.songs.slice(0, 2).map((s) => s.artist).join(", ")}</em>
            </button>
          ))}
        </div>
      </section>
      <section data-testid="region-top-songs">
        <p className="rp-label">Top songs this week</p>
        <p className="rp-muted">Weekly AI picks for {data.name}{updated ? ` · refreshed ${updated}` : ""} · videos from YouTube</p>
        <div className="rp-list">
          {data.top_songs.map((s, i) => <SongRow key={i} song={s} rank={i + 1} onOpen={(song) => onView({ type: "video", song })} />)}
        </div>
      </section>
    </div>
  )
}

export default function RegionPopup({ region, onClose }) {
  const api = useApi()
  const params = `country=${encodeURIComponent(region.country)}&state=${encodeURIComponent(region.state)}`
  const { data, error, retry } = useFetch(`/music/region?${params}`)
  const [stack, setStack] = useState([])
  const view = stack[stack.length - 1]
  const push = (v) => setStack((s) => [...s, v])
  const openSong = (song) => push({ type: "video", song })
  const pattern = regionPattern(region.country, region.state)

  useEffect(() => {
    setStack([])
    api("/me/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: region.country, state: region.state }) }).catch(() => {})
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="region-popup" role="dialog" aria-label={`Music of ${region.state || region.country}`} data-testid="region-popup">
      <div className="rp-border left" style={{ backgroundImage: pattern.image }} data-testid={`region-border-${pattern.key}`} aria-hidden="true" />
      <div className="rp-body">
        <header className="rp-header">
          {view ? (
            <button type="button" className="rp-back" onClick={() => setStack((s) => s.slice(0, -1))} data-testid="region-back">← Back</button>
          ) : <p className="player-kicker">{region.state ? region.country.replace(" of America", "") : "Country"}</p>}
          <h2 data-testid="region-name">{region.state || region.country}</h2>
          <button type="button" className="rp-close" aria-label="Close" onClick={onClose} data-testid="region-close">×</button>
        </header>
        <div className="rp-scroll">
          {!data ? <Loading error={error} retry={retry} text="Building this week's lists…" /> :
            !view ? <Overview data={data} onView={push} /> :
            view.type === "heritage" ? <HeritageView genreId={view.id} regionKey={data.region_key} onOpen={openSong} /> :
            view.type === "playlist" ? <PlaylistView genre={view.genre} onOpen={openSong} /> :
            <VideoView key={`${view.song.artist}-${view.song.title}`} song={view.song} />}
        </div>
      </div>
      <div className="rp-border right" style={{ backgroundImage: pattern.image }} aria-hidden="true" />
    </div>
  )
}
