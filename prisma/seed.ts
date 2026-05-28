import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
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

  // ─── MVP Demo Team ──────────────────────────────────────────────────────────

  const demoTeam = await prisma.team.create({
    data: { name: "Demo Team Alpha" },
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

  // MVP demo manager (FIELD_MANAGER) — maps to "MANAGER" role in the MVP feature
  const demoManager = await prisma.user.create({
    data: {
      email: "manager@d2dblitz.com",
      passwordHash,
      name: "Dave Manager",
      phone: "555-000-0005",
      role: "FIELD_MANAGER",
      teamId: demoTeam.id,
    },
  });

  // MVP demo reps (FIELD_REP) — maps to "REP" role in the MVP feature
  const rep1 = await prisma.user.create({
    data: {
      email: "rep1@d2dblitz.com",
      passwordHash,
      name: "Eve Rep",
      phone: "555-000-0006",
      role: "FIELD_REP",
      teamId: demoTeam.id,
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
      teamId: demoTeam.id,
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

  // ─── MVP Sample Visits ──────────────────────────────────────────────────────

  const today = new Date();
  today.setHours(10, 0, 0, 0);

  const sampleVisitsRep1 = [
    { address: "100 Oak St, Dallas, TX 75201", outcome: "NOT_HOME" as const, notes: null, minsAgo: 30 },
    { address: "102 Oak St, Dallas, TX 75201", outcome: "CALLBACK" as const, notes: "Interested, call after 5pm", minsAgo: 45 },
    { address: "104 Oak St, Dallas, TX 75201", outcome: "SALE" as const, notes: "Signed up for FiberMax 1Gb", minsAgo: 60 },
    { address: "106 Oak St, Dallas, TX 75201", outcome: "NOT_INTERESTED" as const, notes: "Already has cable contract", minsAgo: 80 },
    { address: "108 Oak St, Dallas, TX 75201", outcome: "NOT_HOME" as const, notes: null, minsAgo: 95 },
    { address: "110 Oak St, Dallas, TX 75201", outcome: "SALE" as const, notes: "Upsold premium package", minsAgo: 115 },
  ];

  const sampleVisitsRep2 = [
    { address: "200 Elm Ave, Dallas, TX 75202", outcome: "NOT_HOME" as const, notes: null, minsAgo: 25 },
    { address: "202 Elm Ave, Dallas, TX 75202", outcome: "NOT_INTERESTED" as const, notes: "Very price sensitive", minsAgo: 40 },
    { address: "204 Elm Ave, Dallas, TX 75202", outcome: "CALLBACK" as const, notes: "Spouse needs to agree", minsAgo: 55 },
    { address: "206 Elm Ave, Dallas, TX 75202", outcome: "SALE" as const, notes: "Easy close, super friendly", minsAgo: 70 },
    { address: "208 Elm Ave, Dallas, TX 75202", outcome: "NOT_HOME" as const, notes: null, minsAgo: 90 },
  ];

  for (const v of sampleVisitsRep1) {
    const ts = new Date(today.getTime() - v.minsAgo * 60 * 1000);
    await prisma.visit.create({
      data: {
        repId: rep1.id,
        teamId: demoTeam.id,
        address: v.address,
        outcome: v.outcome,
        notes: v.notes,
        createdAt: ts,
      },
    });
  }

  for (const v of sampleVisitsRep2) {
    const ts = new Date(today.getTime() - v.minsAgo * 60 * 1000);
    await prisma.visit.create({
      data: {
        repId: rep2.id,
        teamId: demoTeam.id,
        address: v.address,
        outcome: v.outcome,
        notes: v.notes,
        createdAt: ts,
      },
    });
  }

  // ─── Full Platform Seed Data ─────────────────────────────────────────────────

  // Create carriers
  const carrier1 = await prisma.carrier.create({
    data: {
      name: "FiberMax ISP",
      revenuePerInstall: 250.0,
      portalUrl: "https://portal.fibermax.example.com",
      status: "ACTIVE",
    },
  });

  const carrier2 = await prisma.carrier.create({
    data: {
      name: "SpeedNet Cable",
      revenuePerInstall: 200.0,
      portalUrl: "https://portal.speednet.example.com",
      status: "ACTIVE",
    },
  });

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
      managerId: demoManager.id,
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
      fieldManagerId: demoManager.id,
      marketId: market1.id,
      notes: "Strong referral from Eve Rep",
      travelCapable: true,
      commitmentLevel: "FULL_TIME",
    },
  });

  // Suppress unused variable warnings
  void [tierGold, tierBronze, sale1, sale2, admin, executive, callCenter, market2];

  console.log("Seed data created successfully!");
  console.log("\nMVP Demo accounts (password: password123):");
  console.log("  Manager:  manager@d2dblitz.com  (FIELD_MANAGER — sees Visit Dashboard)");
  console.log("  Rep 1:    rep1@d2dblitz.com     (FIELD_REP — logs visits)");
  console.log("  Rep 2:    rep2@d2dblitz.com     (FIELD_REP — logs visits)");
  console.log("\nAll accounts (password: password123):");
  console.log("  Admin:        admin@d2dblitz.com");
  console.log("  Executive:    exec@d2dblitz.com");
  console.log("  Recruiter:    recruiter@d2dblitz.com");
  console.log("  Market Owner: marketowner@d2dblitz.com");
  console.log("  Call Center:  callcenter@d2dblitz.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
