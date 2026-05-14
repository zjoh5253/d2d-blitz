"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BASE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export type KnockResult = "sale" | "interested" | "not_home" | "not_interested" | "follow_up";

export type GpsKnock = {
  id: string;
  lat: number;
  lng: number;
  result: KnockResult;
  timestamp: number;
};

export type GpsRoutePoint = { lat: number; lng: number };

const KNOCK_COLOR: Record<KnockResult, string> = {
  sale: "#10B981",
  interested: "#3B82F6",
  not_home: "#F97316",
  follow_up: "#EAB308",
  not_interested: "#EF4444",
};

export function RepGpsMap({
  route,
  knocks,
  current,
}: {
  route: GpsRoutePoint[];
  knocks: GpsKnock[];
  current: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const currentMarkerRef = useRef<maplibregl.Marker | null>(null);

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
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#3B82F6", "line-width": 4, "line-opacity": 0.8 },
      });

      map.addSource("knocks", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "knocks-circle",
        type: "circle",
        source: "knocks",
        paint: {
          "circle-radius": 8,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    });

    mapRef.current = map;
    return () => {
      currentMarkerRef.current?.remove();
      currentMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) },
        properties: {},
      });
    };
    if (map.loaded() && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [route]);

  // Update knocks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const features = knocks.map((k) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [k.lng, k.lat] },
        properties: { id: k.id, color: KNOCK_COLOR[k.result], result: k.result },
      }));
      const src = map.getSource("knocks") as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: "FeatureCollection", features });
    };
    if (map.loaded() && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [knocks]);

  // Current-position marker (blue dot)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !current) return;
    if (!currentMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = "#3B82F6";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 0 2px rgba(59,130,246,0.3)";
      currentMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([current.lng, current.lat]).addTo(map);
      // First fix — recenter the camera there.
      map.flyTo({ center: [current.lng, current.lat], zoom: 16, duration: 800 });
    } else {
      currentMarkerRef.current.setLngLat([current.lng, current.lat]);
    }
  }, [current]);

  return <div ref={containerRef} className="h-full w-full" />;
}
