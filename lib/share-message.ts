// Bring a Friend share message — editable in Staff Hub → Customers & Loyalty →
// Rewards Rules (the business's loyalty_share_message setting). "{link}" is replaced
// with the member's own join link. Safe to import in the browser.

export const DEFAULT_SHARE_MESSAGE = `🌶️ Fancy 20% off your first dine-in at The Royal Chilli?

Join The Royal Chilli Rewards Club using my link and get:
🎁 200 bonus points
💸 20% off your first dine-in visit

👉 {link}

Enjoy! 🍛❤️`;

export function shareMessage(template: string | null | undefined, link: string): string {
  const t = template && template.trim() ? template : DEFAULT_SHARE_MESSAGE;
  // no {link} in a custom message → put the link at the end so it's never lost
  return t.includes("{link}") ? t.split("{link}").join(link) : `${t.trim()}\n\n${link}`;
}
