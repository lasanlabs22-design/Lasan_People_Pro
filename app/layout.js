import { Space_Grotesk } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Only for the "Powered by Lasan Labs" signature; the app itself uses the system's Segoe UI.
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], weight: ["600"] });

export const metadata = {
  title: { default: "Lasan People Pro", template: "%s · Lasan People Pro" },
  description: "Attendance, leave and people management with photo-verified check-in.",
};

export const viewport = { themeColor: "#0f6cbd" };

export default function RootLayout({ children }) {
  return (
    // The theme script sets data-theme before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={`${spaceGrotesk.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  );
}
