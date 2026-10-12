"use client"

import { useState, useSyncExternalStore } from "react"
import { ExternalLink, Landmark, ShieldCheck } from "lucide-react"

const checklist = [
  {
    id: "cipc",
    title: "Check business-name and company registration",
    description: "Review the current CIPC registration process and decide whether a registered company fits your business.",
    href: "https://www.cipc.co.za/",
    linkLabel: "Visit CIPC",
  },
  {
    id: "sars",
    title: "Understand your SARS tax responsibilities",
    description: "Check which tax registrations and filing responsibilities apply to your business.",
    href: "https://www.sars.gov.za/",
    linkLabel: "Visit SARS",
  },
  {
    id: "banking",
    title: "Compare business banking and payment options",
    description: "Compare fees, access, and payment options with providers before choosing an account.",
    href: "",
    linkLabel: "",
  },
  {
    id: "workers",
    title: "Check employer obligations before hiring",
    description: "Review UIF, COIDA, and other employer requirements that may apply when you hire staff.",
    href: "https://www.gov.za/",
    linkLabel: "Visit gov.za",
  },
  {
    id: "procurement",
    title: "Explore public procurement registration",
    description: "Check the Central Supplier Database guidance if you plan to supply government buyers.",
    href: "https://secure.csd.gov.za/",
    linkLabel: "Visit CSD",
  },
  {
    id: "records",
    title: "Start keeping business records",
    description: "Record supplier invoices, sales, expenses, and customer invoices in RandWise.",
    href: "/",
    linkLabel: "Open dashboard",
  },
]

const STORAGE_KEY = "randwise-business-start-checklist"

function subscribeChecklist(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("randwise-checklist-change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("randwise-checklist-change", onChange)
  }
}

function getChecklistSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? "[]"
}

function parseChecklistSnapshot(snapshot: string) {
  try {
    const parsed: unknown = JSON.parse(snapshot)
    if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string")) {
      return parsed.filter((id) => checklist.some((item) => item.id === id))
    }
  } catch {
    return []
  }
  return []
}

export default function Start() {
  const snapshot = useSyncExternalStore(subscribeChecklist, getChecklistSnapshot, () => "[]")
  const completed = parseChecklistSnapshot(snapshot)
  const [storageError, setStorageError] = useState("")

  function toggleStep(id: string) {
    const updated = completed.includes(id) ? completed.filter((step) => step !== id) : [...completed, id]
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event("randwise-checklist-change"))
      setStorageError("")
    } catch {
      setStorageError("Could not save checklist progress in this browser.")
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Your next steps</p>
        <h1 className="page-title mt-1">Start your business</h1>
        <p className="page-subtitle">A practical checklist for moving from an idea or informal trade towards a more organised business.</p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
        <ShieldCheck className="mt-0.5 shrink-0 text-sky-700" size={20} />
        <p>Requirements, fees, and eligibility can change and vary by business. Use the official links to confirm current guidance; checking a box here only saves your personal checklist.</p>
      </div>
      {storageError && <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{storageError}</p>}

      <section aria-label="Business setup checklist" className="space-y-3">
        {checklist.map((step, index) => {
          const done = completed.includes(step.id)
          return (
            <article key={step.id} className="panel flex gap-4 p-4 sm:p-5">
              <button
                type="button"
                aria-label={`${done ? "Mark incomplete" : "Mark complete"}: ${step.title}`}
                aria-pressed={done}
                onClick={() => toggleStep(step.id)}
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${done ? "border-emerald-700 bg-emerald-700 text-white" : "border-gray-300 bg-white text-transparent hover:border-emerald-600"} disabled:opacity-50`}
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={`font-bold ${done ? "text-gray-500 line-through" : "text-gray-900"}`}>{index + 1}. {step.title}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${done ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>{done ? "Done" : "To do"}</span>
                </div>
                <p className="mt-1.5 text-sm leading-6 text-gray-600">{step.description}</p>
                {step.href && (
                  <a href={step.href} target={step.href.startsWith("http") ? "_blank" : undefined} rel={step.href.startsWith("http") ? "noreferrer" : undefined} className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-emerald-800 hover:underline">
                    {step.linkLabel}<ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </section>

      <aside className="panel mt-6 flex gap-3 border-emerald-100 bg-emerald-50/70 p-5">
        <Landmark className="mt-0.5 shrink-0 text-emerald-800" size={21} />
        <div><h2 className="font-bold text-emerald-950">Build useful business records as you go</h2><p className="mt-1 text-sm leading-6 text-emerald-900/80">A clear history of sales, costs, stock purchases, and invoices can help you explain how your business operates. It does not guarantee procurement access, finance, or approval.</p></div>
      </aside>
    </main>
  )
}
