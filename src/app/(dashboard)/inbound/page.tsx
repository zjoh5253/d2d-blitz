"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Phone, Mail, Users, CheckCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeadForm } from "./lead-form";

interface InboundLead {
  id: string;
  source: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  status: string;
  createdAt: string;
  contactAttempts: Array<{
    agent: { id: string; name: string | null };
    attemptDate: string;
  }>;
  _count: { contactAttempts: number };
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-yellow-100 text-yellow-700",
  SUBMITTED: "bg-purple-100 text-purple-700",
  INSTALLED: "bg-emerald-100 text-emerald-700",
  VERIFIED: "bg-green-100 text-green-700",
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "INSTALLED", label: "Installed" },
  { value: "VERIFIED", label: "Verified" },
];

export default function InboundPage() {
  const [leads, setLeads] = React.useState<InboundLead[]>([]);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);

  const fetchLeads = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/inbound-leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const counts = React.useMemo(
    () => ({
      new: leads.filter((l) => l.status === "NEW").length,
      contacted: leads.filter((l) => l.status === "CONTACTED").length,
      submitted: leads.filter((l) => l.status === "SUBMITTED").length,
      installed: leads.filter((l) => l.status === "INSTALLED").length,
      verified: leads.filter((l) => l.status === "VERIFIED").length,
    }),
    [leads]
  );

  const stats = [
    { label: "New Leads", value: counts.new, icon: Users, color: "text-blue-500" },
    { label: "Contacted", value: counts.contacted, icon: Phone, color: "text-yellow-500" },
    { label: "Submitted", value: counts.submitted, icon: Mail, color: "text-purple-500" },
    { label: "Installed", value: counts.installed, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Verified", value: counts.verified, icon: CheckCircle, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbound Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and track inbound customer leads through the pipeline.
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Lead Pipeline</CardTitle>
          <div className="w-40">
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              Loading leads...
            </p>
          ) : leads.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">
              No leads found. Add one to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Agent</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const lastAgent = lead.contactAttempts[0]?.agent;
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium text-sm">
                        {lead.customerName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.customerPhone}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.customerEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.source.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${STATUS_COLORS[lead.status] ?? ""}`}
                          variant="outline"
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lastAgent?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-center">
                        {lead._count.contactAttempts}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/inbound/leads/${lead.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inbound Lead</DialogTitle>
          </DialogHeader>
          <LeadForm
            onSuccess={() => {
              setShowAddModal(false);
              fetchLeads();
            }}
            onCancel={() => setShowAddModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
