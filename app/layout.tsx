import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import UnlockIntelligenceConsole from "@/components/UnlockIntelligenceConsole";
import MarketMoversConsole from "@/components/MarketMoversConsole";
import RemovePerspectiveUI from "@/components/RemovePerspectiveUI";
import "./globals.css";
import "./theme.css";
import "./dark-fixes.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PRISM | Crypto Intelligence Desk",
  description:
    "Evidence-first crypto research with market context, historical replay and multi-chain account intelligence.",
};

const themeInitScript = `
  try {
    const saved = localStorage.getItem("prism-theme");
    const dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <MarketMoversConsole />
        <UnlockIntelligenceConsole />
        <RemovePerspectiveUI />
        <ThemeToggle />
      </body>
    </html>
  );
}
