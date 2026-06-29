import type { Metadata } from "next";
import { AlertsClient } from "./AlertsClient";

export const metadata: Metadata = { title: "Due Date Alerts" };

export default function AlertsPage() {
  return <AlertsClient />;
}
