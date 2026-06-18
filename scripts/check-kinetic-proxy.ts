import "dotenv/config"
import { ProxyAgent } from "undici"

// Validate the residential proxy used by the Kinetic scanner.
//
// Usage:
//   IPROYAL_PROXY_URL="http://user:pass@host:port" npx tsx scripts/check-kinetic-proxy.ts
//
// This does NOT hit gokinetic. It only verifies that the same proxy format
// KineticClient uses can reach the public internet and shows the outbound IP.

function buildDispatcher(): ProxyAgent | undefined {
  const raw = process.env.KINETIC_PROXY_URL || process.env.IPROYAL_PROXY_URL
  if (!raw) return undefined
  const u = new URL(raw)
  const uri = `${u.protocol}//${u.host}`
  if (u.username || u.password) {
    const token =
      "Basic " +
      Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")
    return new ProxyAgent({ uri, token })
  }
  return new ProxyAgent(uri)
}

type FetchInit = RequestInit & { dispatcher?: ProxyAgent }

async function main() {
  const raw = process.env.KINETIC_PROXY_URL || process.env.IPROYAL_PROXY_URL
  if (!raw) {
    console.error("Set KINETIC_PROXY_URL or IPROYAL_PROXY_URL first.")
    process.exit(2)
  }

  const u = new URL(raw)
  console.log(`Proxy host: ${u.host}`)
  console.log(`Proxy auth: ${u.username ? "yes" : "no"}`)

  const dispatcher = buildDispatcher()
  const res = await fetch("https://api.ipify.org?format=json", {
    ...(dispatcher ? { dispatcher } : {}),
  } as FetchInit)
  console.log(`HTTP status: ${res.status}`)
  console.log(await res.text())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
