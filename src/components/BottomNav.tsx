"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Dumbbell, LineChart, Sparkles, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Vandaag", icon: Dumbbell },
  { href: "/week", label: "Week", icon: CalendarCheck },
  { href: "/progressie", label: "Progressie", icon: LineChart },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/coach", label: "Coach", icon: Sparkles },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/training/") && !path.endsWith("/klaar")) return null; // focus tijdens het trainen
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-floor/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" || path.startsWith("/streaks") : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-pin" : "text-mute"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
