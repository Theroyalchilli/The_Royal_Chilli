import { redirect } from "next/navigation";

// The owner's Businesses screen is now a tab of Settings.
export default function BusinessesPage() {
  redirect("/staff/settings?tab=businesses");
}
