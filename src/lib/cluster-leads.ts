// Geographic clustering for the rep-assignment planner.
//
// k-means on lat/lng with k-means++ initialization. After convergence we
// run a balancing pass: oversized clusters donate their boundary points
// to undersized neighbors so each rep ends up with roughly leads/k. That
// matches the operational reality: every rep should get a comparable
// workload regardless of how the raw geography clumps.

export type LeadPoint = {
  id: string;
  lat: number;
  lng: number;
};

export type ClusterPoint = { id: string; lat: number; lng: number };

export type ClusterResult = {
  clusterIdx: number;
  leadIds: string[];
  // Full per-lead points so the frontend map can render pins without a
  // second round-trip. Same content as leadIds + coords.
  points: ClusterPoint[];
  centroid: { lat: number; lng: number };
  // Bounding box for quick map sizing on the frontend.
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
};

// Squared distance in (lat,lng) plane. Cheap; good enough at the
// neighborhood scale where the earth is locally flat.
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// k-means++ seed: pick first centroid randomly, subsequent centroids
// proportional to squared distance from the nearest already-chosen
// centroid. Spreads initial centers far apart, big quality boost over
// random init.
function kppInit(points: LeadPoint[], k: number, rng: () => number): LeadPoint[] {
  const centers: LeadPoint[] = [];
  centers.push(points[Math.floor(rng() * points.length)]);
  while (centers.length < k) {
    const d2 = points.map((p) => {
      let m = Infinity;
      for (const c of centers) {
        const d = dist2(p.lat, p.lng, c.lat, c.lng);
        if (d < m) m = d;
      }
      return m;
    });
    const total = d2.reduce((a, b) => a + b, 0);
    if (total === 0) {
      centers.push(points[Math.floor(rng() * points.length)]);
      continue;
    }
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < d2.length; i++) {
      r -= d2[i];
      if (r <= 0) { idx = i; break; }
    }
    centers.push(points[idx]);
  }
  return centers.map((p) => ({ id: "", lat: p.lat, lng: p.lng }));
}

function kmeans(points: LeadPoint[], k: number, maxIter = 50, seed = 42): number[] {
  const rng = mulberry32(seed);
  const centers = kppInit(points, k, rng);
  const assign = new Array<number>(points.length).fill(-1);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    // Assign step.
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(p.lat, p.lng, centers[c].lat, centers[c].lng);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    if (!changed) break;

    // Update step.
    const sumLat = new Array<number>(k).fill(0);
    const sumLng = new Array<number>(k).fill(0);
    const count = new Array<number>(k).fill(0);
    for (let i = 0; i < points.length; i++) {
      const c = assign[i];
      sumLat[c] += points[i].lat;
      sumLng[c] += points[i].lng;
      count[c]++;
    }
    for (let c = 0; c < k; c++) {
      if (count[c] > 0) {
        centers[c].lat = sumLat[c] / count[c];
        centers[c].lng = sumLng[c] / count[c];
      }
    }
  }
  return assign;
}

