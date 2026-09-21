import supabase from "@/lib/supabase";

export type FeaturedDish = { id: number; image_url: string; blurb: string | null; name: string; price: number };

export async function getFeaturedDishes(): Promise<FeaturedDish[]> {
  const { data } = await supabase
    .from("featured_dishes")
    .select("id, image_url, blurb, menu_items(name, price)")
    .order("position");
  if (!data) return [];
  return data.map((d) => {
    const item = d.menu_items as unknown as { name: string; price: number } | null;
    return { id: d.id, image_url: d.image_url, blurb: d.blurb, name: item?.name ?? "", price: Number(item?.price ?? 0) };
  });
}
