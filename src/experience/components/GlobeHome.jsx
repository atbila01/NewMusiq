import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { findCountryLocation } from "@experience/lib/earthMaps"
import { findStateLocation } from "@experience/lib/regions"
import { Avatar } from "./Sidebar"
import AccountMenu from "./AccountMenu"
import GlobeSearch from "./GlobeSearch"
import EarthGlobe from "./EarthGlobe"
import RegionPopup from "./RegionPopup"
import { findRegion } from "@experience/lib/regions"
import WelcomeTour from "./WelcomeTour"

export default function GlobeHome() {
  const [globeLocation, setGlobeLocation] = useState(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [region, setRegion] = useState(null)
  const [pending, setPending] = useState(null)
  const confirmationRef=useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const st = location.state
    if (!st) return
    if (st.focus) {
      const loc = (st.focus.state && findStateLocation(st.focus.state)) || findCountryLocation(st.focus.country)
      if (loc) setPending({ location: loc, region: { country: st.focus.country, state: st.focus.state || "" } })
    }
    if (st.openPlayer) setTimeout(() => window.dispatchEvent(new Event("nm-open-player")), 300)
    navigate(".", { replace: true, state: null })
  }, [location.state, navigate])

  useEffect(()=>{
    if(!pending)return;
    const before=document.activeElement;
    const buttons=()=>Array.from(confirmationRef.current?.querySelectorAll('button') || []);
    buttons()[0]?.focus();
    const key=e=>{if(e.key==='Escape'){e.preventDefault();setPending(null);}if(e.key==='Tab'){const all=buttons();const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
    window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);before?.focus?.();};
  },[pending]);
  return (
    <>
      <header className="player-header">
        <GlobeSearch onLocate={loc => setPending({ location: loc, region: findRegion(loc.longitude, loc.latitude) })} />
        <button type="button" className="ghost-btn" onClick={()=>navigate("/search")}>Find music</button>
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
          onRegionClick={({ lat, lon }) => { const r = findRegion(lon, lat); if (r) setPending({ region: r }) }} />
        {region && <RegionPopup region={region} onClose={() => setRegion(null)} />}
      </div>
      {pending && <div className="modal-backdrop" role="presentation"><section ref={confirmationRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-region-title">
        <h2 id="confirm-region-title">Confirm place</h2><p>Select {pending.region?.state || pending.region?.country || pending.location?.label} and explore its music?</p>
        <div className="modal-actions"><button autoFocus type="button" onClick={()=>setPending(null)}>Cancel</button><button type="button" onClick={()=>{ if(pending.location) setGlobeLocation({...pending.location,key:Date.now()}); if(pending.region) setRegion(pending.region); setPending(null); }}>Yes, select this place</button></div>
      </section></div>}
      <WelcomeTour />
    </>
  )
}
