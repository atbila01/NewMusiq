import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import Icon from "./Icon"
import AccountMenu from "./AccountMenu"
import { initials, useProfile } from "@/lib/profile"

const NAV = [
  { label: "Explore", icon: "globe", to: "/" },
  { label: "Search", icon: "search", to: "/search" },
  { label: "Profile", icon: "profile", to: "/profile" },
  { label: "Artist Studio", icon: "studio", to: "/studio" },
  { label: "Settings", icon: "settings", to: "/settings" },
  { label: "Admin", icon: "shield", to: "/admin", admin: true },
  { label: "Contact Us", icon: "contact", to: "/contact" },
]

const slug = (s) => s.toLowerCase().replace(/\s+/g, "-")

export function Avatar({ className = "profile-avatar", testId }) {
  const { profile, photoUrl } = useProfile()
  return (
    <div className={className} data-testid={testId}>
      {photoUrl ? <img src={photoUrl} alt="" className="profile-avatar-img" /> : initials(profile?.username)}
    </div>
  )
}

export default function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { profile, role } = useProfile()
  const navigate = useNavigate()

  return (
    <aside className="player-sidebar">
      <button className="player-wordmark" type="button" data-testid="player-wordmark" onClick={() => navigate("/")}>NewMusiq</button>
      <nav className="player-nav" aria-label="Main navigation">
        {NAV.filter((n) => !n.admin || role === "admin").map((item) => (
          <NavLink key={item.label} to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}
            data-testid={`nav-${slug(item.label)}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-profile" data-testid="sidebar-profile">
        <Avatar testId="sidebar-avatar" />
        <div>
          <strong data-testid="sidebar-display-name">{profile?.username}</strong>
          <span data-testid="sidebar-plan-name">{profile?.plan_name || "Listener"}</span>
        </div>
        <button type="button" aria-label="More account options" aria-expanded={menuOpen}
          data-testid="account-menu-button" onClick={() => setMenuOpen((o) => !o)}>
          <Icon name="more" />
        </button>
        {menuOpen && <AccountMenu />}
      </div>
    </aside>
  )
}
