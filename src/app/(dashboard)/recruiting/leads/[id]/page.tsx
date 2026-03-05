export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Phone, Mail, Calendar } from "lucide-react";
import { LeadActions } from "./lead-actions";

type LeadStatus =
  | "NEW"
  | "SCREENING"
  | "INTERVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ONBOARDED";

const STATUS_VARIANTS: Record<
  LeadStatus,
  "default" | "outline" | "destructive" | "secondary"
> = {
  NEW: "outline",
  SCREENING: "secondary",
  INTERVIEW: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  ONBOARDED: "default",
};

const RESULT_VARIANTS = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
} as const;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "RECRUITER", "FIELD_MANAGER"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      recruiter: { select: { id: true, name: true, email: true } },
      fieldManager: { select: { id: true, name: true } },
      market: { select: { id: true, name: true } },
      interviews: {
        orderBy: { date: "desc" },
        include: {
          interviewer: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!lead) notFound();

  // Get markets and managers for action buttons
  const [markets, managers] = await Promise.all([
    db.market.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { role: "FIELD_MANAGER", status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/recruiting"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{lead.name}</h1>
          <p className="text-sm text-muted-foreground">Lead Detail</p>
        </div>
        <Badge variant={STATUS_VARIANTS[lead.status as LeadStatus]}>
          {lead.status}
        </Badge>
      </div>

      {/* Lead Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium">{lead.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{lead.phone}</span>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{lead.email}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Added:</span>
              <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-input">
            <div className="text-sm">
              <span className="text-muted-foreground">Source: </span>
              <span className="font-medium">{lead.source}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Travel Capable: </span>
              <span className="font-medium">
                {lead.travelCapable ? "Yes" : "No"}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Commitment: </span>
              <span className="font-medium">{lead.commitmentLevel ?? "—"}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Recruiter: </span>
              <span className="font-medium">
                {lead.recruiter.name ?? lead.recruiter.email}
              </span>
            </div>
            {lead.fieldManager && (
              <div className="text-sm">
                <span className="text-muted-foreground">Field Manager: </span>
                <span className="font-medium">{lead.fieldManager.name}</span>
              </div>
            )}
            {lead.market && (
              <div className="text-sm">
                <span className="text-muted-foreground">Market: </span>
                <span className="font-medium">{lead.market.name}</span>
              </div>
            )}
          </div>

          {lead.notes && (
            <div className="pt-2 border-t border-input">
              <p className="text-sm text-muted-foreground mb-1">Notes</p>
              <p className="text-sm">{lead.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Transitions</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadActions
            leadId={lead.id}
            currentStatus={lead.status as LeadStatus}
            markets={markets}
            managers={managers}
          />
        </CardContent>
      </Card>

      {/* Interview History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Interviews ({lead.interviews.length})
          </CardTitle>
          <Link href={`/dashboard/recruiting/interviews/new?leadId=${lead.id}`}>
            <Button size="sm" variant="outline">
              Schedule Interview
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {lead.interviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interviews yet.</p>
          ) : (
            <div className="space-y-3">
              {lead.interviews.map((interview) => (
                <Link
                  key={interview.id}
                  href={`/dashboard/recruiting/interviews/${interview.id}`}
                >
                  <div className="rounded-lg border border-input p-3 hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(interview.date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          by {interview.interviewer.name ?? "Unknown"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          RESULT_VARIANTS[
                            interview.result as keyof typeof RESULT_VARIANTS
                          ]
                        }
                      >
                        {interview.result}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {[
                        { label: "Culture", value: interview.cultureFit },
                        { label: "Work Ethic", value: interview.workEthic },
                        { label: "Travel", value: interview.travelReadiness },
                        {
                          label: "Performance",
                          value: interview.performanceExpectations,
                        },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-semibold">{value}/5</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
