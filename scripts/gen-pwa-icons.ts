import sharp from "sharp"
import * as fs from "node:fs"
import * as path from "node:path"

// Generates the D2D Blitz PWA icons from an inline SVG (blue rounded square +
// white "zap" bolt). Re-run any time the mark changes.
//   npx tsx scripts/gen-pwa-icons.ts

const PUB = path.join(__dirname, "..", "public")
const BLUE = "#2563eb"
// lucide "zap" filled path in a 24 viewBox.
const BOLT = "M13 2 3 14h9l-1 8 10-12h-9l1-8Z"

// rounded = app icon (with corner radius), full-bleed for maskable/apple.
function svg({ rounded, scale }: { rounded: boolean; scale: number }): string {
  // center the 24-unit bolt (x 3..22, y 2..22) scaled by `scale` in 512.
  const w = 19 * scale, h = 20 * scale
  const tx = (512 - w) / 2 - 3 * scale
  const ty = (512 - h) / 2 - 2 * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 110 : 0}" fill="${BLUE}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})"><path d="${BOLT}" fill="#ffffff"/></g>
</svg>`
}

async function png(name: string, size: number, opts: { rounded: boolean; scale: number }) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(path.join(PUB, name))
  console.log("  wrote", name, `${size}x${size}`)
}

async function main() {
  if (!fs.existsSync(PUB)) fs.mkdirSync(PUB, { recursive: true })
  // Standard app icons (rounded square, "any" purpose).
  await png("icon-192.png", 192, { rounded: true, scale: 12 })
  await png("icon-512.png", 512, { rounded: true, scale: 12 })
  // Maskable: full-bleed blue, bolt kept inside the ~80% safe zone (smaller).
  await png("icon-maskable-512.png", 512, { rounded: false, scale: 9 })
  // iOS home-screen icon (iOS applies its own rounding → full-bleed).
  await png("apple-touch-icon.png", 180, { rounded: false, scale: 12 })
  console.log("done")
}
main().catch((e) => { console.error(e); process.exit(1) })
