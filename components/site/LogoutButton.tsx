"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="border border-border px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary"
    >
      Log Out
    </button>
  );
}
