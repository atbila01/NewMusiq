import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { findCountryLocation } from "@/lib/earthMaps"
import { findStateLocation } from "@/lib/regions"
import { Avatar } from "./Sidebar"
import AccountMenu from "./AccountMenu"
import GlobeSearch from "./GlobeSearch"
import EarthGlobe from "./EarthGlobe"
import RegionPopup from "./RegionPopup"
import { findRegion } from "@/lib/regions"
import WelcomeTour from "./WelcomeTour"

export default function GlobeHome() {
  const [globeLocation, setGlobeLocation] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [region, setRegion] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const st = location.state
    if (!st) return
    if (st.focus) {
      const loc = (st.focus.state && findStateLocation(st.focus.state)) || findCountryLocation(st.focus.country)
      if (loc) setGlobeLocation({ ...loc, key: Date.now() })
      setRegion({ country: st.focus.country, state: st.focus.state || "" })
    }
    if (st.openPlayer) setTimeout(() => window.dispatchEvent(new Event("nm-open-player")), 300)
    navigate(".", { replace: true, state: null })
  }, [location.state, navigate])

  return (
    <>
      <header className="player-header">
        <GlobeSearch onLocate={setGlobeLocation} />
        <div className="live-indicator" data-testid="live-indicator"><span />Live session</div>
        <div className="mobile-account">
          <button type="button" className="mobile-account-button" aria-label="Account" aria-expanded={mobileMenu}
            data-testid="mobile-account-button" onClick={() => setMobileMenu((o) => !o)}>
            <Avatar className="profile-avatar mobile-avatar" />
          </button>
          {mobileMenu && <AccountMenu idPrefix="mobile-account-menu" className="from-top" />}
        </div>
      </header>
      <div className="player-content">
        <EarthGlobe targetLocation={globeLocation}
          onRegionClick={({ lat, lon }) => { const r = findRegion(lon, lat); if (r) setRegion(r) }} />
        {region && <RegionPopup region={region} onClose={() => setRegion(null)} />}
      </div>
      <WelcomeTour />
    </>
  )
}
