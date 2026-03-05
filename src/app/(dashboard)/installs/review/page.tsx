export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
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
import { MatchActions } from "./match-actions";
import { format } from "date-fns";

type TabValue = "MATCHED" | "UNMATCHED" | "DISPUTED";

const STATUS_BADGE: Record<TabValue, { label: string; className: string }> = {
  MATCHED: { label: "Matched", className: "text-green-700 bg-green-100" },
  UNMATCHED: { label: "Unmatched", className: "text-red-700 bg-red-100" },
  DISPUTED: { label: "Disputed", className: "text-yellow-700 bg-yellow-100" },
};

interface ReviewPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const activeTab = (params.tab?.toUpperCase() ?? "UNMATCHED") as TabValue;
  const validTab = ["MATCHED", "UNMATCHED", "DISPUTED"].includes(activeTab)
    ? activeTab
    : "UNMATCHED";

  const records = await db.installRecord.findMany({
    where: { status: validTab },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      carrier: { select: { id: true, name: true } },
      matchedSale: {
        include: {
          rep: { select: { id: true, name: true } },
        },
      },
      upload: { select: { id: true, fileName: true } },
    },
  });

  const tabs: { value: TabValue; label: string }[] = [
    { value: "UNMATCHED", label: "Unmatched" },
    { value: "MATCHED", label: "Matched" },
    { value: "DISPUTED", label: "Disputed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Install Records</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review matched and unmatched install records. Manually match or dispute as needed.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-input">
        {tabs.map((tab) => (
          <a
            key={tab.value}
            href={`?tab=${tab.value.toLowerCase()}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              validTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {STATUS_BADGE[validTab].label} Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No {STATUS_BADGE[validTab].label.toLowerCase()} records found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Install Date</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>External ID</TableHead>
                  {validTab === "MATCHED" && (
                    <>
                      <TableHead>Matched Sale</TableHead>
                      <TableHead>Rep</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium text-sm">
                      {record.customerName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                      {record.customerAddress}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(record.installDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">{record.carrier.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.externalId ?? "—"}
                    </TableCell>
                    {validTab === "MATCHED" && (
                      <>
                        <TableCell className="text-sm">
                          {record.matchedSale?.customerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.matchedSale?.rep?.name ?? "—"}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_BADGE[validTab].className}
                      >
                        {STATUS_BADGE[validTab].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <MatchActions
                        recordId={record.id}
                        currentStatus={record.status}
                      />
                    </TableCell>
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
