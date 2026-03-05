export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, User, Clock } from "lucide-react";
import { ContactForm } from "./contact-form";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  SUBMITTED: "bg-purple-100 text-purple-700",
  INSTALLED: "bg-emerald-100 text-emerald-700",
  VERIFIED: "bg-green-100 text-green-700",
};

const OUTCOME_LABELS: Record<string, string> = {
  NO_ANSWER: "No Answer",
  VOICEMAIL: "Voicemail",
  SPOKE: "Spoke with Customer",
  QUALIFIED: "Qualified",
  NOT_INTERESTED: "Not Interested",
};

const OUTCOME_COLORS: Record<string, string> = {
  NO_ANSWER: "bg-gray-100 text-gray-700",
  VOICEMAIL: "bg-yellow-100 text-yellow-700",
  SPOKE: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-green-100 text-green-700",
  NOT_INTERESTED: "bg-red-100 text-red-700",
};

export default async function InboundLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const lead = await db.inboundLead.findUnique({
    where: { id },
    include: {
      contactAttempts: {
        orderBy: { attemptDate: "desc" },
        include: {
          agent: { select: { id: true, name: true } },
        },
      },
      inboundSales: {
        include: {
          carrier: { select: { id: true, name: true } },
          agent: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!lead) notFound();

  const canConvert =
    lead.status === "CONTACTED" && lead.inboundSales.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/inbound"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lead.customerName}</h1>
            <Badge
              className={`${STATUS_COLORS[lead.status] ?? ""}`}
              variant="outline"
            >
              {lead.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Inbound Lead &mdash; Source: {lead.source.replace(/_/g, " ")}
          </p>
        </div>
        {canConvert && (
          <Link
            href={`/inbound/sales/new?leadId=${lead.id}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Convert to Sale
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lead Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{lead.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.customerPhone}</span>
              </div>
              {lead.customerEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.customerEmail}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  Created{" "}
                  {new Date(lead.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {lead.qualificationNotes && (
                <div className="pt-2 border-t border-input">
                  <p className="text-xs text-muted-foreground font-medium mb-1">
                    Qualification Notes
                  </p>
                  <p className="text-sm">{lead.qualificationNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Transitions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["NEW", "CONTACTED", "SUBMITTED", "INSTALLED", "VERIFIED"].map(
                (status) => (
                  <form
                    key={status}
                    action={async () => {
                      "use server";
                      await db.inboundLead.update({
                        where: { id },
                        data: { status: status as "NEW" | "CONTACTED" | "SUBMITTED" | "INSTALLED" | "VERIFIED" },
                      });
                    }}
                  >
                    <button
                      type="submit"
                      disabled={lead.status === status}
                      className={`w-full rounded-md px-3 py-1.5 text-sm text-left transition-colors ${
                        lead.status === status
                          ? "bg-primary/10 text-primary font-medium cursor-default"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {status}
                    </button>
                  </form>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Contact Attempt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Log Contact Attempt</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm leadId={lead.id} />
            </CardContent>
          </Card>

          {/* Contact Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Contact History ({lead.contactAttempts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.contactAttempts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No contact attempts yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {lead.contactAttempts.map((attempt, idx) => (
                    <div
                      key={attempt.id}
                      className="flex gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                        {idx < lead.contactAttempts.length - 1 && (
                          <div className="w-px flex-1 bg-border mt-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={`text-xs ${OUTCOME_COLORS[attempt.outcome] ?? ""}`}
                            variant="outline"
                          >
                            {OUTCOME_LABELS[attempt.outcome] ?? attempt.outcome}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(attempt.attemptDate).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by {attempt.agent.name ?? "Unknown"}
                          </span>
                        </div>
                        {attempt.notes && (
                          <p className="text-sm text-muted-foreground">
                            {attempt.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sales */}
          {lead.inboundSales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Converted Sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.inboundSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-input"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {sale.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.carrier.name} &mdash; Agent:{" "}
                        {sale.agent.name ?? "Unknown"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {sale.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
