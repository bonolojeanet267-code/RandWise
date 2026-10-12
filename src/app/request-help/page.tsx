"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function RequestHelp() {
  const [form, setForm] = useState({ business_name:"", service_type:"Testing", description:"", contact:"" })
  const [done, setDone] = useState(false)
  const submit = async () => { await supabase.from("service_requests").insert(form); setDone(true); setForm({ business_name:"", service_type:"Testing", description:"", contact:""}) }
  if(done) return <main className="mx-auto w-full max-w-2xl p-6"><div role="status" className="panel border-emerald-200 bg-emerald-50 p-8 text-center"><h1 className="text-2xl font-bold text-emerald-900">Request sent!</h1><p className="mt-2 text-emerald-800">IT companies in your area will contact you on WhatsApp.</p></div></main>
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-6">
        <p className="eyebrow">RandWise Connect</p>
        <h1 className="page-title mt-1">Request IT help</h1>
        <p className="page-subtitle">Tell us what your business needs and how providers can reach you.</p>
      </div>
      <div className="panel flex flex-col gap-3 p-5 sm:p-6">
        <input placeholder="Your Business Name" value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} className="border p-3 rounded-xl"/>
        <select value={form.service_type} onChange={e=>setForm({...form,service_type:e.target.value})} className="border p-3 rounded-xl"><option>Testing</option><option>Website / Catalog Setup</option><option>POS & Printer Setup</option><option>Data Clean-up</option><option>Training</option></select>
        <input placeholder="WhatsApp Number" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} className="border p-3 rounded-xl"/>
        <textarea placeholder="Describe what you need" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="border p-3 rounded-xl h-24"></textarea>
        <button onClick={submit} className="primary-button p-3">Submit request</button>
      </div>
    </main>
  )
}