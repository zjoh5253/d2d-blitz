"use client"

import * as React from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { latLngToCell, cellToBoundary } from "h3-js"
import { CLUSTER_HEX } from "@/app/dashboard/door-knocks/cluster-map"
import { HEX_RES } from "@/lib/hex-territory"

// Hex-grid territory map (Teki-style). Every lead sits in an H3 hexagon; a hex
// is colored by the rep that owns its leads. With a rep "brush" selected, click
// or drag across hexes to paint them → all leads in a painted hex are assigned
// to that rep (or unassigned with the eraser). Reuses the blitz's lead→rep
// assignment as the source of truth; hexes are the spatial UI on top.

const RES = HEX_RES // keep in sync with the auto-plan partition
const BASE_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
const GRAY = "#a1a1aa"

export interface HexLead { id: string; lat: number; lng: number; assignedRepId: string | null }

export function HexMap({
  leads,
  reps,
  brush,
  onPaint,
}: {
  leads: HexLead[]
  reps: { repId: string; name: string }[]
  brush: string | null | undefined // undefined = pan · null = erase · string = paint that rep
  onPaint: (leadIds: string[], repId: string | null) => void
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const mapRef = React.useRef<maplibregl.Map | null>(null)
  const readyRef = React.useRef(false)
  const paintingRef = React.useRef(false)
  const paintedRef = React.useRef<Set<string>>(new Set()) // hexes touched this stroke
  const overrideRef = React.useRef<Map<string, string | null>>(new Map()) // optimistic owner per hex

  const repColor = React.useMemo(() => {
    const m = new Map<string, string>()
    reps.forEach((r, i) => m.set(r.repId, CLUSTER_HEX[i % CLUSTER_HEX.length]))
    return m
  }, [reps])

  // hex -> { leadIds, owner } (owner = plurality assignedRepId among its leads)
  const hexData = React.useMemo(() => {
    const acc = new Map<string, { leadIds: string[]; counts: Map<string | null, number> }>()
    for (const l of leads) {
      const h = latLngToCell(l.lat, l.lng, RES)
      let e = acc.get(h)
      if (!e) { e = { leadIds: [], counts: new Map() }; acc.set(h, e) }
      e.leadIds.push(l.id)
      e.counts.set(l.assignedRepId, (e.counts.get(l.assignedRepId) ?? 0) + 1)
    }
    const out = new Map<string, { leadIds: string[]; owner: string | null }>()
    for (const [h, e] of acc) {
      let owner: string | null = null, best = -1
      for (const [k, c] of e.counts) if (c > best) { best = c; owner = k }
      out.set(h, { leadIds: e.leadIds, owner })
    }
    return out
  }, [leads])

  const colorFor = React.useCallback(
    (hex: string) => {
      const owner = overrideRef.current.has(hex) ? overrideRef.current.get(hex)! : hexData.get(hex)?.owner ?? null
      return owner ? repColor.get(owner) ?? GRAY : GRAY
    },
    [hexData, repColor]
  )

  const buildGeoJSON = React.useCallback((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: [...hexData.keys()].map((hex) => {
      const ring = cellToBoundary(hex).map(([lat, lng]) => [lng, lat]) // h3 → [lat,lng]; GeoJSON wants [lng,lat]
      ring.push(ring[0])
      return { type: "Feature", properties: { hex, color: colorFor(hex) }, geometry: { type: "Polygon", coordinates: [ring] } }
    }),
  }), [hexData, colorFor])

  const refreshColors = React.useCallback(() => {
    const src = mapRef.current?.getSource("hexes") as maplibregl.GeoJSONSource | undefined
    src?.setData(buildGeoJSON())
  }, [buildGeoJSON])

  // Init the map once.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({ container: containerRef.current, style: BASE_STYLE, center: [-95, 38], zoom: 3, attributionControl: { compact: true } })
    mapRef.current = map
    map.on("load", () => {
      map.addSource("hexes", { type: "geojson", data: buildGeoJSON() })
      map.addLayer({ id: "hex-fill", type: "fill", source: "hexes", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 } })
      map.addLayer({ id: "hex-line", type: "line", source: "hexes", paint: { "line-color": "#ffffff", "line-width": 1 } })
      map.addSource("hex-leads", { type: "geojson", data: { type: "FeatureCollection", features: leads.map((l) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [l.lng, l.lat] } })) } })
      map.addLayer({ id: "hex-lead-dots", type: "circle", source: "hex-leads", paint: { "circle-radius": 2, "circle-color": "#3f3f46", "circle-opacity": 0.5 } })
      readyRef.current = true
      const b = new maplibregl.LngLatBounds()
      leads.forEach((l) => b.extend([l.lng, l.lat]))
      if (leads.length) map.fitBounds(b, { padding: 40, maxZoom: 15, duration: 0 })
    })
    return () => { map.remove(); mapRef.current = null; readyRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-color when the underlying data changes (e.g. after a save refetch).
  React.useEffect(() => { overrideRef.current.clear(); if (readyRef.current) refreshColors() }, [hexData, refreshColors])

  // Paint interaction, re-bound when the brush changes.
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const canPaint = brush !== undefined

    const paintHex = (hex: string) => {
      if (paintedRef.current.has(hex)) return
      paintedRef.current.add(hex)
      overrideRef.current.set(hex, brush ?? null)
      refreshColors()
    }
    const commit = () => {
      if (!paintingRef.current) return
      paintingRef.current = false
      map.dragPan.enable()
      const ids: string[] = []
      paintedRef.current.forEach((h) => ids.push(...(hexData.get(h)?.leadIds ?? [])))
      paintedRef.current.clear()
      if (ids.length) onPaint(ids, brush ?? null)
    }
    const onDown = (e: maplibregl.MapLayerMouseEvent) => {
      if (!canPaint) return
      paintingRef.current = true
      map.dragPan.disable()
      const hex = e.features?.[0]?.properties?.hex as string | undefined
      if (hex) paintHex(hex)
    }
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      if (!paintingRef.current) return
      const hex = e.features?.[0]?.properties?.hex as string | undefined
      if (hex) paintHex(hex)
    }
    map.getCanvas().style.cursor = canPaint ? "crosshair" : ""
    map.on("mousedown", "hex-fill", onDown)
    map.on("mousemove", "hex-fill", onMove)
    document.addEventListener("mouseup", commit)
    return () => {
      map.off("mousedown", "hex-fill", onDown)
      map.off("mousemove", "hex-fill", onMove)
      document.removeEventListener("mouseup", commit)
      map.getCanvas().style.cursor = ""
    }
  }, [brush, hexData, onPaint, refreshColors])

  return <div ref={containerRef} className="h-full w-full" />
}
