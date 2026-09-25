import { Home } from "@/app/home";

/**
 * The front door of PromoterOS.
 *
 * This used to render the waitlist, which made a page we intend to delete the first thing anyone
 * saw of the product. The waitlist now lives at `/waitlist` and this is the product page:
 * what PromoterOS does, for whom, and a way in. See `app/home.tsx`.
 */
export default function Page() {
  return <Home />;
}
