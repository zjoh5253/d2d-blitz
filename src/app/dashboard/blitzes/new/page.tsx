"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { BadgeDollarSign, CalendarDays, Check, Loader2, MapPin, Search, ShieldCheck, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Market {
  id: string
  name: string
  carrier: { name: string }
}

interface Manager {
  id: string
  name: string | null
  email: string
}

interface AreaCandidate {
  zip: string
  city: string
  state: string
  addressCount: number
  inventoryReady: boolean
  discoverable: boolean
}

interface CompTier {
  id: string
  name: string
}

interface FormState {
  name: string
  marketId: string
  startDate: string
  endDate: string
  repCap: string
  housingPlan: string
  managerId: string
  // FBOS v2 staffing fields
  compTierId: string
  travelModel: string
  travelCostCap: string // dollars in the UI; converted to cents on submit
  minScoreRequired: string // "" = any; "60"/"75"/"90" = band floor
  experienceMonths: string
  carrierCredential: string
  distributionMode: string
}

const initialForm: FormState = {
  name: "",
  marketId: "",
  startDate: "",
  endDate: "",
  repCap: "10",
  housingPlan: "",
  managerId: "",
  compTierId: "",
  travelModel: "company_fronted",
  travelCostCap: "",
  minScoreRequired: "75", // spec default: Standard band, 75+
  experienceMonths: "",
  carrierCredential: "",
  distributionMode: "both", // spec default: invites first 24h, then board
}

// US state abbreviation → full name, so a monopoly's "OH" can match the
// "Kinetic Ohio" market by name.
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

