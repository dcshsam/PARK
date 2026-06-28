import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/layout/shell";
import { ThemeProvider } from "@/components/theme-provider";
import { ProfileProvider } from "@/components/profile-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PropReview | Proposal Review",
  description: "Review RFPs, meeting transcripts, and customer documents in one place.",
};

const themeScript = `
  (function() {
    const theme = localStorage.getItem("theme") || "system";
    const resolved = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.classList.add(resolved);
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full bg-background text-foreground">
        <script async dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <ProfileProvider>
            <Shell>{children}</Shell>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
