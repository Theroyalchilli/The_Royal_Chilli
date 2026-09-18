"use client";

// Hidden from the actual printed receipt (@media print) — only shown when
// viewing this page in the browser, e.g. after cancelling the print dialog.
export default function PrintNav() {
  return (
    <div className="no-print" style={{ padding: "8px 8px 0" }}>
      <button
        onClick={() => (window.history.length > 1 ? window.history.back() : (window.location.href = "/pos"))}
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid #ddd",
          background: "#f5f5f5",
          color: "#333",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>
    </div>
  );
}
