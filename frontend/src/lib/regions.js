import { geoBounds, geoCentroid, geoContains } from "d3-geo"
import { feature } from "topojson-client"
import worldData from "world-atlas/countries-50m.json"
import usData from "us-atlas/states-10m.json"

let countries, states

export function latLonFromPoint([x, y, z]) {
  const r = Math.hypot(x, y, z)
  const lat = 90 - (Math.acos(y / r) * 180) / Math.PI
  let lon = (Math.atan2(z, -x) * 180) / Math.PI - 180
  if (lon < -180) lon += 360
  return { lat, lon }
}

export function findRegion(lon, lat) {
  countries ||= feature(worldData, worldData.objects.countries).features
  const country = countries.find((f) => geoContains(f, [lon, lat]))
  if (!country) return null
  const countryName = country.properties?.name || ""
  if (countryName === "United States of America") {
    states ||= feature(usData, usData.objects.states).features
    const state = states.find((f) => geoContains(f, [lon, lat]))
    return { country: countryName, state: state?.properties?.name || "" }
  }
  return { country: countryName, state: "" }
}

export function findStateLocation(query) {
  const q = query.trim().toLowerCase()
  states ||= feature(usData, usData.objects.states).features
  const state = states.find((f) => (f.properties?.name || "").toLowerCase() === q)
  if (!state) return null
  const [longitude, latitude] = geoCentroid(state)
  const [[w, s], [e, n]] = geoBounds(state)
  const visible = Math.max(Math.abs(n - s), Math.abs(e - w) * Math.cos((latitude * Math.PI) / 180))
  return { label: state.properties.name, latitude, longitude, cameraDistance: Math.min(3.2, Math.max(1.38, 1.35 + visible / 25)) }
}
