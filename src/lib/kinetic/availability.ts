import { createHash, randomUUID } from "node:crypto"
import { fetch, ProxyAgent, type Dispatcher } from "undici"

// Kinetic (gokinetic.com) per-address availability client.
//
// Authorized by Teki 2026-06-03 (accepts the ToS/account risk). Pure HTTP —
// hits the same API the consumer checker uses. Single anonymous session
// (static site Basic credential) issues a short-lived Bearer token; each
// address is one POST. Throttled + backed-off for single-IP politeness.
//
// See memory reference_gokinetic_availability for the API shape + the
// still-UNVERIFIED question of which field means "current customer".

const SESSION_URL = "https://buy.gokinetic.com/api/v1/auth/session?context=residential"
const SEARCH_URL = "https://buy.gokinetic.com/api/v1/address/search"
const BASIC = "Basic a2luZXRpYzpTZWN1UmUhQ29ObmVDdDE=" // static, from site JS
const META = "e18301300ccdb672db52968b61bdb08c6dc9a9ea0c87a365a34f1c700aacb5b0"
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// fetch() init with undici's dispatcher (not in the DOM RequestInit type).
type FetchInit = Parameters<typeof fetch>[1] & { dispatcher?: Dispatcher }

// When KINETIC_PROXY_URL or IPROYAL_PROXY_URL is set, route every request through it. Use a
// rotating RESIDENTIAL proxy gateway here — gokinetic throttles hard per IP,
// and rotating IPs is what lets the scan run at volume / in the cloud.
// Format: http://user:pass@gateway-host:port (https:// also fine).
function buildProxyDispatcher(): ProxyAgent | undefined {
  const url = process.env.KINETIC_PROXY_URL || process.env.IPROYAL_PROXY_URL
  if (!url) return undefined
  const u = new URL(url)
  const uri = `${u.protocol}//${u.host}`
  if (u.username || u.password) {
    const token =
      "Basic " +
      Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")
    console.log(`[kinetic] routing through proxy ${u.host}`)
    return new ProxyAgent({ uri, token })
  }
  console.log(`[kinetic] routing through proxy ${u.host}`)
  return new ProxyAgent(uri)
}

// Raised when gokinetic returns HTTP 429. The worker catches this to apply a
// long cooldown rather than hammering the (heavily) rate-limited single IP.
export class KineticThrottledError extends Error {
  constructor() {
    super("kinetic throttled (HTTP 429)")
    this.name = "KineticThrottledError"
  }
}

export interface AddressInput {
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
}

// Observed billingStatus values: "N" (no account) and "A". In live-fiber
// Pleasant Hill a minority of addresses come back "A" — consistent with
// A = Active customer (standard telecom billing coding). That's our
// current-customer signal. Still worth a final confirm against one address
// Teki knows is a customer, but the live-market N/A split is strong evidence.
const CUSTOMER_BILLING_STATUSES = new Set(["A"])

export interface KineticStatus {
  serviceable: boolean
  comingSoon: boolean
  isCustomer: boolean
  validationResult: string | null
  maxQual: string | null
  techType: string | null
  billingStatus: string | null
  estCompletionDt: string | null
  raw: string
}

function normalize(json: Record<string, unknown>): KineticStatus {
  const addr = (json.address ?? {}) as Record<string, unknown>
  const bb = (json.broadbandService ?? {}) as Record<string, unknown>
  const validationResult = (json.validationResult as string) ?? null
  const maxQual = (json.maxQual as string) ?? null
  const billingStatus = (addr.billingStatus as string) ?? null

  const serviceable =
    validationResult === "AddressFound" &&
    !!maxQual &&
    maxQual.toUpperCase() !== "NO QUAL"
  const comingSoon =
    !serviceable && (!!bb.futureQual || !!bb.estimatedCompletionDt)

  return {
    serviceable,
    comingSoon,
    isCustomer: CUSTOMER_BILLING_STATUSES.has((billingStatus ?? "").toUpperCase()),
    validationResult,
    maxQual,
    techType: (json.techType as string) || (addr.techType as string) || null,
    billingStatus,
    estCompletionDt: (bb.estimatedCompletionDt as string) ?? null,
    raw: JSON.stringify(json).slice(0, 8000),
  }
}

export class KineticClient {
  private token: string | null = null
  private sessionId = ""
  private readonly deviceId = randomUUID()
  private readonly minDelayMs: number
  private readonly dispatcher?: Dispatcher

  constructor(opts: { minDelayMs?: number } = {}) {
    this.minDelayMs = opts.minDelayMs ?? 400
    this.dispatcher = buildProxyDispatcher()
  }

  private async ensureSession(): Promise<void> {
    if (this.token) return
    const body = JSON.stringify({ brazeDeviceId: "" })
    const res = await fetch(SESSION_URL, {
      method: "POST",
      headers: {
        authorization: BASIC,
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        "user-agent": UA,
        referer: "https://buy.gokinetic.com/check-availability",
        "x-meta-info": META,
        "x-resource-id": sha256(body),
        "device-id": this.deviceId,
      },
      body,
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    } as FetchInit)
    if (res.status !== 200 && res.status !== 201) {
      throw new Error(`kinetic session failed: HTTP ${res.status}`)
    }
    const j = (await res.json()) as { token?: string }
    if (!j.token) throw new Error("kinetic session: no token")
    this.token = j.token
    try {
      this.sessionId =
        JSON.parse(Buffer.from(j.token.split(".")[1], "base64").toString()).sessionId ?? ""
    } catch {
      this.sessionId = ""
    }
  }

  // Look up one address. Retries with backoff on throttle (429) / 5xx and
  // refreshes the session on 401. Throws only after exhausting retries.
  async check(a: AddressInput, attempt = 0): Promise<KineticStatus> {
    await this.ensureSession()
    await sleep(this.minDelayMs)
    const body = JSON.stringify({
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2 ?? "",
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
    })
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        "user-agent": UA,
        referer: "https://buy.gokinetic.com/check-in-progress",
        "x-meta-info": META,
        "x-resource-id": sha256(body),
        "device-id": this.deviceId,
        "session-id": this.sessionId,
      },
      body,
      ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
    } as FetchInit)

    if (res.status === 401 && attempt < 2) {
      this.token = null // force re-auth
      return this.check(a, attempt + 1)
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(2_000 * (attempt + 1))
      return this.check(a, attempt + 1)
    }
    // Throttle: surface it as a typed error and let the worker decide the
    // cooldown — retrying here just burns the IP's quota faster.
    if (res.status === 429) {
      throw new KineticThrottledError()
    }
    if (res.status !== 200) {
      throw new Error(`kinetic search failed: HTTP ${res.status}`)
    }
    return normalize((await res.json()) as Record<string, unknown>)
  }
}
