"use client"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type Product = {
  id: string
  name: string
  qty: number
  sell_price: number | string
}

type Sale = {
  id: string
  qty: number
  total: number | string
  products: { name: string }[] | { name: string } | null
}

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState("")
  const [qty, setQty] = useState(1)
  const [sales, setSales] = useState<Sale[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadData = useCallback(async () => {
    const [productResult, salesResult] = await Promise.all([
      supabase.from("products").select("id,name,qty,sell_price").order("name"),
      supabase.from("sales").select("id,qty,total,products(name)").order("created_at", { ascending: false }),
    ])

    if (productResult.error) throw new Error(`Could not load products: ${productResult.error.message}`)
    if (salesResult.error) throw new Error(`Could not load recent sales: ${salesResult.error.message}`)

    setProducts(productResult.data ?? [])
    setSales((salesResult.data ?? []) as Sale[])
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadData()
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : String(cause))
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [loadData])

  const sell = async () => {
    const prod = products.find(p=>p.id===selected)
    if(!prod) {
      setError("Select a product before recording a sale.")
      return
    }
    if(!Number.isInteger(qty) || qty <= 0) {
      setError("Enter a quantity of at least one.")
      return
    }

    setError("")
    setSaving(true)
    try {
      const { error: saleError } = await supabase.rpc("record_sale", {
        p_product_id: selected,
        p_quantity: qty,
      })
      if(saleError) {
        setError(`Could not complete sale: ${saleError.message}`)
        return
      }

      setQty(1)
      setSelected("")
      await loadData()
    } catch (cause: unknown) {
      setError(`Could not complete sale: ${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <p className="eyebrow">Revenue</p>
        <h1 className="page-title mt-1">Record a sale</h1>
        <p className="page-subtitle">Choose a product and quantity to log a sale and deduct stock.</p>
      </div>
      <div className="panel mb-7 grid gap-3 p-5 sm:p-6">
        <select value={selected} onChange={e=>setSelected(e.target.value)} className="border p-2 rounded-xl w-full mb-2">
          <option value="">Select product</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.qty} left) - R{p.sell_price}</option>)}
        </select>
        <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value))} className="border p-2 rounded-xl w-full mb-2" placeholder="Qty" />
        <button onClick={sell} disabled={saving} className="primary-button w-full p-3 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Completing sale..." : "Complete sale"}</button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <h2 className="mb-3 text-lg font-bold">Recent sales</h2>
      <div className="space-y-2">{sales.map(s=><div key={s.id} className="panel flex justify-between p-4"><span className="text-gray-600">{(Array.isArray(s.products) ? s.products[0]?.name : s.products?.name) ?? "Product"} <span className="text-gray-400">×</span> {s.qty}</span><span className="font-bold">R{Number(s.total).toFixed(2)}</span></div>)}</div>
    </main>
  )
}