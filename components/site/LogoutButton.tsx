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
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-surface py-3 text-sm font-bold text-primary shadow-sm hover:bg-primary/5"
    >
      <span aria-hidden>🚪</span> Log Out
    </button>
  );
}
