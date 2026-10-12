"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, CircleDollarSign, Clock3, Copy, TriangleAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Invoice = {
  id: string
  invoice_no: string
  customer_name: string
  total: number | string
  status: string
  payment_method: string | null
  due_date: string | null
  paid_amount: number | string
  paid_at: string | null
  created_at: string
}

type PaymentInput = {
  amount: string
  method: string
}

const paymentMethods = ["Cash", "EFT", "Mobile money", "Other"]

function isOverdue(invoice: Invoice) {
  return Number(invoice.paid_amount) < Number(invoice.total)
    && Boolean(invoice.due_date)
    && invoice.due_date! < new Date().toISOString().slice(0, 10)
}

function invoiceStatus(invoice: Invoice) {
  const remaining = Number(invoice.total) - Number(invoice.paid_amount)
  if (remaining <= 0) return "Paid"
  if (isOverdue(invoice)) return "Overdue"
  if (Number(invoice.paid_amount) > 0) return "Partially paid"
  return "Unpaid"
}

export default function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [inputs, setInputs] = useState<Record<string, PaymentInput>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadInvoices = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("invoices")
      .select("id,invoice_no,customer_name,total,status,payment_method,due_date,paid_amount,paid_at,created_at")
      .order("created_at", { ascending: false })

    if (queryError) throw new Error(`Could not load invoices: ${queryError.message}`)
    const loaded = data ?? []
    setInvoices(loaded)
    setInputs((current) => {
      const next = { ...current }
      for (const invoice of loaded) {
        const remaining = Math.max(0, Number(invoice.total) - Number(invoice.paid_amount))
        next[invoice.id] = {
          amount: current[invoice.id]?.amount || remaining.toFixed(2),
          method: current[invoice.id]?.method || "EFT",
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadInvoices()
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
  }, [loadInvoices])

  async function recordPayment(invoice: Invoice) {
    const input = inputs[invoice.id]
    const amount = Number(input?.amount)
    const previouslyPaid = Number(invoice.paid_amount)
    const total = Number(invoice.total)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.")
      return
    }
    if (previouslyPaid + amount > total + 0.001) {
      setError("The payment amount cannot be greater than the invoice balance.")
      return
    }

    setError("")
    setNotice("")
    setSavingId(invoice.id)
    try {
      const newPaidAmount = Math.min(total, previouslyPaid + amount)
      const fullyPaid = newPaidAmount >= total
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          paid_amount: newPaidAmount,
          status: fullyPaid ? "paid" : "partial",
          payment_method: input.method,
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoice.id)

      if (updateError) throw new Error(`Could not record payment: ${updateError.message}`)
      await loadInvoices()
      setNotice(`Recorded R${amount.toFixed(2)} against ${invoice.invoice_no}.`)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSavingId("")
    }
  }

  async function copyReminder(invoice: Invoice) {
    const balance = Number(invoice.total) - Number(invoice.paid_amount)
    const dueText = invoice.due_date
      ? ` It was due on ${new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-ZA")}.`
      : ""
    const text = `Hello ${invoice.customer_name}, this is a reminder that invoice ${invoice.invoice_no} has an outstanding balance of R${balance.toFixed(2)}.${dueText} Please contact us if you have already paid.`
    try {
      await navigator.clipboard.writeText(text)
      setNotice("Payment reminder copied. Review it and send it to the customer using your usual channel.")
      setError("")
    } catch {
      setError("Could not copy the reminder. Check browser clipboard permissions and try again.")
    }
  }

  const paidInvoices = invoices.filter((invoice) => Number(invoice.paid_amount) >= Number(invoice.total))
  const outstandingInvoices = invoices.filter((invoice) => Number(invoice.paid_amount) < Number(invoice.total))
  const overdueInvoices = outstandingInvoices.filter(isOverdue)
  const paidTotal = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.paid_amount), 0)
  const outstandingTotal = outstandingInvoices.reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.paid_amount), 0)
  const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total) - Number(invoice.paid_amount), 0)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-7">
        <p className="eyebrow">Get paid</p>
        <h1 className="page-title mt-1">Payment tracking</h1>
        <p className="page-subtitle">Record full or partial invoice payments and spot overdue balances. Payments are entered manually, not processed by RandWise.</p>
      </header>

      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <article className="panel flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={21} /></span>
          <div><p className="text-sm text-gray-500">Recorded as received</p><p className="text-2xl font-bold">R{paidTotal.toFixed(2)}</p></div>
        </article>
        <article className="panel flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Clock3 size={21} /></span>
          <div><p className="text-sm text-gray-500">Outstanding balance</p><p className="text-2xl font-bold">R{outstandingTotal.toFixed(2)}</p></div>
        </article>
        <article className="panel flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><TriangleAlert size={21} /></span>
          <div><p className="text-sm text-gray-500">Overdue balance</p><p className="text-2xl font-bold">R{overdueTotal.toFixed(2)}</p></div>
        </article>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#8ec97b] bg-[#8ec97b] p-3 text-sm font-semibold text-[#231934]">{notice}</p>}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <CircleDollarSign size={19} className="text-[#246bfd]" />
          <h2 className="text-lg font-bold">Customer invoices</h2>
        </div>
        {loading ? (
          <p role="status" className="panel p-4 text-sm text-gray-500">Loading invoices...</p>
        ) : invoices.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">Create an invoice first, then track payments here.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const total = Number(invoice.total)
              const paid = Number(invoice.paid_amount)
              const remaining = Math.max(0, total - paid)
              const status = invoiceStatus(invoice)
              const input = inputs[invoice.id] ?? { amount: "", method: "EFT" }
              return (
                <article key={invoice.id} className="panel p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{invoice.invoice_no} · {invoice.customer_name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status === "Paid" ? "bg-emerald-50 text-emerald-800" : status === "Overdue" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{status}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">R{paid.toFixed(2)} paid of R{total.toFixed(2)} · R{remaining.toFixed(2)} remaining</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {invoice.due_date ? `Due ${new Date(`${invoice.due_date}T00:00:00`).toLocaleDateString("en-ZA")}` : "No due date set"}
                        {invoice.paid_at ? ` · Latest payment recorded ${new Date(invoice.paid_at).toLocaleDateString("en-ZA")}` : ""}
                        {paid > 0 ? ` · ${invoice.payment_method ?? "Method not recorded"}` : ""}
                      </p>
                    </div>
                    {remaining > 0 && (
                      <button type="button" onClick={() => void copyReminder(invoice)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#246bfd]/25 px-3 py-2 text-sm font-semibold text-[#1552d8] hover:bg-[#246bfd]/5">
                        <Copy size={15} /> Copy reminder
                      </button>
                    )}
                  </div>
                  {remaining > 0 && (
                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1 text-xs font-semibold text-gray-600">
                        Payment received (R)
                        <input aria-label={`Payment amount for ${invoice.invoice_no}`} type="number" min="0.01" max={remaining} step="0.01" value={input.amount} onChange={(event) => setInputs((current) => ({ ...current, [invoice.id]: { ...input, amount: event.target.value } }))} />
                      </label>
                      <label className="grid gap-1 text-xs font-semibold text-gray-600">
                        Payment method
                        <select aria-label={`Payment method for ${invoice.invoice_no}`} value={input.method} onChange={(event) => setInputs((current) => ({ ...current, [invoice.id]: { ...input, method: event.target.value } }))}>
                          {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                        </select>
                      </label>
                      <button type="button" disabled={savingId === invoice.id} onClick={() => void recordPayment(invoice)} className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:cursor-not-allowed">
                        {savingId === invoice.id ? "Saving..." : "Record payment"}
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
      <p className="mt-5 text-center text-xs leading-5 text-gray-500">Payment reminder text is copied for you to review and send yourself. RandWise does not message customers, process payments, or verify that funds arrived.</p>
    </main>
  )
}
