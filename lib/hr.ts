// Fields genuinely dangerous if glanced-at-over-shoulder or screenshotted:
// bank account number, sort code, National Insurance number. Everything else
// on the HR record (name, address, bank *name*) is no more sensitive than
// what's already on the plain Employees page.
export const MASKED_HR_FIELDS = ["ni_number", "sort_code", "account_number"] as const;
export type MaskedHrField = (typeof MASKED_HR_FIELDS)[number];

export function maskValue(value: string | null): string | null {
  if (!value) return value;
  if (value.length <= 4) return "•".repeat(value.length);
  return "•".repeat(value.length - 4) + value.slice(-4);
}

export function maskHrDetails<T extends Record<string, unknown>>(details: T): T {
  const masked = { ...details };
  for (const field of MASKED_HR_FIELDS) {
    if (field in masked) {
      (masked as Record<string, unknown>)[field] = maskValue(masked[field] as string | null);
    }
  }
  return masked;
}

// Matches the UK_Employee_Onboarding_Right_to_Work_Template's "New Starter
// & Day-One Checklist" sheet — same 16 tasks, same owners.
export const ONBOARDING_TASKS: { key: string; label: string; owner: string }[] = [
  { key: "offer_approved", label: "Conditional offer approved and sent", owner: "Manager / HR" },
  { key: "rtw_check", label: "Right-to-work check completed before start", owner: "Manager / HR" },
  { key: "references_checked", label: "References / qualifications checked where required", owner: "Manager / HR" },
  { key: "contract_issued", label: "Written statement / employment contract issued", owner: "Manager / HR" },
  { key: "pay_checked", label: "Pay and working hours checked against current legal requirements", owner: "Payroll / HR" },
  { key: "p45_processed", label: "P45 or HMRC starter checklist processed", owner: "Payroll" },
  { key: "bank_entered", label: "Payroll and bank details entered securely", owner: "Payroll" },
  { key: "pension_assessed", label: "Workplace pension assessment completed", owner: "Payroll / HR" },
  { key: "emergency_contact", label: "Emergency contact recorded securely", owner: "Manager / HR" },
  { key: "adjustments_discussed", label: "Reasonable adjustments discussed and implemented", owner: "Manager / HR" },
  { key: "h_and_s_induction", label: "Health & safety induction completed", owner: "Manager" },
  { key: "food_safety_training", label: "Food safety, hygiene and allergen training completed", owner: "Manager / Chef" },
  { key: "alcohol_licensing", label: "Alcohol licensing / age-verification training completed", owner: "Premises Manager" },
  { key: "uniform_access", label: "Uniform, equipment and system access issued", owner: "Manager" },
  { key: "policies_provided", label: "Policies provided: absence, holiday, grievance, discipline, data protection", owner: "Manager / HR" },
  { key: "probation_dates", label: "Probation review dates diarised", owner: "Manager / HR" },
];
