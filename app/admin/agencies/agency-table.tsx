"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import type { AgencySummary } from "@/lib/admin/agencies";
import { PLAN_LABEL, STATUS_LABEL, STATUS_VARIANT, formatAdminDate } from "@/lib/admin/labels";

const t = translatorFor(DEFAULT_LOCALE);

type SortKey = "name" | "plan" | "subscriptionStatus" | "trialEndsAt" | "createdAt";

function planLabel(plan: string): string {
  const key = PLAN_LABEL[plan];
  return key ? t(key) : plan;
}

function statusLabel(status: string): string {
  const key = STATUS_LABEL[status];
  return key ? t(key) : status;
}

const formatDate = formatAdminDate;

/**
 * Sortable, searchable — build-plan §8/P18's acceptance criteria. Client-side on purpose: the
 * dataset is every agency on the platform, not a per-tenant list, and at this stage of the
 * product that is small enough that a server-paginated table would be premature complexity.
 */
export function AgencyTable({ agencies }: { agencies: AgencySummary[] }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? agencies.filter((a) => a.name.toLowerCase().includes(needle))
      : agencies;

    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [agencies, query, sortKey, sortDir]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function headerButton(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => sortBy(key)}
        className="flex items-center gap-1 hover:text-[color:var(--color-ink)]"
      >
        {label}
        {sortKey === key ? <span aria-hidden="true">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("admin.agencies.search_placeholder")}
        className="w-full max-w-xs rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-ink)] placeholder:text-[color:var(--color-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      />

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{headerButton("name", t("admin.agencies.col.name"))}</TableHeaderCell>
            <TableHeaderCell>{headerButton("plan", t("admin.agencies.col.plan"))}</TableHeaderCell>
            <TableHeaderCell>
              {headerButton("subscriptionStatus", t("admin.agencies.col.status"))}
            </TableHeaderCell>
            <TableHeaderCell>
              {headerButton("trialEndsAt", t("admin.agencies.col.trial_ends"))}
            </TableHeaderCell>
            <TableHeaderCell>{t("admin.agencies.col.users")}</TableHeaderCell>
            <TableHeaderCell>{t("admin.agencies.col.promoters")}</TableHeaderCell>
            <TableHeaderCell>{t("admin.agencies.col.campaigns")}</TableHeaderCell>
            <TableHeaderCell>{t("admin.agencies.col.shifts")}</TableHeaderCell>
            <TableHeaderCell>{headerButton("createdAt", t("admin.agencies.col.created"))}</TableHeaderCell>
            <TableHeaderCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.map((agency) => (
            <TableRow key={agency.agencyId}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{agency.name}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {agency.suspendedAt ? (
                      <Badge variant="bad">{t("admin.agencies.suspended_badge")}</Badge>
                    ) : null}
                    {agency.deletionRequestedAt ? (
                      <Badge variant="warn">{t("admin.agencies.deletion_badge")}</Badge>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell>{planLabel(agency.plan)}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[agency.subscriptionStatus] ?? "neutral"}>
                  {statusLabel(agency.subscriptionStatus)}
                </Badge>
              </TableCell>
              <TableCell>{formatDate(agency.trialEndsAt)}</TableCell>
              <TableCell>{agency.userCount}</TableCell>
              <TableCell>{agency.promoterCount}</TableCell>
              <TableCell>{agency.campaignCount}</TableCell>
              <TableCell>{agency.shiftCount}</TableCell>
              <TableCell>{formatDate(agency.createdAt)}</TableCell>
              <TableCell>
                <Link
                  href={`/admin/agencies/${agency.agencyId}`}
                  className="font-medium text-[color:var(--color-accent)] hover:text-[color:var(--color-accent-hover)]"
                >
                  {t("admin.agencies.view")}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
