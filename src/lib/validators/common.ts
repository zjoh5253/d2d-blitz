import { z } from "zod";

// ─── Carrier ──────────────────────────────────────────────────────────────────

export const carrierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  revenuePerInstall: z.coerce
    .number({ error: "Must be a number" })
    .positive("Must be greater than 0"),
  portalUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CarrierFormValues = z.infer<typeof carrierSchema>;

// ─── User ─────────────────────────────────────────────────────────────────────

export const userCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum([
    "ADMIN",
    "EXECUTIVE",
    "RECRUITER",
    "MARKET_OWNER",
    "FIELD_MANAGER",
    "FIELD_REP",
    "CALL_CENTER",
  ]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  status: z.string().default("ACTIVE"),
});

export const userEditSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional().or(z.literal("")),
  role: z.enum([
    "ADMIN",
    "EXECUTIVE",
    "RECRUITER",
    "MARKET_OWNER",
    "FIELD_MANAGER",
    "FIELD_REP",
    "CALL_CENTER",
  ]),
  status: z.string().default("ACTIVE"),
});

export type UserCreateFormValues = z.infer<typeof userCreateSchema>;
export type UserEditFormValues = z.infer<typeof userEditSchema>;

// ─── Governance Tier ──────────────────────────────────────────────────────────

export const governanceTierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rank: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .positive("Must be greater than 0"),
  minInstallRate: z.coerce
    .number({ error: "Must be a number" })
    .min(0, "Must be 0 or greater")
    .max(1, "Must be between 0 and 1 (e.g. 0.8 = 80%)"),
  commissionMultiplier: z.coerce
    .number({ error: "Must be a number" })
    .positive("Must be greater than 0"),
  isDefault: z.boolean().default(false),
});

export type GovernanceTierFormValues = z.infer<typeof governanceTierSchema>;

// ─── Stack Config ─────────────────────────────────────────────────────────────

export const stackConfigSchema = z
  .object({
    carrierId: z.string().min(1, "Carrier is required"),
    marketId: z.string().optional().or(z.literal("")),
    companyFloorPercent: z.coerce
      .number({ error: "Must be a number" })
      .min(0, "Must be 0 or greater")
      .max(100, "Must be 100 or less"),
    managerOverridePercent: z.coerce
      .number({ error: "Must be a number" })
      .min(0, "Must be 0 or greater")
      .max(100, "Must be 100 or less"),
    marketOwnerSpreadPercent: z.coerce
      .number({ error: "Must be a number" })
      .min(0, "Must be 0 or greater")
      .max(100, "Must be 100 or less"),
    effectiveDate: z.string().min(1, "Effective date is required"),
  })
  .refine(
    (data) =>
      data.companyFloorPercent +
        data.managerOverridePercent +
        data.marketOwnerSpreadPercent <=
      100,
    {
      message: "Total percentages must not exceed 100%",
      path: ["companyFloorPercent"],
    }
  );

export type StackConfigFormValues = z.infer<typeof stackConfigSchema>;

// ─── Market ───────────────────────────────────────────────────────────────────

export const marketSchema = z.object({
  name: z.string().min(1, "Market name is required"),
  carrierId: z.string().min(1, "Carrier is required"),
  ownerId: z.string().min(1, "Owner is required"),
  coverageArea: z.string().optional(),
  competitionNotes: z.string().optional(),
});

export type MarketFormValues = z.infer<typeof marketSchema>;

// ─── Blitz ────────────────────────────────────────────────────────────────────

export const blitzSchema = z.object({
  name: z.string().min(1, "Blitz name is required"),
  marketId: z.string().min(1, "Market is required"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  repCap: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .positive("Rep cap must be a positive integer"),
  housingPlan: z.string().optional(),
  managerId: z.string().min(1, "Manager is required"),
});

export type BlitzFormValues = z.infer<typeof blitzSchema>;

// ─── Daily Report ─────────────────────────────────────────────────────────────

export const dailyReportSchema = z.object({
  doorsKnocked: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  conversations: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  goBacksRecorded: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  appointmentsScheduled: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  salesCount: z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
});

export type DailyReportFormValues = z.infer<typeof dailyReportSchema>;

// ─── Sale ─────────────────────────────────────────────────────────────────────

export const saleSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Customer phone is required"),
  customerAddress: z.string().min(1, "Customer address is required"),
  customerEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  installDate: z.coerce.date(),
  carrierId: z.string().min(1, "Carrier is required"),
});

export type SaleFormValues = z.infer<typeof saleSchema>;

// ─── Lead ─────────────────────────────────────────────────────────────────────

export const LeadSource = z.enum([
  "REFERRAL",
  "SOCIAL_MEDIA",
  "JOB_BOARD",
  "WALK_IN",
  "EVENT",
  "COLD_OUTREACH",
  "OTHER",
]);

export const leadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  source: LeadSource,
  travelCapable: z.boolean(),
  commitmentLevel: z.string().optional(),
  notes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadSchema>;

// ─── Interview ────────────────────────────────────────────────────────────────

export const InterviewResult = z.enum(["PASS", "FAIL", "HOLD", "NO_SHOW"]);

const interviewScore = (label: string) =>
  z.coerce
    .number({ error: "Must be a number" })
    .int("Must be a whole number")
    .min(1, `${label} must be between 1 and 5`)
    .max(5, `${label} must be between 1 and 5`);

export const interviewSchema = z.object({
  cultureFit: interviewScore("Culture fit"),
  workEthic: interviewScore("Work ethic"),
  travelReadiness: interviewScore("Travel readiness"),
  performanceExpectations: interviewScore("Performance expectations"),
  notes: z.string().optional(),
  result: InterviewResult,
});

export type InterviewFormValues = z.infer<typeof interviewSchema>;
