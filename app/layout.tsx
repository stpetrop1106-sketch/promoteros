import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PromoterOS",
    template: "%s | PromoterOS",
  },
  description: "Operations for promotion agencies: staffing, scheduling and field reporting.",
  icons: {
    icon: "/promoteros-mark.svg",
  },
  themeColor: "#1646B8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
