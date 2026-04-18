import { describe, it, expect, vi, beforeEach } from "vitest"

// ---------------------------------------------------------------------------
// Mocks — declared before route imports so vi.mock hoists correctly
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  db: {
    sale: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    blitz: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    installRecord: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    carrier: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    market: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

import {
  GET as salesGET,
  PUT as salesPUT,
} from "@/app/api/sales/[id]/route"

import {
  GET as blitzesGET,
  PUT as blitzesPUT,
  DELETE as blitzesDELETE,
} from "@/app/api/blitzes/[id]/route"

import {
  GET as installRecordsGET,
  PUT as installRecordsPUT,
} from "@/app/api/install-records/[id]/route"

import {
  GET as carriersGET,
  PUT as carriersPUT,
  DELETE as carriersDELETE,
} from "@/app/api/carriers/[id]/route"

import {
  GET as marketsGET,
  PUT as marketsPUT,
  DELETE as marketsDELETE,
} from "@/app/api/markets/[id]/route"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  }
  if (body) init.body = JSON.stringify(body)
  return new Request(url, init)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const ADMIN_SESSION = {
  user: {
    id: "user-1",
    role: "ADMIN",
    name: "Test",
    email: "test@test.com",
    emailVerified: true,
  },
}

const REP_SESSION = {
  user: {
    id: "rep-1",
    role: "REP",
    name: "Rep User",
    email: "rep@test.com",
    emailVerified: true,
  },
}

const MANAGER_SESSION = {
  user: {
    id: "mgr-1",
    role: "FIELD_MANAGER",
    name: "Manager",
    email: "mgr@test.com",
    emailVerified: true,
  },
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// SALES /api/sales/[id]
// ===========================================================================

describe("sales/[id]", () => {
  const saleFixture = {
    id: "sale-1",
    repId: "rep-1",
    customerName: "Jane Doe",
    customerPhone: "555-1234",
    customerAddress: "123 Main St",
    status: "SUBMITTED",
    carrier: { id: "c-1", name: "Carrier A" },
    blitz: { id: "b-1", market: { id: "m-1" } },
    rep: { id: "rep-1", name: "Rep User" },
    commissionRecord: null,
    matchedInstallRecord: null,
  }

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await salesGET(
        makeRequest("http://localhost/api/sales/sale-1", "GET") as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when sale not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(null)
      const res = await salesGET(
        makeRequest("http://localhost/api/sales/sale-1", "GET") as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 403 when non-manager non-owner accesses sale", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...saleFixture,
        repId: "someone-else",
      } as any)
      const res = await salesGET(
        makeRequest("http://localhost/api/sales/sale-1", "GET") as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 200 for admin", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesGET(
        makeRequest("http://localhost/api/sales/sale-1", "GET") as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe("sale-1")
    })

    it("returns 200 for the rep who owns the sale", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesGET(
        makeRequest("http://localhost/api/sales/sale-1", "GET") as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(200)
    })
  })

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          customerName: "Updated",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when sale not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(null)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          customerName: "Updated",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 403 when non-manager non-owner updates sale", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...saleFixture,
        repId: "someone-else",
      } as any)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          customerName: "Updated",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 400 on invalid body", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          customerEmail: "not-an-email",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 400 when status=CANCELLED without cancellationReason", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          status: "CANCELLED",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain("Cancellation reason")
    })

    it("returns 403 when non-manager sets status to VERIFIED", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          status: "VERIFIED",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 403 when non-manager sets status to INSTALLED", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          status: "INSTALLED",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 200 on valid update by admin", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const updated = { ...saleFixture, customerName: "Updated Name" }
      vi.mocked(db.sale.update).mockResolvedValue(updated as any)

      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          customerName: "Updated Name",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.customerName).toBe("Updated Name")
    })

    it("returns 200 when CANCELLED with cancellationReason", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue(saleFixture as any)
      const updated = { ...saleFixture, status: "CANCELLED" }
      vi.mocked(db.sale.update).mockResolvedValue(updated as any)

      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          status: "CANCELLED",
          cancellationReason: "Customer changed mind",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(200)
    })

    it("allows manager to set status to VERIFIED", async () => {
      vi.mocked(auth).mockResolvedValue(MANAGER_SESSION as any)
      vi.mocked(db.sale.findUnique).mockResolvedValue({
        ...saleFixture,
        repId: "someone-else",
      } as any)
      const updated = { ...saleFixture, status: "VERIFIED" }
      vi.mocked(db.sale.update).mockResolvedValue(updated as any)

      const res = await salesPUT(
        makeRequest("http://localhost/api/sales/sale-1", "PUT", {
          status: "VERIFIED",
        }) as any,
        makeParams("sale-1"),
      )
      expect(res.status).toBe(200)
    })
  })
})

