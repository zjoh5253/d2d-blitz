import { NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth-mobile"
import { db } from "@/lib/db"

type RouteParams = { params: Promise<{ id: string }> }

// Serves a go-back/follow-up as an .ics calendar file. A cookie-authed <a> link
// to this route downloads the event; iOS/macOS open it in Apple Calendar and
// Google Calendar imports it too. `?reminder=<minutes>` adds a VALARM that many
// minutes before the appointment (0 = at the appointment time).
//
// The event uses the stored followUpDate (a real time once the rep schedules
// with the datetime picker) as a 30-minute timed event in UTC; the calendar
// app renders it in the rep's local timezone.

function icsUTC(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}
function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSessionFromRequest(request)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const g = await db.goBack.findUnique({ where: { id } })
  if (!g) return NextResponse.json({ error: "Go-back not found" }, { status: 404 })

  const isManager = session.user.role === "ADMIN" || session.user.role === "FIELD_MANAGER"
  if (!isManager && g.repId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const reminderRaw = new URL(request.url).searchParams.get("reminder")
  const reminderMin = reminderRaw != null ? parseInt(reminderRaw, 10) : NaN

  const start = new Date(g.followUpDate)
  const end = new Date(start.getTime() + 30 * 60_000)

  const desc = [g.prospectPhone ? `Phone: ${g.prospectPhone}` : "", g.notes ?? ""]
    .filter(Boolean)
    .join("\n")

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//d2d-blitz//go-back//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:goback-${g.id}@d2d-blitz`,
    `DTSTAMP:${icsUTC(new Date())}`,
    `DTSTART:${icsUTC(start)}`,
    `DTEND:${icsUTC(end)}`,
    `SUMMARY:${esc(`Follow-up: ${g.prospectName}`)}`,
    `LOCATION:${esc(g.prospectAddress)}`,
    `DESCRIPTION:${esc(desc)}`,
  ]
  if (Number.isFinite(reminderMin) && reminderMin >= 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`Follow-up: ${g.prospectName}`)}`,
      `TRIGGER:-PT${reminderMin}M`,
      "END:VALARM"
    )
  }
  lines.push("END:VEVENT", "END:VCALENDAR")

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="follow-up-${g.id}.ics"`,
      "Cache-Control": "no-store",
    },
  })
}
