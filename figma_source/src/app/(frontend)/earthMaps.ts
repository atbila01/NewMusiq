import {
  geoArea,
  geoCentroid,
  geoEquirectangular,
  geoGraticule10,
  geoPath,
} from "d3-geo"
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Position,
} from "geojson"
import { feature, mesh } from "topojson-client"
import type { GeometryCollection, Topology } from "topojson-specification"
import admin1LinesData from "./data/admin1-lines.json"
import worldData from "world-atlas/countries-50m.json"

const WIDTH = 4096
const HEIGHT = 2048

function createCanvas() {
  const canvas = document.createElement("canvas")
  canvas.width = WIDTH
  canvas.height = HEIGHT
  return canvas
}

function normalizeLocationName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function pointOnGlobe([longitude, latitude]: Position) {
  const radius = 1.012
  const phi = ((longitude + 180) * Math.PI) / 180
  const theta = ((90 - latitude) * Math.PI) / 180
  return [
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

export function createAdminBoundaryPositions() {
  const data =
    admin1LinesData as unknown as FeatureCollection<LineString | MultiLineString>
  const positions: number[] = []

  for (const boundary of data.features) {
    const lines =
      boundary.geometry.type === "LineString"
        ? [boundary.geometry.coordinates]
        : boundary.geometry.coordinates

    for (const line of lines) {
      for (let index = 0; index < line.length - 1; index += 1) {
        positions.push(...pointOnGlobe(line[index]))
        positions.push(...pointOnGlobe(line[index + 1]))
      }
    }
  }

  return positions
}

export function findCountryLocation(query: string) {
  const aliases: Record<string, string> = {
    america: "unitedstatesofamerica",
    britain: "unitedkingdom",
    england: "unitedkingdom",
    greatbritain: "unitedkingdom",
    uk: "unitedkingdom",
    us: "unitedstatesofamerica",
    usa: "unitedstatesofamerica",
    unitedstates: "unitedstatesofamerica",
  }
  const normalizedQuery = normalizeLocationName(query)
  const targetName = aliases[normalizedQuery] || normalizedQuery
  const topology = worldData as unknown as Topology<{
    countries: GeometryCollection
    land: GeometryCollection
  }>
  const countries = feature(topology, topology.objects.countries)
  const country = countries.features.find((item) => {
    const properties = item.properties as { name?: string } | null
    return normalizeLocationName(String(properties?.name || "")) === targetName
  })

  if (!country) return null

  const [longitude, latitude] = geoCentroid(country)
  const angularDiameter =
    2 * Math.sqrt(geoArea(country) / Math.PI) * (180 / Math.PI)
  const cameraDistance = Math.min(
    3.2,
    Math.max(1.38, 1.35 + angularDiameter / 25),
  )
  const properties = country.properties as { name?: string } | null
  return {
    cameraDistance,
    label: String(properties?.name || query),
    latitude,
    longitude,
  }
}

export function createEarthMaps() {
  const color = createCanvas()
  const height = createCanvas()
  const colorContext = color.getContext("2d")
  const heightContext = height.getContext("2d")

  if (!colorContext || !heightContext) return { color, height }

  const topology = worldData as unknown as Topology<{
    countries: GeometryCollection
    land: GeometryCollection
  }>
  const countriesObject = topology.objects.countries
  const countries = feature(topology, countriesObject)
  const countryBorders = mesh(
    topology,
    countriesObject,
    (countryA, countryB) => countryA !== countryB,
  )
  const coastlines = mesh(
    topology,
    countriesObject,
    (countryA, countryB) => countryA === countryB,
  )
  const projection = geoEquirectangular()
    .translate([WIDTH / 2, HEIGHT / 2])
    .scale(WIDTH / (2 * Math.PI))
    .precision(0.1)

  const ocean = colorContext.createRadialGradient(
    WIDTH * 0.35,
    HEIGHT * 0.22,
    WIDTH * 0.04,
    WIDTH * 0.5,
    HEIGHT * 0.52,
    WIDTH * 0.62,
  )
  ocean.addColorStop(0, "#3b2053")
  ocean.addColorStop(0.42, "#211033")
  ocean.addColorStop(0.78, "#120820")
  ocean.addColorStop(1, "#07030e")
  colorContext.fillStyle = ocean
  colorContext.fillRect(0, 0, WIDTH, HEIGHT)

  const oceanGlow = colorContext.createLinearGradient(0, 0, 0, HEIGHT)
  oceanGlow.addColorStop(0, "rgba(179, 121, 198, .16)")
  oceanGlow.addColorStop(0.25, "rgba(116, 67, 139, .04)")
  oceanGlow.addColorStop(0.72, "rgba(4, 2, 10, .06)")
  oceanGlow.addColorStop(1, "rgba(2, 1, 6, .4)")
  colorContext.fillStyle = oceanGlow
  colorContext.fillRect(0, 0, WIDTH, HEIGHT)

  const colorPath = geoPath(projection, colorContext)
  colorContext.beginPath()
  colorPath(geoGraticule10())
  colorContext.strokeStyle = "rgba(244, 218, 143, .07)"
  colorContext.lineWidth = 1.25
  colorContext.stroke()

  colorContext.save()
  colorContext.shadowColor = "rgba(237, 187, 84, .35)"
  colorContext.shadowBlur = 14
  colorContext.beginPath()
  colorPath(countries)
  const land = colorContext.createLinearGradient(0, 0, WIDTH, HEIGHT)
  land.addColorStop(0, "#f1d58a")
  land.addColorStop(0.34, "#d7aa50")
  land.addColorStop(0.7, "#b57d2e")
  land.addColorStop(1, "#76501f")
  colorContext.fillStyle = land
  colorContext.fill()
  colorContext.restore()

  colorContext.beginPath()
  colorPath(countryBorders)
  colorContext.strokeStyle = "rgba(142, 103, 31, .92)"
  colorContext.lineWidth = 1.35
  colorContext.stroke()

  // A subtle base trace guarantees boundaries remain legible on close zoom.
  colorContext.lineCap = "round"
  colorContext.lineJoin = "round"
  colorContext.beginPath()
  colorPath(admin1LinesData as unknown as FeatureCollection)
  colorContext.strokeStyle = "rgba(45, 25, 7, .82)"
  colorContext.lineWidth = 4.2
  colorContext.stroke()
  colorContext.beginPath()
  colorPath(admin1LinesData as unknown as FeatureCollection)
  colorContext.strokeStyle = "rgba(191, 139, 40, .78)"
  colorContext.lineWidth = 1.8
  colorContext.stroke()

  colorContext.beginPath()
  colorPath(coastlines)
  colorContext.strokeStyle = "#f8dda0"
  colorContext.lineWidth = 3.25
  colorContext.stroke()

  heightContext.fillStyle = "#181818"
  heightContext.fillRect(0, 0, WIDTH, HEIGHT)
  const heightPath = geoPath(projection, heightContext)
  heightContext.save()
  heightContext.shadowColor = "#ffffff"
  heightContext.shadowBlur = 6
  heightContext.beginPath()
  heightPath(countries)
  heightContext.fillStyle = "#c8c8c8"
  heightContext.fill()
  heightContext.restore()

  heightContext.beginPath()
  heightPath(coastlines)
  heightContext.strokeStyle = "#f4f4f4"
  heightContext.lineWidth = 2.5
  heightContext.stroke()

  return { color, height }
}
