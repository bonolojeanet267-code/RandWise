"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import jsPDF from "jspdf"

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]); const [customer, setCustomer] = useState(""); const [total, setTotal] = useState(0)
  const load = async () => { const { data } = await supabase.from("invoices").select("*").order("created_at",{ascending:false}); if(data) setInvoices(data) }
  useEffect(()=>{load()},[])
  const create = async () => {
    const no = `INV-${Date.now().toString().slice(-4)}`
    await supabase.from("invoices").insert({ invoice_no:no, customer_name:customer, total, status:"sent", items:{ total } }); setCustomer(""); setTotal(0); load()
  }
  const pdf = (inv:any) => { const doc = new jsPDF(); doc.text(`RandWise Invoice ${inv.invoice_no}`,20,20); doc.text(`Customer: ${inv.customer_name}`,20,30); doc.text(`Total: R${inv.total}`,20,40); doc.text(`Status: ${inv.status}`,20,50); doc.save(`${inv.invoice_no}.pdf`) }
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <p className="eyebrow">Get paid</p>
        <h1 className="page-title mt-1">Invoices</h1>
        <p className="page-subtitle">Create a customer invoice and download a shareable PDF.</p>
      </div>
      <div className="panel mb-7 flex flex-col gap-3 p-5 sm:p-6"><input aria-label="Customer name" placeholder="Customer name" value={customer} onChange={e=>setCustomer(e.target.value)}/><input aria-label="Invoice total" type="number" min="0" step="0.01" placeholder="Total (R)" value={total} onChange={e=>setTotal(Number(e.target.value))}/><button onClick={create} className="primary-button p-3">Create invoice</button></div>
      <h2 className="mb-3 text-lg font-bold">Your invoices</h2>
      <div className="space-y-2">{invoices.map(i=><div key={i.id} className="panel mb-2 flex items-center justify-between gap-3 p-4"><div><p className="font-bold">{i.invoice_no} <span className="font-normal text-gray-400">·</span> {i.customer_name}</p><p className="mt-1 text-sm capitalize text-gray-500">{i.status}</p></div><div className="flex items-center gap-3"><span className="font-bold">R{Number(i.total).toFixed(2)}</span><button onClick={()=>pdf(i)} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100">Download PDF</button></div></div>)}</div>
    </main>
  )
}