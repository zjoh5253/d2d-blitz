"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre-based cluster preview for the rep-assignment planner.
//
// Interaction model:
//   - Hover a pin → tooltip (street + current cluster)
//   - Click a pin → side panel popup with cluster dropdown to reassign
//   - Shift+drag a rectangle → bulk-select all pins inside → bulk reassign
//
// We use a single GeoJSON source + circle layer instead of per-marker
// DOM elements because per-marker doesn't scale past ~1k pins.

const BASE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Tailwind palette values matching the CLUSTER_COLORS in the planner UI.
const CLUSTER_HEX = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
  "#84cc16", // lime-500
  "#6366f1", // indigo-500
];

export type ClusterMapPoint = {
  id: string;
  lat: number;
  lng: number;
  clusterIdx: number;
  street: string;
};

type ClickSelection = {
  leadIds: string[];
  // Display only — preferred destination cluster.
  defaultClusterIdx?: number;
  label: string;
};

export function ClusterMap({
  points,
  numClusters,
  onReassign,
}: {
  points: ClusterMapPoint[];
  numClusters: number;
  // Called when the user picks a destination cluster in the popup.
  // The parent owns the cluster state and re-renders with new points.
  onReassign?: (leadIds: string[], newClusterIdx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const [selection, setSelection] = useState<ClickSelection | null>(null);
  const [boxDrag, setBoxDrag] = useState<null | { startX: number; startY: number; endX: number; endY: number }>(null);

  // Initialize the map once. Keep the same instance across point updates;
  // we re-set the GeoJSON source's data when `points` changes.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLE,
      center: [-95, 38],
      zoom: 3,
      attributionControl: { compact: true },
      // Disable default shift+drag = box zoom so we can use it for select.
      boxZoom: false,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 8,
    });

    map.on("load", () => {
      map.addSource("leads", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "leads-circle",
        type: "circle",
        source: "leads",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2, 14, 5, 18, 8],
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
          "circle-opacity": 0.85,
        },
      });

      // Hover: passive tooltip.
      map.on("mousemove", "leads-circle", (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        const props = f.properties as { street?: string; clusterIdx?: number };
        map.getCanvas().style.cursor = "pointer";
        hoverPopup
          .setLngLat(coords)
          .setHTML(
            `<div style="font-family: ui-sans-serif, system-ui; font-size: 12px;">
              <div style="font-weight: 600;">${props.street ?? ""}</div>
              <div style="color: #71717a;">Territory #${(props.clusterIdx ?? 0) + 1}</div>
              <div style="color: #71717a; margin-top: 4px;">Click to reassign</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "leads-circle", () => {
        map.getCanvas().style.cursor = "";
        hoverPopup.remove();
      });

      // Click: open the reassign popup for that single pin.
      map.on("click", "leads-circle", (e) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const props = f.properties as { id: string; clusterIdx: number; street: string };
        hoverPopup.remove();
        setSelection({
          leadIds: [props.id],
          defaultClusterIdx: props.clusterIdx,
          label: props.street || props.id,
        });
      });

      // Shift+drag for bulk selection. MapLibre's drag-pan is disabled
      // for the duration of the shift hold, then re-enabled.
      const canvas = map.getCanvasContainer();
      let dragStart: { x: number; y: number } | null = null;

      const onMouseDown = (e: MouseEvent) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        e.stopPropagation();
        map.dragPan.disable();
        const rect = canvas.getBoundingClientRect();
        dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setBoxDrag({ startX: dragStart.x, startY: dragStart.y, endX: dragStart.x, endY: dragStart.y });
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!dragStart) return;
        const rect = canvas.getBoundingClientRect();
        setBoxDrag({
          startX: dragStart.x,
          startY: dragStart.y,
          endX: e.clientX - rect.left,
          endY: e.clientY - rect.top,
        });
      };
      const onMouseUp = (e: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        map.dragPan.enable();
        if (!dragStart) return;
        const rect = canvas.getBoundingClientRect();
        const x1 = Math.min(dragStart.x, e.clientX - rect.left);
        const y1 = Math.min(dragStart.y, e.clientY - rect.top);
        const x2 = Math.max(dragStart.x, e.clientX - rect.left);
        const y2 = Math.max(dragStart.y, e.clientY - rect.top);
        dragStart = null;
        setBoxDrag(null);
        // Discard tiny drags (treat as accidental click)
        if (Math.abs(x2 - x1) < 8 || Math.abs(y2 - y1) < 8) return;

        const features = map.queryRenderedFeatures(
          [
            [x1, y1],
            [x2, y2],
          ],
          { layers: ["leads-circle"] }
        );
        if (features.length === 0) return;
        const leadIds = Array.from(new Set(features.map((f) => (f.properties as { id?: string })?.id).filter(Boolean) as string[]));
        if (leadIds.length === 0) return;
        setSelection({
          leadIds,
          label: `${leadIds.length} leads in selection`,
        });
      };
      canvas.addEventListener("mousedown", onMouseDown);
      // Cleanup is via the outer return below.
      (map as unknown as { __cleanupBoxSelect?: () => void }).__cleanupBoxSelect = () => {
        canvas.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
    });

    mapRef.current = map;
    hoverPopupRef.current = hoverPopup;

    return () => {
      (map as unknown as { __cleanupBoxSelect?: () => void }).__cleanupBoxSelect?.();
      hoverPopup.remove();
      map.remove();
      mapRef.current = null;
      hoverPopupRef.current = null;
    };
  }, []);

  // Push current points to the map source whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;

    const apply = () => {
      const features = points.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.id,
          clusterIdx: p.clusterIdx,
          color: CLUSTER_HEX[p.clusterIdx % CLUSTER_HEX.length],
          street: p.street,
        },
      }));
      const source = map.getSource("leads") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData({ type: "FeatureCollection", features });
    };

    if (map.loaded() && map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [points]);

  // One-time fit-to-bounds on first non-empty points payload. Subsequent
  // reassignments don't reset the camera.
  const hasFittedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFittedRef.current || points.length === 0) return;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    if (!Number.isFinite(minLat)) return;
    const doFit = () => {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 40, duration: 600, maxZoom: 15 }
      );
      hasFittedRef.current = true;
    };
    if (map.loaded() && map.isStyleLoaded()) doFit();
    else map.once("load", doFit);
  }, [points]);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full rounded-lg border overflow-hidden"
        style={{ height: 420 }}
      />

      {/* Box-drag overlay */}
      {boxDrag && (
        <div
          className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/15"
          style={{
            left: Math.min(boxDrag.startX, boxDrag.endX),
            top: Math.min(boxDrag.startY, boxDrag.endY),
            width: Math.abs(boxDrag.endX - boxDrag.startX),
            height: Math.abs(boxDrag.endY - boxDrag.startY),
          }}
        />
      )}

      {/* Help banner */}
      <div className="absolute left-3 top-3 rounded-md bg-white/95 px-3 py-1.5 text-xs text-zinc-700 shadow-sm">
        Click a pin to reassign · Shift+drag to bulk-select
      </div>

      {/* Reassign popup */}
      {selection && (
        <div className="absolute right-3 bottom-3 max-w-xs rounded-lg bg-white p-3 shadow-lg border z-10">
          <div className="text-sm font-medium mb-2">{selection.label}</div>
          <div className="text-xs text-zinc-500 mb-2">Reassign to:</div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: numClusters }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onReassign?.(selection.leadIds, idx);
                  setSelection(null);
                }}
                disabled={selection.defaultClusterIdx === idx}
                className="flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:bg-zinc-100 disabled:cursor-not-allowed"
              >
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: CLUSTER_HEX[idx % CLUSTER_HEX.length] }}
                />
                #{idx + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelection(null)}
            className="mt-3 w-full text-xs text-zinc-500 hover:text-zinc-900"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
