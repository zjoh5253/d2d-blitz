"use client";

import * as React from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Papa from "papaparse";

type Carrier = { id: string; name: string };
type ColumnMapping = {
  customerName: string;
  customerAddress: string;
  installDate: string;
  externalId: string;
};
type UploadResult = {
  matchedCount: number;
  unmatchedCount: number;
  rowCount: number;
  uploadId: string;
};

const MAPPED_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "customerName", label: "Customer Name", required: true },
  { key: "customerAddress", label: "Customer Address", required: true },
  { key: "installDate", label: "Install Date", required: true },
  { key: "externalId", label: "External ID", required: false },
];

export default function UploadPage() {
  const [carriers, setCarriers] = React.useState<Carrier[]>([]);
  const [carrierId, setCarrierId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [previewRows, setPreviewRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({
    customerName: "",
    customerAddress: "",
    installDate: "",
    externalId: "",
  });
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

    Papa.parse<string[]>(f, {
      preview: 6,
      complete: (results) => {
        if (results.data.length === 0) return;
        const [headers, ...rows] = results.data;
        setCsvHeaders(headers);
        setPreviewRows(rows.slice(0, 5));
        // Auto-map columns by trying to match header names
        const autoMap: ColumnMapping = {
          customerName: "",
          customerAddress: "",
          installDate: "",
          externalId: "",
        };
        headers.forEach((h) => {
          const lower = h.toLowerCase().replace(/\s|_|-/g, "");
          if (!autoMap.customerName && (lower.includes("name") || lower.includes("customer"))) {
            autoMap.customerName = h;
          } else if (!autoMap.customerAddress && (lower.includes("address") || lower.includes("addr"))) {
            autoMap.customerAddress = h;
          } else if (!autoMap.installDate && (lower.includes("install") || lower.includes("date"))) {
            autoMap.installDate = h;
          } else if (!autoMap.externalId && (lower.includes("id") || lower.includes("external"))) {
            autoMap.externalId = h;
          }
        });
        setMapping(autoMap);
      },
    });
  }

  async function handleUpload() {
    if (!file || !carrierId) {
      setError("Please select a carrier and a CSV file.");
      return;
    }
    if (!mapping.customerName || !mapping.customerAddress || !mapping.installDate) {
      setError("Please map the required columns (Customer Name, Customer Address, Install Date).");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("carrierId", carrierId);
      formData.append("columnMapping", JSON.stringify(mapping));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const data = await res.json();
      setResult(data);
      setFile(null);
      setCsvHeaders([]);
      setPreviewRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Upload Install CSV</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import carrier install records and match them against submitted sales.
        </p>
      </div>

      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800">Upload complete</p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Rows</p>
                <p className="text-lg font-bold">{result.rowCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Matched</p>
                <p className="text-lg font-bold text-green-700">{result.matchedCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Unmatched</p>
                <p className="text-lg font-bold text-red-700">{result.unmatchedCount}</p>
              </div>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step 1: Carrier + File */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select Carrier &amp; File</CardTitle>
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
              <Label htmlFor="file">CSV File</Label>
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
                  accept=".csv"
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
          </CardContent>
        </Card>

        {/* Step 2: Column Mapping */}
        {csvHeaders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Map Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MAPPED_FIELDS.map((field) => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-3">
                  <Label className="text-sm">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Select
                    value={mapping[field.key]}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder="Select column..."
                    options={[
                      { value: "", label: "(not mapped)" },
                      ...csvHeaders.map((h) => ({ value: h, label: h })),
                    ]}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Preview */}
      {previewRows.length > 0 && csvHeaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview (first 5 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvHeaders.map((h) => (
                      <TableHead key={h} className="text-xs">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {csvHeaders.map((_, j) => (
                        <TableCell key={j} className="text-xs py-2">
                          {row[j] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleUpload}
          disabled={!file || !carrierId || uploading}
        >
          {uploading ? "Uploading..." : "Upload & Process"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setFile(null);
            setCsvHeaders([]);
            setPreviewRows([]);
            setResult(null);
            setError(null);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
