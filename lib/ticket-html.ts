import type { Ticket } from "@/lib/cloudprnt";

// Tickets printed through a browser onto the Star MCP30 over USB, by the
// Print Station (app/print-station). Safe to import in the browser.

// 35 columns of larger, bold text. On the real printer 48 columns at 2.45mm
// lost their last ~3 characters, i.e. it reaches ~66mm through the browser;
// 35 columns at 3mm is 63mm, leaving a safety margin at the right edge.
export const BROWSER_TICKET_WIDTH = 35;

// The driver's paper is "72mm x Receipt" and 72mm is all the print head can
// reach, so the page is exactly that wide and starts at the left edge.
// Courier is 0.6em per character: 35 columns at 3mm = 63mm. Everything is
// bold — thin strokes print faint on thermal paper. "tall" is 1.5x height
// (still 35 columns), "big" is double size (17 columns). Anything longer
// wraps rather than being cut.
export const TICKET_CSS = `
  body { background: #fff; margin: 0; }
  .ticket { width: 72mm; margin: 0; padding: 3mm 0; font-family: 'Courier New', monospace; font-weight: 700; color: #000; font-size: 3mm; line-height: 1.35; }
  .line { white-space: pre-wrap; word-break: break-all; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .tall { font-weight: 700; transform: scaleY(1.5); transform-origin: 0 0; margin-bottom: 0.5em; }
  .big { font-size: 6mm; font-weight: 700; }
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
