"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { Check, FileDown, FileText, ListChecks, TriangleAlert } from "lucide-react"
import jsPDF from "jspdf"
import { supabase } from "@/lib/supabase"

type ReadinessStats = {
  sales: number
  expenses: number
  salesCount: number
  expenseCount: number
  invoiceCount: number
  purchaseCount: number
  hasBusinessProfile: boolean
}

const emptyStats: ReadinessStats = {
  sales: 0,
  expenses: 0,
  salesCount: 0,
  expenseCount: 0,
  invoiceCount: 0,
  purchaseCount: 0,
  hasBusinessProfile: false,
}

const documentChecklist = [
  { id: "registration", label: "Business registration documents, if applicable" },
  { id: "bank-statements", label: "Recent business bank statements, if available" },
  { id: "identity", label: "Owner identity and address documents, if required" },
  { id: "business-plan", label: "Business plan or cash-flow notes, if requested" },
]
const checklistStorageKey = "randwise-funding-documents"

function subscribeToChecklist(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("randwise-funding-checklist-change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("randwise-funding-checklist-change", onChange)
  }
}

function getChecklistSnapshot() {
  return window.localStorage.getItem(checklistStorageKey) ?? "[]"
}

function parseChecklist(snapshot: string) {
  try {
    const parsed: unknown = JSON.parse(snapshot)
    if (Array.isArray(parsed) && parsed.every((entry): entry is string => typeof entry === "string")) {
      return parsed.filter((id) => documentChecklist.some((item) => item.id === id))
    }
  } catch {
    return []
  }
  return []
}

