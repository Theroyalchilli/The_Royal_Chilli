import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Careers — The Royal Chilli",
  description: "Join the team at The Royal Chilli, Hounslow. We're always looking for passionate chefs, waiters, and kitchen staff.",
};

const roles = [
  { title: "Chef / Kitchen Staff", desc: "Experience with North & South Indian cuisine preferred. Full-time and part-time roles available." },
  { title: "Waiter / Front of House", desc: "Friendly, customer-focused team members to deliver a great dining experience." },
  { title: "Delivery Driver", desc: "Own vehicle or scooter required. Flexible evening and weekend shifts." },
];

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Join Our Team</p>
        <h1 className="mt-2 font-[family-name:var(--font-playfair)] text-4xl font-bold">
          Careers at <span className="italic text-primary">The Royal Chilli</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          We&apos;re a growing team bringing authentic Indian cuisine to Hounslow. If you&apos;re passionate about great food and great service, we&apos;d love to hear from you.
        </p>
      </div>

      <div className="mt-12 space-y-4">
        {roles.map((r) => (
          <div key={r.title} className="rounded-xl border border-border p-5">
            <h2 className="font-semibold text-lg">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold">Interested in joining us?</h2>
        <p className="mt-2 text-muted-foreground">
          Call us on{" "}
          <a href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
            {siteContent.contact.phone}
          </a>{" "}
          or drop your CV in at{" "}
          <span className="text-foreground">{siteContent.contact.address}</span>.
        </p>
      </div>
    </div>
  );
}
