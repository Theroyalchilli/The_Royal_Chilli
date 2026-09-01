// Canonical department and job-title lists, taken from The Royal Chilli's
// organisation chart. Used to standardize staff_hr_details.department /
// .job_title entries going forward (those DB columns stay free text — this
// is just the dropdown source, not a DB constraint, so older records with
// different historical text aren't invalidated).

export type Department = {
  value: string;
  label: string;
};

export const DEPARTMENTS: Department[] = [
  { value: "leadership", label: "Leadership" },
  { value: "corporate_governance", label: "Corporate Governance & Assurance (GRC)" },
  { value: "people_culture", label: "People & Culture (HR)" },
  { value: "commercial_finance", label: "Commercial Excellence & Finance (Accounts & Finance)" },
  { value: "brand_growth", label: "Brand Growth & Market Experience (Sales & Marketing)" },
  { value: "guest_relations", label: "Guest Relations & Hospitality (FOH & Customer Experience)" },
  { value: "culinary_supply", label: "Culinary Excellence & Supply Operations (BOH & Supply Chain)" },
];

export const JOB_TITLES_BY_DEPARTMENT: Record<string, string[]> = {
  leadership: ["Owner / Director", "Restaurant Operations Manager"],
  corporate_governance: [
    "Compliance & Assurance Lead",
    "Health & Safety Officer",
    "Document & Policy Controller",
    "Internal Auditor",
    "Risk & Insurance Coordinator",
  ],
  people_culture: [
    "HR & People Coordinator",
    "Recruitment & Onboarding Officer",
    "HR Administrator",
    "Training & Development Coordinator",
    "Payroll & Benefits Coordinator",
  ],
  commercial_finance: [
    "Finance & Accounts Officer",
    "Accounts Assistant",
    "Purchase Ledger Clerk",
    "Sales Ledger / Receivables Clerk",
    "Cash & Reconciliation Officer",
  ],
  brand_growth: [
    "Marketing & Commercial Manager",
    "Digital Marketing Executive",
    "Content & Social Media Executive",
    "Sales & Partnerships Executive",
    "Customer Loyalty Coordinator",
  ],
  guest_relations: [
    "FOH Supervisor",
    "Host / Reservations Executive",
    "Senior Server",
    "Server / Waiter",
    "Bar & Beverage Assistant",
    "Takeaway & Delivery Coordinator",
  ],
  culinary_supply: [
    "Head Chef / Kitchen Manager",
    "Purchasing Manager",
    "Sous Chef",
    "Chef / CDP",
    "Commis / Kitchen Assistant",
    "Kitchen Porter",
  ],
};
