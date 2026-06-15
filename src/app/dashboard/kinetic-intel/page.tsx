export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShieldCheck, Ban, Clock, XCircle, Radar, Download } from "lucide-react";

// Mutually-exclusive verdict mirroring the rep-app banner + the intel API.
type Verdict = "worth" | "customer" | "coming_soon" | "unserviceable";
function verdictOf(r: { serviceable: boolean; isCustomer: boolean; comingSoon: boolean }): Verdict {
  if (r.isCustomer) return "customer";
  if (r.serviceable) return "worth";
  if (r.comingSoon) return "coming_soon";
  return "unserviceable";
}
function splitKey(key: string): { street: string; zip: string } {
  const i = key.lastIndexOf("|");
  if (i < 0) return { street: key, zip: "" };
  return { street: key.slice(0, i), zip: key.slice(i + 1) };
}
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function KineticIntelPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!(role === "ADMIN" || role === "FIELD_MANAGER")) redirect("/dashboard");

  const rows = await db.kineticAddressStatus.findMany({
    select: {
      addressKey: true,
      serviceable: true,
      isCustomer: true,
      comingSoon: true,
      maxQual: true,
      estCompletionDt: true,
      checkedAt: true,
    },
    orderBy: { checkedAt: "desc" },
  });

  const enriched = rows.map((r) => {
    const { street, zip } = splitKey(r.addressKey);
    return { ...r, street: titleCase(street), zip, verdict: verdictOf(r) };
  });

  const counts = { worth: 0, customer: 0, coming_soon: 0, unserviceable: 0 } as Record<Verdict, number>;
  for (const r of enriched) counts[r.verdict]++;

  // Per-ZIP rollup — the scanner-relevant aggregate (which ZIPs Kinetic
  // serves / is entering). Sorted by coming-soon then total desc.
  const byZip = new Map<string, { zip: string; worth: number; customer: number; coming_soon: number; unserviceable: number; total: number }>();
  for (const r of enriched) {
    const z = r.zip || "(unknown)";
    const e = byZip.get(z) ?? { zip: z, worth: 0, customer: 0, coming_soon: 0, unserviceable: 0, total: 0 };
    e[r.verdict]++;
    e.total++;
    byZip.set(z, e);
  }
  const zipRows = [...byZip.values()].sort((a, b) => b.coming_soon - a.coming_soon || b.total - a.total);

  // Coming-soon list — future-market intel. Sorted by est completion then ZIP.
  const comingSoon = enriched
    .filter((r) => r.verdict === "coming_soon")
    .sort((a, b) => (a.estCompletionDt ?? "").localeCompare(b.estCompletionDt ?? "") || a.zip.localeCompare(b.zip));

  const tiles = [
    { key: "worth", label: "Worth knocking", value: counts.worth, icon: ShieldCheck, cls: "text-green-600" },
    { key: "customer", label: "Current customers", value: counts.customer, icon: Ban, cls: "text-red-600" },
    { key: "coming_soon", label: "Coming soon", value: counts.coming_soon, icon: Clock, cls: "text-blue-600" },
    { key: "unserviceable", label: "Not serviceable", value: counts.unserviceable, icon: XCircle, cls: "text-amber-600" },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Radar className="size-6 text-blue-600" /> Kinetic Intel
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Captured from every in-field availability check + the background scan. {enriched.length.toLocaleString()} addresses on file.
          </p>
        </div>
        <a
          href="/api/kinetic/intel?status=all&format=csv"
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap"
        >
          <Download className="size-4" /> Export all (CSV)
        </a>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.key}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{t.value.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                  </div>
                  <Icon className={`size-7 ${t.cls}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Coming-soon list — the future-market list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Clock className="size-5" /> Coming soon — future markets ({comingSoon.length.toLocaleString()})
          </CardTitle>
          <a
            href="/api/kinetic/intel?status=coming_soon&format=csv"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            <Download className="size-4" /> CSV
          </a>
        </CardHeader>
        <CardContent>
          {comingSoon.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No “coming soon” addresses captured yet. They’ll accumulate here as reps tap pre-launch doors and the scan runs.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>Est. launch</TableHead>
                  <TableHead>Checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comingSoon.slice(0, 500).map((r) => (
                  <TableRow key={r.addressKey}>
                    <TableCell className="font-medium">{r.street}</TableCell>
                    <TableCell>{r.zip}</TableCell>
                    <TableCell>{r.estCompletionDt ?? "—"}</TableCell>
                    <TableCell className="text-gray-500">{r.checkedAt.toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Per-ZIP rollup — the scanner handoff aggregate */}
      <Card>
        <CardHeader>
          <CardTitle>By ZIP</CardTitle>
        </CardHeader>
        <CardContent>
          {zipRows.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ZIP</TableHead>
                  <TableHead className="text-right text-green-700">Worth</TableHead>
                  <TableHead className="text-right text-red-700">Customers</TableHead>
                  <TableHead className="text-right text-blue-700">Coming soon</TableHead>
                  <TableHead className="text-right text-amber-700">Not svc.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zipRows.map((z) => (
                  <TableRow key={z.zip}>
                    <TableCell className="font-medium">{z.zip}</TableCell>
                    <TableCell className="text-right">{z.worth.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{z.customer.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{z.coming_soon.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{z.unserviceable.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{z.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
