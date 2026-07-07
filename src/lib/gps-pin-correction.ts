// GPS-at-knock pin correction.
//
// When a rep dispositions a door they are physically standing at it, so their
// phone GPS is the most accurate coordinate we'll ever get for that address —
// better than the OSM-centroid / interpolated pin the lead was imported with.
// We overwrite the lead's pin in place. Two gates keep a bad fix from making a
// good pin worse:
//   - the fix must be tight: accuracy radius <= MAX_GPS_ACCURACY_M
//   - it must land near the existing pin (<= MAX_PIN_DRIFT_M) so a wrong-pin
//     tap or a GPS spike can't teleport a lead across the map.
// The proximity gate is skipped when the lead has no coords yet — then any
// tight fix is a strict improvement (this backfills carrier-XLSX leads that
// shipped without coordinates).

export const MAX_GPS_ACCURACY_M = 10
export const MAX_PIN_DRIFT_M = 40

/** Great-circle distance between two lat/lng points, in meters. */
export function metersBetween(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6_371_000 // earth radius, meters
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface GpsPinInput {
  /** True for any disposition except PENDING — a rep re-opening a pin and
   *  clearing it back to PENDING isn't standing at the door. */
  isRealDisposition: boolean
  leadLat: number | null
  leadLng: number | null
  gpsLat: unknown
  gpsLng: unknown
  gpsAccuracy: unknown
}

export interface GpsPinUpdate {
  lat: number
  lng: number
  coordSource: string
  coordsUpdatedAt: Date
}

/**
 * Decide whether a rep's GPS fix should become the lead's canonical pin.
 * Returns the fields to write, or null when the fix doesn't pass the gates.
 */
export function computeGpsPinCorrection(input: GpsPinInput): GpsPinUpdate | null {
  if (!input.isRealDisposition) return null

  const gpsLat = Number(input.gpsLat)
  const gpsLng = Number(input.gpsLng)
  const gpsAccuracy = Number(input.gpsAccuracy)
  if (!Number.isFinite(gpsLat) || !Number.isFinite(gpsLng) || !Number.isFinite(gpsAccuracy)) {
    return null
  }
  if (gpsAccuracy > MAX_GPS_ACCURACY_M) return null

  const hasPin = typeof input.leadLat === "number" && typeof input.leadLng === "number"
  if (hasPin) {
    const drift = metersBetween(input.leadLat as number, input.leadLng as number, gpsLat, gpsLng)
    if (drift > MAX_PIN_DRIFT_M) return null
  }

  return { lat: gpsLat, lng: gpsLng, coordSource: "rep_gps", coordsUpdatedAt: new Date() }
}
