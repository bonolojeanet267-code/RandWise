"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardList, PackageCheck, ShoppingBag } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Activity = {
  id: string
  date: string
  title: string
  detail: string
  amount: number
  kind: "sale" | "stock"
}

export default function Audit() {
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadActivity = useCallback(async () => {
    const [salesResult, receiptsResult] = await Promise.all([
      supabase.from("sales").select("id,qty,total,created_at,products(name)").order("created_at", { ascending: false }).limit(30),
      supabase.from("stock_receipts").select("id,supplier_name,invoice_number,invoice_date,invoice_total,created_at").order("created_at", { ascending: false }).limit(30),
    ])

    const failed = [salesResult, receiptsResult].find((result) => result.error)
    if (failed?.error) throw new Error(`Could not load activity: ${failed.error.message}`)

    const sales: Activity[] = (salesResult.data ?? []).map((sale) => {
      const product = Array.isArray(sale.products) ? sale.products[0] : sale.products
      return {
        id: `sale-${sale.id}`,
        date: sale.created_at,
        title: "Sale recorded",
        detail: `${product?.name ?? "Product"} · ${sale.qty} sold`,
        amount: Number(sale.total),
        kind: "sale",
      }
    })
    const receipts: Activity[] = (receiptsResult.data ?? []).map((receipt) => ({
      id: `stock-${receipt.id}`,
      date: receipt.created_at,
      title: "Supplier invoice recorded",
      detail: `${receipt.supplier_name} · ${receipt.invoice_number}`,
      amount: Number(receipt.invoice_total),
      kind: "stock",
    }))

    setActivity([...sales, ...receipts].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 40))
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadActivity()
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
  }, [loadActivity])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Business records</p>
        <h1 className="page-title mt-1">Activity history</h1>
        <p className="page-subtitle">Review recent sales and supplier invoices alongside the automatic stock updates they trigger.</p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <ClipboardList className="mt-0.5 shrink-0 text-amber-800" size={20} />
        <p>This is an activity history to support oversight; it is not a tamper-proof audit log or a guarantee against fraud. Verify transactions against supplier invoices and payment records.</p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <section aria-label="Recent business activity" className="panel overflow-hidden">
        {loading ? (
          <p role="status" className="p-5 text-sm text-gray-500">Loading activity...</p>
        ) : activity.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto text-gray-300" size={30} />
            <p className="mt-3 font-semibold text-gray-700">No activity recorded yet</p>
            <p className="mt-1 text-sm text-gray-500">Sales and supplier invoices will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((item) => {
              const Icon = item.kind === "sale" ? ShoppingBag : PackageCheck
              return (
                <li key={item.id} className="flex items-center gap-3 p-4 sm:gap-4 sm:px-5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.kind === "sale" ? "bg-sky-50 text-sky-700" : "bg-emerald-50 text-emerald-700"}`}><Icon size={19} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.title}</p>
                    <p className="truncate text-sm text-gray-500">{item.detail}</p>
                    <time dateTime={item.date} className="text-xs text-gray-400">{new Date(item.date).toLocaleString("en-ZA")}</time>
                  </div>
                  <p className={`shrink-0 text-right font-bold ${item.kind === "sale" ? "text-emerald-800" : "text-gray-800"}`}>
                    {item.kind === "sale" ? "+" : "−"} R{item.amount.toFixed(2)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
