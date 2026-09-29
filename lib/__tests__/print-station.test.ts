// USB Print Station: its pairing key (one per business), and the page it prints from.
const stored = new Map<string, string>(); // app_settings key -> value
const upsert = jest.fn(async (row: { key: string; value: string }) => {
  stored.set(row.key, row.value);
  return { error: null };
});

jest.mock("@/lib/supabase", () => ({
  __esModule: true,
  default: {
    from: () => ({
      upsert,
      select: () => ({
        like: async (_col: string, pattern: string) => ({
          data: [...stored].filter(([k]) => k.startsWith(pattern.replace("%", ""))).map(([key, value]) => ({ key, value })),
        }),
      }),
    }),
  },
}));

import { NextRequest } from "next/server";
import { pairPrintStation, printStationBusiness } from "@/lib/print-station";
import { ticketHtml } from "@/lib/ticket-html";

const req = (auth?: string) => new NextRequest("https://pos.example/api/print/station/next", { headers: auth ? { authorization: auth } : {} });

describe("print station key", () => {
  beforeEach(() => {
    stored.clear();
  });

  it("stores only a hash, and knows which business the key it handed out is for", async () => {
    const key = await pairPrintStation(1);
    expect([...stored.values()].join()).not.toContain(key);
    expect(await printStationBusiness(req(`Bearer ${key}`))).toBe(1);
  });

  it("rejects a wrong key, no key, and everything before pairing", async () => {
    expect(await printStationBusiness(req("Bearer anything"))).toBeNull();
    await pairPrintStation(1);
    expect(await printStationBusiness(req("Bearer wrong"))).toBeNull();
    expect(await printStationBusiness(req())).toBeNull();
  });

  it("pairing again cuts off the previous computer", async () => {
    const first = await pairPrintStation(1);
    const second = await pairPrintStation(1);
    expect(await printStationBusiness(req(`Bearer ${first}`))).toBeNull();
    expect(await printStationBusiness(req(`Bearer ${second}`))).toBe(1);
  });

  it("each business has its own station — pairing Melt House doesn't cut off Royal Chilli", async () => {
    const rc = await pairPrintStation(1);
    const melt = await pairPrintStation(2);
    expect(stored.has("print_station_key_hash")).toBe(true); // Royal Chilli keeps its existing setting
    expect(await printStationBusiness(req(`Bearer ${rc}`))).toBe(1);
    expect(await printStationBusiness(req(`Bearer ${melt}`))).toBe(2);
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
