"use client";

import * as React from "react";
import Link from "next/link";
import { Upload, FileText, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Carrier = { id: string; name: string };

type ColumnMapping = {
  customerName: string[];
  customerAddress: string[];
  installDate: string | null;
  externalId: string | null;
  confidence: number;
  notes: string | null;
};

type UploadResult = {
  uploadId: string;
  method: "tabular-mapping" | "document";
  mapping: ColumnMapping | null;
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  exceptionCount: number;
  notes: string | null;
};

export default function UploadPage() {
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [carrierId, setCarrierId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<UploadResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/carriers")
      .then((r) => r.json())
      .then((data: Carrier[]) => setCarriers(data))
      .catch(() => setCarriers([]));
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!file || !carrierId) {
      setError("Please select a carrier and a file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carrierId", carrierId);
      const res = await fetch("/api/installs/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          Upload Install Report
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Drop a carrier install report — CSV, Excel, or PDF, any layout. The AI
          parser reads the file, extracts the installs, and reconciles them
          against submitted sales. No column mapping required.
        </p>
      </div>

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800">
                Parsed {result.rowCount} install record{result.rowCount === 1 ? "" : "s"} via{" "}
                {result.method === "document" ? "document extraction" : "column mapping"}.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <Stat label="Records" value={result.rowCount} />
              <Stat label="Matched" value={result.matchedCount} tone="green" />
              <Stat label="Needs review" value={result.exceptionCount} tone="amber" />
              <Stat label="Unmatched" value={result.unmatchedCount} tone="red" />
            </div>

            {result.mapping && (
              <div className="rounded-md border bg-white p-3 text-xs space-y-1">
                <p className="font-medium text-muted-foreground mb-1">
                  Detected columns (AI confidence {(result.mapping.confidence * 100).toFixed(0)}%):
                </p>
                <MapRow label="Name" cols={result.mapping.customerName} />
                <MapRow label="Address" cols={result.mapping.customerAddress} />
                <MapRow label="Install date" cols={result.mapping.installDate ? [result.mapping.installDate] : []} />
                <MapRow label="External ID" cols={result.mapping.externalId ? [result.mapping.externalId] : []} />
              </div>
            )}

            {result.notes && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <strong>Parser note:</strong> {result.notes}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Link href="/dashboard/installs/review">
                <Button size="sm">Review records</Button>
              </Link>
              {result.exceptionCount > 0 && (
                <Link href="/dashboard/installs/exceptions">
                  <Button size="sm" variant="outline">
                    Resolve {result.exceptionCount} exception{result.exceptionCount === 1 ? "" : "s"}
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrier &amp; File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Select
              id="carrier"
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
              placeholder="Select a carrier..."
              options={carriers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Install report (CSV, Excel, or PDF)</Label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="file"
                className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {file ? file.name : "Choose file..."}
              </label>
              <Input
                id="file"
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button onClick={handleUpload} disabled={!file || !carrierId || uploading}>
              {uploading ? "Parsing with AI…" : "Upload & Parse"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setResult(null);
                setError(null);
              }}
            >
              Reset
            </Button>
          </div>
          {uploading && (
            <p className="text-xs text-muted-foreground">
              Reading the file and reconciling against sales — this can take a
              moment for large or scanned reports.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const color =
    tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "";
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MapRow({ label, cols }: { label: string; cols: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}:</span>
      <span className="font-mono">{cols.length ? cols.join(" + ") : "—"}</span>
    </div>
  );
}
