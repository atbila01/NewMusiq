import { useNavigate } from "react-router-dom"
import { useClerk } from "@clerk/react"
import { useProfile } from "@/lib/profile"

export default function AccountMenu({ idPrefix = "account-menu", className = "" }) {
  const { signOut } = useClerk()
  const navigate = useNavigate()
  const { role } = useProfile()
  return (
    <div className={`account-menu ${className}`} role="menu" data-testid={idPrefix}>
      <button type="button" role="menuitem" data-testid={`${idPrefix}-edit-profile`}
        onClick={() => navigate("/complete-profile")}>Edit profile</button>
      <button type="button" role="menuitem" data-testid={`${idPrefix}-change-plan`}
        onClick={() => navigate("/subscribe")}>Change plan</button>
      {role === "admin" && (
        <button type="button" role="menuitem" data-testid={`${idPrefix}-admin`} onClick={() => navigate("/admin")}>Admin</button>
      )}
      <button type="button" role="menuitem" data-testid={`${idPrefix}-sign-out`}
        onClick={() => signOut({ redirectUrl: "/sign-in" })}>Sign out</button>
    </div>
  )
}
