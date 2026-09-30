import { getBusinessSetting } from "@/lib/business-settings";

export type AboutExcerpt = { title: string; titleGold: string; text1: string; text2: string };

export async function getAboutExcerpt(businessId: number): Promise<AboutExcerpt> {
  const value = await getBusinessSetting(businessId, "about_excerpt");
  return value as AboutExcerpt;
}

export async function getOurStoryParagraphs(businessId: number): Promise<string[]> {
  const value = await getBusinessSetting(businessId, "our_story_paragraphs");
  return (value as string[] | undefined) ?? [];
}
