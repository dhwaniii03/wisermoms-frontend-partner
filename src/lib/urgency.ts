export function deadlineColorClass(urgency: string): string {
  if (urgency === "high") return "text-status-error font-semibold";
  if (urgency === "moderate") return "text-status-warning font-semibold";
  return "text-status-success";
}

export function rowBgClass(status: string, urgency: string): string {
  if (status === "renewal_due" || urgency === "high") return "bg-status-error-bg/40";
  if (status === "in_progress" || urgency === "moderate") return "bg-status-warning-bg/30";
  return "";
}

export const URGENCY_LEGEND = [
  { level: "high", label: "High", dot: "bg-status-error", color: "text-status-error" },
  { level: "moderate", label: "Moderate", dot: "bg-status-warning", color: "text-status-warning" },
  { level: "normal", label: "Normal", dot: "bg-status-success", color: "text-status-success" },
] as const;
