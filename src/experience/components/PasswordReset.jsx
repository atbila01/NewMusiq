import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import AuthLayout from './AuthLayout';
export default function PasswordReset() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (password !== confirmation) return setStatus('The passwords do not match.');
    setBusy(true); setStatus('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setStatus(error.message);
    else navigate('/', { replace: true });
  }
  return <AuthLayout title="Set your new password"><form className="screen-form nm-auth-form" onSubmit={submit}>
    <label>New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
    <label>Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>
    <button disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button><p role="status">{status}</p>
  </form></AuthLayout>;
}
