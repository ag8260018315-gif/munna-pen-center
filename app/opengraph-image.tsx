import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config/site";

export const alt = "Munna Pen Center — Wholesale Stationery & Office Supplies, Dhanbad, Jharkhand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social-share image (Open Graph / Twitter). Generated at build time — no image file to maintain. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#262f62",
          color: "#ffffff",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="120" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#3a4eb8" />
            <path d="M23.5 9h17c.6 6.2 6.6 10.4 6.6 18.2 0 7.4-8.7 14.2-15.1 20.3C25.6 41.4 16.9 34.6 16.9 27.2 16.9 19.4 22.9 15.2 23.5 9Z" fill="#ffffff" />
            <path d="M32 31.5v16" stroke="#3a4eb8" strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="32" cy="27.4" r="3.4" fill="#3a4eb8" />
            <rect x="14.5" y="51.5" width="35" height="4.5" rx="2.25" fill="#fbb724" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1 }}>{siteConfig.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>Wholesale Stationery & Office Supplies</div>
          <div style={{ fontSize: 34, color: "#c9d5f8" }}>Delivered across India</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
          <div style={{ background: "#fbb724", color: "#161b3b", fontWeight: 700, padding: "12px 28px", borderRadius: 12 }}>Request a Bulk Quote</div>
          <div style={{ color: "#c9d5f8" }}>{`${siteConfig.location.locality}, ${siteConfig.location.region} · ${siteConfig.contact.phoneDisplay}`}</div>
        </div>
      </div>
    ),
    size,
  );
}
