import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Mock @/lib/db ─────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file by Vitest, so the factory must not
// reference variables declared in module scope. Use vi.hoisted() to create the
// mock object before the hoist boundary.

const mockDb = vi.hoisted(() => ({
  sale: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  stackConfig: {
    findFirst: vi.fn(),
  },
  commissionRecord: {
    upsert: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db: mockDb }))

// Import after mock is registered
import {
  calculateCommission,
  calculateAllPendingCommissions,
} from "@/lib/services/commission"

// ─── Fixtures ──────────────────────────────────────────────────────────────

const BASE_SALE = {
  id: "sale-001",
  repId: "rep-001",
  blitzId: "blitz-001",
  carrierId: "carrier-001",
  status: "VERIFIED",
  submittedAt: new Date("2025-01-15"),
  carrier: {
    revenuePerInstall: 1000,
  },
  blitz: {
    marketId: "market-001",
    market: { id: "market-001", name: "Phoenix" },
  },
  rep: {
    governanceTierId: null,
    governanceTier: null,
  },
}

const BASE_STACK_CONFIG = {
  id: "config-001",
  carrierId: "carrier-001",
  marketId: "market-001",
  companyFloorPercent: 0.30,
  managerOverridePercent: 0.10,
  marketOwnerSpreadPercent: 0.05,
  effectiveDate: new Date("2024-01-01"),
}

const UPSERTED_RECORD = {
  id: "commission-001",
  saleId: "sale-001",
  repId: "rep-001",
  blitzId: "blitz-001",
  carrierPayout: 1000,
  companyFloor: 300,
  managerOverride: 70,
  marketOwnerSpread: 35,
  repPay: 595,
  status: "ELIGIBLE",
  governanceTierId: null,
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupHappyPath(
  saleOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {},
  recordOverrides: Record<string, unknown> = {},
) {
  mockDb.sale.findUnique.mockResolvedValue({ ...BASE_SALE, ...saleOverrides })
  mockDb.stackConfig.findFirst.mockResolvedValue({ ...BASE_STACK_CONFIG, ...configOverrides })
  mockDb.commissionRecord.upsert.mockResolvedValue({ ...UPSERTED_RECORD, ...recordOverrides })
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("calculateCommission", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Basic commission calculation
  describe("basic commission calculation", () => {
    it("calls upsert with correctly calculated intermediate values", async () => {
      setupHappyPath()

      await calculateCommission("sale-001")

      expect(mockDb.commissionRecord.upsert).toHaveBeenCalledOnce()
      const { create, update } = mockDb.commissionRecord.upsert.mock.calls[0][0]

      // carrierPayout = 1000
      expect(create.carrierPayout).toBe(1000)

      // companyFloor = 1000 * 0.30 = 300
      expect(create.companyFloor).toBe(300)

      // remaining = 1000 - 300 = 700 (not stored directly but drives downstream)

      // managerOverride = 700 * 0.10 = 70
      expect(create.managerOverride).toBe(70)

      // marketOwnerSpread = 700 * 0.05 = 35
      expect(create.marketOwnerSpread).toBe(35)

      // repPay = (700 - 70 - 35) * 1.0 = 595
      expect(create.repPay).toBe(595)

      // update mirrors the same values
      expect(update.carrierPayout).toBe(1000)
      expect(update.companyFloor).toBe(300)
      expect(update.managerOverride).toBe(70)
      expect(update.marketOwnerSpread).toBe(35)
      expect(update.repPay).toBe(595)
    })

    it("returns the upserted commission record", async () => {
      setupHappyPath()

      const result = await calculateCommission("sale-001")

      expect(result).toEqual(UPSERTED_RECORD)
    })

    it("upserts with status ELIGIBLE and correct saleId/repId/blitzId", async () => {
      setupHappyPath()

      await calculateCommission("sale-001")

      const { create } = mockDb.commissionRecord.upsert.mock.calls[0][0]
      expect(create.status).toBe("ELIGIBLE")
      expect(create.saleId).toBe("sale-001")
      expect(create.repId).toBe("rep-001")
      expect(create.blitzId).toBe("blitz-001")
    })
  })

  // 2. Governance tier multiplier reduces repPay
  describe("governance tier multiplier", () => {
    it("applies 0.8 multiplier and reduces repPay by 20%", async () => {
      setupHappyPath({
        rep: {
          governanceTierId: "tier-001",
          governanceTier: { id: "tier-001", commissionMultiplier: 0.8 },
        },
      })

      await calculateCommission("sale-001")

      const { create } = mockDb.commissionRecord.upsert.mock.calls[0][0]

      // remaining = 700, deductions = 70 + 35 = 105, base repPay = 595
      // with 0.8 multiplier: 595 * 0.8 = 476
      expect(create.repPay).toBeCloseTo(476, 10)

      // carrierPayout, companyFloor, managerOverride, marketOwnerSpread are unaffected
      expect(create.carrierPayout).toBe(1000)
      expect(create.companyFloor).toBe(300)
      expect(create.managerOverride).toBe(70)
      expect(create.marketOwnerSpread).toBe(35)
    })

    it("stores the tier id on the commission record", async () => {
      setupHappyPath({
        rep: {
          governanceTierId: "tier-001",
          governanceTier: { id: "tier-001", commissionMultiplier: 0.8 },
        },
      })

      await calculateCommission("sale-001")

      const { create, update } = mockDb.commissionRecord.upsert.mock.calls[0][0]
      expect(create.governanceTierId).toBe("tier-001")
      expect(update.governanceTierId).toBe("tier-001")
    })
  })

  // 3. No governance tier defaults to multiplier 1.0
  describe("no governance tier", () => {
    it("defaults multiplier to 1.0 when governanceTier is null", async () => {
      setupHappyPath({
        rep: { governanceTierId: null, governanceTier: null },
      })

      await calculateCommission("sale-001")

      const { create } = mockDb.commissionRecord.upsert.mock.calls[0][0]
      expect(create.repPay).toBe(595)
    })

    it("stores null governanceTierId when no tier", async () => {
      setupHappyPath({
        rep: { governanceTierId: null, governanceTier: null },
      })

      await calculateCommission("sale-001")

      const { create } = mockDb.commissionRecord.upsert.mock.calls[0][0]
      expect(create.governanceTierId).toBeNull()
    })
  })

  // 4. Sale not found
  describe("sale not found", () => {
    it("throws 'Sale not found' when findUnique returns null", async () => {
      mockDb.sale.findUnique.mockResolvedValue(null)

      await expect(calculateCommission("missing-sale")).rejects.toThrow("Sale not found")
    })

    it("does not call stackConfig or commissionRecord when sale is missing", async () => {
      mockDb.sale.findUnique.mockResolvedValue(null)

      await expect(calculateCommission("missing-sale")).rejects.toThrow()

      expect(mockDb.stackConfig.findFirst).not.toHaveBeenCalled()
      expect(mockDb.commissionRecord.upsert).not.toHaveBeenCalled()
    })
  })

  // 5. Sale not verified
  describe("sale not verified", () => {
    it("throws 'Sale must be verified' when status is PENDING", async () => {
      mockDb.sale.findUnique.mockResolvedValue({ ...BASE_SALE, status: "PENDING" })

      await expect(calculateCommission("sale-001")).rejects.toThrow("Sale must be verified")
    })

    it("throws 'Sale must be verified' when status is CANCELLED", async () => {
      mockDb.sale.findUnique.mockResolvedValue({ ...BASE_SALE, status: "CANCELLED" })

      await expect(calculateCommission("sale-001")).rejects.toThrow("Sale must be verified")
    })

    it("does not call stackConfig when sale is not verified", async () => {
      mockDb.sale.findUnique.mockResolvedValue({ ...BASE_SALE, status: "PENDING" })

      await expect(calculateCommission("sale-001")).rejects.toThrow()

      expect(mockDb.stackConfig.findFirst).not.toHaveBeenCalled()
    })
  })

  // 6. No stack config found
  describe("no stack config", () => {
    it("throws 'No stack configuration found' when findFirst returns null", async () => {
      mockDb.sale.findUnique.mockResolvedValue(BASE_SALE)
      mockDb.stackConfig.findFirst.mockResolvedValue(null)

      await expect(calculateCommission("sale-001")).rejects.toThrow(
        "No stack configuration found",
      )
    })

    it("does not call commissionRecord when no config exists", async () => {
      mockDb.sale.findUnique.mockResolvedValue(BASE_SALE)
      mockDb.stackConfig.findFirst.mockResolvedValue(null)

      await expect(calculateCommission("sale-001")).rejects.toThrow()

      expect(mockDb.commissionRecord.upsert).not.toHaveBeenCalled()
    })
  })

  // 7. Market-specific config preferred via orderBy
  describe("market-specific config preferred", () => {
    it("queries stackConfig with marketId desc ordering to prefer market-specific config", async () => {
      setupHappyPath()

      await calculateCommission("sale-001")

      expect(mockDb.stackConfig.findFirst).toHaveBeenCalledOnce()
      const query = mockDb.stackConfig.findFirst.mock.calls[0][0]

      // Verify orderBy places marketId desc first
      expect(query.orderBy).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ marketId: "desc" }),
        ]),
      )
      expect(query.orderBy[0]).toEqual({ marketId: "desc" })
    })

    it("queries stackConfig with OR condition covering market-specific and carrier-wide", async () => {
      setupHappyPath()

      await calculateCommission("sale-001")

      const query = mockDb.stackConfig.findFirst.mock.calls[0][0]

      expect(query.where.OR).toEqual(
        expect.arrayContaining([
          { marketId: BASE_SALE.blitz.marketId },
          { marketId: null },
        ]),
      )
    })

    it("uses the first config returned by the DB (market-specific wins when present)", async () => {
      const marketSpecificConfig = {
        ...BASE_STACK_CONFIG,
        marketId: "market-001",
        companyFloorPercent: 0.25, // different from carrier-wide
      }
      mockDb.sale.findUnique.mockResolvedValue(BASE_SALE)
      mockDb.stackConfig.findFirst.mockResolvedValue(marketSpecificConfig)
      mockDb.commissionRecord.upsert.mockResolvedValue(UPSERTED_RECORD)

      await calculateCommission("sale-001")

      const { create } = mockDb.commissionRecord.upsert.mock.calls[0][0]

      // companyFloor = 1000 * 0.25 = 250
      expect(create.companyFloor).toBe(250)
    })
  })
})

