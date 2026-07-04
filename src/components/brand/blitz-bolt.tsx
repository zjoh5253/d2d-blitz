import * as React from "react";

/*
 * D2D Blitz brand mark — a two-layer extruded lightning bolt.
 * Geometry is fixed on a 250×250 viewBox; size via className (e.g. `w-5 h-5`, `size-4`).
 *
 * Variants:
 *   - "solid"   (default) single-color filled silhouette, driven by `currentColor`
 *               (set the color with a text-* class). Drop-in for white-in-tile lockups.
 *   - "outline" stroked, no fill, `currentColor` — preserves the 3D seam lines.
 *   - "brand"   full-color 3D mark in the brand blues with an amber spark. Self-colored.
 */

const SILHOUETTE =
  "m28.905208333333334 135.65416666666667 111.74999999999999 -121.85005208333332 27.715624999999996 22.673906249999998 -10.297395833333333 55.023020833333334h35.596875l27.463541666666664 22.67395833333333 -111.2078125 121.79479166666665 -28.000520833333333 -22.583854166666665 10.040104166666666 -55.11302083333333h-34.80260416666667z";
const FRONT_FACE =
  "M140.653125 13.804114583333332 28.905208333333334 135.65416666666667h67.63072916666665l-14.611458333333333 77.73177083333333 111.74791666666667 -121.85h-67.63020833333333z";
const SIDE_BOTTOM =
  "m81.92447916666666 213.3864583333333 28.000520833333333 22.584374999999998 111.2078125 -121.79531249999998 -27.463541666666664 -22.6734375z";
const TAB =
  "M57.163020833333334 158.26979166666666h34.80260416666667l4.570312499999999 -22.61927083333333H28.905208333333334z";
const SIDE_TOP =
  "M140.653125 13.806875 126.04270833333332 91.53593749999999l32.03125 -0.034895833333333334 10.297395833333333 -55.023020833333334 -27.715624999999996 -22.673906249999998z";

export type BlitzBoltProps = Omit<React.SVGProps<SVGSVGElement>, "fill"> & {
  variant?: "solid" | "outline" | "brand";
};

export function BlitzBolt({ variant = "solid", ...props }: BlitzBoltProps) {
  const common = {
    viewBox: "0 0 250 250",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    ...props,
  };

  if (variant === "outline") {
    return (
      <svg fill="none" {...common}>
        {[SILHOUETTE, FRONT_FACE].map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }

  if (variant === "brand") {
    return (
      <svg fill="none" {...common}>
        <path d={SILHOUETTE} fill="#3B82F6" />
        <path d={FRONT_FACE} fill="#3B82F6" />
        <path d={SIDE_BOTTOM} fill="#1E3A8A" />
        <path d={SIDE_TOP} fill="#1E40AF" />
        <path d={TAB} fill="#F59E0B" />
        {[SILHOUETTE, FRONT_FACE, SIDE_BOTTOM, TAB, SIDE_TOP].map((d, i) => (
          <path
            key={i}
            d={d}
            stroke="#0F172A"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }

  // solid (default)
  return (
    <svg fill="currentColor" {...common}>
      <path d={SILHOUETTE} />
    </svg>
  );
}
