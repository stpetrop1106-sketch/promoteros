import { redirect } from "next/navigation";

/** The console's own guard lives in `app/admin/layout.tsx` and runs before this. */
export default function AdminIndexPage() {
  redirect("/admin/agencies");
}