export default function Funding() {
  const [stats, setStats] = useState(emptyStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [storageError, setStorageError] = useState("")
  const completedDocuments = parseChecklist(useSyncExternalStore(subscribeToChecklist, getChecklistSnapshot, () => "[]"))

  const loadStats = useCallback(async () => {
    const [salesResult, expensesResult, invoicesResult, purchasesResult, businessResult] = await Promise.all([
      supabase.from("sales").select("total"),
      supabase.from("expenses").select("amount"),
      supabase.from("invoices").select("id"),
      supabase.from("stock_receipts").select("id"),
      supabase.from("businesses").select("name").maybeSingle(),
    ])

    const failed = [salesResult, expensesResult, invoicesResult, purchasesResult, businessResult].find((result) => result.error)
    if (failed?.error) throw new Error(`Could not load business records: ${failed.error.message}`)

    const sales = salesResult.data ?? []
    const expenses = expensesResult.data ?? []
    setStats({
      sales: sales.reduce((sum, row) => sum + Number(row.total), 0),
      expenses: expenses.reduce((sum, row) => sum + Number(row.amount), 0),
      salesCount: sales.length,
      expenseCount: expenses.length,
      invoiceCount: invoicesResult.data?.length ?? 0,
      purchaseCount: purchasesResult.data?.length ?? 0,
      hasBusinessProfile: Boolean(businessResult.data?.name?.trim()),
    })
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadStats()
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [loadStats])

  const profit = stats.sales - stats.expenses
  const criteria = [
    { label: "Business profile set up", complete: stats.hasBusinessProfile, href: "/" },
    { label: "Sales recorded", complete: stats.salesCount > 0, href: "/sales" },
    { label: "Expenses recorded", complete: stats.expenseCount > 0, href: "/expenses" },
    { label: "Customer invoices created", complete: stats.invoiceCount > 0, href: "/invoices" },
    { label: "Supplier purchases recorded", complete: stats.purchaseCount > 0, href: "/inventory" },
    ...documentChecklist.map((item) => ({ label: item.label, complete: completedDocuments.includes(item.id), id: item.id })),
  ]
  const progress = Math.round((criteria.filter((item) => item.complete).length / criteria.length) * 100)

  function toggleDocument(id: string) {
    const updated = completedDocuments.includes(id)
      ? completedDocuments.filter((entry) => entry !== id)
      : [...completedDocuments, id]
    try {
      window.localStorage.setItem(checklistStorageKey, JSON.stringify(updated))
      window.dispatchEvent(new Event("randwise-funding-checklist-change"))
      setStorageError("")
    } catch {
      setStorageError("Could not save the document checklist in this browser.")
    }
  }

  function exportReport() {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text("RandWise - Business Records Summary", 20, 20)
    doc.setFontSize(11)
    doc.text(`Prepared: ${new Date().toLocaleDateString("en-ZA")}`, 20, 31)
    doc.text(`Sales recorded: R${stats.sales.toFixed(2)} (${stats.salesCount} transactions)`, 20, 45)
    doc.text(`Expenses recorded: R${stats.expenses.toFixed(2)} (${stats.expenseCount} entries)`, 20, 55)
    doc.text(`Difference between recorded sales and expenses: R${profit.toFixed(2)}`, 20, 65)
    doc.text(`Customer invoices: ${stats.invoiceCount}`, 20, 75)
    doc.text(`Supplier purchases: ${stats.purchaseCount}`, 20, 85)
    doc.text(`Readiness checklist completion: ${progress}%`, 20, 95)
    doc.text(`Business profile set up: ${stats.hasBusinessProfile ? "Yes" : "No"}`, 20, 105)
    doc.text(`Documents marked ready: ${completedDocuments.length} of ${documentChecklist.length}`, 20, 115)
    doc.setFontSize(9)
    doc.text("Checklist completion is owner-reported and does not assess eligibility or guarantee funding.", 20, 130, { maxWidth: 170 })
    doc.text("Review all figures and application requirements with the relevant funding provider.", 20, 142, { maxWidth: 170 })
    doc.save("RandWise-Business-Records-Summary.pdf")
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Prepare your records</p>
        <h1 className="page-title mt-1">Funding readiness</h1>
        <p className="page-subtitle">Spot missing business records and prepare documents a funder may ask to review. The checklist is not an eligibility assessment.</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {storageError && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{storageError}</p>}
      <section className="mb-6 rounded-[1.75rem] bg-[#153e30] p-6 text-white shadow-lg shadow-emerald-950/10 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-100/85">Checklist completeness</p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight">{loading ? "—" : `${progress}%`}</p>
            <p className="mt-2 text-sm text-emerald-50/85">Based on records and documents marked ready. Not a funding or credit score.</p>
          </div>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-emerald-100"><ListChecks size={30} /></span>
        </div>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-orange-400 transition-all" style={{ width: `${loading ? 0 : progress}%` }} />
        </div>
      </section>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Recorded sales", value: `R${stats.sales.toFixed(2)}` },
          { label: "Recorded expenses", value: `R${stats.expenses.toFixed(2)}` },
          { label: "Sales less expenses", value: `R${profit.toFixed(2)}` },
        ].map((metric) => <article key={metric.label} className="panel p-5"><p className="text-sm text-gray-500">{metric.label}</p><p className="mt-2 text-xl font-bold">{loading ? "—" : metric.value}</p></article>)}
      </div>

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FileText size={20} /></span>
          <div><h2 className="font-bold">Records and documents</h2><p className="text-sm text-gray-500">Records update from RandWise. Document readiness is saved only in this browser.</p></div>
        </div>
        <ul className="space-y-3">
          {criteria.map((item) => (
            <li key={item.label} className="flex flex-wrap items-center gap-3 text-sm">
              {"id" in item ? (
                <input
                  aria-label={`Mark ${item.label} ready`}
                  type="checkbox"
                  checked={item.complete}
                  onChange={() => toggleDocument(item.id)}
                  className="h-5 w-5 accent-[#246bfd]"
                />
              ) : (
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.complete ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"}`}>{item.complete ? <Check size={13} /> : "·"}</span>
              )}
              <span className={item.complete ? "text-gray-800" : "text-gray-500"}>{item.label}</span>
              {"href" in item && <a className="font-semibold text-[#1552d8] hover:underline" href={item.href}>Open</a>}
              <span className="ml-auto text-gray-500">{item.complete ? "Ready" : "Missing"}</span>
            </li>
          ))}
        </ul>
      </section>

      {!loading && progress < 100 && (
        <aside className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <p>Some checklist items are not marked ready. Review the missing records and documents with the requirements of the specific funder you plan to approach.</p>
        </aside>
      )}
      <button type="button" disabled={loading || Boolean(error)} onClick={exportReport} className="primary-button flex w-full items-center justify-center gap-2 p-4 disabled:cursor-not-allowed disabled:opacity-50">
        <FileDown size={19} /> Export business records summary
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-gray-500">The PDF is an owner-prepared summary, not audited financial statements or an official funder assessment. Confirm each funder’s current application requirements directly.</p>
    </main>
  )
}
