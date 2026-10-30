import React, { useEffect, useRef, useState } from 'react';
import { Globe2, Search } from 'lucide-react';
import * as L from '../../vendor/leaflet/leaflet-src.esm.js';
import '../../vendor/leaflet/leaflet.css';
import earthAtNight from '../../assets/earth-at-night-mercator.jpg';
import { searchArtistOrigins, locateArtistOrigin } from '../../lib/artistOrigins';

const regions = [
  { name: 'North America', center: [39, -98] },
  { name: 'South America', center: [-16, -61] },
  { name: 'Europe', center: [51, 12] },
  { name: 'Africa', center: [2, 20] },
  { name: 'Asia', center: [34, 100] },
  { name: 'Oceania', center: [-25, 134] }
];
const worldBounds = [[-85.05112878, -180], [85.05112878, 180]];

export function WorldMapPage({ onPlaceSelect, targetLocation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const searchRequestRef = useRef(0);
  const artistMarkerRef = useRef(null);
  const containerRef = useRef(null);
  const zoomPanelRef = useRef(null);
  const mapRef = useRef(null);
  const confirmationRef = useRef(null);
  const focusMarkerRef = useRef(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [selected, setSelected] = useState('North America');
  const [tileError, setTileError] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [focusPoint, setFocusPoint] = useState(null);

  useEffect(() => () => { searchRequestRef.current += 1; }, []);

  const searchArtists = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    const request = ++searchRequestRef.current;
    setSearchBusy(true);
    setResults([]);
    artistMarkerRef.current?.remove();
    setSearchStatus('Searching artists and bands…');
    try {
      const matches = await searchArtistOrigins(query);
      if (request !== searchRequestRef.current) return;
      setResults(matches);
      setSearchStatus(matches.length ? 'Choose an artist or band to find their origin on the map.' : 'No artists or bands found. Try another name.');
    } catch {
      if (request === searchRequestRef.current) setSearchStatus('Search is unavailable right now. Please try again.');
    } finally {
      if (request === searchRequestRef.current) setSearchBusy(false);
    }
  };

  const showArtistOrigin = async (artist) => {
    const request = ++searchRequestRef.current;
    setSearchBusy(true);
    setSearchStatus(`Finding ${artist.name}’s origin…`);
    artistMarkerRef.current?.remove();
    try {
      const point = await locateArtistOrigin(artist);
      if (request !== searchRequestRef.current || !mapRef.current) return;
      const label = document.createElement('span');
      label.textContent = `${artist.name} — ${artist.origin.name} (place of origin)`;
      artistMarkerRef.current = L.circleMarker(point, {
        radius: 10, color: '#ffffff', weight: 3, fillColor: '#d6a855', fillOpacity: 1,
        bubblingMouseEvents: false,
      }).bindTooltip(label, { permanent: true, direction: 'top' }).addTo(mapRef.current);
      artistMarkerRef.current.on('click', () => setPendingPlace({ name: artist.origin.name, point, zoom: 10 }));
      mapRef.current.flyTo(point, 10, { duration: 0.7 });
      setSearchStatus(`${artist.name} — ${artist.origin.name}. Showing their place of origin.`);
    } catch (error) {
      if (request === searchRequestRef.current) setSearchStatus(error.message || 'Could not load this origin. Please try again.');
    } finally {
      if (request === searchRequestRef.current) setSearchBusy(false);
    }
  };

  useEffect(() => {
    if (pendingPlace) confirmationRef.current?.showModal();
    else confirmationRef.current?.close();
  }, [pendingPlace]);

  useEffect(() => {
    const map = L.map(containerRef.current, {
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      doubleClickZoom: false,
      maxBounds: worldBounds,
      maxBoundsViscosity: 1,
      scrollWheelZoom: true
    }).setView([17, 0], 2);
    mapRef.current = map;
    const sizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    sizeObserver.observe(containerRef.current);
    L.DomEvent.disableClickPropagation(zoomPanelRef.current);
    L.DomEvent.disableScrollPropagation(zoomPanelRef.current);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomleft', metric: true, imperial: true }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    map.createPane('nightPane');
    map.getPane('nightPane').style.zIndex = 150;
    L.imageOverlay(earthAtNight, worldBounds, {
      pane: 'nightPane',
      className: 'world-night-image',
      attribution: 'Night imagery: <a href="https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/">NASA Earth Observatory</a>'
    }).addTo(map);

    // City detail loads only when the listener zooms in; no tiles are prefetched.
    const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      noWrap: true,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    streets.on('tileerror', () => setTileError(true));
    streets.on('tileload', () => setTileError(false));

    const markers = L.layerGroup(regions.map(region => L.circleMarker(region.center, {
      radius: 9,
      color: '#fff3c7',
      weight: 2,
      fillColor: '#d6a855',
      fillOpacity: 0.95,
      bubblingMouseEvents: false
    }).bindTooltip(region.name).on('click', () => {
      setPendingPlace({ name: region.name, point: region.center, zoom: 5, region: true });
    }))).addTo(map);
    const focusMarker = L.circleMarker([0, 0], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#59c7e8',
      fillOpacity: 1
    });
    focusMarkerRef.current = focusMarker;

    let selectionTimer;
    const choosePoint = (event) => {
      clearTimeout(selectionTimer);
      const point = [event.latlng.lat, event.latlng.lng];
      selectionTimer = setTimeout(() => {
        setPendingPlace({ name: `the place at ${point[0].toFixed(4)}, ${point[1].toFixed(4)}`, point });
      }, 300);
    };
    const zoomToPoint = (event) => {
      clearTimeout(selectionTimer);
      const point = [event.latlng.lat, event.latlng.lng];
      setPendingPlace({ name: `the place at ${point[0].toFixed(4)}, ${point[1].toFixed(4)}`, point,
        zoom: Math.min(19, Math.max(12, map.getZoom() + 3)) });
    };

    const updateLayers = () => {
      setZoom(map.getZoom());
      if (map.getZoom() >= 4) {
        if (!map.hasLayer(streets)) streets.addTo(map);
      } else if (map.hasLayer(streets)) {
        map.removeLayer(streets);
        setTileError(false);
      }
      if (map.getZoom() >= 7) {
        if (map.hasLayer(markers)) map.removeLayer(markers);
      } else if (!map.hasLayer(markers)) markers.addTo(map);
    };
    map.on('zoomend', updateLayers);
    map.on('click', choosePoint);
    map.on('dblclick', zoomToPoint);

    return () => {
      clearTimeout(selectionTimer);
      sizeObserver.disconnect();
      map.off('zoomend', updateLayers);
      map.off('click', choosePoint);
      map.off('dblclick', zoomToPoint);
      map.remove();
      mapRef.current = null;
      focusMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!targetLocation || !mapRef.current) return;
    const { latitude, longitude, label } = targetLocation;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 85.05112878 || Math.abs(longitude) > 180) return;
    setPendingPlace({ name: label || 'this place', point: [latitude, longitude], zoom: 7 });
  }, [targetLocation]);

  const chooseRegion = (region) => {
    setPendingPlace({ name: region.name, point: region.center, zoom: 5, region: true });
  };
  const confirmPlace = () => {
    if (!pendingPlace || !mapRef.current) return;
    if (pendingPlace.region) setSelected(pendingPlace.name);
    setFocusPoint(pendingPlace.point);
    focusMarkerRef.current?.setLatLng(pendingPlace.point).addTo(mapRef.current);
    if (pendingPlace.zoom) mapRef.current.flyTo(pendingPlace.point, pendingPlace.zoom, { duration: 0.7 });
    onPlaceSelect?.({
      name: pendingPlace.name,
      latitude: pendingPlace.point[0],
      longitude: pendingPlace.point[1],
    });
    setPendingPlace(null);
  };
  const scaleLabel = zoom <= 3 ? 'World' : zoom <= 7 ? 'Region' : zoom <= 12 ? 'City' : 'Street';

  return (
    <div className="world-map-page">
      <dialog ref={confirmationRef} className="place-confirmation" aria-labelledby="place-confirmation-title"
        onCancel={() => setPendingPlace(null)}>
        <h2 id="place-confirmation-title">Confirm place</h2>
        <p>Are you sure you want to select {pendingPlace?.name}?</p>
        <div className="place-confirmation-actions">
          <button type="button" autoFocus onClick={() => setPendingPlace(null)}>Cancel</button>
          <button type="button" onClick={confirmPlace}>Yes, select this place</button>
        </div>
      </dialog>
      <div className="world-map-intro">
        <div className="world-map-intro-row">
          <div>
            <p className="eyebrow"><Globe2 size={15} /> EXPLORE</p>
            <h1>World Map</h1>
            <p>Drag to explore, use the scale slider, or double-click a city to zoom straight in.</p>
          </div>
        </div>
      </div>

      <section className="map-artist-search" aria-label="Find artists on the map">
        <form className="inline-search" onSubmit={searchArtists} role="search">
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Search artists or bands by name" placeholder="Search an artist or band…"
            value={query} maxLength={120} onChange={event => {
              setQuery(event.target.value);
              searchRequestRef.current += 1;
              setSearchBusy(false);
              setResults([]);
              setSearchStatus('');
              artistMarkerRef.current?.remove();
            }} />
          <button type="submit" disabled={searchBusy || !query.trim()}>Search map</button>
        </form>
        <p>Find artists and bands by hometown or place of origin.</p>
        <p role="status">{searchStatus}</p>
        {results.length > 0 && <ul className="map-artist-results">
          {results.map(artist => <li key={artist.id}>
            <button type="button" disabled={searchBusy || !artist.origin} onClick={() => showArtistOrigin(artist)}>
              <strong>{artist.name}</strong>
              <span>{[artist.type, artist.description, artist.origin?.name || 'Origin unavailable', artist.country].filter(Boolean).join(' · ')}</span>
            </button>
          </li>)}
        </ul>}
        <small>Artist origins: <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> · Map coordinates: <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</a></small>
      </section>

      <div className="world-map-card">
        <div className="world-map-canvas">
          <div className="world-map-interactive" ref={containerRef} aria-label="Interactive world map; drag to pan and scroll or pinch to zoom" />
          <div className="world-map-zoom-panel" ref={zoomPanelRef}>
            <label htmlFor="world-map-zoom">Map scale</label>
            <input id="world-map-zoom" type="range" min="2" max="19" step="1" value={zoom}
              onChange={event => mapRef.current?.setZoom(Number(event.target.value))} />
            <span>{scaleLabel} · level {zoom}</span>
            <button type="button" disabled={!focusPoint}
              onClick={() => mapRef.current?.flyTo(focusPoint, Math.max(13, mapRef.current.getZoom()), { duration: 0.7 })}>
              {focusPoint ? 'Zoom to selected place' : 'Click a place on the map'}
            </button>
          </div>
          {tileError && <p className="world-map-error" role="status">City map tiles are unavailable right now. Try again when connected.</p>}
        </div>
        <div className="world-map-details">
          <div><span className="eyebrow">SELECTED REGION</span><h2>{selected}</h2></div>
          <div className="world-map-region-list" aria-label="World regions">
            <button type="button" onClick={() => mapRef.current?.flyTo([17, 0], 2, { duration: 0.7 })}>Whole world</button>
            {regions.map(region => (
              <button key={region.name} type="button" className={selected === region.name ? 'active' : ''}
                onClick={() => chooseRegion(region)} aria-pressed={selected === region.name}>
                {region.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
