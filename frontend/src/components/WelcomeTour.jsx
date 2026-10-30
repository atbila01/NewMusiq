import { useEffect, useLayoutEffect, useState } from "react"
import { useApi, useProfile } from "@/lib/profile"

const STEPS = [
  { target: ".player-content", title: "Spin the globe", text: "Drag to explore and tap any country or state to hear its music, top songs and local genres." },
  { target: '[data-testid="nav-search"]', title: "Search anything", text: "Find songs and artists, search by lyrics you remember, or sing a line to find it." },
  { target: '[data-testid="nav-profile"]', title: "Your playlists", text: "Liked Songs and every playlist you create live on your Profile. Tap + on any song to add it." },
]
const PAD = 8

function useRect(selector) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector(selector)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener("resize", measure)
    const t = setInterval(measure, 500)
    return () => { window.removeEventListener("resize", measure); clearInterval(t) }
  }, [selector])
  return rect
}

function cardPosition(rect) {
  const w = Math.min(340, window.innerWidth - 32), vw = window.innerWidth, vh = window.innerHeight
  if (!rect) return { top: vh / 2 - 100, left: (vw - w) / 2, width: w }
  const big = rect.width > vw * 0.5
  if (big) return { top: Math.max(16, rect.top + 40), left: Math.max(16, Math.min(rect.left + 40, vw - w - 16)), width: w }
  const right = rect.right + 18
  if (right + w < vw - 16) return { top: Math.max(16, Math.min(rect.top - 20, vh - 240)), left: right, width: w }
  return { top: Math.max(16, rect.top - 230), left: Math.max(16, Math.min(rect.left + rect.width / 2 - w / 2, vw - w - 16)), width: w }
}

export default function WelcomeTour() {
  const { profile, refresh } = useProfile()
  const api = useApi()
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (profile?.show_tour) setOpen(true) }, [profile?.show_tour])
  const s = STEPS[step]
  const rect = useRect(s.target)
  if (!open) return null

  const close = async () => {
    setOpen(false)
    try { await api("/me/tour-done", { method: "POST" }); refresh() } catch {}
  }
  const last = step === STEPS.length - 1

  return (
    <div className="tour-layer" data-testid="welcome-tour" role="dialog" aria-label="Welcome tour">
      {rect ? (
        <div className="tour-spot" key={`spot-${step}`} data-testid="tour-spotlight" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
      ) : <div className="tour-dim" />}
      <div className="tour-card" key={step} style={cardPosition(rect)} data-testid={`tour-step-${step + 1}`}>
        <p className="player-kicker">Welcome to NewMusiq · {step + 1} of {STEPS.length}</p>
        <h2 data-testid="tour-title">{s.title}</h2>
        <p className="tour-text">{s.text}</p>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i === step ? "on" : ""} />)}</div>
        <div className="tour-actions">
          <button type="button" className="text-link" onClick={close} data-testid="tour-skip">Skip tour</button>
          {step > 0 && <button type="button" className="ghost-btn" onClick={() => setStep(step - 1)} data-testid="tour-back">Back</button>}
          <button type="button" onClick={() => (last ? close() : setStep(step + 1))} data-testid={last ? "tour-done" : "tour-next"}>
            {last ? "Start exploring" : "Next"}
          </button>
        </div>
      </div>
    </div>
  )
}
