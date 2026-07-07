// Andrew's monotonic chain — O(n log n) convex hull. Returns the
// outermost points wrapping a set of (lng, lat) tuples in CCW order
// suitable for a GeoJSON Polygon ring.

export type Pt = { lng: number; lat: number };

function cross(O: Pt, A: Pt, B: Pt): number {
  return (A.lng - O.lng) * (B.lat - O.lat) - (A.lat - O.lat) * (B.lng - O.lng);
}

export function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) =>
    a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng
  );

  const lower: Pt[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Pt[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Drop the last point of each half because it's the same as the
  // starting point of the other half. Append the two halves.
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
