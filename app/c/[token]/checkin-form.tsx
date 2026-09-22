"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { checkinWithGeo, checkinWithOverride, type CheckinActionState } from "./actions";

export type CheckinFormLabels = {
  confirm: string;
  locating: string;
  submitting: string;
  success: string;
  tooFar: string;
  recordedFarNote: string;
  goToReport: string;
  useOverride: string;
  overridePrompt: string;
  overrideReasonLabel: string;
  overrideReasonPlaceholder: string;
  overrideSubmit: string;
  retryGeo: string;
  geoDenied: string;
  geoUnavailable: string;
  geoTimeout: string;
  geoUnsupported: string;
  geoInsecure: string;
  /** A3-01 — shown when the action never reached the server at all. */
  offline: string;
  /** A3-21 — the arrival is already on record; not an error to recover from. */
  alreadyCheckedIn: string;
  saveFailedByReason: Record<string, string>;
};

type Phase = "idle" | "locating" | "submitting" | "success" | "override";

/**
 * One-shot, foreground geolocation capture — see CLAUDE.md §3.
 *
 * `navigator.geolocation.getCurrentPosition` is called exactly once, on the tap. Never
 * `watchPosition`. Every failure path (permission denied, unavailable, timeout, insecure
 * context, unsupported browser, or a server error) lands on the manual override form below,
 * never on a dead end.
 */
export function CheckinForm<RouteType extends string>({
  token,
  reportHref,
  reportQuery,
  labels,
}: {
  token: string;
  // Generic over the route string, mirroring Next's typed-routes wrapper pattern used
  // elsewhere in this codebase (e.g. app/campaigns/link-button.tsx) — a plain `href: string`
  // prop would widen the caller's literal/template href and fail `next/link`'s `RouteImpl`
  // check even for a href that is a valid route.
  reportHref: Route<RouteType>;
  /** A3-16 — carries `?lang=` onwards so a promoter reading in English stays in English. */
  reportQuery?: { lang: string };
  labels: CheckinFormLabels;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [withinGeofence, setWithinGeofence] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function handleActionResult(result: CheckinActionState) {
    if (result.status === "success") {
      setWithinGeofence(result.withinGeofence);
      setPhase("success");
      setErrorText(null);
      return;
    }
    // A3-21 — "you are already checked in" is not a failure to recover from, and dropping the
    // promoter into the manual-override form invited them to submit something that would fail
    // in exactly the same way. The arrival is on record: show them that, and the way onwards.
    if (result.reason === "already_checked_in") {
      setWithinGeofence(null);
      setNotice(labels.alreadyCheckedIn);
      setPhase("success");
      setErrorText(null);
      return;
    }
    setErrorText(labels.saveFailedByReason[result.reason] ?? labels.saveFailedByReason.default ?? "");
    setPhase("override");
  }

  /**
   * A3-01, second half. Both action calls below used to be awaited inside `startTransition` with
   * no `try/catch`: a transport rejection could not reach `handleActionResult`, so `phase` stayed
   * `"submitting"` and the button stayed disabled forever with nothing on screen. The promoter
   * standing in the store had no way to tell a failed tap from a slow one.
   *
   * `fallbackPhase` is where the form goes back to, so the promoter can simply tap again: the
   * main button for a geolocation attempt, the override form for a manual one.
   */
  function runAction(fallbackPhase: Phase, call: () => Promise<CheckinActionState>) {
    startTransition(async () => {
      try {
        handleActionResult(await call());
      } catch {
        setErrorText(labels.offline);
        setPhase(fallbackPhase);
      }
    });
  }

  function requestLocation() {
    setErrorText(null);

    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setErrorText(labels.geoInsecure);
      setPhase("override");
      return;
    }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setErrorText(labels.geoUnsupported);
      setPhase("override");
      return;
    }

    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPhase("submitting");
        runAction("idle", () =>
          checkinWithGeo(token, position.coords.latitude, position.coords.longitude),
        );
      },
      (geoError) => {
        const message =
          geoError.code === geoError.PERMISSION_DENIED
            ? labels.geoDenied
            : geoError.code === geoError.TIMEOUT
              ? labels.geoTimeout
              : labels.geoUnavailable;
        setErrorText(message);
        setPhase("override");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }

  function submitOverride(event: React.FormEvent) {
    event.preventDefault();
    setPhase("submitting");
    runAction("override", () => checkinWithOverride(token, reason));
  }

  if (phase === "success") {
    return (
      <div className="mt-6 space-y-3 text-center text-sm">
        <p className="font-medium text-[color:var(--color-ok)]">{notice ?? labels.success}</p>
        {withinGeofence === false && (
          <p className="text-[color:var(--color-muted)]">
            {labels.tooFar} {labels.recordedFarNote}
          </p>
        )}
        <Link
          href={{ pathname: reportHref, query: reportQuery }}
          className="inline-block rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)]"
        >
          {labels.goToReport}
        </Link>
      </div>
    );
  }

  if (phase === "override") {
    return (
      <div className="mt-6 space-y-3">
        {errorText && <p className="text-sm text-[color:var(--color-bad)]">{errorText}</p>}
        <p className="text-sm text-[color:var(--color-muted)]">{labels.overridePrompt}</p>
        <form onSubmit={submitOverride} className="space-y-3">
          <div>
            <label htmlFor="override-reason" className="text-sm text-[color:var(--color-muted)]">
              {labels.overrideReasonLabel}
            </label>
            <textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={labels.overrideReasonPlaceholder}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-sm outline-none transition focus:border-[color:var(--color-accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
          >
            {labels.overrideSubmit}
          </button>
          <button
            type="button"
            onClick={requestLocation}
            disabled={pending}
            className="w-full rounded-lg border border-[color:var(--color-line)] px-4 py-3 font-medium text-[color:var(--color-ink)] transition hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
          >
            {labels.retryGeo}
          </button>
        </form>
      </div>
    );
  }

  const busy = phase === "locating" || phase === "submitting" || pending;

  return (
    <div className="mt-6 space-y-3">
      {/* A3-01 — this used to have nowhere to render. A geolocation attempt that never reached
          the server comes back here so the promoter can simply tap again. */}
      {errorText && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--color-bad)] bg-[color:var(--color-surface)] p-3 text-sm font-medium text-[color:var(--color-bad)]"
        >
          {errorText}
        </p>
      )}
      <button
        type="button"
        onClick={requestLocation}
        disabled={busy}
        className="w-full rounded-lg bg-[color:var(--color-accent)] px-4 py-4 text-base font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
      >
        {phase === "locating" ? labels.locating : phase === "submitting" ? labels.submitting : labels.confirm}
      </button>
      <button
        type="button"
        onClick={() => {
          setErrorText(null);
          setPhase("override");
        }}
        disabled={busy}
        className="w-full text-center text-sm text-[color:var(--color-muted)] underline disabled:opacity-50"
      >
        {labels.useOverride}
      </button>
    </div>
  );
}