// ─── calculateAllPendingCommissions ────────────────────────────────────────

describe("calculateAllPendingCommissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns an empty array when there are no verified sales without commissions", async () => {
    mockDb.sale.findMany.mockResolvedValue([])

    const results = await calculateAllPendingCommissions()

    expect(results).toEqual([])
  })

  it("processes multiple verified sales and returns success entries", async () => {
    const sales = [
      { ...BASE_SALE, id: "sale-A" },
      { ...BASE_SALE, id: "sale-B" },
    ]
    mockDb.sale.findMany.mockResolvedValue(sales)

    // Both calculateCommission calls will need sale + stackConfig + upsert mocks
    mockDb.sale.findUnique
      .mockResolvedValueOnce({ ...BASE_SALE, id: "sale-A" })
      .mockResolvedValueOnce({ ...BASE_SALE, id: "sale-B" })
    mockDb.stackConfig.findFirst.mockResolvedValue(BASE_STACK_CONFIG)
    mockDb.commissionRecord.upsert
      .mockResolvedValueOnce({ ...UPSERTED_RECORD, saleId: "sale-A" })
      .mockResolvedValueOnce({ ...UPSERTED_RECORD, saleId: "sale-B" })

    const results = await calculateAllPendingCommissions()

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      saleId: "sale-A",
      status: "success",
      record: expect.objectContaining({ saleId: "sale-A" }),
    })
    expect(results[1]).toEqual({
      saleId: "sale-B",
      status: "success",
      record: expect.objectContaining({ saleId: "sale-B" }),
    })
  })

  it("captures errors per sale and continues processing remaining sales", async () => {
    const sales = [
      { ...BASE_SALE, id: "sale-good" },
      { ...BASE_SALE, id: "sale-bad" },
    ]
    mockDb.sale.findMany.mockResolvedValue(sales)

    // First sale succeeds
    mockDb.sale.findUnique
      .mockResolvedValueOnce({ ...BASE_SALE, id: "sale-good" })
      // Second sale: findUnique returns null → throws "Sale not found"
      .mockResolvedValueOnce(null)

    mockDb.stackConfig.findFirst.mockResolvedValue(BASE_STACK_CONFIG)
    mockDb.commissionRecord.upsert.mockResolvedValue({ ...UPSERTED_RECORD, saleId: "sale-good" })

    const results = await calculateAllPendingCommissions()

    expect(results).toHaveLength(2)

    expect(results[0]).toMatchObject({ saleId: "sale-good", status: "success" })
    expect(results[1]).toMatchObject({
      saleId: "sale-bad",
      status: "error",
      error: expect.stringContaining("Sale not found"),
    })
  })

  it("queries for sales with status VERIFIED and no existing commissionRecord", async () => {
    mockDb.sale.findMany.mockResolvedValue([])

    await calculateAllPendingCommissions()

    expect(mockDb.sale.findMany).toHaveBeenCalledWith({
      where: {
        status: "VERIFIED",
        commissionRecord: null,
      },
    })
  })

  it("returns error entries for all sales when stackConfig is missing", async () => {
    const sales = [
      { ...BASE_SALE, id: "sale-X" },
      { ...BASE_SALE, id: "sale-Y" },
    ]
    mockDb.sale.findMany.mockResolvedValue(sales)

    mockDb.sale.findUnique
      .mockResolvedValueOnce({ ...BASE_SALE, id: "sale-X" })
      .mockResolvedValueOnce({ ...BASE_SALE, id: "sale-Y" })
    mockDb.stackConfig.findFirst.mockResolvedValue(null)

    const results = await calculateAllPendingCommissions()

    expect(results).toHaveLength(2)
    expect(results[0].status).toBe("error")
    expect(results[1].status).toBe("error")
    expect(results[0].error).toContain("No stack configuration found")
    expect(results[1].error).toContain("No stack configuration found")
  })
})