// ===========================================================================
// BLITZES /api/blitzes/[id]
// ===========================================================================

describe("blitzes/[id]", () => {
  const blitzFixture = {
    id: "blitz-1",
    name: "Summer Blitz",
    status: "PLANNING",
    market: { id: "m-1", carrier: { id: "c-1" } },
    manager: { id: "mgr-1", name: "Manager", email: "mgr@test.com" },
    assignments: [],
    expenses: [],
    sales: [],
  }

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await blitzesGET(
        makeRequest("http://localhost/api/blitzes/blitz-1", "GET"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when blitz not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.blitz.findUnique).mockResolvedValue(null)
      const res = await blitzesGET(
        makeRequest("http://localhost/api/blitzes/blitz-1", "GET"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 200 with blitz data", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.blitz.findUnique).mockResolvedValue(blitzFixture as any)
      const res = await blitzesGET(
        makeRequest("http://localhost/api/blitzes/blitz-1", "GET"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Summer Blitz")
    })
  })

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await blitzesPUT(
        makeRequest("http://localhost/api/blitzes/blitz-1", "PUT", {
          name: "Updated",
        }),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 400 on invalid body", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await blitzesPUT(
        makeRequest("http://localhost/api/blitzes/blitz-1", "PUT", {
          name: "",
        }),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 400 when repCap is negative", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await blitzesPUT(
        makeRequest("http://localhost/api/blitzes/blitz-1", "PUT", {
          repCap: -5,
        }),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 200 on valid update", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...blitzFixture, name: "Fall Blitz" }
      vi.mocked(db.blitz.update).mockResolvedValue(updated as any)

      const res = await blitzesPUT(
        makeRequest("http://localhost/api/blitzes/blitz-1", "PUT", {
          name: "Fall Blitz",
        }),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Fall Blitz")
    })

    it("returns 200 when updating status", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...blitzFixture, status: "ACTIVE" }
      vi.mocked(db.blitz.update).mockResolvedValue(updated as any)

      const res = await blitzesPUT(
        makeRequest("http://localhost/api/blitzes/blitz-1", "PUT", {
          status: "ACTIVE",
        }),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe("ACTIVE")
    })
  })

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await blitzesDELETE(
        makeRequest("http://localhost/api/blitzes/blitz-1", "DELETE"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when blitz not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.blitz.findUnique).mockResolvedValue(null)
      const res = await blitzesDELETE(
        makeRequest("http://localhost/api/blitzes/blitz-1", "DELETE"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 400 when blitz status is not PLANNING", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.blitz.findUnique).mockResolvedValue({
        id: "blitz-1",
        status: "ACTIVE",
      } as any)
      const res = await blitzesDELETE(
        makeRequest("http://localhost/api/blitzes/blitz-1", "DELETE"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toContain("PLANNING")
    })

    it("returns 200 and deletes blitz in PLANNING status", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.blitz.findUnique).mockResolvedValue({
        id: "blitz-1",
        status: "PLANNING",
      } as any)
      vi.mocked(db.blitz.delete).mockResolvedValue(blitzFixture as any)

      const res = await blitzesDELETE(
        makeRequest("http://localhost/api/blitzes/blitz-1", "DELETE"),
        makeParams("blitz-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(db.blitz.delete).toHaveBeenCalledWith({ where: { id: "blitz-1" } })
    })
  })
})

// ===========================================================================
// INSTALL RECORDS /api/install-records/[id]
// ===========================================================================

