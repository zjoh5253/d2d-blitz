"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { convexHull, type Pt } from "@/lib/convex-hull";

// Per-rep territory map: every assigned lead in the blitz rendered as a
// pin colored by its rep, plus a semi-transparent convex-hull polygon
// per rep showing the territory at a glance.

const BASE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Paired bright + soft alpha-tinted variants so polygons render
// readable underneath pins. Indexed by rep order.
const REP_PALETTE = [
  { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.18)" },
  { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.18)" },
  { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.18)" },
  { stroke: "#8b5cf6", fill: "rgba(139, 92, 246, 0.18)" },
  { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.18)" },
  { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.18)" },
  { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.18)" },
  { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.18)" },
  { stroke: "#84cc16", fill: "rgba(132, 204, 22, 0.18)" },
  { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.18)" },
];

export type RepTerritory = {
  repId: string;
  repName: string;
  points: { id: string; lat: number; lng: number; street: string; disposition: string }[];
};

export function TerritoryMap({ territories }: { territories: RepTerritory[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasFitRef = useRef(false);

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-95, 38],
      zoom: 3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    map.on("load", () => {
      map.addSource("territories-fill", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "territories-fill",
        type: "fill",
        source: "territories-fill",
        paint: {
          "fill-color": ["get", "fill"],
          "fill-outline-color": ["get", "stroke"],
        },
      });
      map.addLayer({
        id: "territories-outline",
        type: "line",
        source: "territories-fill",
        paint: {
          "line-color": ["get", "stroke"],
          "line-width": 2,
          "line-opacity": 0.7,
        },
      });

      map.addSource("territories-pins", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "territories-pins",
        type: "circle",
        source: "territories-pins",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 5, 18, 8],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-opacity": 0.85,
        },
      });

      map.on("mousemove", "territories-pins", (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const props = f.properties as { street?: string; repName?: string; disposition?: string };
        map.getCanvas().style.cursor = "pointer";
        popup
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: ui-sans-serif, system-ui; font-size: 12px;">
              <div style="font-weight: 600;">${props.street ?? ""}</div>
              <div style="color: #71717a;">${props.repName ?? ""}</div>
              <div style="color: #71717a;">${props.disposition ?? ""}</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "territories-pins", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    mapRef.current = map;
    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push territory data into the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || territories.length === 0) return;

    const apply = () => {
      // Polygon features per rep.
      const polyFeatures = territories
        .map((t, idx) => {
          const palette = REP_PALETTE[idx % REP_PALETTE.length];
          const pts: Pt[] = t.points.map((p) => ({ lng: p.lng, lat: p.lat }));
          if (pts.length < 3) return null;
          const hull = convexHull(pts);
          if (hull.length < 3) return null;
          // Close the ring.
          const ring = [...hull, hull[0]].map((p) => [p.lng, p.lat]);
          return {
            type: "Feature" as const,
            geometry: { type: "Polygon" as const, coordinates: [ring] },
            properties: {
              repId: t.repId,
              repName: t.repName,
              stroke: palette.stroke,
              fill: palette.fill,
              count: t.points.length,
            },
          };
        })
        .filter(Boolean) as GeoJSON.Feature<GeoJSON.Polygon>[];

      // Pin features.
      const pinFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
      for (let i = 0; i < territories.length; i++) {
        const palette = REP_PALETTE[i % REP_PALETTE.length];
        for (const p of territories[i].points) {
          pinFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            properties: {
              id: p.id,
              repId: territories[i].repId,
              repName: territories[i].repName,
              color: palette.stroke,
              street: p.street,
              disposition: p.disposition,
            },
          });
        }
      }

      (map.getSource("territories-fill") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: polyFeatures,
      });
      (map.getSource("territories-pins") as maplibregl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: pinFeatures,
      });

      // Fit once on first non-empty data.
      if (!hasFitRef.current && pinFeatures.length > 0) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const t of territories) {
          for (const p of t.points) {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
          }
        }
        if (Number.isFinite(minLat)) {
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 60, duration: 600, maxZoom: 15 }
          );
          hasFitRef.current = true;
        }
      }
    };

    if (map.loaded() && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [territories]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="w-full rounded-lg border overflow-hidden"
        style={{ height: 480 }}
      />
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        {territories.map((t, idx) => {
          const palette = REP_PALETTE[idx % REP_PALETTE.length];
          return (
            <div key={t.repId} className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded-full"
                style={{ background: palette.stroke }}
              />
              <span className="font-medium">{t.repName}</span>
              <span className="text-muted-foreground">({t.points.length})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
