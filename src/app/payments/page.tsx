"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, CircleDollarSign, Clock3 } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Invoice = {
  id: string
  invoice_no: string
  customer_name: string
  total: number | string
  status: string
  payment_method: string | null
  created_at: string
}

const paymentMethods = ["Cash", "EFT", "Mobile money", "Other"]

export default function Payments() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [method, setMethod] = useState("EFT")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")

  const loadInvoices = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("invoices")
      .select("id,invoice_no,customer_name,total,status,payment_method,created_at")
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

  async function markPaid(invoice: Invoice) {
    setError("")
    setSavingId(invoice.id)
    try {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "paid", payment_method: method })
        .eq("id", invoice.id)

      if (updateError) throw new Error(`Could not update invoice: ${updateError.message}`)
      await loadInvoices()
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSavingId("")
    }
  }

  const paidInvoices = invoices.filter((invoice) => invoice.status.toLowerCase() === "paid")
  const pendingInvoices = invoices.filter((invoice) => invoice.status.toLowerCase() !== "paid")
  const paidTotal = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const pendingTotal = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Get paid</p>
        <h1 className="page-title mt-1">Payment tracking</h1>
        <p className="page-subtitle">Record which invoices have been paid and how. RandWise records payments; it does not process or verify them.</p>
      </div>

      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        <article className="panel flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={21} /></span>
          <div><p className="text-sm text-gray-500">Recorded as paid</p><p className="text-2xl font-bold">R{paidTotal.toFixed(2)}</p></div>
        </article>
        <article className="panel flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-700"><Clock3 size={21} /></span>
          <div><p className="text-sm text-gray-500">Still outstanding</p><p className="text-2xl font-bold">R{pendingTotal.toFixed(2)}</p></div>
        </article>
      </div>

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700"><CircleDollarSign size={20} /></span>
          <div><h2 className="font-bold">Payment methods</h2><p className="text-sm text-gray-500">Cash, EFT, and mobile money can be recorded manually.</p></div>
        </div>
        <p className="text-sm leading-6 text-gray-600">No payment gateway is connected. Confirm the money reached your account before marking an invoice paid. Mobile-money and payment-provider integrations can be added later.</p>
      </section>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <section>
        <h2 className="mb-3 text-lg font-bold">Invoices</h2>
        {loading ? <p role="status" className="text-sm text-gray-500">Loading invoices...</p> : invoices.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">Create an invoice first, then track when your customer pays.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((invoice) => {
              const paid = invoice.status.toLowerCase() === "paid"
              return (
                <article key={invoice.id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">{invoice.invoice_no} <span className="font-normal text-gray-400">·</span> {invoice.customer_name}</p>
                    <p className="mt-1 text-sm text-gray-500">R{Number(invoice.total).toFixed(2)} · {paid ? `Paid via ${invoice.payment_method ?? "unrecorded method"}` : "Payment pending"}</p>
                  </div>
                  {paid ? (
                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">Paid</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <select aria-label={`Payment method for ${invoice.invoice_no}`} value={method} onChange={(event) => setMethod(event.target.value)} className="min-w-36">
                        {paymentMethods.map((paymentMethod) => <option key={paymentMethod}>{paymentMethod}</option>)}
                      </select>
                      <button type="button" disabled={savingId === invoice.id} onClick={() => void markPaid(invoice)} className="primary-button px-4 py-2 disabled:opacity-60">
                        {savingId === invoice.id ? "Saving..." : "Record as paid"}
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
