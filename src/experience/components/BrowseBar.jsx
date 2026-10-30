import { useNavigate } from "react-router-dom"

export default function BrowseBar() {
  const navigate = useNavigate()
  return (
    <div className="player-bottom-bar browse-bar" data-testid="browse-bar">
      <div className="browse-copy">
        <p className="player-kicker">Browsing mode</p>
        <strong>You're exploring the globe for free</strong>
        <span>Subscribe to listen to music, see new releases and join the conversation.</span>
      </div>
      <button type="button" className="browse-cta" onClick={() => navigate("/subscribe")} data-testid="browse-subscribe-button">
        See plans
      </button>
    </div>
  )
}
