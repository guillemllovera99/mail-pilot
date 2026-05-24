"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { signOut, useSession } from "next-auth/react"

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/board", label: "Board" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/review", label: "Review" },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: session } = useSession()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/dashboard/search?q=${encodeURIComponent(trimmed)}`)
    setQ("")
  }

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 mr-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">MailQuark</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => {
            const active = href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-800 text-white"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-900"
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {/* Search + Avatar */}
        <div className="ml-auto flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex items-center">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search tasks…"
                className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg pl-8 pr-3 py-1.5 w-40 focus:w-56 transition-all duration-200 focus:outline-none focus:border-gray-600 placeholder-gray-600"
              />
            </div>
          </form>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center hover:border-gray-500 transition-colors flex-shrink-0"
              title={session?.user?.email ?? "Account"}
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-9 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                {session?.user?.email && (
                  <div className="px-4 py-2.5 border-b border-gray-800">
                    <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                  </div>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
