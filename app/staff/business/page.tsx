import { redirect } from "next/navigation";

// Business setup is now a tab of Settings.
export default function BusinessSetupPage() {
  redirect("/staff/settings?tab=setup");
}
