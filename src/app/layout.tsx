import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "相撲相関図",
  description: "力士たちのつながりを可視化する",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-stone-950 text-stone-100 min-h-screen">{children}</body>
    </html>
  );
}
