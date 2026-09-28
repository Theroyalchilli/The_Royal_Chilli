// Rewards Club email templates: what goes to Brevo.
process.env.BREVO_API_KEY = "test-key";
const sent: { subject: string; htmlContent: string; headers?: Record<string, string> }[] = [];
global.fetch = jest.fn(async (_url: unknown, init?: { body?: string }) => {
  sent.push(JSON.parse(String(init?.body)));
  return { ok: true, text: async () => "" } as Response;
}) as unknown as typeof fetch;

// email.ts reads BREVO_API_KEY when it loads, so load it after setting it.
let email: typeof import("@/lib/email");
beforeAll(async () => { email = await import("@/lib/email"); });
import { unsubscribeKey, unsubscribeKeyValid, unsubscribeUrl } from "@/lib/unsubscribe";

beforeEach(() => { sent.length = 0; });

describe("Rewards Club emails", () => {
  it("welcome: points, voucher code + dates, friend link — no unsubscribe (account email)", async () => {
    await email.sendWelcomeEmail("p@example.com", {
      customerName: "Priya Shah", signupPoints: 200, voucherCode: "ABCD2345",
      voucherValidFrom: "2026-10-08T04:00:00Z", voucherExpiresAt: "2026-11-06T19:00:00Z",
      referralLink: "https://site.test/join?ref=RC7KX2QM", accountUrl: "https://site.test/account/loyalty",
    });
    const { subject, htmlContent: html, headers } = sent[0];
    expect(subject).toMatch(/Welcome/);
    expect(html).toContain("You're in, Priya!");
    expect(html).toContain("200 points");
    expect(html).toContain("ABCD2345");
    expect(html).toContain("Use it from Thu 8 October");
    expect(html).toContain("join?ref=RC7KX2QM");
    expect(headers).toBeUndefined();
  });

  it("thank-you and nudge are marketing: unsubscribe link + List-Unsubscribe header", async () => {
    const unsub = "https://site.test/unsubscribe?c=5&k=x";
    await email.sendThankYouEmail("p@example.com", {
      customerName: "Priya", pointsEarned: 960, balance: 1160, voucherCode: null, voucherExpiresAt: null,
      reviewUrl: "https://g.page/r/review", accountUrl: "https://site.test/account/loyalty", unsubscribeUrl: unsub,
    });
    await email.sendNudgeEmail("p@example.com", {
      customerName: "Priya", balance: 1160, secondVisitBonus: 200, voucherCode: "ABCD2345",
      voucherExpiresAt: "2026-11-06T19:00:00Z", accountUrl: "https://site.test/account/loyalty", unsubscribeUrl: unsub,
    });
    expect(sent[0].htmlContent).toContain("You earned <strong");
    expect(sent[0].htmlContent).toContain("£11.60");
    expect(sent[0].htmlContent).toContain("Leave a review");
    expect(sent[1].htmlContent).toContain("200-point 2nd-visit bonus");
    for (const e of sent) {
      expect(e.htmlContent).toContain(unsub.replace(/&/g, "&amp;"));
      expect(e.headers).toEqual({ "List-Unsubscribe": `<${unsub}>` });
    }
  });

  it("review request gets the real unsubscribe link when given one", async () => {
    await email.sendReviewRequestEmail("p@example.com", { customerName: "Priya", reviewUrl: "https://g.page/r/review", unsubscribeUrl: "https://site.test/unsubscribe?c=5&k=x" });
    expect(sent[0].htmlContent).toContain(">Unsubscribe</a>");
    expect(sent[0].htmlContent).not.toContain('Reply "unsubscribe"');
  });

  it("escapes names typed by customers", async () => {
    await email.sendReferralUnlockedEmail("r@example.com", {
      customerName: "<b>Ravi</b>", friendName: "Priya", code: "WXYZ6789", expiresAt: "2026-11-06T19:00:00Z", accountUrl: "https://site.test/a",
    });
    expect(sent[0].htmlContent).not.toContain("<b>Ravi");
    expect(sent[0].htmlContent).toContain("&lt;b&gt;Ravi");
    expect(sent[0].htmlContent).toContain("WXYZ6789");
  });
});

describe("unsubscribe links", () => {
  it("only work for the customer they were made for", () => {
    expect(unsubscribeKeyValid(5, unsubscribeKey(5))).toBe(true);
    expect(unsubscribeKeyValid(6, unsubscribeKey(5))).toBe(false);
    expect(unsubscribeKeyValid(0, unsubscribeKey(0))).toBe(false);
    expect(unsubscribeUrl(5)).toMatch(/\/unsubscribe\?c=5&k=[A-Za-z0-9_-]{16}$/);
  });
});
