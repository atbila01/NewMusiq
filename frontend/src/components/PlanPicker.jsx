import { useEffect, useState } from "react"
import { API } from "@/lib/profile"

const TAGLINES = {
  standard: "Required to use NewMusiq",
  pro: "For listeners who love to talk music",
  artist: "Publish your own music",
}

export default function PlanPicker({ value, onChange, currentPlan }) {
  const [plans, setPlans] = useState([])

  useEffect(() => {
    fetch(`${API}/plans`).then((r) => r.json()).then(setPlans).catch(() => {})
  }, [])

  return (
    <div className="plan-picker" data-testid="plan-picker">
      <p className="plan-kicker">Subscription</p>
      <h2 className="plan-title">Choose Your Plan</h2>
      <p className="plan-sub">Every plan is billed monthly. Cancel or switch any time.</p>
      <div className="plan-list" role="radiogroup" aria-label="Subscription plans">
        {plans.map((plan) => {
          const selected = value === plan.id
          const current = currentPlan === plan.id
          return (
            <button key={plan.id} type="button" role="radio" aria-checked={selected}
              className={`plan-card ${selected ? "selected" : ""}`} data-testid={`plan-option-${plan.id}`}
              onClick={() => onChange(plan.id)}>
              <span className="plan-card-head">
                <span>
                  <strong>{plan.name}</strong>
                  <em>{current ? "Your current plan" : TAGLINES[plan.id]}</em>
                </span>
                <span className="plan-price" data-testid={`plan-price-${plan.id}`}>
                  ${plan.price.toFixed(2)}<small>/mo</small>
                </span>
              </span>
              <ul>
                {plan.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <span className="plan-radio" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
