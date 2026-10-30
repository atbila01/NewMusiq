import { useEffect } from "react"
import { useAuth, useClerk } from "@clerk/react"

const FORGET_KEY = "nm-forget-me"
const ALIVE = "nm_alive=1"

export function setRemember(remember) {
  if (remember) return localStorage.removeItem(FORGET_KEY)
  localStorage.setItem(FORGET_KEY, "1")
  document.cookie = `${ALIVE}; path=/; SameSite=Lax`
}

// Signs out "don't remember me" sessions once the browser has been closed (session cookie gone).
export function RememberGuard() {
  const { isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  useEffect(() => {
    if (!isLoaded || !isSignedIn || localStorage.getItem(FORGET_KEY) !== "1") return
    if (document.cookie.split("; ").includes(ALIVE)) return
    localStorage.removeItem(FORGET_KEY)
    signOut({ redirectUrl: "/sign-in" })
  }, [isLoaded, isSignedIn, signOut])
  return null
}
