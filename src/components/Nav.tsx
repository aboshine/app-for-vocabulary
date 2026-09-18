"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/vocabulary", label: "Vocabulary" },
  { href: "/review", label: "Review" },
  { href: "/categories", label: "Categories" },
  { href: "/grammar", label: "Grammar", disabled: true },
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
