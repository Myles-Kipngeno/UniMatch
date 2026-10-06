/**
 * Computes the great-circle distance between two GPS points using the Haversine formula.
 * Returns distance in kilometers, or null if coordinates are invalid.
 */
export function getHaversineDistanceKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  const isValid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

  if (!isValid(lat1) || !isValid(lon1) || !isValid(lat2) || !isValid(lon2)) {
    return null
  }

  const R = 6371 // Earth's mean radius in km
  const toRad = (deg: number) => deg * (Math.PI / 180)

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const radLat1 = toRad(lat1)
  const radLat2 = toRad(lat2)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Returns a precise human-readable distance or intelligent campus fallback.
 * Never outputs a fake, hardcoded number.
 */
export function formatPreciseDistance(
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  targetLat: number | null | undefined,
  targetLng: number | null | undefined,
  locationName?: string | null,
  campus?: string | null,
  university?: string | null
): string {
  const km = getHaversineDistanceKm(userLat, userLng, targetLat, targetLng)

  if (km !== null) {
    if (km < 0.1) {
      return '📍 Nearby on campus (< 100 m)'
    }
    if (km < 1) {
      return `📍 ${Math.round(km * 1000)} m away`
    }
    return `📍 ${km.toFixed(1)} km away`
  }

  // Fallbacks when GPS is unavailable on one or both devices
  if (locationName && locationName.trim()) {
    return `📍 At ${locationName.trim()}`
  }

  if (campus && campus.trim()) {
    return `📍 ${campus.trim()}`
  }

  if (university && university.trim()) {
    return `📍 ${university.trim()}`
  }

  return '📍 Kabarak University'
}
