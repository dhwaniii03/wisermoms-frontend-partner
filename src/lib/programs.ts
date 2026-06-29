export const PROGRAM_COLORS_BY_CODE: Record<string, string> = {
  wic: "bg-primary-100 text-primary-700",
  snap: "bg-secondary-100 text-secondary-700",
  medicaid: "bg-green-100 text-green-700",
  tanf: "bg-red-100 text-red-700",
  ccdf: "bg-orange-100 text-orange-700",
  section8: "bg-teal-100 text-teal-700",
  liheap: "bg-purple-100 text-purple-700",
};

/** @deprecated Prefer PROGRAM_COLORS_BY_CODE with program_code from API */
export const PROGRAM_COLORS: Record<string, string> = {
  WIC: "bg-primary-100 text-primary-700",
  SNAP: "bg-secondary-100 text-secondary-700",
  Medicaid: "bg-green-100 text-green-700",
  TANF: "bg-red-100 text-red-700",
  CCAP: "bg-orange-100 text-orange-700",
  Housing: "bg-teal-100 text-teal-700",
  LIHEAP: "bg-purple-100 text-purple-700",
};

export const PROGRAM_FULL_NAMES_BY_CODE: Record<string, string> = {
  tanf: "Temporary Assistance for Needy Families",
  wic: "Women, Infants and Children",
  ccdf: "Child Care Assistance Program",
  medicaid: "Medicaid & CHIP",
  snap: "Supplemental Nutrition Assistance Program",
  section8: "Housing Choice Voucher Program",
  liheap: "Low Income Home Energy Assistance Program",
};

/** @deprecated API returns full names; use program field directly when available */
export const PROGRAM_FULL_NAMES: Record<string, string> = {
  TANF: "Temporary Assistance for Needy Families",
  WIC: "Women, Infants and Children",
  CCAP: "Child Care Assistance Program",
  Medicaid: "Medicaid & CHIP",
};

export function getProgramColorClass(programCode: string, programLabel?: string): string {
  return (
    PROGRAM_COLORS_BY_CODE[programCode] ??
    PROGRAM_COLORS[programLabel ?? ""] ??
    "bg-partner-100 text-partner-700"
  );
}

/** Expand short labels; pass-through when API already returns full names. */
export function getProgramLabel(labelOrShort: string, programCode?: string): string {
  if (programCode && PROGRAM_FULL_NAMES_BY_CODE[programCode]) {
    return PROGRAM_FULL_NAMES_BY_CODE[programCode];
  }
  return PROGRAM_FULL_NAMES[labelOrShort] || labelOrShort;
}