// Balancing pass: if any cluster is more than 25% above target size,
// transfer its outermost points (relative to its own centroid) to the
// nearest undersized cluster. Repeat until everyone is within tolerance
// or we've moved enough points that further moves would just oscillate.
function rebalance(points: LeadPoint[], assign: number[], k: number): number[] {
  const target = Math.ceil(points.length / k);
  const tolerance = 0.25; // ±25% of target
  const minSize = Math.floor(target * (1 - tolerance));
  const maxSize = Math.ceil(target * (1 + tolerance));

  for (let pass = 0; pass < 50; pass++) {
    const counts = new Array<number>(k).fill(0);
    for (const a of assign) counts[a]++;

    const oversized = counts.map((c, i) => ({ i, c })).filter((x) => x.c > maxSize).sort((a, b) => b.c - a.c);
    const undersized = counts.map((c, i) => ({ i, c })).filter((x) => x.c < minSize).sort((a, b) => a.c - b.c);
    if (oversized.length === 0 || undersized.length === 0) break;

    // Recompute centroids.
    const centers = computeCentroids(points, assign, k);

    // For each oversized cluster, move its farthest points to the
    // closest undersized cluster (one point at a time).
    let movedAny = false;
    for (const o of oversized) {
      // Indices in this oversized cluster ranked by distance from its centroid (farthest first).
      const inThis: Array<{ idx: number; d: number }> = [];
      for (let i = 0; i < points.length; i++) {
        if (assign[i] !== o.i) continue;
        inThis.push({ idx: i, d: dist2(points[i].lat, points[i].lng, centers[o.i].lat, centers[o.i].lng) });
      }
      inThis.sort((a, b) => b.d - a.d);

      const overBy = counts[o.i] - target;
      let moved = 0;
      for (const cand of inThis) {
        if (moved >= overBy) break;
        // Find nearest undersized cluster center.
        let best = -1;
        let bestD = Infinity;
        for (const u of undersized) {
          if (counts[u.i] >= target) continue;
          const d = dist2(points[cand.idx].lat, points[cand.idx].lng, centers[u.i].lat, centers[u.i].lng);
          if (d < bestD) { bestD = d; best = u.i; }
        }
        if (best < 0) break;
        assign[cand.idx] = best;
        counts[o.i]--;
        counts[best]++;
        moved++;
        movedAny = true;
      }
    }
    if (!movedAny) break;
  }
  return assign;
}

function computeCentroids(points: LeadPoint[], assign: number[], k: number) {
  const sumLat = new Array<number>(k).fill(0);
  const sumLng = new Array<number>(k).fill(0);
  const count = new Array<number>(k).fill(0);
  for (let i = 0; i < points.length; i++) {
    const c = assign[i];
    sumLat[c] += points[i].lat;
    sumLng[c] += points[i].lng;
    count[c]++;
  }
  return Array.from({ length: k }, (_, c) => ({
    lat: count[c] > 0 ? sumLat[c] / count[c] : 0,
    lng: count[c] > 0 ? sumLng[c] / count[c] : 0,
  }));
}

// Deterministic seeded PRNG so clustering is repeatable. Same inputs
// always produce the same clusters, which is critical for "Reset to
// auto" not surprising the admin with a different partition.
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clusterLeads(points: LeadPoint[], k: number, seed = 42): ClusterResult[] {
  if (points.length === 0 || k <= 0) return [];
  if (k === 1 || points.length <= k) {
    // Degenerate: one cluster, or fewer points than reps (each gets one).
    return buildResults(points, points.map((_, i) => (points.length <= k ? i % k : 0)), Math.min(k, Math.max(1, points.length)));
  }
  const assign = kmeans(points, k, 50, seed);
  rebalance(points, assign, k);
  return buildResults(points, assign, k);
}

function buildResults(points: LeadPoint[], assign: number[], k: number): ClusterResult[] {
  const out: ClusterResult[] = Array.from({ length: k }, (_, c) => ({
    clusterIdx: c,
    leadIds: [],
    points: [],
    centroid: { lat: 0, lng: 0 },
    bbox: { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity },
  }));

  const sumLat: number[] = new Array(k).fill(0);
  const sumLng: number[] = new Array(k).fill(0);

  for (let i = 0; i < points.length; i++) {
    const c = assign[i];
    const p = points[i];
    out[c].leadIds.push(p.id);
    out[c].points.push({ id: p.id, lat: p.lat, lng: p.lng });
    sumLat[c] += p.lat;
    sumLng[c] += p.lng;
    if (p.lat < out[c].bbox.minLat) out[c].bbox.minLat = p.lat;
    if (p.lat > out[c].bbox.maxLat) out[c].bbox.maxLat = p.lat;
    if (p.lng < out[c].bbox.minLng) out[c].bbox.minLng = p.lng;
    if (p.lng > out[c].bbox.maxLng) out[c].bbox.maxLng = p.lng;
  }
  for (let c = 0; c < k; c++) {
    const n = out[c].leadIds.length;
    if (n > 0) {
      out[c].centroid.lat = sumLat[c] / n;
      out[c].centroid.lng = sumLng[c] / n;
    }
  }
  // Sort clusters largest-first for a stable UI ordering.
  out.sort((a, b) => b.leadIds.length - a.leadIds.length);
  out.forEach((r, i) => (r.clusterIdx = i));
  return out;
}
