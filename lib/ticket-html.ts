import type { Ticket } from "@/lib/cloudprnt";

// Tickets printed through a browser onto the Star MCP30 over USB, by the
// Print Station (app/print-station). Safe to import in the browser.

// 45 columns: at 48 the last ~3 characters of each line (the right-aligned
// prices) were cut off on the real printer, so lines are 3 shorter — the gap
// between text and amount shrinks, the text size stays the same.
export const BROWSER_TICKET_WIDTH = 45;

// The driver's paper is "72mm x Receipt" and 72mm is all the print head can
// reach, so the page is exactly that wide and starts at the left edge.
// Courier is 0.6em per character: 45 columns at 2.45mm = 66.2mm, inside the
// ~69mm this printer actually reaches through the browser. "tall" is double
// height only (still 45 columns), "big" is double width (22 columns).
// Anything longer wraps.
export const TICKET_CSS = `
  body { background: #fff; margin: 0; }
  .ticket { width: 72mm; margin: 0; padding: 3mm 0; font-family: 'Courier New', monospace; color: #000; font-size: 2.45mm; line-height: 1.35; }
  .line { white-space: pre-wrap; word-break: break-all; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .tall { font-weight: 700; transform: scaleY(1.5); transform-origin: 0 0; margin-bottom: 0.5em; }
  .big { font-size: 4.9mm; font-weight: 700; }
  @media print {
    @page { margin: 0; }
    .no-print { display: none; }
  }
`;

export function lineClass(l: Ticket[number]): string {
  return ["line", l.align === "center" ? "center" : "", l.bold ? "bold" : "", l.size && l.size !== "normal" ? l.size : ""].filter(Boolean).join(" ");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A complete printable page, for printing from a hidden iframe.
export function ticketHtml(ticket: Ticket): string {
  const body = ticket.map((l) => `<div class="${lineClass(l)}">${escapeHtml(l.text) || " "}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${TICKET_CSS}</style></head><body><div class="ticket">${body}</div></body></html>`;
}
