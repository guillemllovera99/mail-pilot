"use client"

import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  const handleSignIn = async () => {
    setLoading(true)
    await signIn("azure-ad", { callbackUrl: "/dashboard" })
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      {/* Logo + wordmark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">MailQuark</h1>
          <p className="text-gray-400 text-sm mt-1">Your inbox, organized.</p>
        </div>
      </div>

      {/* Sign-in card */}
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
        <p className="text-gray-400 text-sm mb-7">
          Sign in with your Microsoft account to continue.
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 disabled:bg-gray-200 text-gray-900 font-medium py-3 px-4 rounded-xl transition-colors duration-150 shadow-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            /* Microsoft logo SVG */
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
          )}
          <span>{loading ? "Redirecting…" : "Sign in with Microsoft"}</span>
        </button>

        <p className="text-center text-gray-600 text-xs mt-6 leading-relaxed">
          You&apos;ll be asked to approve access to your Outlook inbox once.
          <br />No password is stored.
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 text-gray-700 text-xs">
        Private prototype · Not for distribution
      </p>
    </div>
  )
}
