"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function Expenses() {
  const [list, setList] = useState<any[]>([])
  const [form, setForm] = useState({ category: "Rent", amount: 0, payment_method: "Cash", description: "" })
  const load = async () => { const { data } = await supabase.from("expenses").select("*").order("date",{ascending:false}); if(data) setList(data) }
  useEffect(()=>{load()},[])
  const add = async () => { await supabase.from("expenses").insert(form); setForm({ category:"Rent", amount:0, payment_method:"Cash", description:""}); load() }
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <p className="eyebrow">Money out</p>
        <h1 className="page-title mt-1">Expenses</h1>
        <p className="page-subtitle">Record and review the costs of running your business.</p>
      </div>
      <div className="panel mb-7 flex flex-col gap-3 p-5 sm:p-6">
        <select value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="border p-2 rounded-xl"><option>Rent</option><option>Stock</option><option>Transport</option><option>Electricity</option><option>Salaries</option></select>
        <input type="number" placeholder="Amount" value={form.amount} onChange={e=>setForm({...form, amount:Number(e.target.value)})} className="border p-2 rounded-xl"/>
        <input placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="border p-2 rounded-xl"/>
        <button onClick={add} className="primary-button p-3">+ Add expense</button>
      </div>
      <h2 className="mb-3 text-lg font-bold">Recent expenses</h2>
      <div className="space-y-2">{list.map(e=><div key={e.id} className="panel flex justify-between gap-4 p-4"><span><span className="font-semibold">{e.category}</span><span className="text-gray-500"> · {e.description}</span></span><span className="shrink-0 font-bold text-rose-700">− R{Number(e.amount).toFixed(2)}</span></div>)}</div>
    </main>
  )
}