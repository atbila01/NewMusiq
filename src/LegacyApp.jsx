import React, { useEffect, useLayoutEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Player } from './components/Player';
import { HomePage } from './components/pages/HomePage';
import { WorldMapPage } from './components/pages/WorldMapPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { SettingsPage } from './components/pages/SettingsPage';
import { ArtistPage } from './components/pages/ArtistPage';
import { ArtistAccessPage } from './components/pages/ArtistAccessPage';
import { SubscriptionPage } from './components/pages/SubscriptionPage';
import { ArtistStudioModal } from './components/modals/ArtistStudioModal';
import { EditProfileModal } from './components/modals/EditProfileModal';
import './styles/index.css';
import { safeStorage } from './lib/safeStorage';

function MainApp({ theme, setTheme }) {
  const { session, loading } = useAuth();
  const [activePage, setActivePage] = useState(() => window.location.hash === '#billing' ? 'billing' : 'home');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [previousPage, setPreviousPage] = useState('home');
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [wideLayout, setWideLayout] = useState(() => window.matchMedia('(min-width: 1100px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1100px)');
    const updateLayout = () => setWideLayout(media.matches);
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);
  const mapSide = activePage === 'world-map' && wideLayout;

  const openArtist = (name) => {
    if (!name) return;
    setPreviousPage(activePage === 'artist' ? previousPage : activePage);
    setSelectedArtist(name);
    setActivePage('artist');
  };

  if (loading) {
    return null;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <div className={`app-shell ${mapSide ? 'map-layout' : ''}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenStudio={() => setIsStudioOpen(true)}
      />

      <main className="content-wrapper">
        <Header
          activePage={activePage}
          setActivePage={setActivePage}
          onOpenSettings={() => setActivePage('settings')}
          onEditProfile={() => setIsEditProfileOpen(true)}
        />

        {activePage === 'home' && <HomePage onArtistSelect={openArtist} />}
        {activePage === 'world-map' && <WorldMapPage />}
        {activePage === 'profile' && <ProfilePage onEditProfile={() => setIsEditProfileOpen(true)} onArtistSelect={openArtist} />}
        {activePage === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} />}
        {activePage === 'artist-access' && <ArtistAccessPage onArtistSelect={openArtist} />}
        {activePage === 'billing' && <SubscriptionPage />}
        {activePage === 'artist' && selectedArtist && <ArtistPage artistName={selectedArtist} onBack={() => setActivePage(previousPage)} />}
      </main>

      <Player mapSide={mapSide} />

      {isStudioOpen && (
        <ArtistStudioModal onClose={() => setIsStudioOpen(false)} />
      )}

      {isEditProfileOpen && (
        <EditProfileModal onClose={() => setIsEditProfileOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => safeStorage.getItem('soundwave-theme') === 'dark' ? 'dark' : 'light');

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    safeStorage.setItem('soundwave-theme', theme);
  }, [theme]);

  return (
    <AuthProvider>
      <AudioProvider>
        <MainApp theme={theme} setTheme={setTheme} />
      </AudioProvider>
    </AuthProvider>
  );
}
