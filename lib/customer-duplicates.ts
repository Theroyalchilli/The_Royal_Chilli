import { phoneKey } from "@/lib/phone";

// "Possible duplicates" for Staff Hub → Customers: records that share a
// mobile, an email, or the same name. Chains join up — if A and B share a
// mobile and B and C share an email, A, B and C are one group.

export type DupCandidate = { id: number; name: string; phone: string | null; email: string | null };
export type DupGroup<T extends DupCandidate> = { reasons: ("mobile" | "email" | "name")[]; members: T[] };

export function findDuplicateGroups<T extends DupCandidate>(customers: T[]): DupGroup<T>[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  for (const c of customers) parent.set(c.id, c.id);

  const reasonsFor = new Map<string, Set<"mobile" | "email" | "name">>(); // "a-b" pair → why
  const link = (key: string, reason: "mobile" | "email" | "name", buckets: Map<string, number[]>, id: number) => {
    const list = buckets.get(key) ?? [];
    for (const other of list) {
      parent.set(find(other), find(id));
      const pair = [Math.min(other, id), Math.max(other, id)].join("-");
      (reasonsFor.get(pair) ?? reasonsFor.set(pair, new Set()).get(pair)!).add(reason);
    }
    list.push(id);
    buckets.set(key, list);
  };

  const byPhone = new Map<string, number[]>();
  const byEmail = new Map<string, number[]>();
  const byName = new Map<string, number[]>();
  for (const c of customers) {
    const p = c.phone ? phoneKey(c.phone) : "";
    const e = (c.email ?? "").trim().toLowerCase();
    const n = (c.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (p) link(p, "mobile", byPhone, c.id);
    if (e) link(e, "email", byEmail, c.id);
    if (n && n !== "guest") link(n, "name", byName, c.id);
  }

  const groups = new Map<number, T[]>();
  for (const c of customers) {
    const root = find(c.id);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((members) => {
      const ids = new Set(members.map((m) => m.id));
      const reasons = new Set<"mobile" | "email" | "name">();
      for (const [pair, why] of reasonsFor) {
        const [a, b] = pair.split("-").map(Number);
        if (ids.has(a) && ids.has(b)) why.forEach((w) => reasons.add(w));
      }
      // strongest evidence first
      const order = ["mobile", "email", "name"] as const;
      return { reasons: order.filter((r) => reasons.has(r)), members: members.sort((a, b) => a.id - b.id) };
    })
    .sort((a, b) => (a.reasons.includes("name") && a.reasons.length === 1 ? 1 : 0) - (b.reasons.includes("name") && b.reasons.length === 1 ? 1 : 0));
}
