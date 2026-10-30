import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import AuthLayout from "./AuthLayout";
import PlanPicker from "./PlanPicker";
import { getSavedPlan, savePlan } from "@experience/lib/profile";
function AccountForm({ signup = false }) {
  const { login, register } = useAuth();
  const { pathname } = useLocation();
  const reset = pathname.includes("/reset");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const field = name => ({ value: form[name], onChange: e => setForm(v => ({ ...v, [name]: e.target.value })) });
  async function submit(e) {
    e.preventDefault(); setBusy(true); setStatus("");
    try {
      if (reset) {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: `${window.location.origin}/?reset=1` });
        if (error) throw error;
        setStatus("Check your email for the password reset link.");
      } else if (signup) {
        const result = await register({ ...form, role: "listener", artistName: "" });
        if (!result.session) setStatus("Check your email to confirm your account, then sign in.");
      } else await login(form.email, form.password);
    } catch (err) { setStatus(err.message); } finally { setBusy(false); }
  }
  return <form className="screen-form nm-auth-form" onSubmit={submit}>
    <div className="search-modes" aria-label="Account access"><Link className={!signup ? "active" : ""} to="/sign-in">Returning user</Link><Link className={signup ? "active" : ""} to="/sign-up">New user</Link></div>
    {signup && <label>Display name<input required autoComplete="name" maxLength={80} {...field("name")} /></label>}
    <label>Email<input required type="email" autoComplete="email" {...field("email")} /></label>
    {!reset && <label>Password<div className="nm-password"><input required minLength={8} type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} {...field("password")} /><button type="button" onClick={() => setVisible(v => !v)}>{visible ? "Hide" : "Show"}</button></div></label>}
    <button disabled={busy} type="submit">{busy ? "Please wait…" : reset ? "Send reset link" : signup ? "Create account" : "Sign in"}</button>
    {!signup && !reset && <Link to="/sign-in/reset">Forgot password?</Link>}
    <p role="status" className="status">{status}</p>
  </form>;
}
export function SignInPage() { return <AuthLayout mode="login" title="Welcome back" footer={<p className="create-account">New to NewMusiq? <Link to="/sign-up">Create an account</Link></p>}><AccountForm /></AuthLayout>; }
export function SignUpPage() {
  const [plan, setPlan] = useState(getSavedPlan);
  return <AuthLayout mode="create" title="Create your account" aside={<PlanPicker value={plan} onChange={p => { setPlan(p); savePlan(p); }} />}><AccountForm signup /></AuthLayout>;
}
