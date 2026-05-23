"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-gray-500 hover:text-gray-300 transition-colors duration-150 underline underline-offset-2"
    >
      Sign out
    </button>
  )
}
