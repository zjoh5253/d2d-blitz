export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  CalendarClock,
  User,
  Phone,
  MapPin,
  Mail,
  Hash,
  DollarSign,
  ArrowLeft,
} from "lucide-react"
import { format, addDays } from "date-fns"
type SaleStatus =
  | "SUBMITTED"
  | "PENDING_INSTALL"
  | "INSTALLED"
  | "VERIFIED"
  | "CANCELLED"
  | "DISPUTED"

function getSaleStatusVariant(
  status: SaleStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "VERIFIED":
      return "default"
    case "INSTALLED":
      return "secondary"
    case "CANCELLED":
      return "destructive"
    case "DISPUTED":
      return "destructive"
    default:
      return "outline"
  }
}

interface InstallMilestone {
  label: string
  date: Date
  description: string
  checkAction: string
}

function getInstallMilestones(installDate: Date): InstallMilestone[] {
  return [
    {
      label: "48hr Before",
      date: addDays(installDate, -2),
      description: "Send reminder and confirm appointment window",
      checkAction: "Call customer to confirm",
    },
    {
      label: "24hr Before",
      date: addDays(installDate, -1),
      description: "Final confirmation of install appointment",
      checkAction: "Confirm appointment time",
    },
    {
      label: "Install Day",
      date: installDate,
      description: "Verify with customer that installer arrived",
      checkAction: "Verify installer on-site",
    },
    {
      label: "Post-Install",
      date: addDays(installDate, 1),
      description: "Check in to confirm successful installation",
      checkAction: "Customer satisfaction check-in",
    },
  ]
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const repId = session.user.id
  const isManager =
    session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      carrier: true,
      blitz: { include: { market: true } },
      commissionRecord: { include: { governanceTier: true } },
    },
  })

  if (!sale) notFound()
  if (!isManager && sale.repId !== repId) notFound()

  const milestones = getInstallMilestones(sale.installDate)
  const today = new Date()

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/reps/sales">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Sales
          </Button>
        </Link>
      </div>

      {/* Sale Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{sale.customerName}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {sale.blitz.name} &mdash; {sale.blitz.market.name}
              </p>
            </div>
            <Badge variant={getSaleStatusVariant(sale.status)} className="shrink-0">
              {sale.status.replace("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{sale.customerName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{sale.customerPhone}</span>
            </div>
            <div className="flex items-center gap-2 text-sm sm:col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{sale.customerAddress}</span>
            </div>
            {sale.customerEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{sale.customerEmail}</span>
              </div>
            )}
            {sale.orderConfirmation && (
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{sale.orderConfirmation}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Carrier</p>
              <p className="font-medium">{sale.carrier.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Install Date</p>
              <p className="font-medium">
                {format(sale.installDate, "MMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Submitted</p>
              <p className="font-medium">
                {format(sale.submittedAt, "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Install Follow-Up Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Install Follow-Up Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {milestones.map((m, i) => {
              const isPast = m.date < today
              const isToday =
                m.date.toDateString() === today.toDateString()

              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className={`h-3 w-3 rounded-full border-2 ${
                        isPast
                          ? "bg-primary border-primary"
                          : isToday
                            ? "bg-primary/50 border-primary"
                            : "bg-background border-muted-foreground"
                      }`}
                    />
                    {i < milestones.length - 1 && (
                      <div
                        className={`w-px h-10 mt-1 ${isPast ? "bg-primary/30" : "bg-border"}`}
                      />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm font-medium ${
                          isToday ? "text-primary" : isPast ? "text-muted-foreground" : ""
                        }`}
                      >
                        {m.label}
                      </p>
                      <Badge variant={isToday ? "default" : "outline"} className="text-xs">
                        {format(m.date, "MMM d")}
                      </Badge>
                      {isToday && (
                        <Badge className="text-xs bg-amber-500">Today</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.description}
                    </p>
                    <p className="text-xs font-medium mt-0.5">{m.checkAction}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Recovery Section */}
      {sale.status === "CANCELLED" && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Cancel Recovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This sale has been cancelled. Consider the following recovery
              steps:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold shrink-0">1.</span>
                <span>
                  Contact the customer to understand the cancellation reason.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold shrink-0">2.</span>
                <span>
                  Address any concerns and offer to reschedule the install.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive font-bold shrink-0">3.</span>
                <span>
                  If recovered, submit a new sale with updated details.
                </span>
              </li>
            </ul>
            <Link href="/dashboard/reps/sales/new">
              <Button variant="outline" size="sm" className="mt-2">
                Submit Recovery Sale
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Commission Info */}
      {sale.commissionRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Rep Pay</p>
                <p className="text-lg font-bold">
                  ${sale.commissionRecord.repPay.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline">
                  {sale.commissionRecord.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Carrier Payout</p>
                <p className="text-sm font-medium">
                  ${sale.commissionRecord.carrierPayout.toFixed(2)}
                </p>
              </div>
              {sale.commissionRecord.governanceTier && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    Governance Tier
                  </p>
                  <p className="text-sm font-medium">
                    {sale.commissionRecord.governanceTier.name}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
