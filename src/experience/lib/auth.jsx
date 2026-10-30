import { useCallback } from 'react';
import { useAuth as useNewMusiqAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
export function useAuth() {
  const { session, user, loading } = useNewMusiqAuth();
  const getToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token || null;
  }, []);
  return { isLoaded: !loading, isSignedIn: Boolean(session), userId: user?.id, getToken };
}
export function Show({ when, children }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return (when === 'signed-in' ? isSignedIn : !isSignedIn) ? children : null;
}
export function useClerk() {
  const { logout } = useNewMusiqAuth();
  const signOut = async ({ redirectUrl = '/sign-in' } = {}) => { await logout(); window.location.assign(redirectUrl); };
  return { signOut };
}
export function useUser() {
  const { user, loading } = useNewMusiqAuth();
  return { isLoaded: !loading, user: user ? { ...user, primaryEmailAddress: { emailAddress: user.email }, firstName: user.user_metadata?.name || '' } : null };
}
