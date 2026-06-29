"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Check,
  Building2,
  MapPin,
  Users,
  Palette,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Globe,
  Phone,
  Mail,
  ExternalLink,
} from "lucide-react";
import { usePartnerAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { initials } from "@/lib/utils";
import { parseEmailList } from "@/lib/auth-utils";
import { formatPhoneForApi, normalizeUsPhoneDigits, optionalUsPhoneFieldSchema } from "@/lib/phone";
import { getStateLabel } from "@/lib/us-states";
import {
  LocationFields,
  type UseLocationFieldsResult,
} from "@/components/location/LocationFields";

// ---- Steps ----

const STEPS = [
  {
    id: "profile",
    label: "Confirm Profile",
    icon: Building2,
    description: "Add a tagline & services",
  },
  {
    id: "location",
    label: "Confirm Location",
    icon: MapPin,
    description: "Add your service area",
  },
  {
    id: "team",
    label: "Team Setup",
    icon: Users,
    description: "Contact & caseworkers",
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: Palette,
    description: "Customize your portal",
  },
  {
    id: "launch",
    label: "Go Live",
    icon: Rocket,
    description: "Review and launch",
  },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ---- Draft persistence key ----
const DRAFT_KEY = "momplan-onboarding-draft";

// ---- Form schemas ----
const profileSchema = z.object({
  name: z.string().min(2),
  tagline: z.string().max(120).optional(),
  description: z.string().max(1000).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  linkedin: z.string().url().or(z.literal("")).optional(),
  services: z.string().optional(),
});

const locationSchema = z.object({
  address: z.string().min(2),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  zip: z.string().trim().min(1, "ZIP code is required"),
  county: z.string().trim().min(1, "County is required"),
  country: z.string().optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: optionalUsPhoneFieldSchema,
  service_area: z.string().optional(),
});

const teamSchema = z.object({
  contact_name: z.string().min(2),
  contact_title: z.string().optional(),
  contact_email: z.string().email(),
  caseworker_emails: z.string().optional(),
  caseworker_password: z.string().optional(),
  default_caseload_capacity: z.coerce.number().int().min(1).max(500).default(8),
});

const prefSchema = z.object({
  primary_language: z.string().optional(),
  notification_frequency: z.enum(["realtime", "daily", "weekly"]),
  case_numbering_prefix: z.string().max(8).optional(),
});

type ProfileData = z.infer<typeof profileSchema>;
type LocationData = z.infer<typeof locationSchema>;
type TeamData = z.infer<typeof teamSchema>;
type PrefData = z.infer<typeof prefSchema>;

type DraftData = {
  profile?: Partial<ProfileData>;
  location?: Partial<LocationData>;
  team?: Partial<TeamData>;
  pref?: Partial<PrefData>;
};

type SummaryItem = {
  label: string;
  value: string | undefined;
  multiline?: boolean;
};

const NOTIFICATION_LABELS: Record<PrefData["notification_frequency"], string> = {
  realtime: "Real-time",
  daily: "Daily",
  weekly: "Weekly",
};

function reviewValue(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function formatPhoneDisplay(digits: string | undefined): string | undefined {
  if (!digits) return undefined;
  const normalized = normalizeUsPhoneDigits(digits);
  if (normalized.length !== 10) return digits;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

function buildLaunchSummary(draft: DraftData): { label: string; items: SummaryItem[] }[] {
  const loc = draft.location;
  const cityState = [loc?.city, getStateLabel(loc?.state)].filter(Boolean).join(", ");

  return [
    {
      label: "Organization",
      items: [
        { label: "Name", value: reviewValue(draft.profile?.name) },
        { label: "Tagline", value: reviewValue(draft.profile?.tagline) },
        { label: "Description", value: reviewValue(draft.profile?.description), multiline: true },
        { label: "Website", value: reviewValue(draft.profile?.website) },
        { label: "LinkedIn", value: reviewValue(draft.profile?.linkedin) },
        { label: "Services", value: reviewValue(draft.profile?.services) },
      ],
    },
    {
      label: "Location",
      items: [
        { label: "Address", value: reviewValue(loc?.address) },
        { label: "City", value: reviewValue(cityState) },
        { label: "ZIP", value: reviewValue(loc?.zip) },
        { label: "County", value: reviewValue(loc?.county) },
        { label: "Country", value: reviewValue(loc?.country) },
        { label: "Email", value: reviewValue(loc?.email) },
        { label: "Phone", value: formatPhoneDisplay(loc?.phone) },
        { label: "Service Area", value: reviewValue(loc?.service_area), multiline: true },
      ],
    },
    {
      label: "Team",
      items: [
        { label: "Contact", value: reviewValue(draft.team?.contact_name) },
        { label: "Title", value: reviewValue(draft.team?.contact_title) },
        { label: "Email", value: reviewValue(draft.team?.contact_email) },
        {
          label: "Default capacity",
          value:
            draft.team?.default_caseload_capacity != null
              ? String(draft.team.default_caseload_capacity)
              : undefined,
        },
        {
          label: "Caseworkers invited",
          value: draft.team?.caseworker_emails
            ? String(parseEmailList(draft.team.caseworker_emails).length)
            : undefined,
        },
      ],
    },
    {
      label: "Preferences",
      items: [
        { label: "Language", value: reviewValue(draft.pref?.primary_language) },
        {
          label: "Notifications",
          value: draft.pref?.notification_frequency
            ? NOTIFICATION_LABELS[draft.pref.notification_frequency]
            : undefined,
        },
        { label: "Case Prefix", value: reviewValue(draft.pref?.case_numbering_prefix) },
      ],
    },
  ];
}

// ---- Preview panel ----

function PreviewPanel({
  draft,
  orgName,
}: {
  draft: DraftData;
  orgName: string;
}) {
  const abbr = initials(orgName || draft.profile?.name || "");

  return (
    <div className="space-y-4">
      {/* Org card */}
      <div className="bg-gradient-to-br from-partner-100 to-partner-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-partner flex items-center justify-center text-white font-extrabold text-lg shadow-partner">
            {abbr || "♡"}
          </div>
          <div>
            <div className="font-extrabold text-partner-950 text-sm">
              {draft.profile?.name || <span className="text-partner-400 italic text-xs">Organization Name</span>}
            </div>
            <div className="text-partner-600 text-xs mt-0.5">
              {draft.profile?.tagline || <span className="text-partner-400 italic">Tagline…</span>}
            </div>
          </div>
        </div>

        {draft.profile?.description && (
          <p className="text-partner-800 text-xs leading-relaxed line-clamp-3">
            {draft.profile.description}
          </p>
        )}
      </div>

      {/* Contact details */}
      {(draft.location?.city || draft.location?.phone || draft.profile?.website) && (
        <div className="bg-white rounded-xl border border-surface-border p-4 space-y-2.5">
          <div className="text-[10px] font-bold text-text-soft uppercase tracking-widest mb-3">
            Contact Info
          </div>
          {draft.location?.city && (
            <div className="flex items-center gap-2 text-xs text-text-dark">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {[draft.location.city, getStateLabel(draft.location.state), draft.location.country]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {draft.location?.phone && (
            <div className="flex items-center gap-2 text-xs text-text-dark">
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{draft.location.phone}</span>
            </div>
          )}
          {draft.location?.email && (
            <div className="flex items-center gap-2 text-xs text-text-dark">
              <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{draft.location.email}</span>
            </div>
          )}
          {draft.profile?.website && (
            <div className="flex items-center gap-2 text-xs text-text-dark">
              <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{draft.profile.website}</span>
            </div>
          )}
        </div>
      )}

      {/* Team */}
      {draft.team?.contact_name && (
        <div className="bg-white rounded-xl border border-surface-border p-4">
          <div className="text-[10px] font-bold text-text-soft uppercase tracking-widest mb-2">
            Primary Contact
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-partner flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials(draft.team.contact_name)}
            </div>
            <div>
              <div className="text-xs font-semibold text-text-dark">{draft.team.contact_name}</div>
              {draft.team.contact_title && (
                <div className="text-[10px] text-text-soft">{draft.team.contact_title}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sidebar stepper ----

function StepperSidebar({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <div className="space-y-1">
      {STEPS.map((step, i) => {
        const done = completedSteps.has(i);
        const cur = i === currentStep;
        const upcoming = i > currentStep && !done;

        return (
          <div key={step.id} className="flex items-start gap-3 py-2">
            {/* Line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300 ${
                  done
                    ? "bg-status-success text-white shadow-sm"
                    : cur
                    ? "bg-gradient-partner text-white shadow-partner"
                    : "bg-primary-100 text-text-soft"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-0.5 h-6 mt-1 rounded-full transition-all duration-500 ${
                    done ? "bg-status-success" : "bg-partner-200"
                  }`}
                />
              )}
            </div>
            {/* Label */}
            <div className="pt-0.5">
              <step.icon
                className={`w-3.5 h-3.5 mb-0.5 ${cur ? "text-primary" : done ? "text-status-success" : "text-text-soft"}`}
              />
              <div
                className={`text-sm font-semibold ${
                  cur ? "text-text-dark" : done ? "text-status-success" : "text-text-soft"
                }`}
              >
                {step.label}
              </div>
              <div className="text-[11px] text-text-soft">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Main component ----

export function OnboardingClient() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<DraftData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationValidationRef = useRef<UseLocationFieldsResult | null>(null);

  const { user, organization } = usePartnerAuthStore();
  const { toast } = useToast();
  const router = useRouter();

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft(JSON.parse(saved));
    } catch {}
  }, []);

  const saveDraft = (patch: DraftData) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {}
  };

  const markComplete = (step: number) => {
    setCompleted((s) => new Set([...s, step]));
  };

  // Step forms
  const profileForm = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: organization?.name ?? draft.profile?.name ?? "",
      tagline: draft.profile?.tagline ?? "",
      description: organization?.description ?? draft.profile?.description ?? "",
      website: organization?.website ?? draft.profile?.website ?? "",
      linkedin: draft.profile?.linkedin ?? "",
      services: draft.profile?.services ?? "",
    },
  });

  const locationForm = useForm<LocationData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      address: organization?.address ?? draft.location?.address ?? "",
      city: organization?.city ?? draft.location?.city ?? "",
      state: organization?.state ?? draft.location?.state ?? "",
      zip: organization?.zip ?? draft.location?.zip ?? "",
      county: organization?.county ?? draft.location?.county ?? "",
      country: organization?.country ?? draft.location?.country ?? "United States",
      email: (organization as any)?.contact_email ?? organization?.email ?? draft.location?.email ?? "",
      phone: normalizeUsPhoneDigits(organization?.phone ?? draft.location?.phone ?? ""),
      service_area: draft.location?.service_area ?? "",
    },
  });

  const teamForm = useForm<TeamData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      contact_name: user?.full_name ?? draft.team?.contact_name ?? "",
      contact_title: user?.title ?? draft.team?.contact_title ?? "",
      contact_email: user?.email ?? draft.team?.contact_email ?? "",
      caseworker_emails: draft.team?.caseworker_emails ?? "",
      caseworker_password: draft.team?.caseworker_password ?? "",
      default_caseload_capacity: draft.team?.default_caseload_capacity ?? 8,
    },
  });

  const prefForm = useForm<PrefData>({
    resolver: zodResolver(prefSchema),
    defaultValues: {
      primary_language: draft.pref?.primary_language ?? "English",
      notification_frequency: draft.pref?.notification_frequency ?? "daily",
      case_numbering_prefix: draft.pref?.case_numbering_prefix ?? "CASE",
    },
  });

  const progressPct = Math.round(((currentStep + (completed.has(currentStep) ? 1 : 0)) / STEPS.length) * 100);

  const handleProfile = async (data: ProfileData) => {
    saveDraft({ profile: data });
    markComplete(0);
    setCurrentStep(1);
  };

  const handleLocation = async (data: LocationData) => {
    if (!locationValidationRef.current?.validate()) {
      toast({
        variant: "destructive",
        title: "Location verification required",
        description:
          locationValidationRef.current?.getValidationError() ||
          "Please verify your state, city, and ZIP code.",
      });
      return;
    }
    saveDraft({ location: data });
    markComplete(1);
    setCurrentStep(2);
  };

  const handleTeam = async (data: TeamData) => {
    const emails = data.caseworker_emails ? parseEmailList(data.caseworker_emails) : [];
    if (emails.length > 0 && (!data.caseworker_password || data.caseworker_password.length < 8)) {
      toast({
        variant: "destructive",
        title: "Password required",
        description: "Enter a shared password (8+ characters) when inviting caseworkers.",
      });
      return;
    }
    saveDraft({ team: data });
    markComplete(2);
    setCurrentStep(3);
  };

  const handlePref = async (data: PrefData) => {
    saveDraft({ pref: data });
    markComplete(3);
    setCurrentStep(4);
  };

  const handleLaunch = async () => {
    setIsSubmitting(true);
    try {
      const teamEmails = draft.team?.caseworker_emails
        ? parseEmailList(draft.team.caseworker_emails)
        : [];
      await api.post("/api/partner/organization/onboarding/complete", {
        ...draft.profile,
        ...draft.location,
        contact_name: draft.team?.contact_name,
        contact_title: draft.team?.contact_title,
        contact_email: draft.team?.contact_email,
        ...draft.pref,
        phone: formatPhoneForApi(draft.location?.phone ?? "") ?? undefined,
        default_caseload_capacity: draft.team?.default_caseload_capacity ?? 8,
        ...(teamEmails.length > 0 && {
          caseworker_emails: teamEmails,
          caseworker_password: draft.team?.caseworker_password,
        }),
      });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      toast({
        title: "Organization is live! 🌸",
        description: "Your portal is ready. Welcome to MomPlan!",
        variant: "success",
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        "Please try again.";
      toast({ variant: "destructive", title: "Something went wrong", description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const orgName = profileForm.watch("name") || organization?.name || "";

  return (
    <div className="min-h-screen bg-gradient-partner-soft flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[320px] min-w-[320px] flex-col bg-white border-r border-surface-border p-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-gradient-partner rounded-xl flex items-center justify-center shadow-partner">
            <Heart className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <div className="font-extrabold text-text-dark text-base leading-none">MomPlan</div>
            <div className="text-text-soft text-[10px] uppercase tracking-widest font-semibold mt-0.5">
              Organization Setup
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-text-soft font-medium">Setup Progress</span>
            <span className="text-primary font-bold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} />
        </div>

        {/* Stepper */}
        <StepperSidebar currentStep={currentStep} completedSteps={completed} />

        {/* Preview */}
        <div className="mt-auto pt-6 border-t border-surface-border">
          <div className="text-[10px] font-bold text-text-soft uppercase tracking-widest mb-3">
            ✦ Live Preview
          </div>
          <PreviewPanel draft={draft} orgName={orgName} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        {/* Mobile progress */}
        <div className="w-full max-w-lg mb-6 lg:hidden">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-text-soft">Step {currentStep + 1} of {STEPS.length}</span>
            <span className="text-primary font-bold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} />
        </div>

        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {/* Step 0 — Organization Profile */}
              {currentStep === 0 && (
                <StepCard
                  icon={Building2}
                  title="Confirm Your Profile 🌷"
                  description="Your registration details are pre-filled. Add a tagline and services to complete your public profile."
                >
                  <form onSubmit={profileForm.handleSubmit(handleProfile)} className="space-y-4">
                    <FormField label="Organization Name" required error={profileForm.formState.errors.name?.message}>
                      <Input {...profileForm.register("name")} placeholder="Blossom Community Hub" />
                    </FormField>
                    <FormField label="Tagline" hint="A short phrase that captures your mission (max 120 chars)">
                      <Input {...profileForm.register("tagline")} placeholder="Empowering mothers, strengthening families" />
                    </FormField>
                    <FormField label="Mission / Description" hint="What do you do and why does it matter?">
                      <Textarea {...profileForm.register("description")} rows={4} placeholder="Share your organization's heart…" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Website" error={profileForm.formState.errors.website?.message}>
                        <Input {...profileForm.register("website")} type="url" placeholder="https://" />
                      </FormField>
                      <FormField label="LinkedIn">
                        <Input {...profileForm.register("linkedin")} type="url" placeholder="https://linkedin.com/company/…" />
                      </FormField>
                    </div>
                    <FormField label="Services Offered" hint="Comma-separated list of services">
                      <Input {...profileForm.register("services")} placeholder="Prenatal care, Food assistance, Housing support…" />
                    </FormField>
                    <StepButtons step={currentStep} onBack={goBack} isLast={false} isLoading={profileForm.formState.isSubmitting} />
                  </form>
                </StepCard>
              )}

              {/* Step 1 — Location */}
              {currentStep === 1 && (
                <StepCard
                  icon={MapPin}
                  title="Confirm Location & Contact 🏡"
                  description="Your address and contact details are pre-filled. Add the counties or cities you serve."
                >
                  <form onSubmit={locationForm.handleSubmit(handleLocation)} className="space-y-4">
                    <FormField label="Street Address" required error={locationForm.formState.errors.address?.message}>
                      <Input {...locationForm.register("address")} placeholder="123 Lavender Lane, Suite 200" />
                    </FormField>
                    <LocationFields
                      sectionTitle="Organization location"
                      values={{
                        state: locationForm.watch("state") ?? "",
                        city: locationForm.watch("city") ?? "",
                        zip: locationForm.watch("zip") ?? "",
                        county: locationForm.watch("county") ?? "",
                      }}
                      onChange={(field, value) => {
                        locationForm.setValue(field, value, { shouldValidate: true });
                      }}
                      errors={{
                        state: locationForm.formState.errors.state?.message,
                        city: locationForm.formState.errors.city?.message,
                        zip: locationForm.formState.errors.zip?.message,
                        county: locationForm.formState.errors.county?.message,
                      }}
                      requireZip
                      requireCounty
                      lockDerivedFields
                      allowManualFallback
                      validationRef={locationValidationRef}
                    />
                    <FormField label="Country">
                      <Input {...locationForm.register("country")} placeholder="United States" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Contact Email" error={locationForm.formState.errors.email?.message}>
                        <Input {...locationForm.register("email")} type="email" placeholder="hello@yourorg.com" />
                      </FormField>
                      <FormField label="Phone" error={locationForm.formState.errors.phone?.message}>
                        <Input
                          {...locationForm.register("phone")}
                          type="tel"
                          inputMode="numeric"
                          numericOnly
                          prefix="+1"
                          placeholder="5550000000"
                          maxLength={10}
                          autoComplete="tel-national"
                          error={!!locationForm.formState.errors.phone}
                        />
                      </FormField>
                    </div>
                    <FormField label="Service Area" hint="Counties, cities, or regions you serve">
                      <Textarea {...locationForm.register("service_area")} rows={2} placeholder="Cook County, Chicago metro area…" />
                    </FormField>
                    <StepButtons step={currentStep} onBack={goBack} isLast={false} isLoading={locationForm.formState.isSubmitting} />
                  </form>
                </StepCard>
              )}

              {/* Step 2 — Team */}
              {currentStep === 2 && (
                <StepCard
                  icon={Users}
                  title="Team Setup 👥"
                  description="Set your primary contact and optionally invite caseworkers with a caseload capacity."
                >
                  <form onSubmit={teamForm.handleSubmit(handleTeam)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField label="Primary Contact Name" required error={teamForm.formState.errors.contact_name?.message}>
                        <Input {...teamForm.register("contact_name")} placeholder="Jane Smith" />
                      </FormField>
                      <FormField label="Title / Role">
                        <Input {...teamForm.register("contact_title")} placeholder="Program Manager" />
                      </FormField>
                    </div>
                    <FormField label="Contact Email" required error={teamForm.formState.errors.contact_email?.message}>
                      <Input {...teamForm.register("contact_email")} type="email" placeholder="jane@yourorg.com" />
                    </FormField>

                    <div className="rounded-xl border border-surface-border bg-primary-subtle/30 p-4 space-y-4">
                      <div>
                        <div className="text-sm font-semibold text-text-dark">Invite caseworkers (optional)</div>
                        <p className="text-xs text-text-soft mt-1">
                          Add team emails now or skip and invite them later from the Team tab.
                        </p>
                      </div>
                      <FormField
                        label="Caseload capacity (cases per caseworker)"
                        error={teamForm.formState.errors.default_caseload_capacity?.message}
                      >
                        <Input
                          {...teamForm.register("default_caseload_capacity", { valueAsNumber: true })}
                          type="number"
                          min={1}
                          max={500}
                          placeholder="8"
                        />
                      </FormField>
                      <FormField label="Caseworker emails">
                        <Textarea
                          {...teamForm.register("caseworker_emails")}
                          rows={4}
                          placeholder={"cw1@yourorg.com\ncw2@yourorg.com"}
                        />
                      </FormField>
                      <FormField label="Shared password for new caseworkers">
                        <Input
                          {...teamForm.register("caseworker_password")}
                          type="text"
                          placeholder="Minimum 8 characters (required if inviting emails)"
                        />
                      </FormField>
                    </div>

                    <StepButtons step={currentStep} onBack={goBack} isLast={false} isLoading={teamForm.formState.isSubmitting} />
                  </form>
                </StepCard>
              )}

              {/* Step 3 — Preferences */}
              {currentStep === 3 && (
                <StepCard
                  icon={Palette}
                  title="Preferences 🎨"
                  description="Customize how MomPlan Partner works for your organization."
                >
                  <form onSubmit={prefForm.handleSubmit(handlePref)} className="space-y-4">
                    <FormField label="Primary Language">
                      <select
                        {...prefForm.register("primary_language")}
                        className="flex h-11 w-full rounded-xl border-[1.5px] border-surface-border bg-primary-subtle px-3.5 text-sm text-text-dark outline-none focus:border-primary-500 focus:bg-white transition-all"
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Español</option>
                        <option value="French">Français</option>
                        <option value="Arabic">العربية</option>
                        <option value="Mandarin">中文</option>
                      </select>
                    </FormField>

                    <FormField label="Notification Frequency">
                      <div className="grid grid-cols-3 gap-2">
                        {(["realtime", "daily", "weekly"] as const).map((freq) => {
                          const selected = prefForm.watch("notification_frequency") === freq;
                          return (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => prefForm.setValue("notification_frequency", freq)}
                              className={`py-3 px-2 rounded-xl border-[1.5px] text-xs font-semibold capitalize transition-all ${
                                selected
                                  ? "border-primary bg-primary-subtle text-primary shadow-focus"
                                  : "border-surface-border text-text-mid hover:border-primary-lighter"
                              }`}
                            >
                              {freq}
                            </button>
                          );
                        })}
                      </div>
                    </FormField>

                    <FormField
                      label="Case Number Prefix"
                      hint={`e.g. "CASE" generates case numbers like CASE-0001`}
                    >
                      <Input {...prefForm.register("case_numbering_prefix")} placeholder="CASE" maxLength={8} />
                    </FormField>

                    <StepButtons step={currentStep} onBack={goBack} isLast={false} isLoading={prefForm.formState.isSubmitting} />
                  </form>
                </StepCard>
              )}

              {/* Step 4 — Launch */}
              {currentStep === 4 && (
                <StepCard
                  icon={Rocket}
                  title="Ready to Launch 🚀"
                  description="Review your setup and go live."
                >
                  {/* Summary */}
                  <div className="space-y-4 mb-6 max-h-[min(60vh,520px)] overflow-y-auto pr-1">
                    {buildLaunchSummary(draft)
                      .map((section) => {
                        const items = section.items.filter((item) => item.value);
                        if (items.length === 0) return null;

                        return (
                          <div
                            key={section.label}
                            className="bg-primary-subtle rounded-xl p-4 border border-surface-border"
                          >
                            <div className="text-[10px] font-bold text-text-soft uppercase tracking-widest mb-3">
                              {section.label}
                            </div>
                            <div className="space-y-2">
                              {items.map((item) => (
                                <div key={item.label} className="flex gap-3">
                                  <span className="text-xs text-text-soft w-28 shrink-0">{item.label}</span>
                                  <span
                                    className={`text-xs font-semibold text-text-dark min-w-0 flex-1 ${
                                      item.multiline ? "whitespace-pre-wrap break-words" : "truncate"
                                    }`}
                                  >
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-soft bg-partner-50 rounded-xl p-3 border border-partner-200 mb-6">
                    <ExternalLink className="w-3.5 h-3.5 text-primary shrink-0" />
                    You can update all of these details at any time from the Settings page.
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                    <Button type="button" variant="outline" onClick={goBack}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      type="button"
                      variant="pink"
                      size="lg"
                      loading={isSubmitting}
                      onClick={handleLaunch}
                      className="gap-2"
                    >
                      <Rocket className="w-4 h-4" /> Launch Organization 🌸
                    </Button>
                  </div>
                </StepCard>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ---- Helper sub-components ----

function StepCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Heart;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-surface-border shadow-partner-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-partner flex items-center justify-center shadow-partner shrink-0">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-text-dark">{title}</h2>
          <p className="text-sm text-text-soft">{description}</p>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-partner-300/40 to-transparent mb-6" />
      {children}
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-primary-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-text-soft">{hint}</p>}
      {error && <p className="text-xs text-status-error">{error}</p>}
    </div>
  );
}

function StepButtons({
  step,
  onBack,
  isLast,
  isLoading,
}: {
  step: number;
  onBack: () => void;
  isLast: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-surface-border mt-2">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        className={step === 0 ? "opacity-0 pointer-events-none" : ""}
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Button>
      <Button type="submit" size="default" loading={isLoading}>
        {isLast ? "Review" : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}
