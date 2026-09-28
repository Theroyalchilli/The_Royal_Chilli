"use client";

import { useRouter } from "next/navigation";

// This account was merged into another record (duplicate clean-up), so its
// login no longer works — sign out and log in with the kept account.
export default function MergedAccountNotice() {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/account/logout", { method: "POST" }).catch(() => {});
    router.push("/account/login");
    router.refresh();
  }
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface px-5 py-6 text-center shadow-sm">
      <h1 className="font-[family-name:var(--font-playfair)] text-2xl">Your accounts have been joined</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We found more than one account for you and combined them, so all your points and visits are in one place. Please log in again with your main account.
      </p>
      <button onClick={signOut} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground">
        Log in again
      </button>
    </div>
  );
}
