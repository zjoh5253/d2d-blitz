# MDU (Apartment / Multi-Dwelling Unit) Model — Spec

**Status:** proposed (2026-07-10). Not built. The unit-expansion approach was
tried and reverted (commit `58278a2` → reverted by `6968c2a`) because it
inflated door-knock counts. This spec is the corrected model.

## The principle

**Activity and impact are different things and live in different data.**

- **Door-knocks** = the `door_knock_leads` a rep works. A rep visits a leasing
  office **once** → that's **1 knock**, regardless of how many units the complex
  has. We never inflate activity.
- **Installs / revenue** = verified per-unit from carrier install reports. A
  1,000-unit complex generates up to 1,000 install records over time → impact
  scales **on its own**.

So the whole model comes down to: **one door-knock lead per apartment complex
(the leasing office), tagged with its unit count; sales/installs scale by units.**

---

## 1. Data model

**`DoorKnockLead`** — add:
- `isMdu Boolean @default(false)` — this lead is an apartment complex / MDU.
- `unitCount Int?` — number of units at the complex (opportunity size; shown on
  the pin). Null for single-family.

**`Sale`** — add:
- `unitsSold Int @default(1)` — how many units this deal covers (1 for a
  single-family sale; N for a complex/bulk deal). Drives revenue + leaderboard
  impact. Rep enters it at close for MDUs.

**Config** (carrier or global):
- `mduUnitThreshold Int` — buildings with **more** units than this collapse to a
  single leasing-office lead; at/below it, units stay as individual doors (see §3).
  *Recommended default: 4* (a fourplex and under = knock the doors; bigger =
  one office visit).

---

## 2. Address-pull behavior (the corrected import)

In `importScannerInventory` (`src/lib/blitz-area.ts`), per street address:

1. **Count the units** at each building (distinct `unit` values in
   `scanner_addresses` for that street).
2. **If unit count > `mduUnitThreshold`:** emit **ONE** lead for the building
   (the leasing office), with `isMdu = true`, `unitCount = N`. Do **not** expand.
3. **If unit count ≤ threshold:** emit one lead **per unit** (small multiplex —
   reps really do knock these doors). `isMdu = false`.
4. Single-family (no units): unchanged — one lead.

This is the key correction: big complexes → 1 lead (not N), so the door-knock
count stays honest, while the `unitCount` preserves the opportunity size.

> Data caveat: OpenAddresses unit coverage is incomplete and OSM has none, so the
> `unitCount` is a floor, not exact. A rep can correct it at the office (§5). For
> ZIPs on the OSM fallback, complexes still appear as one building lead with no
> unit data — acceptable (they visit the office and confirm the count).

---

## 3. Door-knock counting

- An MDU lead = **1 knock** when the rep dispositions the leasing office.
- Nothing about the unit count touches knock/activity metrics.
- The rep map shows the MDU pin with a badge (e.g., "🏢 120 units") so reps
  prioritize high-value targets.

---

## 4. Sales & impact

- On closing an MDU, the rep enters **`unitsSold`** (whole complex or a portion).
- **Revenue** = `unitsSold × carrier revenue-per-install` (a 1,000-unit deal at
  $300/unit = $300k). Commission flows from that as normal.
- **Installs** are still verified per-unit from carrier reports — they arrive as
  the units get installed, so verified revenue self-corrects to reality.

---

## 5. Leaderboard reconciliation

| Metric | MDU behavior | Rationale |
|---|---|---|
| Doors knocked / activity | **1** | One office visit = one interaction. |
| Sales (count) | **1** | It's one deal/contract. |
| Installs / revenue | **scales by units** | Reflects true impact (verified per-unit). |
| Conversion / SPH | 1 knock → 1 sale | Not diluted; MDU reps look *strong* (high value/knock). |
| Points / XP | **curved by units** | Rewards the bigger deal without letting one mega-deal nuke the board. |

**Points curve (recommended):** instead of linear `points = unitsSold × per-unit`
(a 1,000-unit deal would dwarf everyone), use a **diminishing curve**, e.g.
`basePoints × (1 + log2(unitsSold))` or a tiered bonus (1–4 units = ×1, 5–50 =
×3, 51–200 = ×6, 200+ = ×10). Tunable. Keeps MDU deals clearly more valuable
while preserving a competitive board.

---

## 6. Open decisions (need your call)

1. **Threshold** for "collapse to leasing office" vs "individual doors."
   *Recommend 4.*
2. **Points weighting curve** — linear-capped, log, or tiered? *Recommend
   tiered/log so one deal doesn't dominate.*
3. **Unit-count source of truth** — OA data (a floor) vs rep-confirmed at the
   office. *Recommend: seed from OA, let the rep edit on the lead.*
4. Should **installs metric** count per-unit (impact) or per-deal? *Recommend
   per-unit (matches carrier reports).*

---

## 7. Phased build

- **P1 — Capture (no leaderboard changes):** schema (`isMdu`, `unitCount`,
  `unitsSold`), import collapse-vs-expand by threshold, MDU badge on the pin,
  `unitsSold` field on the sale form. Ships the honest-knock + opportunity view.
- **P2 — Impact:** revenue = `unitsSold × per-unit`; installs count per-unit.
- **P3 — Leaderboard:** points curve + surface MDU wins distinctly.

P1 alone fixes the original concern (apartments captured, knocks honest). P2/P3
add the impact/leaderboard payoff.
