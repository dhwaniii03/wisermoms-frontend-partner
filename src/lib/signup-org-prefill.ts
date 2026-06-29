import type { UseFormReturn } from "react-hook-form";
import type { ExistingOrgOption } from "@/components/signup/ExistingOrgSelect";
import { resolveOrgTypeLabel } from "@/lib/org-types";
import { normalizeUsPhoneDigits } from "@/lib/phone";

type Step0Data = {
  zip: string;
  city: string;
  state: string;
  county: string;
  existingOrgId?: string;
  orgName: string;
  orgType: string;
  website: string;
  description?: string;
};

type Step1Data = {
  email: string;
  phone?: string;
  address: string;
  country?: string;
};

type Step2Data = {
  adminFirstName: string;
  adminMiddleName?: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  employees?: string;
  founded?: string;
  taxId?: string;
  linkedin: string;
};

/**
 * Prefill org profile fields from the directory record.
 * Location (zip/city/state/county) is intentionally NOT overwritten — the user
 * already verified their location for county matching before picking an org.
 */
export function applyExistingOrgPrefill(
  org: ExistingOrgOption,
  forms: {
    form0: UseFormReturn<Step0Data>;
    form1: UseFormReturn<Step1Data>;
    form2: UseFormReturn<Step2Data>;
  },
  onPreview?: (patch: {
    orgName: string;
    orgType: string;
    city: string;
    state: string;
    employees: string;
    founded: string;
  }) => void
) {
  const { form0, form1, form2 } = forms;
  const orgType = resolveOrgTypeLabel(org.type);

  form0.setValue("orgName", org.name, { shouldValidate: true });
  if (orgType) {
    form0.setValue("orgType", orgType, { shouldValidate: true });
  }
  form0.setValue("website", org.website?.trim() ?? "", { shouldValidate: true });
  form0.setValue(
    "description",
    (org.description || org.tagline || "").trim(),
    { shouldValidate: true }
  );

  if (org.email?.trim()) form1.setValue("email", org.email.trim(), { shouldValidate: true });
  if (org.phone?.trim()) {
    form1.setValue("phone", normalizeUsPhoneDigits(org.phone), { shouldValidate: true });
  }
  if (org.address?.trim()) form1.setValue("address", org.address.trim(), { shouldValidate: true });
  if (org.country?.trim()) form1.setValue("country", org.country.trim(), { shouldValidate: true });

  if (org.employees?.trim()) {
    form2.setValue("employees", org.employees.trim(), { shouldValidate: true });
  }
  if (org.founded?.trim()) {
    form2.setValue("founded", org.founded.trim(), { shouldValidate: true });
  }
  if (org.tax_id?.trim()) {
    form2.setValue("taxId", org.tax_id.trim(), { shouldValidate: true });
  }
  form2.setValue("linkedin", org.linkedin?.trim() ?? "", { shouldValidate: true });

  onPreview?.({
    orgName: org.name,
    orgType,
    city: org.city?.trim() || form0.getValues("city") || "",
    state: org.state?.trim() || form0.getValues("state") || "",
    employees: org.employees?.trim() ?? "",
    founded: org.founded?.trim() ?? "",
  });
}

/**
 * Clear org-derived fields when the user switches to "create a new organization".
 * Location fields (zip/city/state/county) are preserved since they drive the org search.
 */
export function clearExistingOrgPrefill(
  forms: {
    form0: UseFormReturn<Step0Data>;
    form1: UseFormReturn<Step1Data>;
    form2: UseFormReturn<Step2Data>;
  },
  onPreview?: (patch: {
    orgName: string;
    orgType: string;
    city: string;
    state: string;
    employees: string;
    founded: string;
  }) => void
) {
  const { form0, form1, form2 } = forms;

  form0.setValue("orgName", "", { shouldValidate: false });
  form0.setValue("orgType", "", { shouldValidate: false });
  form0.setValue("website", "", { shouldValidate: false });
  form0.setValue("description", "", { shouldValidate: false });

  form1.setValue("email", "", { shouldValidate: false });
  form1.setValue("phone", "", { shouldValidate: false });
  form1.setValue("address", "", { shouldValidate: false });

  form2.setValue("employees", "", { shouldValidate: false });
  form2.setValue("founded", "", { shouldValidate: false });
  form2.setValue("taxId", "", { shouldValidate: false });
  form2.setValue("linkedin", "", { shouldValidate: false });

  onPreview?.({
    orgName: "",
    orgType: "",
    city: form0.getValues("city") || "",
    state: form0.getValues("state") || "",
    employees: "",
    founded: "",
  });
}