describe("install-records/[id]", () => {
  const recordFixture = {
    id: "rec-1",
    status: "UNMATCHED",
    matchedSaleId: null,
    carrier: { id: "c-1", name: "Carrier A" },
    matchedSale: null,
    upload: { id: "u-1", fileName: "file.csv" },
    exceptions: [],
  }

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await installRecordsGET(
        makeRequest("http://localhost/api/install-records/rec-1", "GET") as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when record not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValue(null)
      const res = await installRecordsGET(
        makeRequest("http://localhost/api/install-records/rec-1", "GET") as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 200 with record data", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValue(recordFixture as any)
      const res = await installRecordsGET(
        makeRequest("http://localhost/api/install-records/rec-1", "GET") as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe("rec-1")
    })
  })

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          status: "MATCHED",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when record not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(null)
      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          status: "MATCHED",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 400 on invalid body", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          status: "INVALID_STATUS",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns existing record on action=confirm (no-op)", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(recordFixture as any)

      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          action: "confirm",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.id).toBe("rec-1")
      expect(db.installRecord.update).not.toHaveBeenCalled()
    })

    it("returns 409 when sale is already matched to another record", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      // First call: find the record being updated
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(recordFixture as any)
      // Second call: check for existing match — returns a different record
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce({
        id: "rec-other",
        matchedSaleId: "sale-1",
      } as any)

      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          matchedSaleId: "sale-1",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(409)
      const json = await res.json()
      expect(json.error).toContain("already matched")
    })

    it("returns 200 and sets status to MATCHED when matchedSaleId provided", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      // First call: find the record being updated
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(recordFixture as any)
      // Second call: check for existing match — no conflict
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(null)

      const updatedRecord = {
        ...recordFixture,
        status: "MATCHED",
        matchedSaleId: "sale-1",
      }
      vi.mocked(db.installRecord.update).mockResolvedValue(updatedRecord as any)
      vi.mocked(db.sale.update).mockResolvedValue({} as any)

      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          matchedSaleId: "sale-1",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe("MATCHED")
      expect(db.sale.update).toHaveBeenCalledWith({
        where: { id: "sale-1" },
        data: { status: "VERIFIED" },
      })
    })

    it("returns 200 when updating status only", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(recordFixture as any)
      const updatedRecord = { ...recordFixture, status: "DISPUTED" }
      vi.mocked(db.installRecord.update).mockResolvedValue(updatedRecord as any)

      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          status: "DISPUTED",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe("DISPUTED")
    })

    it("allows matching to the same record (re-match)", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce(recordFixture as any)
      // Second call returns the same record (same id) — not a conflict
      vi.mocked(db.installRecord.findUnique).mockResolvedValueOnce({
        id: "rec-1",
        matchedSaleId: "sale-1",
      } as any)
      const updatedRecord = { ...recordFixture, status: "MATCHED", matchedSaleId: "sale-1" }
      vi.mocked(db.installRecord.update).mockResolvedValue(updatedRecord as any)
      vi.mocked(db.sale.update).mockResolvedValue({} as any)

      const res = await installRecordsPUT(
        makeRequest("http://localhost/api/install-records/rec-1", "PUT", {
          matchedSaleId: "sale-1",
        }) as any,
        makeParams("rec-1"),
      )
      expect(res.status).toBe(200)
    })
  })
})

// ===========================================================================
// CARRIERS /api/carriers/[id]
// ===========================================================================

