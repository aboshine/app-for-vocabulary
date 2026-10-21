"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links: Array<{ href: string; label: string; disabled?: boolean }> = [
  { href: "/", label: "Today" },
  { href: "/reading", label: "Read" },
  { href: "/review", label: "Review" },
  { href: "/learn", label: "Learn" },
  { href: "/vocabulary", label: "Words" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Main">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        if (link.disabled) {
          return (
            <span key={link.href} className="nav-link disabled" aria-disabled="true">
              {link.label}
            </span>
          );
        }
        return (
          <Link key={link.href} href={link.href} className={active ? "nav-link active" : "nav-link"}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
