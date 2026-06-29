import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  extractZip5,
  isZipValidationEnabled,
  lookupZip,
  normalizeZipInput,
  validateZip,
} from "@/services/zipValidation";

const ZIP_STALE_TIME_MS = 24 * 60 * 60 * 1000;

export interface LocationFieldValues {
  state: string;
  city: string;
  zip: string;
  county: string;
}

interface UseLocationFieldsOptions {
  values: LocationFieldValues;
  onChange: (field: keyof LocationFieldValues, value: string) => void;
  requireCity?: boolean;
  requireZip?: boolean;
  requireCounty?: boolean;
  isManualFallback?: boolean;
}

function countiesMatch(selected: string, options: string[]): boolean {
  if (!selected.trim()) return false;
  const normalized = selected.trim().toUpperCase();
  return options.some((county) => county.toUpperCase() === normalized);
}

function citiesMatchLocal(selected: string, options: string[]): boolean {
  if (!selected.trim()) return false;
  const normalized = selected.trim().toLowerCase();
  return options.some((city) => city.toLowerCase() === normalized);
}

export function useLocationFields({
  values,
  onChange,
  requireCity = true,
  requireZip = false,
  requireCounty = true,
  isManualFallback = false,
}: UseLocationFieldsOptions) {
  const enabled = isZipValidationEnabled();
  const [lookupTarget, setLookupTarget] = useState<string | null>(null);
  const zipAutofillRef = useRef(false);
  const lastResolvedZipRef = useRef<string | null>(null);
  const previousZip5Ref = useRef<string | null>(null);
  // Tracks which resolved lookup (zip + result type) has already been applied
  // to the form, so the apply/clear effect runs at most once per result and can
  // never drive an infinite update loop.
  const processedLookupRef = useRef<{ zip: string | null; sig: string | null }>({
    zip: null,
    sig: null,
  });

  const zip5 = extractZip5(values.zip);
  const lookupZip5 = lookupTarget ? extractZip5(lookupTarget) : null;

  const lookupQuery = useQuery({
    queryKey: ["zip-lookup", lookupZip5],
    queryFn: () => lookupZip(lookupZip5!),
    enabled: enabled && Boolean(lookupZip5),
    staleTime: ZIP_STALE_TIME_MS,
    gcTime: ZIP_STALE_TIME_MS,
    retry: false,
  });

  const validationQuery = useQuery({
    queryKey: ["zip-validation", zip5, values.state, values.city, values.county],
    queryFn: () =>
      validateZip(values.zip, values.state, values.city || undefined, values.county || undefined),
    enabled:
      enabled &&
      Boolean(
        zip5 &&
          values.state.length === 2 &&
          (!requireCity || values.city.trim()) &&
          (!requireCounty || values.county.trim() || (lookupQuery.data?.counties.length ?? 0) <= 1)
      ),
    staleTime: ZIP_STALE_TIME_MS,
    gcTime: ZIP_STALE_TIME_MS,
    retry: false,
  });

  const triggerZipLookup = useCallback(
    (rawZip: string) => {
      const normalized = normalizeZipInput(rawZip);
      if (extractZip5(normalized)) {
        setLookupTarget(normalized);
      }
    },
    []
  );

  const clearDerivedLocation = useCallback(() => {
    const hasDerived = Boolean(values.state || values.city || values.county);
    if (!hasDerived) return;

    zipAutofillRef.current = true;
    if (values.state) onChange("state", "");
    if (values.city) onChange("city", "");
    if (values.county) onChange("county", "");
    window.setTimeout(() => {
      zipAutofillRef.current = false;
    }, 0);
  }, [onChange, values.state, values.city, values.county]);

  useEffect(() => {
    if (!enabled) return;

    if (!zip5) {
      if (previousZip5Ref.current) {
        clearDerivedLocation();
      }
      lastResolvedZipRef.current = null;
      previousZip5Ref.current = null;
      processedLookupRef.current = { zip: null, sig: null };
      return;
    }

    previousZip5Ref.current = zip5;

    if (zip5.length === 5) {
      triggerZipLookup(values.zip);
    }
  }, [enabled, values.zip, zip5, triggerZipLookup, clearDerivedLocation]);

  useEffect(() => {
    if (!enabled || !lookupQuery.data || lookupQuery.isFetching) return;
    if (!lookupZip5) return;

    const data = lookupQuery.data;
    const sig = data.error || !data.state || !data.city ? "error" : "ok";

    // Apply (or clear) each resolved lookup result only once. Re-running the
    // body on later renders (e.g. because `onChange` / form values changed
    // identity) would otherwise let a failed lookup repeatedly clear the form,
    // which freezes the page in an endless update loop.
    if (processedLookupRef.current.zip === lookupZip5 && processedLookupRef.current.sig === sig) {
      return;
    }
    processedLookupRef.current = { zip: lookupZip5, sig };

    if (sig === "error") {
      clearDerivedLocation();
      lastResolvedZipRef.current = null;
      return;
    }

    zipAutofillRef.current = true;
    lastResolvedZipRef.current = lookupZip5;

    if (data.state !== values.state) {
      onChange("state", data.state!);
    }

    const cities = data.cities && data.cities.length > 0 ? data.cities : (data.city ? [data.city] : []);
    if (cities.length === 1) {
      if (values.city !== cities[0]) {
        onChange("city", cities[0]);
      }
    } else if (cities.length > 1) {
      if (values.city && !citiesMatchLocal(values.city, cities)) {
        onChange("city", "");
      }
    } else if (values.city) {
      onChange("city", "");
    }

    const counties = data.counties;
    if (counties.length === 1) {
      if (values.county !== counties[0]) {
        onChange("county", counties[0]);
      }
    } else if (counties.length > 1) {
      if (values.county && !countiesMatch(values.county, counties)) {
        onChange("county", "");
      }
    } else if (values.county) {
      onChange("county", "");
    }

    window.setTimeout(() => {
      zipAutofillRef.current = false;
    }, 0);
  }, [
    enabled,
    lookupQuery.data,
    lookupQuery.isFetching,
    lookupZip5,
    values.state,
    values.city,
    values.county,
    onChange,
    clearDerivedLocation,
  ]);

  const countyOptions = useMemo(
    () =>
      (lookupQuery.data?.counties ?? []).map((county) => ({
        value: county,
        label: county,
      })),
    [lookupQuery.data?.counties]
  );

  const cityOptions = useMemo(
    () =>
      (lookupQuery.data?.cities ?? []).map((city) => ({
        value: city,
        label: city,
      })),
    [lookupQuery.data?.cities]
  );

  const showCountyDropdown = Boolean(zip5 && countyOptions.length > 0);
  const requiresCountySelection = countyOptions.length > 1;

  const showCityDropdown = Boolean(zip5 && cityOptions.length > 0);
  const requiresCitySelection = cityOptions.length > 1;

  const handleStateChange = useCallback(
    (state: string) => {
      onChange("state", state);
      if (!zipAutofillRef.current) {
        onChange("city", "");
        onChange("county", "");
      }
    },
    [onChange]
  );

  const handleCityChange = useCallback(
    (city: string) => {
      onChange("city", city);
    },
    [onChange]
  );

  const handleCountyChange = useCallback(
    (county: string) => {
      onChange("county", county);
    },
    [onChange]
  );

  const handleZipChange = useCallback(
    (raw: string) => {
      const normalized = normalizeZipInput(raw);
      onChange("zip", normalized);

      if (!extractZip5(normalized)) {
        setLookupTarget(null);
        lastResolvedZipRef.current = null;
      }
    },
    [onChange]
  );

  const handleZipBlur = useCallback(() => {
    if (zip5) {
      triggerZipLookup(values.zip);
    }
  }, [zip5, triggerZipLookup, values.zip]);

  const zipFormatError = useMemo(() => {
    if (!enabled || !values.zip.trim()) return null;
    if (!zip5) return "Please enter a valid US ZIP code.";
    return null;
  }, [enabled, values.zip, zip5]);

  const lookupError =
    enabled && zip5 && lookupQuery.data?.error && !lookupQuery.isFetching
      ? lookupQuery.data.error
      : null;

  const countyError = useMemo(() => {
    if (!enabled || !requiresCountySelection || !zip5 || lookupQuery.isFetching) return null;
    if (lookupQuery.data?.error) return null;
    if (!values.county.trim()) return "Please select a county for this ZIP code.";
    if (!countiesMatch(values.county, countyOptions.map((option) => option.value))) {
      return "Please select a valid county for this ZIP code.";
    }
    return null;
  }, [
    enabled,
    requiresCountySelection,
    zip5,
    lookupQuery.isFetching,
    lookupQuery.data?.error,
    values.county,
    countyOptions,
  ]);

  const validationError =
    enabled && zip5 && values.state.length === 2 && values.city.trim()
      ? validationQuery.data?.error ?? null
      : null;

  const isLoading =
    lookupQuery.isFetching ||
    (Boolean(
      zip5 &&
        values.state.length === 2 &&
        values.city.trim() &&
        (values.county.trim() || !requiresCountySelection)
    ) &&
      validationQuery.isFetching);

  const isVerified = Boolean(
    enabled &&
      zip5 &&
      values.state.length === 2 &&
      (!requireCity || values.city.trim()) &&
      (!requireCounty || !requiresCountySelection || values.county.trim()) &&
      !isLoading &&
      !lookupError &&
      !countyError &&
      validationQuery.data?.valid
  );

  const validate = useCallback((): boolean => {
    if (!enabled) return true;

    if (requireZip && !values.zip.trim()) return false;
    if (values.zip.trim() && !zip5) return false;
    
    if (isManualFallback) {
      if (zip5 && values.state.length !== 2) return false;
      if (requireCity && !values.city.trim()) return false;
      if (requireCounty && !values.county.trim()) return false;
      return true;
    }

    if (zip5 && lookupError) return false;
    if (zip5 && values.state.length !== 2) return false;
    if (requireCity && !values.city.trim()) return false;
    if (requireCounty && requiresCountySelection && !values.county.trim()) return false;
    if (countyError) return false;
    if (isLoading) return false;

    if (zip5 && values.state.length === 2) {
      if (requireCity && values.city.trim() && validationError) return false;
      if (requireCity && values.city.trim() && !validationQuery.data?.valid) return false;
      return true;
    }

    return true;
  }, [
    enabled,
    requireZip,
    requireCity,
    requireCounty,
    isManualFallback,
    values.zip,
    values.state,
    values.city,
    values.county,
    zip5,
    lookupError,
    requiresCountySelection,
    countyError,
    isLoading,
    validationError,
    validationQuery.data?.valid,
  ]);

  const getValidationError = useCallback((): string | null => {
    if (!enabled) return null;
    if (requireZip && !values.zip.trim()) return "ZIP code is required.";
    if (zipFormatError) return zipFormatError;
    
    if (isManualFallback) {
      if (zip5 && values.state.length !== 2) return "Please enter a valid US state.";
      if (requireCity && !values.city.trim()) return "City is required.";
      if (requireCounty && !values.county.trim()) return "County is required.";
      return null;
    }

    if (isLoading) return "Looking up ZIP code…";
    if (lookupError) return lookupError;
    if (zip5 && values.state.length !== 2) return "Please select a valid US state.";
    if (requireCity && !values.city.trim()) return "City is required.";
    if (countyError) return countyError;
    if (validationError) return validationError;
    if (
      zip5 &&
      values.state.length === 2 &&
      values.city.trim() &&
      validationQuery.data &&
      !validationQuery.data.valid
    ) {
      return validationQuery.data.error || "Please verify your ZIP code, state, and city.";
    }
    return null;
  }, [
    enabled,
    requireZip,
    requireCity,
    requireCounty,
    isManualFallback,
    values.zip,
    values.state,
    values.city,
    zip5,
    zipFormatError,
    isLoading,
    lookupError,
    countyError,
    validationError,
    validationQuery.data,
  ]);

  return {
    isEnabled: enabled,
    countyOptions,
    cityOptions,
    showCountyDropdown,
    requiresCountySelection,
    showCityDropdown,
    requiresCitySelection,
    isLoading,
    isVerified,
    zipFormatError,
    lookupError,
    countyError,
    validationError,
    handleStateChange,
    handleCityChange,
    handleCountyChange,
    handleZipChange,
    handleZipBlur,
    validate,
    getValidationError,
  };
}

export type UseLocationFieldsResult = ReturnType<typeof useLocationFields>;