describe("carriers/[id]", () => {
  const carrierFixture = {
    id: "carrier-1",
    name: "Acme Solar",
    revenuePerInstall: 250,
    portalUrl: "https://portal.acme.com",
    status: "ACTIVE",
  }

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await carriersGET(
        makeRequest("http://localhost/api/carriers/carrier-1", "GET") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when carrier not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.carrier.findUnique).mockResolvedValue(null)
      const res = await carriersGET(
        makeRequest("http://localhost/api/carriers/carrier-1", "GET") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 200 with carrier data", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.carrier.findUnique).mockResolvedValue(carrierFixture as any)
      const res = await carriersGET(
        makeRequest("http://localhost/api/carriers/carrier-1", "GET") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Acme Solar")
    })

    it("returns 200 for non-admin users (read access)", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      vi.mocked(db.carrier.findUnique).mockResolvedValue(carrierFixture as any)
      const res = await carriersGET(
        makeRequest("http://localhost/api/carriers/carrier-1", "GET") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(200)
    })
  })

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Updated",
          revenuePerInstall: 300,
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 403 for non-admin user", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Updated",
          revenuePerInstall: 300,
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 400 on invalid body (missing required fields)", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "",
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 400 when revenuePerInstall is negative", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Carrier",
          revenuePerInstall: -10,
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 400 when portalUrl is not a valid URL", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Carrier",
          revenuePerInstall: 100,
          portalUrl: "not-a-url",
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 200 on valid update by admin", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...carrierFixture, name: "Updated Carrier" }
      vi.mocked(db.carrier.update).mockResolvedValue(updated as any)

      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Updated Carrier",
          revenuePerInstall: 250,
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Updated Carrier")
    })

    it("accepts empty portalUrl", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...carrierFixture, portalUrl: null }
      vi.mocked(db.carrier.update).mockResolvedValue(updated as any)

      const res = await carriersPUT(
        makeRequest("http://localhost/api/carriers/carrier-1", "PUT", {
          name: "Carrier",
          revenuePerInstall: 250,
          portalUrl: "",
        }) as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(200)
    })
  })

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await carriersDELETE(
        makeRequest("http://localhost/api/carriers/carrier-1", "DELETE") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 403 for non-admin user", async () => {
      vi.mocked(auth).mockResolvedValue(REP_SESSION as any)
      const res = await carriersDELETE(
        makeRequest("http://localhost/api/carriers/carrier-1", "DELETE") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(403)
    })

    it("returns 200 and soft-deletes (sets status to INACTIVE)", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...carrierFixture, status: "INACTIVE" }
      vi.mocked(db.carrier.update).mockResolvedValue(updated as any)

      const res = await carriersDELETE(
        makeRequest("http://localhost/api/carriers/carrier-1", "DELETE") as any,
        makeParams("carrier-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe("INACTIVE")
      expect(db.carrier.update).toHaveBeenCalledWith({
        where: { id: "carrier-1" },
        data: { status: "INACTIVE" },
      })
    })
  })
})

// ===========================================================================
// MARKETS /api/markets/[id]
// ===========================================================================

describe("markets/[id]", () => {
  const marketFixture = {
    id: "market-1",
    name: "Phoenix Metro",
    status: "ACTIVE",
    carrier: { id: "c-1", name: "Carrier A" },
    owner: { id: "mgr-1", name: "Manager", email: "mgr@test.com" },
    blitzes: [],
  }

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await marketsGET(
        makeRequest("http://localhost/api/markets/market-1", "GET"),
        makeParams("market-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 404 when market not found", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.market.findUnique).mockResolvedValue(null)
      const res = await marketsGET(
        makeRequest("http://localhost/api/markets/market-1", "GET"),
        makeParams("market-1"),
      )
      expect(res.status).toBe(404)
    })

    it("returns 200 with market data", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.market.findUnique).mockResolvedValue(marketFixture as any)
      const res = await marketsGET(
        makeRequest("http://localhost/api/markets/market-1", "GET"),
        makeParams("market-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Phoenix Metro")
    })
  })

  describe("PUT", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          name: "Updated",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 400 on invalid body", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          name: "",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 400 on invalid status", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          status: "BOGUS",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(400)
    })

    it("returns 200 on valid update", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...marketFixture, name: "Tucson Metro" }
      vi.mocked(db.market.update).mockResolvedValue(updated as any)

      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          name: "Tucson Metro",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.name).toBe("Tucson Metro")
    })

    it("accepts empty coverageArea and competitionNotes", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...marketFixture, coverageArea: null, competitionNotes: null }
      vi.mocked(db.market.update).mockResolvedValue(updated as any)

      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          coverageArea: "",
          competitionNotes: "",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(200)
    })

    it("returns 200 when updating status to PLANNING", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      const updated = { ...marketFixture, status: "PLANNING" }
      vi.mocked(db.market.update).mockResolvedValue(updated as any)

      const res = await marketsPUT(
        makeRequest("http://localhost/api/markets/market-1", "PUT", {
          status: "PLANNING",
        }),
        makeParams("market-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe("PLANNING")
    })
  })

  describe("DELETE", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null)
      const res = await marketsDELETE(
        makeRequest("http://localhost/api/markets/market-1", "DELETE"),
        makeParams("market-1"),
      )
      expect(res.status).toBe(401)
    })

    it("returns 200 and hard-deletes the market", async () => {
      vi.mocked(auth).mockResolvedValue(ADMIN_SESSION as any)
      vi.mocked(db.market.delete).mockResolvedValue(marketFixture as any)

      const res = await marketsDELETE(
        makeRequest("http://localhost/api/markets/market-1", "DELETE"),
        makeParams("market-1"),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(db.market.delete).toHaveBeenCalledWith({ where: { id: "market-1" } })
    })
  })
})
