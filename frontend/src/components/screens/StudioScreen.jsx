import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import Screen from "./Screen"
import Icon from "../Icon"
import UpgradeCard from "../UpgradeCard"
import { Cover } from "../TrackList"
import { useApi, useProfile } from "@/lib/profile"
import { usePlayer } from "@/lib/player"

function LineChart({ series }) {
  const W = 640, H = 200, P = 28
  const max = Math.max(1, ...series.map((s) => s.listeners))
  const x = (i) => P + (i * (W - P * 2)) / Math.max(1, series.length - 1)
  const y = (v) => H - P - (v / max) * (H - P * 2)
  const path = series.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s.listeners)}`).join(" ")
  const step = Math.ceil(series.length / 8)
  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} data-testid="studio-line-chart" role="img" aria-label="Listeners over time">
      {[0, 0.5, 1].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} className="grid" />)}
      {[0, 1].map((f) => <text key={`t${f}`} x={4} y={y(max * f) + 4}>{Math.round(max * f)}</text>)}
      <path d={`${path} L${x(series.length - 1)},${H - P} L${x(0)},${H - P} Z`} className="area" />
      <path d={path} className="line" />
      {series.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.listeners)} r="3" />)}
      {series.map((s, i) => (i % step === 0 ? <text key={`l${i}`} x={x(i)} y={H - 6} textAnchor="middle">{s.label}</text> : null))}
    </svg>
  )
}

function Analytics() {
  const api = useApi()
  const [range, setRange] = useState("week")
  const [data, setData] = useState(null)
  useEffect(() => { api(`/studio/analytics?range=${range}`).then((r) => r.json()).then(setData).catch(() => {}) }, [api, range])
  const Rank = ({ title, rows, unit }) => (
    <div className="rank-card"><h3>{title}</h3>
      {rows?.length ? rows.map((r, i) => <p key={r.id}><span>{i + 1}</span>{r.title}<em>{r.count} {unit}</em></p>) : <p className="rp-muted">No data yet.</p>}
    </div>
  )
  return (
    <section className="screen-section" data-testid="studio-analytics">
      <div className="section-head">
        <h2>Analytics</h2>
        <div className="search-modes">
          {["week", "month", "year"].map((r) => <button key={r} type="button" className={range === r ? "active" : ""} onClick={() => setRange(r)} data-testid={`studio-range-${r}`}>{r[0].toUpperCase() + r.slice(1)}</button>)}
        </div>
      </div>
      {data && (
        <>
          <div className="admin-stats">
            <div><strong data-testid="studio-total-plays">{data.total_plays}</strong><span>Plays</span></div>
            <div><strong data-testid="studio-listeners">{data.unique_listeners}</strong><span>Listeners</span></div>
          </div>
          <div className="chart-card"><LineChart series={data.series} /></div>
          <div className="rank-grid">
            <Rank title="Most listened to" rows={data.most_played} unit="plays" />
            <Rank title="Most liked" rows={data.most_liked} unit="likes" />
          </div>
        </>
      )}
    </section>
  )
}

function Shelf({ title, items, testId, onPlay }) {
  return (
    <section className="screen-section" data-testid={testId}>
      <h2>{title}</h2>
      {items.length ? (
        <div className="shelf">
          {items.map((it) => (
            <button key={it.key} type="button" className="shelf-item" onClick={() => onPlay(it.track)} data-testid={`${testId}-item`}>
              <Cover track={it.track} />
              <strong>{it.title}</strong><em>{it.sub}</em>
            </button>
          ))}
        </div>
      ) : <p className="rp-muted">Nothing here yet.</p>}
    </section>
  )
}

export default function StudioScreen() {
  const api = useApi()
  const navigate = useNavigate()
  const player = usePlayer()
  const { profile } = useProfile()
  const [tracks, setTracks] = useState([])
  const isArtist = (profile?.plan_level || 0) >= 3

  useEffect(() => { if (isArtist) api("/tracks/mine").then((r) => r.json()).then(setTracks).catch(() => {}) }, [api, isArtist])

  const albums = useMemo(() => {
    const groups = {}
    tracks.filter((t) => t.release_type === "album").forEach((t) => { (groups[t.album_title] ||= []).push(t) })
    return Object.entries(groups).map(([name, list]) => ({ key: name, title: name, sub: `${list.length} tracks`, track: list.find((t) => t.has_cover) || list[0] }))
  }, [tracks])
  const singles = tracks.filter((t) => t.release_type !== "album").map((t) => ({ key: t.id, title: t.title, sub: t.featured ? `feat. ${t.featured}` : t.location, track: t }))

  if (!isArtist) return (
    <Screen kicker="For creators" title="Artist Studio" testId="studio-screen">
      <UpgradeCard plan="Artist" testId="studio-upgrade" title="Upload and publish your own music"
        text="The Artist plan ($14.99/mo) lets you upload tracks, sync lyrics with AI and see your listener analytics." />
    </Screen>
  )
  return (
    <Screen kicker="For creators" title="Artist Studio" testId="studio-screen">
      <Analytics />
      <Shelf title="Albums" items={albums} testId="studio-albums" onPlay={(t) => player.play(t)} />
      <Shelf title="Singles" items={singles} testId="studio-singles" onPlay={(t) => player.play(t)} />
      <button type="button" className="upload-fab" onClick={() => navigate("/studio/upload")} data-testid="studio-upload-fab">
        <Icon name="plus" />Upload
      </button>
    </Screen>
  )
}
