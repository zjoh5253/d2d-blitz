"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BASE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export type RepLeadPin = {
  id: string;
  lat: number;
  lng: number;
  street: string;
  disposition: "PENDING" | "NOT_HOME" | "GO_BACK" | "SOLD" | "NOT_INTERESTED";
};

// Mirror of the mobile DISPOSITION_CONFIG palette so reps see the same
// colors on phone web and native.
const DISPO_COLOR: Record<RepLeadPin["disposition"], string> = {
  PENDING: "#6B7280",        // gray-500
  NOT_HOME: "#F97316",       // orange-500
  GO_BACK: "#EAB308",        // yellow-500
  SOLD: "#10B981",           // emerald-500
  NOT_INTERESTED: "#EF4444", // red-500
};

export function RepLeadsMap({
  pins,
  onPinPress,
}: {
  pins: RepLeadPin[];
  onPinPress?: (lead: RepLeadPin) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hasFitRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-95, 38],
      zoom: 3,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("leads", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "leads-circle",
        type: "circle",
        source: "leads",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 8, 18, 12],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.on("mouseenter", "leads-circle", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "leads-circle", () => { map.getCanvas().style.cursor = ""; });
      map.on("click", "leads-circle", (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties as { id: string; street: string; disposition: RepLeadPin["disposition"]; lat: number; lng: number };
        onPinPress?.({
          id: props.id,
          street: props.street,
          disposition: props.disposition,
          lat: props.lat,
          lng: props.lng,
        });
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [onPinPress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || pins.length === 0) return;
    const apply = () => {
      const features = pins.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          street: p.street,
          disposition: p.disposition,
          color: DISPO_COLOR[p.disposition],
          lat: p.lat,
          lng: p.lng,
        },
      }));
      const src = map.getSource("leads") as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features });
      if (!hasFitRef.current) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const p of pins) {
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lng < minLng) minLng = p.lng;
          if (p.lng > maxLng) maxLng = p.lng;
        }
        if (Number.isFinite(minLat)) {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, duration: 500, maxZoom: 15 });
          hasFitRef.current = true;
        }
      }
    };
    if (map.loaded() && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [pins]);

  return <div ref={containerRef} className="h-full w-full" />;
}
