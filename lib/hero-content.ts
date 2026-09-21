import supabase from "@/lib/supabase";

export type HeroContent = { tag: string; headline: string; headlineGold: string; description: string };

export async function getHeroContent(): Promise<HeroContent> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "hero_content").maybeSingle();
  return data?.value as HeroContent;
}

export async function getHeroImages(): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "hero_images").maybeSingle();
  return (data?.value as string[] | undefined) ?? [];
}
