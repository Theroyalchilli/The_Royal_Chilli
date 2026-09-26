// USB Print Station: its pairing key, and the page it prints from.
let stored: { value: unknown } | null = null;
const upsert = jest.fn(async (row: { value: unknown }) => {
  stored = { value: row.value };
  return { error: null };
});

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      upsert,
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored }) }) }),
    }),
  },
}));

import { NextRequest } from "next/server";
import { isPrintStation, pairPrintStation } from "@/lib/print-station";
import { ticketHtml } from "@/lib/ticket-html";

const req = (auth?: string) => new NextRequest("https://pos.example/api/print/station/next", { headers: auth ? { authorization: auth } : {} });

describe("print station key", () => {
  beforeEach(() => {
    stored = null;
  });

  it("stores only a hash, and accepts the key it handed out", async () => {
    const key = await pairPrintStation();
    expect(stored?.value).not.toContain(key);
    expect(await isPrintStation(req(`Bearer ${key}`))).toBe(true);
  });

  it("rejects a wrong key, no key, and everything before pairing", async () => {
    expect(await isPrintStation(req("Bearer anything"))).toBe(false);
    await pairPrintStation();
    expect(await isPrintStation(req("Bearer wrong"))).toBe(false);
    expect(await isPrintStation(req())).toBe(false);
  });

  it("pairing again cuts off the previous computer", async () => {
    const first = await pairPrintStation();
    const second = await pairPrintStation();
    expect(await isPrintStation(req(`Bearer ${first}`))).toBe(false);
    expect(await isPrintStation(req(`Bearer ${second}`))).toBe(true);
  });
});

describe("ticketHtml", () => {
  it("escapes ticket text so a customer's note can't inject markup", () => {
    const html = ticketHtml([{ text: "NOTE: <img src=x onerror=alert(1)> & co", bold: true }]);
    expect(html).toContain("NOTE: &lt;img src=x onerror=alert(1)&gt; &amp; co");
    expect(html).not.toContain("<img");
    expect(html).toContain('class="line bold"');
  });
});
