"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import jsPDF from "jspdf"
import { supabase } from "@/lib/supabase"

type Invoice = {
  id: string
  invoice_no: string
  customer_name: string
  total: number | string
  status: string
  due_date: string | null
  paid_amount: number | string
  created_at: string
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customer, setCustomer] = useState("")
  const [total, setTotal] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadInvoices = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("invoices")
      .select("id,invoice_no,customer_name,total,status,due_date,paid_amount,created_at")
      .order("created_at", { ascending: false })
    if (queryError) throw new Error(`Could not load invoices: ${queryError.message}`)
    setInvoices(data ?? [])
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        await loadInvoices()
      } catch (cause: unknown) {
        if (active) setError(messageFor(cause))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [loadInvoices])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setSaving(true)
    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
      const { error: insertError } = await supabase.from("invoices").insert({
        invoice_no: invoiceNumber,
        customer_name: customer.trim(),
        total: Number(total),
        status: "sent",
        paid_amount: 0,
        due_date: dueDate || null,
        items: { total: Number(total) },
      })
      if (insertError) throw new Error(`Could not create invoice: ${insertError.message}`)
      setCustomer("")
      setTotal("")
      setDueDate("")
      await loadInvoices()
    } catch (cause: unknown) {
      setError(messageFor(cause))
    } finally {
      setSaving(false)
    }
  }

  function downloadPdf(invoice: Invoice) {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text(`RandWise Invoice ${invoice.invoice_no}`, 20, 20)
    doc.setFontSize(11)
    doc.text(`Customer: ${invoice.customer_name}`, 20, 32)
    doc.text(`Total: R${Number(invoice.total).toFixed(2)}`, 20, 43)
    doc.text(`Paid: R${Number(invoice.paid_amount).toFixed(2)}`, 20, 54)
    doc.text(`Outstanding: R${Math.max(0, Number(invoice.total) - Number(invoice.paid_amount)).toFixed(2)}`, 20, 65)
    doc.text(`Due date: ${invoice.due_date ? new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-ZA") : "Not set"}`, 20, 76)
    doc.text(`Status: ${invoice.status}`, 20, 87)
    doc.save(`${invoice.invoice_no}.pdf`)
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="eyebrow">Get paid</p>
        <h1 className="page-title mt-1">Invoices</h1>
        <p className="page-subtitle">Create customer invoices, set due dates, and follow payment progress.</p>
      </header>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <form onSubmit={create} className="panel mb-7 grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
        <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
          Customer name
          <input required maxLength={160} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Customer name" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
          Invoice total (R)
          <input required type="number" min="0.01" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="0.00" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
          Payment due date
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <button type="submit" disabled={saving} className="primary-button self-end rounded-xl p-3 disabled:cursor-not-allowed">
          {saving ? "Creating..." : "Create invoice"}
        </button>
      </form>

      <h2 className="mb-3 text-lg font-bold">Your invoices</h2>
      {loading ? (
        <p role="status" className="panel p-4 text-sm text-gray-500">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <p className="panel p-4 text-sm text-gray-600">Your invoices will appear here after you create one.</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid_amount))
            const overdue = remaining > 0 && invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)
            return (
              <article key={invoice.id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">{invoice.invoice_no} <span className="font-normal text-gray-400">·</span> {invoice.customer_name}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    R{Number(invoice.total).toFixed(2)} total · R{Number(invoice.paid_amount).toFixed(2)} paid · R{remaining.toFixed(2)} outstanding
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {invoice.due_date ? `Due ${new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-ZA")}` : "No due date set"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${remaining === 0 ? "bg-emerald-50 text-emerald-800" : overdue ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>
                    {remaining === 0 ? "Paid" : overdue ? "Overdue" : Number(invoice.paid_amount) > 0 ? "Partially paid" : "Unpaid"}
                  </span>
                  <button type="button" onClick={() => downloadPdf(invoice)} className="rounded-lg border border-[#246bfd]/25 px-3 py-2 text-sm font-bold text-[#1552d8] hover:bg-[#246bfd]/5">
                    Download PDF
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <p className="mt-5 text-center text-xs leading-5 text-gray-500">Invoice and payment records are business records only. RandWise does not collect money or verify payments.</p>
    </main>
  )
}
