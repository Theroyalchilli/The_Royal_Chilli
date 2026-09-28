import { redirect } from "next/navigation";

// Bring a Friend share link: /join?ref=RC7KX2QM → the sign-up form with the
// member's code attached.
export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const code = (ref || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  redirect(code ? `/account/login?mode=signup&ref=${code}` : "/account/login?mode=signup");
}
