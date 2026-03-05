"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Search, AlertTriangle } from "lucide-react";

type SaleSearchResult = {
  id: string;
  customerName: string;
  customerAddress: string;
  installDate: string;
  rep: { name: string | null };
  carrier: { name: string };
};

interface MatchActionsProps {
  recordId: string;
  currentStatus: string;
  onActionComplete?: () => void;
}

export function MatchActions({ recordId, currentStatus, onActionComplete }: MatchActionsProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [disputeOpen, setDisputeOpen] = React.useState(false);
  const [manualMatchOpen, setManualMatchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SaleSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [selectedSaleId, setSelectedSaleId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function searchSales() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/install-records/${recordId}/search-sales?q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setError("Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function confirmMatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/install-records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      });
      if (!res.ok) throw new Error("Failed to confirm");
      setConfirmOpen(false);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  async function createDispute() {
    if (!reason.trim()) {
      setError("Please enter a reason for the dispute.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/install-exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installRecordId: recordId, reason }),
      });
      if (!res.ok) throw new Error("Failed to create dispute");
      // Also update record status
      await fetch(`/api/install-records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DISPUTED" }),
      });
      setDisputeOpen(false);
      setReason("");
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  async function manualMatch() {
    if (!selectedSaleId) {
      setError("Please select a sale to match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/install-records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedSaleId: selectedSaleId, status: "MATCHED" }),
      });
      if (!res.ok) throw new Error("Failed to match");
      setManualMatchOpen(false);
      setSelectedSaleId(null);
      setSearchQuery("");
      setSearchResults([]);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        {currentStatus === "MATCHED" && (
          <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
            <CheckCircle className="h-3 w-3 mr-1" />
            Confirm
          </Button>
        )}
        {currentStatus === "UNMATCHED" && (
          <Button size="sm" variant="outline" onClick={() => setManualMatchOpen(true)}>
            <Search className="h-3 w-3 mr-1" />
            Match
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={() => setDisputeOpen(true)}
        >
          <AlertTriangle className="h-3 w-3 mr-1" />
          Dispute
        </Button>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Match</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure this install record is correctly matched to the linked sale?
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMatch} disabled={loading}>
              {loading ? "Confirming..." : "Confirm Match"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Reason for dispute</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe why this record is disputed..."
                rows={3}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={createDispute} disabled={loading}>
              {loading ? "Creating..." : "Create Dispute"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={manualMatchOpen} onOpenChange={setManualMatchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manual Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by customer name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchSales()}
              />
              <Button variant="outline" onClick={searchSales} disabled={searching}>
                {searching ? "..." : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-md p-2">
                {searchResults.map((sale) => (
                  <div
                    key={sale.id}
                    className={`flex items-start justify-between p-2 rounded cursor-pointer text-sm ${
                      selectedSaleId === sale.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedSaleId(sale.id)}
                  >
                    <div>
                      <p className="font-medium">{sale.customerName}</p>
                      <p className="text-muted-foreground text-xs">{sale.customerAddress}</p>
                      <p className="text-muted-foreground text-xs">
                        Install: {new Date(sale.installDate).toLocaleDateString()} &middot; Rep:{" "}
                        {sale.rep.name ?? "—"} &middot; {sale.carrier.name}
                      </p>
                    </div>
                    {selectedSaleId === sale.id && (
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No matching sales found.
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setManualMatchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={manualMatch} disabled={!selectedSaleId || loading}>
              {loading ? "Matching..." : "Link Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
