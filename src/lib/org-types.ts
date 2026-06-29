/** Display labels for partner organization types (must match backend ORG_TYPE_LABELS). */
export const ORG_TYPES = [
  "211 Network",
  "Childcare Provider",
  "Cooperative",
  "DV Coalition",
  "Education Nonprofit",
  "Emergency Shelter",
  "Faith-Based",
  "Food Bank",
  "Government Agency",
  "Health Clinic",
  "Housing Nonprofit",
  "Immigration Nonprofit",
  "Legal Aid",
  "Non-profit (501c3)",
  "Workforce Development",
  "Wraparound Nonprofit",
  "Other",
] as const;

export type OrgTypeLabel = (typeof ORG_TYPES)[number];

const ORG_TYPE_SLUG_TO_LABEL: Record<string, OrgTypeLabel> = {
  "211_network": "211 Network",
  childcare_provider: "Childcare Provider",
  cooperative: "Cooperative",
  dv_coalition: "DV Coalition",
  education_nonprofit: "Education Nonprofit",
  emergency_shelter: "Emergency Shelter",
  faith_based: "Faith-Based",
  food_bank: "Food Bank",
  government_agency: "Government Agency",
  health_clinic: "Health Clinic",
  housing_nonprofit: "Housing Nonprofit",
  immigration_nonprofit: "Immigration Nonprofit",
  legal_aid: "Legal Aid",
  nonprofit_501c3: "Non-profit (501c3)",
  workforce_development: "Workforce Development",
  wraparound_nonprofit: "Wraparound Nonprofit",
  other: "Other",
};

export function resolveOrgTypeLabel(type: string | null | undefined): string {
  if (!type?.trim()) return "";
  const trimmed = type.trim();
  if ((ORG_TYPES as readonly string[]).includes(trimmed)) return trimmed;
  return ORG_TYPE_SLUG_TO_LABEL[trimmed] ?? trimmed;
}
