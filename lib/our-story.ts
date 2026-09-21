import supabase from "@/lib/supabase";

export type AboutExcerpt = { title: string; titleGold: string; text1: string; text2: string };

export async function getAboutExcerpt(): Promise<AboutExcerpt> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "about_excerpt").maybeSingle();
  return data?.value as AboutExcerpt;
}

export async function getOurStoryParagraphs(): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "our_story_paragraphs").maybeSingle();
  return (data?.value as string[] | undefined) ?? [];
}
