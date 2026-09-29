import supabase from "@/lib/supabase";

// Merge two customer records that are the same person: everything on `dropId`
// moves to `keepId`, missing details are filled in, a double welcome offer is
// taken back, and the dropped record is hidden (merged_into), not deleted.
// Used automatically when a guest record is claimed (joining, adding a mobile)
// and by managers from Staff Hub (part B).

type Cust = {
  id: number;
  business_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  password_hash: string | null;
  loyalty_points: number;
  date_of_birth: string | null;
  address: string | null;
  notes: string | null;
  marketing_consent: boolean;
  referral_code: string | null;
  referred_by_customer_id: number | null;
  referral_completed_at: string | null;
  merged_into: number | null;
};

export async function mergeCustomers(
  keepId: number,
  dropId: number,
  opts: { staffId?: number | null; reason: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (keepId === dropId) return { ok: false, error: "That's the same customer" };
  const { data: rows } = await supabase.from("customers").select("*").in("id", [keepId, dropId]);
  const keep = (rows ?? []).find((r) => r.id === keepId) as Cust | undefined;
  const drop = (rows ?? []).find((r) => r.id === dropId) as Cust | undefined;
  if (!keep || !drop) return { ok: false, error: "Customer not found" };
  if (keep.merged_into || drop.merged_into) return { ok: false, error: "One of these has already been merged" };
  if (keep.business_id !== drop.business_id) return { ok: false, error: "These are customers of two different businesses" };

  // 1. Free the dropped record's unique mobile/email-login first, keeping a note
  //    of what it had (its login stops working — only the kept record's does).
  const note = `[merged into #${keepId} ${new Date().toISOString().slice(0, 10)}] was: ${drop.name}${drop.phone ? `, ${drop.phone}` : ""}${drop.email ? `, ${drop.email}` : ""}${drop.password_hash ? " (had a website login)" : ""}`;
  const { error: freeErr } = await supabase
    .from("customers")
    .update({ phone: null, password_hash: null, merged_into: keepId, merged_at: new Date().toISOString(), notes: drop.notes ? `${drop.notes}\n${note}` : note })
    .eq("id", dropId)
    .is("merged_into", null);
  if (freeErr) return { ok: false, error: "Couldn't merge — try again" };

  // 2. Move everything that belongs to the dropped record.
  await Promise.all([
    supabase.from("orders").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("reservations").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("loyalty_transactions").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("loyalty_tier_changes").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("loyalty_redemptions").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("loyalty_redemptions").update({ referred_customer_id: keepId }).eq("referred_customer_id", dropId),
    supabase.from("customer_addresses").update({ customer_id: keepId }).eq("customer_id", dropId),
    supabase.from("customers").update({ referred_by_customer_id: keepId }).eq("referred_by_customer_id", dropId),
  ]);

  // 3. Points: moving ledger rows doesn't fire the balance trigger, so move
  //    the balance by hand.
  // 4. Fill in what the kept record is missing.
  const fill: Record<string, unknown> = {
    loyalty_points: Number(keep.loyalty_points) + Number(drop.loyalty_points),
  };
  if (!keep.phone && drop.phone) fill.phone = drop.phone;
  if (!keep.email && drop.email) fill.email = drop.email;
  if ((!keep.name || keep.name === "Guest") && drop.name && drop.name !== "Guest") fill.name = drop.name;
  if (!keep.date_of_birth && drop.date_of_birth) fill.date_of_birth = drop.date_of_birth;
  if (!keep.address && drop.address) fill.address = drop.address;
  if (!keep.referral_code && drop.referral_code) fill.referral_code = drop.referral_code;
  if (!keep.referred_by_customer_id && drop.referred_by_customer_id && drop.referred_by_customer_id !== keepId) {
    fill.referred_by_customer_id = drop.referred_by_customer_id;
    fill.referral_completed_at = drop.referral_completed_at;
  }
  if (drop.marketing_consent && !keep.marketing_consent) fill.marketing_consent = true;
  await supabase.from("customers").update(fill).eq("id", keepId);
  await supabase.from("customers").update({ loyalty_points: 0, referral_code: null }).eq("id", dropId);

  // 5. One welcome offer per person: take back extra sign-up points and
  //    cancel an extra unused welcome voucher.
  const { data: welcomes } = await supabase
    .from("loyalty_transactions")
    .select("id, points_delta")
    .eq("customer_id", keepId)
    .eq("reason", "welcome_bonus")
    .order("id");
  // minus what earlier merges already took back — merging 3 records into one
  // must not take the same extra welcome back twice
  const { data: takenBack } = await supabase
    .from("loyalty_transactions")
    .select("points_delta")
    .eq("customer_id", keepId)
    .eq("reference_type", "merge_duplicate_welcome");
  const alreadyTaken = -(takenBack ?? []).reduce((s, t) => s + Number(t.points_delta), 0);
  const extra = (welcomes ?? []).slice(1).reduce((s, w) => s + Number(w.points_delta), 0) - alreadyTaken;
  if (extra > 0) {
    await supabase.from("loyalty_transactions").insert({
      customer_id: keepId,
      points_delta: -extra,
      reason: "manual_adjustment",
      reference_type: "merge_duplicate_welcome",
      reference_id: dropId,
      staff_id: opts.staffId ?? null,
    });
  }
  const { data: vouchers } = await supabase
    .from("loyalty_redemptions")
    .select("id, status, reward:loyalty_rewards!inner(is_welcome_reward)")
    .eq("customer_id", keepId)
    .eq("reward.is_welcome_reward", true)
    .order("id");
  const welcomeVouchers = (vouchers ?? []) as { id: number; status: string }[];
  const alreadyUsed = welcomeVouchers.some((v) => v.status === "redeemed");
  const unused = welcomeVouchers.filter((v) => v.status === "issued");
  const toCancel = alreadyUsed ? unused : unused.slice(1);
  if (toCancel.length) {
    await supabase.from("loyalty_redemptions").update({ status: "cancelled" }).in("id", toCancel.map((v) => v.id));
  }

  await supabase.from("audit_logs").insert({
    staff_id: opts.staffId ?? null,
    action: "customer_merged",
    entity_type: "customer",
    entity_id: keepId,
    changes: { merged: dropId, reason: opts.reason, dropped: { name: drop.name, phone: drop.phone, email: drop.email, points: drop.loyalty_points } },
  });
  return { ok: true };
}
