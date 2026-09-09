"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
export function CheckinForm({
  token,
  reportHref,
  labels,
}: {
  token: string;
  reportHref: string;
  labels: CheckinFormLabels;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
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
    setErrorText(labels.saveFailedByReason[result.reason] ?? labels.saveFailedByReason.default ?? "");
    setPhase("override");
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
        startTransition(async () => {
          const result = await checkinWithGeo(
            token,
            position.coords.latitude,
            position.coords.longitude,
          );
          handleActionResult(result);
        });
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
    startTransition(async () => {
      const result = await checkinWithOverride(token, reason);
      handleActionResult(result);
    });
  }

  if (phase === "success") {
    return (
      <div className="mt-6 space-y-3 text-center text-sm">
        <p className="font-medium text-[color:var(--color-ok)]">{labels.success}</p>
        {withinGeofence === false && (
          <p className="text-[color:var(--color-muted)]">
            {labels.tooFar} {labels.recordedFarNote}
          </p>
        )}
        <Link
          href={reportHref}
          className="inline-block rounded-lg bg-[color:var(--color-action)] px-4 py-3 font-medium text-white"
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
              className="mt-1 w-full rounded-lg border border-[color:var(--color-line)] p-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[color:var(--color-action)] px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {labels.overrideSubmit}
          </button>
          <button
            type="button"
            onClick={requestLocation}
            disabled={pending}
            className="w-full rounded-lg border border-[color:var(--color-line)] px-4 py-3 font-medium disabled:opacity-50"
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
      <button
        type="button"
        onClick={requestLocation}
        disabled={busy}
        className="w-full rounded-lg bg-[color:var(--color-action)] px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
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