// Find the Kinetic market for a state abbreviation (e.g. OH → "Kinetic Ohio").
function matchMarket(markets: Market[], state: string, carrier: string): Market | undefined {
  const stateName = STATE_NAMES[state.toUpperCase()]?.toLowerCase()
  if (!stateName) return undefined
  const wantCarrier = (carrier || "kinetic").toLowerCase()
  return markets.find(
    (m) =>
      m.carrier.name.toLowerCase().includes(wantCarrier) &&
      m.name.toLowerCase().includes(stateName)
  )
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default function NewBlitzPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [markets, setMarkets] = React.useState<Market[]>([])
  const [managers, setManagers] = React.useState<Manager[]>([])
  const [compTiers, setCompTiers] = React.useState<CompTier[]>([])
  const [qualifiedCount, setQualifiedCount] = React.useState<number | null>(null)
  const [loadingData, setLoadingData] = React.useState(true)
  const [form, setForm] = React.useState<FormState>({
    ...initialForm,
    marketId: searchParams.get("marketId") ?? "",
  })
  const [areaQuery, setAreaQuery] = React.useState("")
  const [areaResults, setAreaResults] = React.useState<AreaCandidate[]>([])
  const [selectedArea, setSelectedArea] = React.useState<AreaCandidate | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)
  // Set when arriving from the map-scanner "Create blitz" button — we try to
  // create the blitz with no further input and jump straight to the list.
  const [autoCreating, setAutoCreating] = React.useState(searchParams.get("auto") === "1")
  const autoRanRef = React.useRef(false)

  React.useEffect(() => {
    async function fetchData() {
      const [marketsRes, managersRes, tiersRes] = await Promise.all([
        fetch("/api/markets"),
        fetch("/api/users?role=FIELD_MANAGER"),
        fetch("/api/comp-tiers"),
      ])
      const loadedMarkets: Market[] = marketsRes.ok ? await marketsRes.json() : []
      const loadedManagers: Manager[] = managersRes.ok ? await managersRes.json() : []
      const loadedTiers: CompTier[] = tiersRes.ok ? await tiersRes.json() : []
      setMarkets(loadedMarkets)
      setManagers(loadedManagers)
      setCompTiers(loadedTiers)
      setLoadingData(false)
      // Auto-create path (from a monopoly row): try to create immediately.
      if (searchParams.get("auto") === "1" && !autoRanRef.current) {
        autoRanRef.current = true
        autoCreate(loadedMarkets, loadedManagers)
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live "how many reps qualify" preview as the minimum score band changes.
  React.useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (form.minScoreRequired) params.set("minScore", form.minScoreRequired)
    setQualifiedCount(null)
    fetch(`/api/blitzes/qualified-count?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setQualifiedCount(d.count) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [form.minScoreRequired])

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  // One-click create from the map-scanner monopoly button (any carrier). The
  // server resolves/creates the market from carrier+state, so we just need a
  // ZIP and a manager. Applies sensible defaults and jumps to the filtering
  // list; falls back to the prefilled form only if there's no manager.
  async function autoCreate(loadedMarkets: Market[], loadedManagers: Manager[]) {
    const zip = (searchParams.get("zip") ?? "").replace(/\D/g, "").slice(0, 5)
    const city = searchParams.get("city") ?? ""
    const state = (searchParams.get("state") ?? "").toUpperCase()
    const carrier = searchParams.get("carrier") ?? "kinetic"
    const carrierName = searchParams.get("carrierName") ?? carrier

    const area: AreaCandidate = {
      zip, city, state, addressCount: 0, inventoryReady: false, discoverable: true,
    }
    const place = [city, state].filter(Boolean).join(", ")
    const name = `${place || zip} Blitz`
    const manager = loadedManagers[0]

    // Prefill the form (best-effort market match) for the fallback path.
    setSelectedArea(area)
    setAreaResults([area])
    setForm((cur) => ({
      ...cur,
      name,
      marketId: matchMarket(loadedMarkets, state, carrier)?.id ?? cur.marketId,
      managerId: manager?.id ?? cur.managerId,
    }))

    if (!zip || !manager || !state) {
      setAutoCreating(false)
      setServerError(
        !manager ? "No field manager available — add one, then create." : "Missing ZIP or state — complete the form to continue."
      )
      return
    }

    const today = new Date()
    const end = new Date(today)
    end.setDate(end.getDate() + 14)
    try {
      const response = await fetch("/api/blitzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          carrierSlug: carrier,
          carrierName,
          state,
          startDate: isoDate(today),
          endDate: isoDate(end),
          repCap: 10,
          managerId: manager.id,
          sourceZip: zip,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAutoCreating(false)
        setServerError(data.error ?? "Could not create the blitz — review the details and try again.")
        return
      }
      router.push("/dashboard/blitzes?filtering=1")
    } catch {
      setAutoCreating(false)
      setServerError("Could not create the blitz — review the details and try again.")
    }
  }

  async function searchArea(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)
    setSelectedArea(null)
    setSearching(true)
    try {
      const response = await fetch(`/api/blitzes/area-search?q=${encodeURIComponent(areaQuery)}`)
      const data = await response.json()
      if (!response.ok) {
        setAreaResults([])
        setServerError(data.error ?? "Could not search that area")
        return
      }
      const candidates: AreaCandidate[] = data.candidates ?? []
      setAreaResults(candidates)
      if (candidates.length === 0) {
        setServerError("No matching town or ZIP was found")
        return
      }
      // Auto-select when there's only one usable result so the user doesn't
      // have to make a separate click before the Create button enables.
      const usable = candidates.filter((c) => c.inventoryReady || c.discoverable)
      if (usable.length === 1) chooseArea(usable[0])
    } catch {
      setServerError("Could not reach the area search service")
    } finally {
      setSearching(false)
    }
  }

  function chooseArea(area: AreaCandidate) {
    setSelectedArea(area)
    setServerError(null)
    if (!form.name) {
      const place = [area.city, area.state].filter(Boolean).join(", ")
      updateForm("name", `${place || area.zip} Blitz`)
    }
  }

  async function createBlitz(event: React.FormEvent) {
    event.preventDefault()
    setServerError(null)
    if (!selectedArea || (!selectedArea.inventoryReady && !selectedArea.discoverable)) {
      setServerError("Select an area to canvass")
      return
    }
    if (!form.name || !form.marketId || !form.startDate || !form.endDate || !form.managerId) {
      setServerError("Complete the required blitz details")
      return
    }

    setSubmitting(true)
    try {
      // Build the payload explicitly so empty optional fields are omitted (an
      // empty enum/number string would otherwise fail validation or coerce to 0).
      const payload: Record<string, unknown> = {
        name: form.name,
        marketId: form.marketId,
        startDate: form.startDate,
        endDate: form.endDate,
        repCap: Number(form.repCap),
        housingPlan: form.housingPlan,
        managerId: form.managerId,
        sourceZip: selectedArea.zip,
        travelModel: form.travelModel,
        distributionMode: form.distributionMode,
      }
      if (form.compTierId) payload.compTierId = form.compTierId
      if (form.travelCostCap) payload.travelCostCap = Math.round(Number(form.travelCostCap) * 100) // dollars -> cents
      if (form.minScoreRequired) payload.minScoreRequired = Number(form.minScoreRequired)
      if (form.experienceMonths) payload.experienceMonths = Number(form.experienceMonths)
      if (form.carrierCredential) payload.carrierCredential = form.carrierCredential

      const response = await fetch("/api/blitzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        setServerError(data.error ?? "Failed to create blitz")
        return
      }
      // Blitz + addresses exist and known customers are already filtered. The
      // live provider (IP Royal) filter continues in the background — send the
      // user to the list, where its progress shows and staffing stays locked
      // until it's done.
      router.push("/dashboard/blitzes?filtering=1")
    } catch {
      setServerError("The blitz could not be created")
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData || autoCreating) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        {autoCreating ? (
          <>
            <span className="font-medium text-foreground">Creating blitz…</span>
            <span>Pulling addresses and starting the customer filter.</span>
          </>
        ) : (
          <span>Loading</span>
        )}
      </div>
    )
  }

  const selectedMarket = markets.find((market) => market.id === form.marketId)
  const isKinetic = selectedMarket?.carrier.name.toLowerCase().includes("kinetic") ?? false

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard/blitzes" className="hover:underline">Blitzes</Link>
          <span>/</span>
          <span>New</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Blitz</h1>
      </div>

      {serverError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Territory
              </CardTitle>
              <CardDescription>Find the town or ZIP that the team will work.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={searchArea} className="flex gap-2">
                <Input
                  value={areaQuery}
                  onChange={(event) => setAreaQuery(event.target.value)}
                  placeholder="Town, state or ZIP"
                  aria-label="Town, state or ZIP"
                />
                <Button type="submit" disabled={searching || areaQuery.trim().length < 2}>
                  {searching ? <Loader2 className="animate-spin" /> : <Search />}
                  Search
                </Button>
              </form>

              {areaResults.length > 0 && (
                <div className="divide-y rounded-md border">
                  {areaResults.map((area) => {
                    const selected = selectedArea?.zip === area.zip
                    return (
                      <button
                        key={area.zip}
                        type="button"
                        onClick={() => chooseArea(area)}
                        disabled={!area.inventoryReady && !area.discoverable}
                        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors first:rounded-t-md last:rounded-b-md hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <span>
                          <span className="block text-sm font-medium">
                            {[area.city, area.state].filter(Boolean).join(", ") || area.zip}
                          </span>
                          <span className="block text-xs text-muted-foreground">ZIP {area.zip}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-right">
                            <span className="block text-sm font-medium">
                              {area.inventoryReady ? area.addressCount.toLocaleString() : "—"}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {area.inventoryReady
                                ? "addresses loaded"
                                : area.discoverable
                                  ? "pull on create"
                                  : "inventory unavailable"}
                            </span>
                          </span>
                          <span className="flex h-6 w-6 items-center justify-center">
                            {selected && <Check className="h-5 w-5 text-primary" />}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Campaign
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form id="create-blitz-form" onSubmit={createBlitz} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="name">Blitz name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Lockhart Fiber Blitz"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="marketId">Market and provider</Label>
                  <Select
                    id="marketId"
                    value={form.marketId}
                    onChange={(event) => updateForm("marketId", event.target.value)}
                    placeholder="Select market"
                    options={markets.map((market) => ({
                      value: market.id,
                      label: `${market.name} (${market.carrier.name})`,
                    }))}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="startDate">Start date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={(event) => updateForm("startDate", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="endDate">End date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(event) => updateForm("endDate", event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="repCap">Rep cap</Label>
                    <Input
                      id="repCap"
                      type="number"
                      min={1}
                      value={form.repCap}
                      onChange={(event) => updateForm("repCap", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="managerId">Field manager</Label>
                    <Select
                      id="managerId"
                      value={form.managerId}
                      onChange={(event) => updateForm("managerId", event.target.value)}
                      placeholder="Select manager"
                      options={managers.map((manager) => ({
                        value: manager.id,
                        label: manager.name ?? manager.email,
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="housingPlan">Housing plan</Label>
                  <Textarea
                    id="housingPlan"
                    value={form.housingPlan}
                    onChange={(event) => updateForm("housingPlan", event.target.value)}
                    placeholder="Housing arrangements, address, details..."
                    rows={3}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeDollarSign className="h-5 w-5 text-primary" />
                Compensation &amp; qualification
              </CardTitle>
              <CardDescription>Comp tier, travel terms, who can claim, and how seats fill.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="compTierId">Comp tier</Label>
                  <Select
                    id="compTierId"
                    value={form.compTierId}
                    onChange={(event) => updateForm("compTierId", event.target.value)}
                    placeholder={compTiers.length ? "Select comp tier" : "No tiers configured"}
                    options={compTiers.map((tier) => ({ value: tier.id, label: tier.name }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="travelModel">Travel</Label>
                  <Select
                    id="travelModel"
                    value={form.travelModel}
                    onChange={(event) => updateForm("travelModel", event.target.value)}
                    options={[
                      { value: "company_fronted", label: "Company-fronted" },
                      { value: "rep_fronted_reimburse", label: "Rep-fronted (reimbursed)" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="travelCostCap">Travel cost cap ($)</Label>
                  <Input
                    id="travelCostCap"
                    type="number"
                    min={0}
                    value={form.travelCostCap}
                    onChange={(event) => updateForm("travelCostCap", event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="distributionMode">Seat distribution</Label>
                  <Select
                    id="distributionMode"
                    value={form.distributionMode}
                    onChange={(event) => updateForm("distributionMode", event.target.value)}
                    options={[
                      { value: "both", label: "Invites first, then board" },
                      { value: "invites", label: "Targeted invites only" },
                      { value: "board", label: "Open board only" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="minScoreRequired">Minimum readiness</Label>
                  <Select
                    id="minScoreRequired"
                    value={form.minScoreRequired}
                    onChange={(event) => updateForm("minScoreRequired", event.target.value)}
                    options={[
                      { value: "", label: "Any rep" },
                      { value: "60", label: "Restricted (60+)" },
                      { value: "75", label: "Standard (75+)" },
                      { value: "90", label: "Premium (90+)" },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="experienceMonths">Min experience (months)</Label>
                  <Input
                    id="experienceMonths"
                    type="number"
                    min={0}
                    value={form.experienceMonths}
                    onChange={(event) => updateForm("experienceMonths", event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="carrierCredential">Required carrier credential</Label>
                <Input
                  id="carrierCredential"
                  value={form.carrierCredential}
                  onChange={(event) => updateForm("carrierCredential", event.target.value)}
                  placeholder="e.g. Kinetic certified (optional)"
                />
              </div>

              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">
                  {qualifiedCount == null
                    ? "Checking qualified reps…"
                    : `${qualifiedCount.toLocaleString()} rep${qualifiedCount === 1 ? "" : "s"} qualify at this minimum.`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Lead preparation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Selected ZIP</span>
                <span className="font-medium">{selectedArea?.zip ?? "Not selected"}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Address inventory</span>
                <span className="font-medium">
                  {!selectedArea
                    ? "—"
                    : selectedArea.inventoryReady
                      ? selectedArea.addressCount.toLocaleString()
                      : "Pulled on create"}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>Known customers and previously scanned unreachable addresses are suppressed immediately.</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>Duplicate street addresses are removed before leads are created.</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>
                  {isKinetic
                    ? "Remaining addresses will be eligible for the Kinetic direct-provider scan."
                    : "Direct-provider scanning is currently available for Kinetic markets."}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button
              type="submit"
              form="create-blitz-form"
              className="flex-1"
              disabled={submitting || !selectedArea || (!selectedArea.inventoryReady && !selectedArea.discoverable)}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <MapPin />}
              {submitting ? "Preparing blitz..." : "Create and prepare"}
            </Button>
            <Link href="/dashboard/blitzes">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
