import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type AgreementSeed = {
  type: "REP_AGREEMENT" | "GPS_CONSENT" | "TAX_W9" | "BACKGROUND_CHECK";
  title: string;
  body: string;
  required: boolean;
  blocking: boolean;
  requiresUpload: boolean;
};

const AGREEMENT_SEEDS: AgreementSeed[] = [
  {
    type: "REP_AGREEMENT",
    title: "Independent Rep Agreement",
    body:
      "## Independent Rep Agreement\n\nYou are engaged as an independent contractor, not an employee. " +
      "Please review the terms governing commissions, conduct, and termination before signing.",
    required: true,
    blocking: true,
    requiresUpload: false,
  },
  {
    type: "GPS_CONSENT",
    title: "GPS / Location Tracking Consent",
    body:
      "## GPS / Location Tracking Consent\n\nThe app tracks your location during active shifts to verify " +
      "door-knock activity and route coverage. By accepting you consent to foreground and background " +
      "location collection while on the clock.",
    required: true,
    blocking: true,
    requiresUpload: false,
  },
  {
    type: "BACKGROUND_CHECK",
    title: "Background Check Consent",
    body:
      "## Background Check Consent\n\nYou authorize D2D Blitz to obtain a consumer/background report as " +
      "permitted by law for the purpose of evaluating your engagement as a sales representative.",
    required: true,
    blocking: true,
    requiresUpload: false,
  },
  {
    type: "TAX_W9",
    title: "W-9 Tax Form",
    body:
      "## W-9 Tax Form\n\nUpload a completed and signed IRS Form W-9. This is required so we can issue " +
      "your 1099 at year end. Your document is stored securely and only visible to administrators.",
    required: true,
    blocking: false,
    requiresUpload: true,
  },
];

async function seedAgreements() {
  for (const seed of AGREEMENT_SEEDS) {
    // No natural unique key on (type, version); guard on the active row per type.
    const existing = await prisma.agreement.findFirst({
      where: { type: seed.type, isActive: true },
    });
    if (existing) continue;

    await prisma.agreement.create({
      data: {
        type: seed.type,
        title: seed.title,
        body: seed.body,
        version: 1,
        required: seed.required,
        blocking: seed.blocking,
        requiresUpload: seed.requiresUpload,
        isActive: true,
      },
    });
  }
}

