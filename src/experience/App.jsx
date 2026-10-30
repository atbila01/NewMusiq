import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { Show } from "@experience/lib/auth"
import ClerkAuthProvider from "@experience/components/auth/ClerkAuthProvider"
import { SignInPage, SignUpPage } from "@experience/components/AuthPages"
const ProfileSetup = lazy(() => import("@experience/components/ProfileSetup"))
import Subscribe from "@experience/components/Subscribe"
import { PaymentCancel, PaymentSuccess } from "@experience/components/PaymentResult"
import PlayerScreen from "@experience/components/PlayerScreen"
const GlobeHome = lazy(() => import("@experience/components/GlobeHome"))
const SearchScreen = lazy(() => import("@experience/components/screens/SearchScreen"))
const ProfileScreen = lazy(() => import("@experience/components/screens/ProfileScreen"))
const StudioScreen = lazy(() => import("@experience/components/screens/StudioScreen"))
const UploadScreen = lazy(() => import("@experience/components/screens/UploadScreen"))
const SettingsScreen = lazy(() => import("@experience/components/screens/SettingsScreen"))
const AdminScreen = lazy(() => import("@experience/components/screens/AdminScreen"))
const ContactScreen = lazy(() => import("@experience/components/screens/ContactScreen"))
import { ProfileProvider, useProfile } from "@experience/lib/profile"
import { ArtistAccessPage } from "../components/pages/ArtistAccessPage"
import PasswordReset from "./components/PasswordReset"
import { RememberGuard } from "@experience/lib/remember"

function Protected({ children }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
    </>
  )
}

function SignedOutOnly({ children }) {
  return (
    <>
      <Show when="signed-out">{children}</Show>
      <Show when="signed-in"><Navigate to="/" replace /></Show>
    </>
  )
}

function Loading() {
  const { error, refresh } = useProfile()
  return (
    <div className="app-loading" data-testid="app-loading">
      {error ? (
        <div className="app-error">
          <p data-testid="app-load-error">{error}</p>
          <button type="button" onClick={() => refresh().catch(() => {})} data-testid="app-retry-button">Try again</button>
        </div>
      ) : "Loading your music home…"}
    </div>
  )
}

function WithProfile({ children }) {
  const { profile } = useProfile()
  return profile ? children : <Loading />
}

function Home() {
  const { profile } = useProfile()
  if (new URLSearchParams(window.location.search).get("reset") === "1") return <Navigate to="/account/reset" replace />
  if (window.location.hash.startsWith("#billing")) return <Navigate to="/subscribe" replace />
  if (!profile.completed) return <Navigate to="/complete-profile" replace />
  
  return <PlayerScreen />
}

const SCREENS = [["artist-access", ArtistAccessScreen], ["search", SearchScreen], ["profile", ProfileScreen], ["studio", StudioScreen], ["studio/upload", UploadScreen],
  ["settings", SettingsScreen], ["admin", AdminScreen], ["contact", ContactScreen]]

function ArtistAccessScreen() {
 const navigate=useNavigate();
 return <ArtistAccessPage onArtistSelect={name=>navigate(`/search?artist=${encodeURIComponent(name)}`)} />;
}
function SubscribeRoute() {
  const { profile } = useProfile()
  if (!profile.completed) return <Navigate to="/complete-profile" replace />
  return <Subscribe />
}

const guard = (el) => <Protected><WithProfile>{el}</WithProfile></Protected>

export default function App() {
  return (
    <BrowserRouter>
      <ClerkAuthProvider>
        <RememberGuard />
        <ProfileProvider>
          <Suspense fallback={<div className="app-loading">Loading NewMusiq…</div>}>
          <Routes>
            <Route path="/sign-in/*" element={<SignedOutOnly><SignInPage /></SignedOutOnly>} />
            <Route path="/sign-up/*" element={<SignedOutOnly><SignUpPage /></SignedOutOnly>} />
            <Route path="/account/reset" element={<Protected><PasswordReset /></Protected>} />
            <Route path="/complete-profile" element={guard(<ProfileSetup />)} />
            <Route path="/subscribe" element={guard(<SubscribeRoute />)} />
            <Route path="/payment/success" element={<Protected><PaymentSuccess /></Protected>} />
            <Route path="/payment/cancel" element={<Protected><PaymentCancel /></Protected>} />
            <Route path="/" element={guard(<Home />)}>
              <Route index element={<GlobeHome />} />
              {SCREENS.map(([path, C]) => <Route key={path} path={path} element={<C />} />)}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </ProfileProvider>
      </ClerkAuthProvider>
    </BrowserRouter>
  )
}
