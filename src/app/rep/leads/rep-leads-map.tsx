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

// Map pin palette (rep-requested 2026-06-04):
//   yellow = no answer (Not Home), blue = follow up (Go Back),
//   red = no sale (Not Interested), green = sale made (Sold).
// PENDING (not yet knocked) stays gray.
const DISPO_COLOR: Record<RepLeadPin["disposition"], string> = {
  PENDING: "#6B7280",        // gray-500  — not yet knocked
  NOT_HOME: "#EAB308",       // yellow-500 — no answer
  GO_BACK: "#3B82F6",        // blue-500   — follow up
  SOLD: "#22C55E",           // green-500  — sale made
  NOT_INTERESTED: "#EF4444", // red-500    — no sale made
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
  // Hold the latest onPinPress in a ref so the map-creation effect doesn't
  // depend on it. Otherwise a new onPinPress identity (e.g. after the parent
  // refetches leads on a disposition update) would tear down and recreate the
  // map, snapping the rep's pan/zoom back to the default view.
  const onPinPressRef = useRef(onPinPress);
  useEffect(() => { onPinPressRef.current = onPinPress; }, [onPinPress]);

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

    // Live "you are here" dot for field reps — tracks the rep + shows heading.
    // Auto-activated on load (below) so it appears without an extra tap; the
    // button stays for manual re-center / retry if permission is denied.
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    });
    map.addControl(geolocate, "top-right");

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
        onPinPressRef.current?.({
          id: props.id,
          street: props.street,
          disposition: props.disposition,
          lat: props.lat,
          lng: props.lng,
        });
      });

      // Auto-show the rep's live location once the map is ready. The browser
      // prompts for permission on first use; if denied, the control stays as a
      // tappable retry button and the fit-to-pins view remains.
      geolocate.trigger();
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // Create the map exactly once; the click handler reads onPinPress via a
    // ref so handler-identity changes never rebuild the map.
  }, []);

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