async function main() {
  // Seed onboarding agreements (idempotent — safe to re-run)
  await seedAgreements();

  // Create governance tiers
  const tierGold = await prisma.governanceTier.create({
    data: {
      name: "Gold",
      rank: 1,
      minInstallRate: 0.8,
      commissionMultiplier: 1.2,
      isDefault: false,
    },
  });

  const tierSilver = await prisma.governanceTier.create({
    data: {
      name: "Silver",
      rank: 2,
      minInstallRate: 0.6,
      commissionMultiplier: 1.0,
      isDefault: true,
    },
  });

  const tierBronze = await prisma.governanceTier.create({
    data: {
      name: "Bronze",
      rank: 3,
      minInstallRate: 0.4,
      commissionMultiplier: 0.85,
      isDefault: false,
    },
  });

  // Create users
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      email: "admin@d2dblitz.com",
      passwordHash,
      name: "System Admin",
      phone: "555-000-0001",
      role: "ADMIN",
    },
  });

  const executive = await prisma.user.create({
    data: {
      email: "exec@d2dblitz.com",
      passwordHash,
      name: "Jane Executive",
      phone: "555-000-0002",
      role: "EXECUTIVE",
    },
  });

  const recruiter = await prisma.user.create({
    data: {
      email: "recruiter@d2dblitz.com",
      passwordHash,
      name: "Bob Recruiter",
      phone: "555-000-0003",
      role: "RECRUITER",
    },
  });

  const marketOwner = await prisma.user.create({
    data: {
      email: "marketowner@d2dblitz.com",
      passwordHash,
      name: "Carol Market",
      phone: "555-000-0004",
      role: "MARKET_OWNER",
    },
  });

  const fieldManager = await prisma.user.create({
    data: {
      email: "manager@d2dblitz.com",
      passwordHash,
      name: "Dave Manager",
      phone: "555-000-0005",
      role: "FIELD_MANAGER",
    },
  });

  const rep1 = await prisma.user.create({
    data: {
      email: "rep1@d2dblitz.com",
      passwordHash,
      name: "Eve Rep",
      phone: "555-000-0006",
      role: "FIELD_REP",
      governanceTierId: tierSilver.id,
    },
  });

  const rep2 = await prisma.user.create({
    data: {
      email: "rep2@d2dblitz.com",
      passwordHash,
      name: "Frank Rep",
      phone: "555-000-0007",
      role: "FIELD_REP",
      governanceTierId: tierSilver.id,
    },
  });

  const callCenter = await prisma.user.create({
    data: {
      email: "callcenter@d2dblitz.com",
      passwordHash,
      name: "Grace Agent",
      phone: "555-000-0008",
      role: "CALL_CENTER",
    },
  });

  // Create carriers (with a carrier-wide minimum retained margin)
  const carrier1 = await prisma.carrier.create({
    data: {
      name: "FiberMax ISP",
      revenuePerInstall: 250.0,
      minMarginPercent: 20,
      portalUrl: "https://portal.fibermax.example.com",
      status: "ACTIVE",
    },
  });

  const carrier2 = await prisma.carrier.create({
    data: {
      name: "SpeedNet Cable",
      revenuePerInstall: 200.0,
      minMarginPercent: 15,
      portalUrl: "https://portal.speednet.example.com",
      status: "ACTIVE",
    },
  });

  // Product catalog for carrier1 (each product has its own per-install revenue)
  await prisma.product.createMany({
    data: [
      { carrierId: carrier1.id, name: "500 Mbps", revenue: 200.0 },
      { carrierId: carrier1.id, name: "1 Gig", revenue: 300.0 },
      { carrierId: carrier1.id, name: "2 Gig", revenue: 400.0, minMarginPercent: 25 },
    ],
  });

  // Example custom per-rep commission override: rep1 earns a flat $150 on 1 Gig.
  const oneGig = await prisma.product.findFirst({
    where: { carrierId: carrier1.id, name: "1 Gig" },
  });
  if (oneGig) {
    await prisma.repCommissionOverride.create({
      data: {
        repId: rep1.id,
        carrierId: carrier1.id,
        productId: oneGig.id,
        amount: 150.0,
        effectiveDate: new Date("2024-01-01"),
      },
    });
  }

  // Create markets
  const market1 = await prisma.market.create({
    data: {
      name: "Dallas-Fort Worth",
      carrierId: carrier1.id,
      ownerId: marketOwner.id,
      coverageArea: "DFW Metroplex",
      competitionNotes: "Heavy AT&T presence",
      status: "ACTIVE",
    },
  });

  const market2 = await prisma.market.create({
    data: {
      name: "Austin Metro",
      carrierId: carrier2.id,
      ownerId: marketOwner.id,
      coverageArea: "Greater Austin Area",
      competitionNotes: "Google Fiber competitor",
      status: "ACTIVE",
    },
  });

  // Create stack configs
  await prisma.stackConfig.create({
    data: {
      carrierId: carrier1.id,
      marketId: market1.id,
      companyFloorPercent: 0.2,
      managerOverridePercent: 0.1,
      marketOwnerSpreadPercent: 0.05,
      effectiveDate: new Date("2024-01-01"),
    },
  });

  await prisma.stackConfig.create({
    data: {
      carrierId: carrier2.id,
      marketId: market2.id,
      companyFloorPercent: 0.25,
      managerOverridePercent: 0.08,
      marketOwnerSpreadPercent: 0.05,
      effectiveDate: new Date("2024-01-01"),
    },
  });

  // Global-default holdback policy: reserve 10% of rep commission for 120 days,
  // released as a retention bonus if the install survives. (carrierId null = default)
  await prisma.holdbackPolicy.create({
    data: {
      carrierId: null,
      holdbackPercent: 10,
      holdbackDays: 120,
      effectiveDate: new Date("2024-01-01"),
    },
  });

  // Create a blitz
  const blitz1 = await prisma.blitz.create({
    data: {
      marketId: market1.id,
      name: "DFW Spring Blitz 2024",
      startDate: new Date("2024-03-01"),
      endDate: new Date("2024-03-31"),
      repCap: 10,
      housingPlan: "Extended Stay America - Irving",
      status: "ACTIVE",
      managerId: fieldManager.id,
    },
  });

  // Assign reps to blitz
  await prisma.blitzAssignment.create({
    data: {
      blitzId: blitz1.id,
      repId: rep1.id,
      housingAssignment: "Room 201",
      status: "ACTIVE",
      arrivalConfirmed: true,
    },
  });

  await prisma.blitzAssignment.create({
    data: {
      blitzId: blitz1.id,
      repId: rep2.id,
      housingAssignment: "Room 202",
      status: "ACTIVE",
      arrivalConfirmed: true,
    },
  });

  // Create sample sales
  const sale1 = await prisma.sale.create({
    data: {
      repId: rep1.id,
      blitzId: blitz1.id,
      carrierId: carrier1.id,
      customerName: "John Smith",
      customerPhone: "555-100-0001",
      customerAddress: "123 Main St, Dallas, TX 75201",
      customerEmail: "john@example.com",
      installDate: new Date("2024-03-10"),
      orderConfirmation: "FM-2024-001",
      status: "VERIFIED",
    },
  });

  const sale2 = await prisma.sale.create({
    data: {
      repId: rep1.id,
      blitzId: blitz1.id,
      carrierId: carrier1.id,
      customerName: "Sarah Johnson",
      customerPhone: "555-100-0002",
      customerAddress: "456 Oak Ave, Dallas, TX 75202",
      installDate: new Date("2024-03-12"),
      orderConfirmation: "FM-2024-002",
      status: "VERIFIED",
    },
  });

  await prisma.sale.create({
    data: {
      repId: rep2.id,
      blitzId: blitz1.id,
      carrierId: carrier1.id,
      customerName: "Mike Davis",
      customerPhone: "555-100-0003",
      customerAddress: "789 Elm Blvd, Irving, TX 75038",
      installDate: new Date("2024-03-15"),
      status: "SUBMITTED",
    },
  });

  // Create daily reports
  await prisma.dailyReport.create({
    data: {
      repId: rep1.id,
      blitzId: blitz1.id,
      date: new Date("2024-03-05"),
      doorsKnocked: 45,
      conversations: 15,
      goBacksRecorded: 3,
      appointmentsScheduled: 2,
      salesCount: 1,
    },
  });

  await prisma.dailyReport.create({
    data: {
      repId: rep2.id,
      blitzId: blitz1.id,
      date: new Date("2024-03-05"),
      doorsKnocked: 38,
      conversations: 12,
      goBacksRecorded: 2,
      appointmentsScheduled: 1,
      salesCount: 0,
    },
  });

  // Create blitz expenses
  await prisma.blitzExpense.create({
    data: {
      blitzId: blitz1.id,
      category: "HOUSING",
      amount: 3500,
      description: "Extended Stay America - March 2024",
      date: new Date("2024-03-01"),
    },
  });

  await prisma.blitzExpense.create({
    data: {
      blitzId: blitz1.id,
      category: "TRAVEL",
      amount: 800,
      description: "Flight reimbursements - 2 reps",
      date: new Date("2024-03-01"),
    },
  });

  // Create a recruiting lead
  await prisma.lead.create({
    data: {
      name: "Alex Prospect",
      phone: "555-200-0001",
      email: "alex@example.com",
      source: "REFERRAL",
      status: "INTERVIEW",
      recruiterId: recruiter.id,
      fieldManagerId: fieldManager.id,
      marketId: market1.id,
      notes: "Strong referral from Eve Rep",
      travelCapable: true,
      commitmentLevel: "FULL_TIME",
    },
  });

  console.log("Seed data created successfully!");
  console.log("\nLogin credentials (all use password: password123):");
  console.log("  Admin: admin@d2dblitz.com");
  console.log("  Executive: exec@d2dblitz.com");
  console.log("  Recruiter: recruiter@d2dblitz.com");
  console.log("  Market Owner: marketowner@d2dblitz.com");
  console.log("  Field Manager: manager@d2dblitz.com");
  console.log("  Field Rep 1: rep1@d2dblitz.com");
  console.log("  Field Rep 2: rep2@d2dblitz.com");
  console.log("  Call Center: callcenter@d2dblitz.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
