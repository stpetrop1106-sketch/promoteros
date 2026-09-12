import { translatorFor, DEFAULT_LOCALE } from "@/lib/i18n";
import { signOut } from "@/app/login/actions";
import { Avatar, Icon } from "@/components/ui";

const t = translatorFor(DEFAULT_LOCALE);

/**
 * Who you are signed in as, and the way out — at the foot of the sidebar, where every product
 * of this shape puts it.
 *
 * Before P35 this existed twice, as an ad-hoc line of text on exactly two screens. On
 * `/campaigns` it floated *above* the page title, so the first thing on the screen was an email
 * address; on `/shifts` it sat on the title's own row and ran straight off the right edge of a
 * phone, because a Greek email address plus "Αποσύνδεση" does not fit in 375px next to a
 * heading. Neither screen had any more claim to owning sign-out than the other four.
 *
 * It is a server component passed to `AppShell` as a node, the same way the billing banner is —
 * so it inherits the shell's hidden-path guard for free. That guard is the reason this is not
 * simply dropped into the layout: a promoter opening `/i/[token]` on their phone must never see
 * a coordinator's email address, and a coordinator opening their own invitation link to check it
 * is signed in at the time.
 */
export function AccountRow({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={email} size="sm" tone="neutral" />
      {/* `truncate` is right here and almost nowhere else in the product: an email address is a
          value the person already knows, so the half that survives still identifies it. The
          `title` gives the whole thing back on hover. */}
      <span
        title={email}
        className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--color-muted)]"
      >
        {email}
      </span>
      <form action={signOut} className="shrink-0">
        <button
          type="submit"
          aria-label={t("auth.sign_out")}
          title={t("auth.sign_out")}
          className="flex size-9 items-center justify-center rounded-lg text-[color:var(--color-muted-soft)] transition-[background-color,color] duration-150 ease-[var(--ease-out-soft)] hover:bg-[color:var(--color-canvas-sunken)] hover:text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] active:translate-y-px"
        >
          <Icon name="logout" size={18} />
        </button>
      </form>
    </div>
  );
}
