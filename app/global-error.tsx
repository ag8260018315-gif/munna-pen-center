"use client";

import { siteConfig } from "@/lib/config/site";

/**
 * Last-resort error boundary (errors in the root layout itself). It must render its own
 * <html>/<body>, so it uses plain inline styles and no site components.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", placeItems: "center", minHeight: "100vh", padding: "1.5rem", color: "#0f172a" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.75rem", color: "#262f62" }}>Something went wrong</h1>
          <p style={{ lineHeight: 1.6 }}>Munna Pen Center is temporarily unavailable. Please try again, or WhatsApp / call us on {siteConfig.contact.phoneDisplay}.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, padding: "12px 24px", fontSize: 16, fontWeight: 600, background: "#f59e0b", color: "#161b3b", border: 0, borderRadius: 8, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
