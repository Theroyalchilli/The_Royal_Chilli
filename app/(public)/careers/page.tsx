import type { Metadata } from "next";
import { siteContent } from "@/lib/site-content";
import Reveal from "@/components/site/Reveal";

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
      <Reveal className="text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Join Our Team</p>
        <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
          Careers at <span className="italic text-primary">The Royal Chilli</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          We&apos;re a growing team bringing authentic Indian cuisine to Hounslow. If you&apos;re passionate about great food and great service, we&apos;d love to hear from you.
        </p>
      </Reveal>

      <div className="mt-12 space-y-4">
        {roles.map((r, i) => (
          <Reveal key={r.title} delay={i * 80} className="border border-border p-6">
            <h2 className="text-lg">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.desc}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-12 border border-border bg-card p-8 text-center">
        <h2 className="font-[family-name:var(--font-playfair)] text-xl">Interested in joining us?</h2>
        <p className="mt-2 text-muted-foreground">
          Call us on{" "}
          <a href={`tel:${siteContent.contact.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
            {siteContent.contact.phone}
          </a>{" "}
          or drop your CV in at{" "}
          <span className="text-foreground">{siteContent.contact.address}</span>.
        </p>
      </Reveal>
    </div>
  );
}
