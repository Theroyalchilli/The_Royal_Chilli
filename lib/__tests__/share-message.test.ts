import { DEFAULT_SHARE_MESSAGE, shareMessage } from "@/lib/share-message";

describe("Bring a Friend share message", () => {
  const link = "https://www.theroyalchilli.com/join?ref=RC8D2C7A";
  it("the standard message carries the member's link", () => {
    const m = shareMessage(null, link);
    expect(m).toContain("🎁 200 bonus points");
    expect(m).toContain(`👉 ${link}`);
    expect(m).not.toContain("{link}");
  });
  it("uses the wording set in Rewards Rules", () => {
    expect(shareMessage("Come eat! {link}", link)).toBe(`Come eat! ${link}`);
  });
  it("a message without {link} still gets the link at the end", () => {
    expect(shareMessage("Come eat!", link)).toBe(`Come eat!\n\n${link}`);
  });
  it("blank → the standard message", () => {
    expect(shareMessage("   ", link)).toBe(DEFAULT_SHARE_MESSAGE.replace("{link}", link));
  });
});
