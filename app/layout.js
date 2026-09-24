import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata = {
  title: { default: "Lasan People", template: "%s · Lasan People" },
  description: "Attendance, leave and people management for Lasan.",
};

export const viewport = { themeColor: "#05060c" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full">
        <div className="aurora" aria-hidden />
        {children}
      </body>
    </html>
  );
}
