import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/shell";
import { ThemeProvider } from "@/components/theme-provider";
import { ProfileProvider } from "@/components/profile-provider";
import { InlineScript } from "@/components/inline-script";

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
      className="h-full antialiased"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <InlineScript id="theme-script" html={themeScript} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <ProfileProvider>
            <Shell>{children}</Shell>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
