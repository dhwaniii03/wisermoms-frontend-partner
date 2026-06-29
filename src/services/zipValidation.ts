import { api } from "@/lib/api";

export function isZipValidationEnabled(): boolean {
  return true;
}

export type ZipValidationErrorCode =
  | "INVALID_FORMAT"
  | "NOT_FOUND"
  | "STATE_MISMATCH"
  | "CITY_MISMATCH"
  | "COUNTY_MISMATCH"
  | "DATASET_ERROR";

export interface ZipValidationResult {
  valid: boolean;
  city: string | null;
  cities: string[];
  state: string | null;
  zip: string | null;
  counties: string[];
  county: string | null;
  error: string | null;
  errorCode?: ZipValidationErrorCode;
}

export interface ZipLookupResult {
  zip: string;
  city: string | null;
  cities: string[];
  state: string | null;
  stateName: string | null;
  counties: string[];
  error: string | null;
  errorCode?: ZipValidationErrorCode;
}

export interface CityLookupResult {
  valid: boolean;
  city: string | null;
  state: string | null;
  zips: string[];
  error: string | null;
  errorCode?: ZipValidationErrorCode;
}

export function extractZip5(zip: string): string | null {
  const digits = zip.trim().replace(/\D/g, "");
  if (digits.length !== 5) return null;
  return digits;
}

export function isValidZipFormat(zip: string): boolean {
  return extractZip5(zip) !== null;
}

export function normalizeZipInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

function inferErrorCode(message: string | null): ZipValidationErrorCode | undefined {
  if (!message) return undefined;
  if (message.includes("valid US ZIP")) return "INVALID_FORMAT";
  if (message.includes("ZIP code not found")) return "NOT_FOUND";
  if (message.includes("is assigned to")) return "CITY_MISMATCH";
  if (message.includes("does not belong")) return "STATE_MISMATCH";
  if (message.includes("is in ") && message.includes(" — not ")) return "COUNTY_MISMATCH";
  if (message.includes("select a county")) return "INVALID_FORMAT";
  if (message.includes("lookup data")) return "DATASET_ERROR";
  return undefined;
}

export async function validateZip(
  zip: string,
  state: string,
  city?: string,
  county?: string
): Promise<ZipValidationResult> {
  const zip5 = extractZip5(zip);
  if (!zip5) {
    return {
      valid: false,
      city: null,
      cities: [],
      state: null,
      zip: null,
      counties: [],
      county: null,
      error: "Please enter a valid US ZIP code.",
      errorCode: "INVALID_FORMAT",
    };
  }

  if (!state || state.length !== 2) {
    return {
      valid: false,
      city: null,
      cities: [],
      state: null,
      zip: zip5,
      counties: [],
      county: null,
      error: "Please select a valid US state.",
      errorCode: "INVALID_FORMAT",
    };
  }

  try {
    const response = await api.post("/api/location/validate-zip", {
      zip,
      state,
      city: city || undefined,
      county: county || undefined,
    });
    const data = response.data.data as {
      valid: boolean;
      city: string | null;
      cities?: string[];
      state: string | null;
      zip: string | null;
      counties?: string[];
      county?: string | null;
      error: string | null;
    };

    return {
      valid: data.valid,
      city: data.city,
      cities: data.cities ?? [],
      state: data.state,
      zip: data.zip,
      counties: data.counties ?? [],
      county: data.county ?? null,
      error: data.error,
      errorCode: inferErrorCode(data.error),
    };
  } catch {
    return {
      valid: false,
      city: null,
      cities: [],
      state: null,
      zip: zip5,
      counties: [],
      county: null,
      error: "Unable to verify ZIP code right now. Please try again.",
      errorCode: "DATASET_ERROR",
    };
  }
}

export async function lookupZip(zip: string): Promise<ZipLookupResult> {
  const zip5 = extractZip5(zip);
  if (!zip5) {
    return {
      zip: "",
      city: null,
      cities: [],
      state: null,
      stateName: null,
      counties: [],
      error: "Please enter a valid US ZIP code.",
      errorCode: "INVALID_FORMAT",
    };
  }

  try {
    const response = await api.post("/api/location/lookup-zip", { zip: zip5 });
    const data = response.data.data as {
      zip: string;
      city: string | null;
      cities?: string[];
      state: string | null;
      stateName: string | null;
      counties: string[];
      error: string | null;
    };

    return {
      zip: data.zip,
      city: data.city,
      cities: data.cities ?? [],
      state: data.state,
      stateName: data.stateName,
      counties: data.counties ?? [],
      error: data.error,
      errorCode: inferErrorCode(data.error),
    };
  } catch {
    return {
      zip: zip5,
      city: null,
      cities: [],
      state: null,
      stateName: null,
      counties: [],
      error: "Unable to look up ZIP code right now. Please try again.",
      errorCode: "DATASET_ERROR",
    };
  }
}

export async function lookupCity(state: string, city: string): Promise<CityLookupResult> {
  if (!state || state.length !== 2 || !city.trim()) {
    return {
      valid: false,
      city: null,
      state: state || null,
      zips: [],
      error: "State and city are required.",
      errorCode: "INVALID_FORMAT",
    };
  }

  try {
    const response = await api.get("/api/location/lookup-city", {
      params: { state, city: city.trim() },
    });
    const data = response.data.data as {
      valid: boolean;
      city: string | null;
      state: string | null;
      zips: string[];
      error: string | null;
    };

    return {
      valid: data.valid,
      city: data.city,
      state: data.state,
      zips: data.zips ?? [],
      error: data.error,
      errorCode: inferErrorCode(data.error),
    };
  } catch {
    return {
      valid: false,
      city: null,
      state: state.toUpperCase(),
      zips: [],
      error: "Unable to verify city right now. Please try again.",
      errorCode: "DATASET_ERROR",
    };
  }
}
