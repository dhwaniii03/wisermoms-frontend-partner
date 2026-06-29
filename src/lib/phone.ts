import { z } from "zod";

/** Strip a stored phone value (+1..., formatted) to 10 US digits for form inputs. */
export function normalizeUsPhoneDigits(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function isValidUsPhoneDigits(digits: string): boolean {
  return /^\d{10}$/.test(digits);
}

export function formatPhoneForApi(digits: string): string | undefined {
  const normalized = normalizeUsPhoneDigits(digits);
  if (!normalized) return undefined;
  return `+1${normalized}`;
}

export const optionalUsPhoneFieldSchema = z
  .string()
  .optional()
  .refine((val) => !val || isValidUsPhoneDigits(val), {
    message: "Enter a valid 10-digit US phone number",
  });
