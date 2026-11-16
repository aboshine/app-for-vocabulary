"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Categories moved out of the bar to make room for Read / Learn; it is linked from Words and Learn.
const links = [
  { href: "/", label: "Today" },
  { href: "/reading", label: "Read" },
  { href: "/review", label: "Review" },
  { href: "/learn", label: "Learn" },
  { href: "/tutor", label: "Tutor" },
  { href: "/vocabulary", label: "Words" },
  { href: "/grammar", label: "Grammar" },
  { href: "/settings", label: "⚙", aria: "Settings" },
] as Array<{ href: string; label: string; aria?: string }>;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="nav" aria-label="Main">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link key={link.href} href={link.href} aria-label={link.aria} className={active ? "nav-link active" : "nav-link"}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
