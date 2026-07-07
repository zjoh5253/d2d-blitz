import { ImageResponse } from "next/og";
import { getPublicCardData, formatDateRange } from "@/lib/public-card";

// Server-rendered preview image for SMS / Slack / social unfurls (spec §7.2).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getPublicCardData(token);

  const title = data?.blitzName ?? "Fiber Blitz";
  const carrier = data?.carrierName ?? "";
  const dates = data ? formatDateRange(data.startDate, data.endDate) : "";
  const seats = data ? (data.expired ? "Filled" : `${data.seatsRemaining} seats open`) : "";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #111827 0%, #374151 100%)",
          color: "white",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase" }}>
          {carrier}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 34, color: "#d1d5db" }}>{dates}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div
            style={{
              display: "flex",
              fontSize: 32,
              fontWeight: 600,
              background: "rgba(255,255,255,0.15)",
              padding: "12px 28px",
              borderRadius: 999,
            }}
          >
            {seats}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#9ca3af" }}>Fiber Blitz</div>
        </div>
      </div>
    ),
    size
  );
}
