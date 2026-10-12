"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ChevronDown, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"

const focusLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Stock & supply" },
  { href: "/payments", label: "Payments" },
  { href: "/funding", label: "Funding" },
  { href: "/start", label: "Start up" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/services", label: "IT Connect" },
  { href: "/audit", label: "Activity" },
]

const moreLinks = [
  { href: "/sales", label: "Sales" },
  { href: "/expenses", label: "Expenses" },
  { href: "/rent-reminders", label: "Rent & bills" },
  { href: "/budgets", label: "Budgets" },
  { href: "/invoices", label: "Invoices" },
]

export default function Navbar({ email }: { email: string }) {
  const pathname = usePathname()
  const isMoreActive = moreLinks.some(({ href }) => pathname === href)

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 border-b border-white/10 bg-[#231934] text-white shadow-lg shadow-black/15">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-200">
              <BarChart3 size={19} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block text-[1.05rem] font-extrabold leading-tight tracking-tight">
                RandWise<span className="text-[#f79193]">.</span>
              </span>
              <span className="hidden text-[0.65rem] text-slate-300/75 sm:block">SMALL BUSINESS, IN CONTROL</span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/discover"
              className="whitespace-nowrap rounded-full bg-[#246bfd] px-3 py-2 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#1552d8] active:scale-95 sm:px-4"
            >
              <span className="hidden sm:inline">Switch to </span>Customer view
            </Link>
            <span className="hidden max-w-40 truncate text-xs text-slate-200/75 lg:block">{email}</span>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void supabase.auth.signOut()}
              className="shrink-0 rounded-lg p-2 text-slate-200/80 transition hover:bg-white/10 hover:text-white active:scale-90"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" aria-label="Business tools">
          {focusLinks.map(({ href, label }) => {
            const active = pathname === href || (href === "/services" && pathname.startsWith("/request-help"))
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition duration-200 hover:-translate-y-0.5 active:scale-95 sm:text-sm ${
                  active ? "bg-[#246bfd] text-white shadow-sm" : "text-slate-100/85 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </Link>
            )
          })}
          <details className="group relative">
            <summary className={`flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition duration-200 hover:bg-white/10 active:scale-95 sm:text-sm ${isMoreActive ? "bg-white/15 text-white" : "text-slate-100/85"}`}>
              More <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="absolute left-0 top-full z-50 mt-2 min-w-44 rounded-xl border border-slate-900/10 bg-white p-1.5 text-gray-800 shadow-xl">
              {moreLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:bg-blue-50 hover:text-blue-900 active:scale-[0.98] ${pathname === href ? "bg-blue-50 text-blue-900" : ""}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </nav>
  )
}
