"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, MessageSquare, RefreshCw, Search, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CaseworkerCard, CaseworkerLoadStatus } from "@/types";

const STATUS_LABELS: Record<CaseworkerLoadStatus, string> = {
  overloaded: "Overloaded",
  at_risk: "At risk",
  healthy: "Healthy",
};

const STATUS_BADGE: Record<CaseworkerLoadStatus, string> = {
  overloaded: "bg-red-100 text-red-700 border-red-200",
  at_risk: "bg-amber-100 text-amber-800 border-amber-200",
  healthy: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const BAR_COLORS: Record<CaseworkerLoadStatus, string> = {
  overloaded: "bg-red-500",
  at_risk: "bg-amber-500",
  healthy: "bg-emerald-500",
};

async function fetchCaseworkerCards(): Promise<CaseworkerCard[]> {
  const res = await api.get("/api/partner/analytics/caseworkers");
  return res.data.data?.caseworkers ?? [];
}

function CaseworkerCardItem({
  card,
  highlighted = false,
}: {
  card: CaseworkerCard;
  highlighted?: boolean;
}) {
  const barPct = Math.min(card.utilization_pct, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-card transition-shadow",
        highlighted
          ? "border-partner-400 ring-2 ring-partner-200 shadow-partner"
          : "border-surface-border"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-partner flex items-center justify-center text-white text-sm font-bold shrink-0">
            {card.initials}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-text-dark truncate">{card.name}</div>
            <div className="text-xs text-text-soft">{card.title}</div>
          </div>
        </div>
        <Badge className={cn("shrink-0 border", STATUS_BADGE[card.status])}>
          {STATUS_LABELS[card.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Active cases", value: card.active_cases },
          { label: "Capacity limit", value: card.capacity_limit },
          { label: "Completion", value: `${card.completion_rate}%` },
          {
            label: "Avg response",
            value: card.avg_response_hours != null ? `${card.avg_response_hours}h` : "—",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-surface-border bg-primary-subtle/40 px-3 py-2.5"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-text-soft">
              {metric.label}
            </div>
            <div className="text-lg font-bold text-text-dark mt-0.5">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-text-mid mb-1.5">
          <span>Caseload capacity</span>
          <span className="font-semibold">
            {card.utilization_pct}% · {card.active_cases}/{card.capacity_limit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", BAR_COLORS[card.status])}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {card.programs.map((program) => (
          <Badge key={program} variant="outline" className="text-[10px] font-semibold">
            {program}
          </Badge>
        ))}
        {card.renewals_due > 0 && (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
            {card.renewals_due} renewal{card.renewals_due === 1 ? "" : "s"} due
          </Badge>
        )}
        {card.docs_overdue > 0 && (
          <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
            {card.docs_overdue} doc{card.docs_overdue === 1 ? "" : "s"} overdue
          </Badge>
        )}
      </div>

      {card.alerts.length > 0 && (
        <div className="space-y-1 mb-4">
          {card.alerts.map((alert) => (
            <p
              key={alert}
              className={cn(
                "text-xs",
                card.status === "overloaded" ? "text-red-600" : "text-amber-700"
              )}
            >
              {alert}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="text-xs h-8">
          View cases
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          Message
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
          <UserCog className="w-3.5 h-3.5" />
          Reassign
        </Button>
      </div>
    </motion.div>
  );
}

export interface CaseworkerCardsPanelProps {
  selectedId?: string | null;
  onClearSelection?: () => void;
  showHeader?: boolean;
}

export function CaseworkerCardsPanel({
  selectedId = null,
  onClearSelection,
  showHeader = true,
}: CaseworkerCardsPanelProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CaseworkerLoadStatus>("all");
  const [sortBy, setSortBy] = useState<"capacity" | "name" | "cases">("capacity");
  const selectedCardRef = useRef<HTMLDivElement>(null);

  const { data: cards = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["caseworker-cards"],
    queryFn: fetchCaseworkerCards,
    staleTime: 60 * 1000,
  });

  const selectedCard = selectedId ? cards.find((c) => c.id === selectedId) : null;

  useEffect(() => {
    if (selectedId && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId, selectedCard, isLoading]);

  const filtered = useMemo(() => {
    let list = [...cards];
    if (selectedId) {
      list = list.filter((c) => c.id === selectedId);
    } else {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (c) => c.full_name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
        );
      }
      if (statusFilter !== "all") {
        list = list.filter((c) => c.status === statusFilter);
      }
      list.sort((a, b) => {
        if (sortBy === "name") return a.full_name.localeCompare(b.full_name);
        if (sortBy === "cases") return b.active_cases - a.active_cases;
        return b.utilization_pct - a.utilization_pct;
      });
    }
    return list;
  }, [cards, search, statusFilter, sortBy, selectedId]);

  return (
    <section className="space-y-4">
      {showHeader && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-soft mb-1">
              Caseworker cards
            </div>
            <h2 className="text-lg font-bold text-text-dark">Team workload & capacity</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 self-start"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      )}

      {selectedId && selectedCard && onClearSelection && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-partner-200 bg-partner-50/60 px-4 py-3">
          <p className="text-sm text-text-dark">
            Showing card for <span className="font-semibold">{selectedCard.full_name}</span>
          </p>
          <Button variant="outline" size="sm" onClick={onClearSelection} className="gap-1.5 shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            Show all
          </Button>
        </div>
      )}

      {!selectedId && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-soft" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search caseworker…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "overloaded", "at_risk", "healthy"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={statusFilter === value ? "default" : "outline"}
                  onClick={() => setStatusFilter(value)}
                  className="capitalize"
                >
                  {value === "all" ? "All" : STATUS_LABELS[value]}
                </Button>
              ))}
            </div>
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="capacity">Sort: capacity</SelectItem>
              <SelectItem value="cases">Sort: active cases</SelectItem>
              <SelectItem value="name">Sort: name</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}

      {isLoading ? (
        <div className={cn("grid gap-4", selectedId ? "grid-cols-1 max-w-xl" : "grid-cols-1 xl:grid-cols-2")}>
          {Array.from({ length: selectedId ? 1 : 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-white py-16 text-center">
          <AlertTriangle className="w-8 h-8 text-text-soft mx-auto mb-3" />
          <p className="text-sm font-semibold text-text-dark mb-1">
            {selectedId ? "Caseworker card not found" : "No caseworkers to display"}
          </p>
          <p className="text-xs text-text-soft">
            {selectedId
              ? "This member may not have caseworker workload data yet."
              : "Add team members with a capacity limit to see cards here."}
          </p>
          {selectedId && onClearSelection && (
            <Button variant="outline" size="sm" onClick={onClearSelection} className="mt-4">
              Back to all cards
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("grid gap-4", selectedId ? "grid-cols-1 max-w-xl" : "grid-cols-1 xl:grid-cols-2")}>
          {filtered.map((card) => (
            <div
              key={card.id}
              ref={selectedId === card.id ? selectedCardRef : undefined}
            >
              <CaseworkerCardItem card={card} highlighted={selectedId === card.id} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
