import { useNavigate } from "react-router-dom"

export default function UpgradeCard({ plan, title, text, testId = "upgrade-card" }) {
  const navigate = useNavigate()
  return (
    <div className="upgrade-card" data-testid={testId}>
      <p className="player-kicker">{plan} plan</p>
      <h3>{title}</h3>
      <p>{text}</p>
      <button type="button" onClick={() => navigate("/subscribe")} data-testid={`${testId}-button`}>
        Upgrade to {plan}
      </button>
    </div>
  )
}
