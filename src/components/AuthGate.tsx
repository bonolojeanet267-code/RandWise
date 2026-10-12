"use client"

import { FormEvent, useEffect, useState } from "react"
import { ArrowRight, LoaderCircle, LockKeyhole, Store } from "lucide-react"
import type { Session } from "@supabase/supabase-js"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/Navbar"

type AuthMode = "sign-in" | "sign-up"

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [businessReady, setBusinessReady] = useState(false)
  const [mode, setMode] = useState<AuthMode>("sign-up")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) setBusinessReady(false)
    })

    async function restoreSession() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!active) return
      if (sessionError) {
        setError(`Could not check your sign-in: ${sessionError.message}`)
        setCheckingSession(false)
        return
      }

      setSession(data.session)
      if (data.session) {
        const { error: businessError } = await supabase.rpc("bootstrap_business", {
          p_business_name: "My Business",
        })
        if (!active) return
        if (businessError) setError(`Could not open your business space: ${businessError.message}`)
        else setBusinessReady(true)
      }
      setCheckingSession(false)
    }

    void restoreSession()
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (pathname === "/discover") return children

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setMessage("")
    setBusy(true)

    try {
      if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError

        if (!data.session) {
          setMessage("Account created. Check your email to confirm your address, then sign in.")
          setMode("sign-in")
          return
        }

        const { error: businessError } = await supabase.rpc("bootstrap_business", {
          p_business_name: businessName.trim(),
        })
        if (businessError) throw new Error(`Your account was created, but the business space could not be set up: ${businessError.message}`)
        setBusinessReady(true)
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      if (!data.session) throw new Error("Sign-in succeeded but no active session was returned.")

      const { error: businessError } = await supabase.rpc("bootstrap_business", {
        p_business_name: businessName.trim() || "My Business",
      })
      if (businessError) throw new Error(`Signed in, but your business space could not be opened: ${businessError.message}`)
      setSession(data.session)
      setBusinessReady(true)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  if (checkingSession || (session && !businessReady && !error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-gray-600">
          <LoaderCircle className="animate-spin" size={18} /> Opening your secure business space...
        </p>
      </div>
    )
  }

  if (!session || !businessReady) {
    return (
      <main className="flex min-h-[calc(100vh-2rem)] items-center justify-center px-4 py-10">
        <section className="panel w-full max-w-md p-6 sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-800"><Store size={23} /></div>
          <p className="eyebrow">Small business, in control</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{mode === "sign-up" ? "Create your business space" : "Welcome back"}</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            {mode === "sign-up" ? "Create a private account for your business records." : "Sign in to access your business records."}
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            {mode === "sign-up" && (
              <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                Business name
                <input required minLength={2} autoComplete="organization" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Naledi's Shop" />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Email
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Password
              <input required type="password" minLength={8} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>

            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {message && <p role="status" className="rounded-xl border border-[#8ec97b]/60 bg-[#8ec97b]/20 p-3 text-sm text-[#27491d]">{message}</p>}
            <button disabled={busy} type="submit" className="primary-button flex items-center justify-center gap-2 p-3 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <LoaderCircle className="animate-spin" size={18} /> : <>{mode === "sign-up" ? "Create account" : "Sign in"} <ArrowRight size={17} /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            {mode === "sign-up" ? "Already have an account?" : "New to RandWise?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "sign-up" ? "sign-in" : "sign-up"); setError(""); setMessage("") }} className="font-bold text-blue-800 hover:underline">
              {mode === "sign-up" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400"><LockKeyhole size={13} /> Your business records are private to your account.</p>
        </section>
      </main>
    )
  }

  return (
    <>
      <Navbar email={session.user.email ?? ""} />
      {children}
    </>
  )
}
