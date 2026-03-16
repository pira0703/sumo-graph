import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "えにし — 力士たちのつながり",
  description: "力士のつながりを辿り、知られざるドラマを発見する",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" style={{ backgroundColor: "var(--washi)", color: "var(--ink)" }}>
        {children}
      </body>
    </html>
  );
}
