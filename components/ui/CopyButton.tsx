"use client";

import { useEffect, useRef, useState } from "react";
import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { whatsappUrl } from "@/lib/whatsapp";
import { Button, buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";
import { Icon } from "./Icon";

const t = translatorFor(DEFAULT_LOCALE);

type CopyStatus = "idle" | "copied" | "blocked";

/**
 * Copy text, and never fail silently.
 *
 * Every copy button in the product used to call `navigator.clipboard.writeText` and nothing else.
 * That API is refused with `NotAllowedError` in a great many real places — embedded browsers, the
 * in-app browser WhatsApp and Instagram open links in, an iframe without the permission, a tab that
 * lost focus — and each call site either ignored the rejection or swallowed it. Reproduced on
 * production: the coordinator tapped "Αντιγραφή", the promise rejected, and the button did nothing
 * at all. No message, no change. From the outside that is indistinguishable from a broken button.
 *
 * So, in order:
 *  1. `execCommand("copy")` on a temporary textarea, synchronously inside the tap. Deprecated, but
 *     it is the one path that works in the embedded browsers that refuse the async API, and it has
 *     to run first — after an awaited rejection the user activation it needs may already be spent.
 *  2. The async Clipboard API.
 *  3. If both are refused, say so, and select the text on screen (`selectTargetId`) so a long-press
 *     or Ctrl+C finishes the job. The coordinator is always left with a next step.
 */
export function CopyButton({
  text,
  label,
  copiedLabel,
  selectTargetId,
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  /** Id of a visible textarea/input holding `text`. Selected when copying is blocked. */
  selectTargetId?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function settle(next: CopyStatus) {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    // "Copied" can fade; "blocked" stays until the next tap, because it carries an instruction.
    if (next === "copied") timer.current = setTimeout(() => setStatus("idle"), 2500);
  }

  function onClick() {
    if (copyWithSelection(text)) {
      settle("copied");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => settle("copied"),
        () => {
          selectVisible(selectTargetId);
          settle("blocked");
        },
      );
      return;
    }
    selectVisible(selectTargetId);
    settle("blocked");
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        iconLeft={<Icon name={status === "copied" ? "check" : "copy"} size={14} />}
        onClick={onClick}
      >
        {status === "copied" ? (copiedLabel ?? t("copy.copied")) : (label ?? t("common.copy"))}
      </Button>
      {status === "blocked" ? (
        <span role="alert" className="text-xs leading-5 text-[color:var(--color-warn-ink)]">
          {selectTargetId ? t("copy.blocked_selected") : t("copy.blocked")}
        </span>
      ) : null}
      {/* Announce success to screen readers without moving focus. */}
      <span className="sr-only" aria-live="polite">
        {status === "copied" ? (copiedLabel ?? t("copy.copied")) : ""}
      </span>
    </span>
  );
}

/**
 * Opens WhatsApp with `text` already typed to `phone`. Renders nothing when the phone cannot be
 * turned into a WhatsApp number, rather than a button that leads to a dead end.
 */
export function WhatsAppButton({
  phone,
  text,
  label,
  variant = "secondary",
  size = "sm",
  className,
}: {
  phone: string | null | undefined;
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const href = whatsappUrl(phone, text);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClassName({ variant, size, className })}
    >
      <Icon name="message" size={14} />
      {label ?? t("whatsapp.open")}
    </a>
  );
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  // 16px stops iOS zooming the page when the field takes focus; fixed and transparent keeps it
  // from scrolling or flashing.
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;";
  document.body.appendChild(ta);
  const previous = document.activeElement as HTMLElement | null;
  let ok = false;
  try {
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS ignores select() on its own
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  } finally {
    ta.remove();
    previous?.focus?.();
  }
  return ok;
}

function selectVisible(id: string | undefined) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  }
}
