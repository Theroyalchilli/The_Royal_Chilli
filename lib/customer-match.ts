import supabase from "@/lib/supabase";
import { phoneKey } from "@/lib/phone";

// One customer, one record: whenever someone joins, orders, books or is
// looked up at the till, they're matched on mobile OR email.
//   neither matches          → none (make a new record)
//   one matches, or both the same record → match
//   mobile and email on two different records → conflict (ask, don't guess)

export type MemberSummary = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  loyalty_points: number;
  has_account: boolean;
};

export type MemberMatch =
  | { kind: "none" }
  | { kind: "match"; member: MemberSummary; by: "phone" | "email" | "both" }
  | {
      kind: "conflict";
      phoneMember: MemberSummary;
      emailMember: MemberSummary;
      /** The mobile's record is a guest with no email and the email's record has no
       *  mobile — almost certainly the same person split in two; safe to merge the
       *  guest into the other when they're joining or adding their number. */
      mergeable: boolean;
    };

const COLS = "id, name, phone, email, loyalty_points, password_hash";
type Row = { id: number; name: string; phone: string | null; email: string | null; loyalty_points: number; password_hash: string | null };
const summary = (r: Row): MemberSummary => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  loyalty_points: r.loyalty_points,
  has_account: !!r.password_hash,
});

export async function findByPhone(phone: string | null | undefined): Promise<MemberSummary | null> {
  const key = phoneKey(phone);
  if (!key) return null;
  const { data } = await supabase.from("customers").select(COLS).eq("phone", key).is("merged_into", null).limit(1).maybeSingle();
  return data ? summary(data as Row) : null;
}

/** Several guest rows can share an email (a household); a website account wins, then the oldest. */
export async function findByEmail(email: string | null | undefined): Promise<MemberSummary | null> {
  const clean = String(email ?? "").trim().toLowerCase();
  if (!clean) return null;
  const { data } = await supabase
    .from("customers")
    .select(COLS)
    .ilike("email", clean.replace(/[\\%_]/g, (c) => `\\${c}`))
    .is("merged_into", null)
    .order("id");
  const rows = (data ?? []) as Row[];
  const pick = rows.find((r) => r.password_hash) ?? rows[0];
  return pick ? summary(pick) : null;
}

export async function findMember(phone: string | null | undefined, email: string | null | undefined): Promise<MemberMatch> {
  const [byPhone, byEmail] = await Promise.all([findByPhone(phone), findByEmail(email)]);
  if (byPhone && byEmail) {
    if (byPhone.id === byEmail.id) return { kind: "match", member: byPhone, by: "both" };
    const mergeable = !byPhone.has_account && !byPhone.email && !byEmail.phone;
    return { kind: "conflict", phoneMember: byPhone, emailMember: byEmail, mergeable };
  }
  if (byPhone) return { kind: "match", member: byPhone, by: "phone" };
  if (byEmail) return { kind: "match", member: byEmail, by: "email" };
  return { kind: "none" };
}
