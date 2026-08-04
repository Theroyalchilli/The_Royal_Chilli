import supabase from "@/lib/supabase";

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";
  const todayEnd = now.toISOString().slice(0, 10) + "T23:59:59.999Z";

  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  const seq = ((count ?? 0) + 1).toString().padStart(3, "0");
  return `RC-${dateStr}-${seq}`;
}
