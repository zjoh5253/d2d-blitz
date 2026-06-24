// Spiderfy: pin overlap handling for the rep leads map.
//
// Reps walk a street tapping pins; when two leads share (near-)identical coords
// they draw on top of each other and only the top one is tappable. Once the rep
// zooms to street level we fan each coincident group out onto a small ring
// around its centroid so every pin is reachable. Pins that don't overlap are
// never moved, and the feature's `lat`/`lng` properties stay the lead's TRUE
// coords so a tap still reports the real address — only the drawn dot shifts.

export type RepLeadPin = {
  id: string;
  lat: number;
  lng: number;
  street: string;
  disposition: "PENDING" | "NOT_HOME" | "GO_BACK" | "SOLD" | "NOT_INTERESTED";
};

// Map pin palette (rep-requested 2026-06-04):
//   yellow = no answer (Not Home), blue = follow up (Go Back),
//   red = no sale (Not Interested), green = sale made (Sold).
// PENDING (not yet knocked) stays gray.
export const DISPO_COLOR: Record<RepLeadPin["disposition"], string> = {
  PENDING: "#6B7280",        // gray-500  — not yet knocked
  NOT_HOME: "#EAB308",       // yellow-500 — no answer
  GO_BACK: "#3B82F6",        // blue-500   — follow up
  SOLD: "#22C55E",           // green-500  — sale made
  NOT_INTERESTED: "#EF4444", // red-500    — no sale made
};

// Street level — where a walking rep actually taps pins. Below this we leave
// groups stacked (fanning at city zoom would falsely imply spatial spread).
export const SPIDERFY_ZOOM = 17;

export type LeadFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    id: string;
    street: string;
    disposition: RepLeadPin["disposition"];
    color: string;
    lat: number;
    lng: number;
  };
};

function feature(p: RepLeadPin, lat: number, lng: number): LeadFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: p.id,
      street: p.street,
      disposition: p.disposition,
      color: DISPO_COLOR[p.disposition],
      lat: p.lat, // TRUE coords — taps resolve to the real address
      lng: p.lng,
    },
  };
}

/**
 * Build the GeoJSON features for the current zoom. Coincident pins (~1m) are
 * fanned onto a ring (radius ~constant on screen) once zoom >= SPIDERFY_ZOOM;
 * everything else renders at its true coordinate.
 */
export function spiderfyFeatures(pins: RepLeadPin[], zoom: number): LeadFeature[] {
  const groups = new Map<string, number[]>();
  pins.forEach((p, i) => {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });

  const fan = zoom >= SPIDERFY_ZOOM;
  const features: LeadFeature[] = [];
  for (const idxs of groups.values()) {
    if (idxs.length === 1 || !fan) {
      for (const i of idxs) features.push(feature(pins[i], pins[i].lat, pins[i].lng));
      continue;
    }
    const n = idxs.length;
    const cLat = idxs.reduce((s, i) => s + pins[i].lat, 0) / n;
    const cLng = idxs.reduce((s, i) => s + pins[i].lng, 0) / n;
    // pixels → meters at this zoom/latitude, so the ring stays ~constant on screen
    const metersPerPx = (156543.03392 * Math.cos((cLat * Math.PI) / 180)) / 2 ** zoom;
    const radiusM = (14 + Math.min(n, 8) * 2) * metersPerPx;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    idxs.forEach((i, k) => {
      const a = (2 * Math.PI * k) / n;
      const lat = cLat + (radiusM * Math.sin(a)) / 111320;
      const lng = cLng + (radiusM * Math.cos(a)) / (111320 * cosLat);
      features.push(feature(pins[i], lat, lng));
    });
  }
  return features;
}
