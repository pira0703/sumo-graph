"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",               label: "相関図" },
  { href: "/banzuke",        label: "番付" },
  { href: "/admin/rikishi",  label: "力士" },
  { href: "/admin/heya",     label: "部屋" },
  { href: "/admin/oyakata",  label: "名跡" },
  { href: "/admin/basho",    label: "場所" },
  { href: "/admin/themes",   label: "テーマ" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1.5 flex-wrap">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="px-2.5 py-1 rounded text-sm transition-colors"
            style={active
              ? { backgroundColor: "var(--purple)", border: "1px solid var(--purple)", color: "white", fontWeight: 500 }
              : { backgroundColor: "var(--white)", border: "1px solid var(--border)", color: "var(--ink)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
