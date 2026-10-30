import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useAuth } from "@experience/lib/auth"

import { experienceApi } from './service';
export const API = '/api/experience';
export function useApi() {
  const { userId } = useAuth();
  return useCallback((path, options = {}) => experienceApi(path, options), [userId]);
}

const ProfileContext = createContext({ profile: null, photoUrl: "", error: "", role: "member", refresh: async () => {} })

export function ProfileProvider({ children }) {
  const { isSignedIn, userId } = useAuth()
  const api = useApi()
  const [profile, setProfile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState("")
  const [error, setError] = useState("")
  const [role, setRole] = useState("member")

  const loadPhoto = useCallback(async (hasPhoto) => {
    if (!hasPhoto) return setPhotoUrl(old => { if(old) URL.revokeObjectURL(old); return ""; })
    try {
      const blob = await (await api("/me/photo")).blob()
      setPhotoUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
    } catch {}
  }, [api])

  const refresh = useCallback(async () => {
    setError("")
    setRole("member")
    try {
      const data = await (await api("/me")).json()
      setProfile(data)
      loadPhoto(data.has_photo)
      api("/me/role").then((r) => r.json()).then((d) => setRole(d.role)).catch(() => setRole("member"))
      return data
    } catch (e) {
      setError("We couldn't load your account. Please try again.")
      throw e
    }
  }, [api, loadPhoto])

  useEffect(() => {
    if (isSignedIn) refresh().catch(() => {})
    else { setProfile(null); setPhotoUrl(""); setError(""); setRole("member") }
  }, [isSignedIn, userId, refresh])

  return <ProfileContext.Provider value={{ profile, photoUrl, error, role, refresh }}>{children}</ProfileContext.Provider>
}

export const useProfile = () => useContext(ProfileContext)

export const initials = (name = "") =>
  name.split(/[\s._]+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "NM"

const PLAN_KEY = "nm_plan"
export const getSavedPlan = () => ["listener", "artist"].find((p) => p === localStorage.getItem(PLAN_KEY)) || "listener"
export const savePlan = (plan) => localStorage.setItem(PLAN_KEY, plan)

export function useCheckout() {
  const api = useApi()
  return useCallback(async (plan) => {
    const res = await api("/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, origin_url: window.location.origin }),
    })
    const { checkout_url } = await res.json()
    window.location.href = checkout_url
  }, [api])
}
