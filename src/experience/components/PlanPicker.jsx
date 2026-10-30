import { BILLING_PLANS } from '../../../supabase/functions/_shared/billing-plans.js';
export default function PlanPicker({value, onChange}) {
 return <div className="plan-picker">{Object.entries(BILLING_PLANS).map(([key,p]) => <button key={key} type="button" className={`plan-card ${value===key ? "selected" : ""}`} aria-pressed={value===key} onClick={()=>onChange(key)}><h2>{p.name}</h2><strong>${(p.cents/100).toFixed(2)} / month</strong><p>{p.trialMonths} month{p.trialMonths>1 ? "s" : ""} trial for eligible accounts</p></button>)}</div>;
}
