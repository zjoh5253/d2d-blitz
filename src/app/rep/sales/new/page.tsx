"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, Check, Calendar } from "lucide-react";

// Web port of mobile-d2d's NewSaleScreen. Same POST contract to
// /api/sales: { blitzId, carrierId, customerName, customerPhone,
// customerAddress, customerEmail?, installDate (YYYY-MM-DD),
// orderConfirmation? }.

interface Carrier { id: string; name: string }
interface Blitz { id: string; name: string }

interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

const SPEED_TIERS = ["100M", "200M", "250M", "300M", "500M", "600M", "940M", "1G", "2G", "5G", "7G", "10G"];

export default function NewSalePage() {
  const router = useRouter();

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [blitzes, setBlitzes] = useState<Blitz[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [blitzId, setBlitzId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [speed, setSpeed] = useState<string | null>(null);
  const [valueAdded, setValueAdded] = useState(false);
  const [installDate, setInstallDate] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load carriers + active blitzes once.
  useEffect(() => {
    (async () => {
      try {
        const [cRes, bRes] = await Promise.all([
          fetch("/api/carriers"),
          fetch("/api/blitzes"),
        ]);
        if (cRes.ok) setCarriers(await cRes.json());
        if (bRes.ok) {
          const data = await bRes.json();
          const list: Blitz[] = Array.isArray(data) ? data : data.blitzes || [];
          setBlitzes(list);
          if (list.length === 1) setBlitzId(list[0].id);
        }
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  // Address autocomplete via Google Places (skipped if no key).
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (!apiKey || text.trim().length < 3) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
          body: JSON.stringify({
            input: text,
            includedRegionCodes: ["us"],
            includedPrimaryTypes: ["street_address", "subpremise", "premise"],
          }),
        });
        const data = await res.json();
        const ps: PlacePrediction[] = (data.suggestions ?? [])
          .filter((s: { placePrediction?: unknown }) => s.placePrediction)
          .map((s: { placePrediction: { placeId: string; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } }) => ({
            placeId: s.placePrediction.placeId,
            description: s.placePrediction.text?.text ?? "",
            mainText: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text ?? "",
            secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? "",
          }));
        setPredictions(ps);
        setShowSuggestions(ps.length > 0);
      } catch {
        setPredictions([]);
      }
    }, 300);
  };
  const selectPrediction = (p: PlacePrediction) => {
    setAddress(p.description);
    setShowSuggestions(false);
  };

  const carrierLookup = useMemo(() => new Map(carriers.map((c) => [c.id, c])), [carriers]);
  const blitzLookup = useMemo(() => new Map(blitzes.map((b) => [b.id, b])), [blitzes]);

  const canSubmit =
    blitzId &&
    carrierId &&
    customerName.trim() &&
    phone.replace(/\D/g, "").length >= 10 &&
    address.trim() &&
    installDate;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const orderInfoParts = [
        speed && `Speed: ${speed}`,
        valueAdded && "Value-added: yes",
        orderConfirmation.trim() && `Order #: ${orderConfirmation.trim()}`,
        notes.trim(),
      ].filter(Boolean);
      const body = {
        blitzId,
        carrierId,
        customerName: customerName.trim(),
        customerPhone: phone.replace(/\D/g, ""),
        customerAddress: address.trim(),
        customerEmail: email.trim() || undefined,
        installDate,
        orderConfirmation: orderInfoParts.join(" · ") || undefined,
      };
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setSuccess("Sale submitted.");
      // Brief delay so the user sees the confirmation, then bounce to /rep/sales.
      setTimeout(() => router.push("/rep/sales"), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-3 py-3">
        <button onClick={() => router.back()} className="p-1 -ml-1">
          <ChevronLeft className="size-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold">New Sale</h1>
      </div>

      <div className="p-4 space-y-4">
        {loadingMeta && (
          <div className="text-center text-sm text-gray-500 py-3">Loading…</div>
        )}

        {!loadingMeta && blitzes.length === 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            You&apos;re not assigned to any active blitz. Ask your manager to assign you before submitting a sale.
          </div>
        )}

        <Section label="Blitz *">
          <SelectField
            value={blitzLookup.get(blitzId)?.name || "Pick a blitz…"}
            onClick={() => {/* native select handles */}}
          >
            <select
              value={blitzId}
              onChange={(e) => setBlitzId(e.target.value)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            >
              <option value="">Pick a blitz…</option>
              {blitzes.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </SelectField>
        </Section>

        <Section label="Carrier *">
          <SelectField value={carrierLookup.get(carrierId)?.name || "Pick a carrier…"}>
            <select
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            >
              <option value="">Pick a carrier…</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </SelectField>
        </Section>

        <Section label="Customer name *">
          <Input value={customerName} onChange={setCustomerName} placeholder="Jane Doe" />
        </Section>

        <Section label="Phone *">
          <Input value={phone} onChange={setPhone} placeholder="(555) 123-4567" type="tel" inputMode="tel" />
        </Section>

        <Section label="Email">
          <Input value={email} onChange={setEmail} placeholder="optional" type="email" inputMode="email" />
        </Section>

        <Section label="Address *">
          <div className="relative">
            <Input value={address} onChange={handleAddressChange} placeholder="Start typing an address" />
            {showSuggestions && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border bg-white shadow-lg max-h-60 overflow-y-auto">
                {predictions.map((p) => (
                  <button
                    key={p.placeId}
                    onClick={() => selectPrediction(p)}
                    className="block w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="text-sm font-medium text-gray-900">{p.mainText}</div>
                    <div className="text-xs text-gray-500">{p.secondaryText}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section label="Speed tier">
          <div className="flex flex-wrap gap-1.5">
            {SPEED_TIERS.map((s) => {
              const active = speed === s;
              return (
                <button
                  key={s}
                  onClick={() => setSpeed(active ? null : s)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                    active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Install date *">
          <div className="relative">
            <input
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border bg-white text-base"
            />
            <Calendar className="absolute right-3 top-3 size-5 text-gray-400 pointer-events-none" />
          </div>
        </Section>

        <Section label="Order confirmation">
          <Input value={orderConfirmation} onChange={setOrderConfirmation} placeholder="optional" />
        </Section>

        <Section label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional info"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border bg-white text-base"
          />
        </Section>

        <label className="flex items-center justify-between bg-white rounded-lg border p-3">
          <span className="text-sm font-medium">Value-added sale</span>
          <input
            type="checkbox"
            checked={valueAdded}
            onChange={(e) => setValueAdded(e.target.checked)}
            className="size-5"
          />
        </label>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700 flex items-center gap-2">
            <Check className="size-4" /> {success}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg"
        >
          {submitting ? "Submitting…" : "Submit sale"}
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", inputMode,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "tel" | "email";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="w-full h-11 px-3 rounded-lg border bg-white text-base"
    />
  );
}

function SelectField({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="w-full h-11 px-3 flex items-center justify-between rounded-lg border bg-white text-base">
        <span className={value.includes("…") ? "text-gray-400" : ""}>{value}</span>
        <ChevronDown className="size-5 text-gray-400" />
      </div>
      {children}
    </div>
  );
}
