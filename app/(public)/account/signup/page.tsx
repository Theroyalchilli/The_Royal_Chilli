import { redirect } from "next/navigation";

// Signup now lives on the combined login/signup screen (segmented toggle),
// matching the reference build — this route just gets anyone who still has
// the old separate URL bookmarked to the right place.
export default function SignupRedirect() {
  redirect("/account/login?mode=signup");
}
