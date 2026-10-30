"use server"

import config from "@payload-config"
import { Country, State } from "country-state-city"
import { getPayload } from "payload"

export type CommentActionResult = {
  ok: true
  comment: {
    id: string
    displayName: string
    message: string
    createdAt: string
    pending: true
  }
} | {
  ok: false
  error: string
}

export type LocationSearchResult = {
  ok: true
  location: {
    cameraDistance: number
    label: string
    latitude: number
    longitude: number
  }
} | {
  ok: false
  error: string
}

function normalizeLocationName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function findSubdivision(locationName: string) {
  const [subdivisionQuery, countryQuery] = locationName
    .split(",")
    .map((part) => part.trim())
  const normalizedSubdivision = normalizeLocationName(subdivisionQuery)
  const normalizedCountry = countryQuery
    ? normalizeLocationName(countryQuery)
    : ""
  const countries = Country.getAllCountries()
  const country = normalizedCountry
    ? countries.find(
        (item) =>
          normalizeLocationName(item.name) === normalizedCountry ||
          normalizeLocationName(item.isoCode) === normalizedCountry,
      )
    : undefined
  const subdivision = State.getAllStates().find(
    (item) =>
      (normalizeLocationName(item.name) === normalizedSubdivision ||
        normalizeLocationName(item.isoCode) === normalizedSubdivision) &&
      (!country || item.countryCode === country.isoCode),
  )
  const latitude = Number(subdivision?.latitude)
  const longitude = Number(subdivision?.longitude)

  if (
    !subdivision ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null
  }

  const subdivisionCountry = countries.find(
    (item) => item.isoCode === subdivision.countryCode,
  )

  return {
    cameraDistance: 1.78,
    label: subdivisionCountry
      ? `${subdivision.name}, ${subdivisionCountry.name}`
      : subdivision.name,
    latitude,
    longitude,
  }
}

export async function searchGlobeLocation(
  query: string,
): Promise<LocationSearchResult> {
  const locationName = query.trim()

  if (locationName.length < 2 || locationName.length > 120) {
    return { ok: false, error: "Enter a valid location name." }
  }

  const subdivision = findSubdivision(locationName)
  if (subdivision) {
    return {
      ok: true,
      location: subdivision,
    }
  }

  try {
    const searchParams = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      q: locationName,
    })
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: {
          "Accept-Language": "en",
          "User-Agent": "NewMusiq/1.0",
        },
      },
    )

    if (!response.ok) {
      return { ok: false, error: "Location search is unavailable right now." }
    }

    const matches = (await response.json()) as Array<{
      boundingbox?: [string, string, string, string]
      display_name?: string
      lat?: string
      lon?: string
    }>
    const match = matches[0]
    const latitude = Number(match?.lat)
    const longitude = Number(match?.lon)

    if (!match || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, error: "No matching location was found." }
    }

    const [south, north, west, east] = (match.boundingbox || []).map(Number)
    const latitudeSpan =
      Number.isFinite(south) && Number.isFinite(north)
        ? Math.abs(north - south)
        : 0
    const rawLongitudeSpan =
      Number.isFinite(west) && Number.isFinite(east) ? Math.abs(east - west) : 0
    const longitudeSpan = Math.min(rawLongitudeSpan, 360 - rawLongitudeSpan)
    const visibleSpan = Math.max(
      latitudeSpan,
      longitudeSpan * Math.cos((latitude * Math.PI) / 180),
    )
    const cameraDistance = Math.min(
      3.2,
      Math.max(1.38, 1.35 + visibleSpan / 25),
    )

    return {
      ok: true,
      location: {
        cameraDistance,
        label: match.display_name?.split(",")[0] || locationName,
        latitude,
        longitude,
      },
    }
  } catch {
    return { ok: false, error: "Location search is unavailable right now." }
  }
}

export async function submitListenerComment(input: {
  displayName: string
  message: string
}): Promise<CommentActionResult> {
  const displayName = input.displayName.trim()
  const message = input.message.trim()

  if (!displayName || displayName.length > 60) {
    return { ok: false, error: "Enter a valid display name." }
  }

  if (!message || message.length > 600) {
    return {
      ok: false,
      error: "Feedback must be between 1 and 600 characters.",
    }
  }

  try {
    const payload = await getPayload({ config })
    const comment = await payload.create({
      collection: "listener-comments",
      data: {
        displayName,
        message,
        status: "pending",
        trackKey: "golden-moon",
      },
      draft: false,
      overrideAccess: false,
    })

    return {
      ok: true,
      comment: {
        id: String(comment.id),
        displayName: comment.displayName,
        message: comment.message,
        createdAt: comment.createdAt,
        pending: true,
      },
    }
  } catch {
    return {
      ok: false,
      error: "Your feedback could not be submitted. Please try again.",
    }
  }
}
