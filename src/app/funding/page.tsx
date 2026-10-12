"use client"

import { useCallback, useEffect, useState } from "react"
import { FileDown, FileText, ListChecks } from "lucide-react"
import jsPDF from "jspdf"
import { supabase } from "@/lib/supabase"

type ReadinessStats = {
  sales: number
  expenses: number
  salesCount: number
  expenseCount: number
  invoiceCount: number
  purchaseCount: number
}

const emptyStats: ReadinessStats = {
  sales: 0,
  expenses: 0,
  salesCount: 0,
  expenseCount: 0,
  invoiceCount: 0,
  purchaseCount: 0,
}

export default function Funding() {
  const [stats, setStats] = useState(emptyStats)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadStats = useCallback(async () => {
    const [salesResult, expensesResult, invoicesResult, purchasesResult] = await Promise.all([
      supabase.from("sales").select("total"),
      supabase.from("expenses").select("amount"),
      supabase.from("invoices").select("id"),
      supabase.from("stock_receipts").select("id"),
    ])

    const failed = [salesResult, expensesResult, invoicesResult, purchasesResult].find((result) => result.error)
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
    { label: "Sales recorded", complete: stats.salesCount > 0 },
    { label: "Expenses recorded", complete: stats.expenseCount > 0 },
    { label: "Customer invoices created", complete: stats.invoiceCount > 0 },
    { label: "Supplier purchases recorded", complete: stats.purchaseCount > 0 },
  ]
  const progress = Math.round((criteria.filter((item) => item.complete).length / criteria.length) * 100)

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
    doc.text(`Record-keeping checklist: ${progress}%`, 20, 95)
    doc.setFontSize(9)
    doc.text("Informational summary only. Not a credit score, proof of eligibility, or funding approval.", 20, 112, { maxWidth: 170 })
    doc.text("Review all figures and application requirements with the relevant funding provider.", 20, 124, { maxWidth: 170 })
    doc.save("RandWise-Business-Records-Summary.pdf")
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Prepare your records</p>
        <h1 className="page-title mt-1">Funding readiness</h1>
        <p className="page-subtitle">Organise the business records a funder may ask to review. This page does not determine eligibility or guarantee funding.</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <section className="mb-6 rounded-[1.75rem] bg-[#153e30] p-6 text-white shadow-lg shadow-emerald-950/10 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-100/75">Record-keeping progress</p>
            <p className="mt-2 text-5xl font-extrabold tracking-tight">{loading ? "—" : `${progress}%`}</p>
            <p className="mt-2 text-sm text-emerald-50/75">Based only on the four record categories below, not a funding or credit score.</p>
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
          <div><h2 className="font-bold">Build a record history</h2><p className="text-sm text-gray-500">Keep these categories up to date as your business trades.</p></div>
        </div>
        <ul className="space-y-3">
          {criteria.map((item) => (
            <li key={item.label} className="flex items-center gap-3 text-sm">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${item.complete ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"}`}>{item.complete ? "✓" : "·"}</span>
              <span className={item.complete ? "text-gray-800" : "text-gray-500"}>{item.label}</span>
              <span className="ml-auto text-gray-500">{item.complete ? "Started" : "Not yet"}</span>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" disabled={loading || Boolean(error)} onClick={exportReport} className="primary-button flex w-full items-center justify-center gap-2 p-4 disabled:cursor-not-allowed disabled:opacity-50">
        <FileDown size={19} /> Export business records summary
      </button>
      <p className="mt-3 text-center text-xs leading-5 text-gray-500">The PDF is an owner-prepared summary, not audited financial statements or an official funder assessment. Confirm each funder’s current application requirements directly.</p>
    </main>
  )
}
