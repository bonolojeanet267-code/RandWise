"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Services() {
  const [providers, setProviders] = useState<any[]>([])
  useEffect(()=>{
    async function load(){ const { data } = await supabase.from("it_providers").select("*"); if(data && data.length>0) setProviders(data); else setProviders([
      { company_name:"CodeFix Boksburg", services:["Testing","Website Setup"], location:"Boksburg", price_from:500, whatsapp:"27600000000", verified:true, bio:"We help spaza shops test stock & build catalogs"},
      { company_name:"Tshwane Techies", services:["POS Setup","Training"], location:"Pretoria", price_from:350, whatsapp:"27600000001", verified:true, bio:"Small IT team for small businesses"},
      { company_name:"Kasi Devs", services:["Data Clean-up","Testing"], location:"Soweto", price_from:250, whatsapp:"27600000002", verified:false, bio:"Students offering affordable IT help"}
    ])}
    load()
  },[])
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <p className="eyebrow">Local business network</p>
        <h1 className="page-title mt-1">RandWise Connect</h1>
        <p className="page-subtitle">Find practical IT support from small teams and local providers.</p>
      </div>
      <Link href="/request-help" className="primary-button mb-6 block rounded-xl p-3 text-center">+ Request IT help</Link>
      <div className="grid gap-4 sm:grid-cols-2">{providers.map((p,i)=><div key={i} className="panel p-5"><div className="flex justify-between gap-3"><h2 className="font-bold">{p.company_name} {p.verified&&<span className="text-emerald-700" aria-label="Verified">✓</span>}</h2><span className="h-fit whitespace-nowrap rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-800">From R{p.price_from}</span></div><p className="mt-2 text-sm text-gray-500">{p.location} · {p.services?.join(", ")}</p><p className="mt-3 text-sm leading-6 text-gray-700">{p.bio}</p><a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer" className="mt-4 block rounded-xl bg-emerald-50 p-3 text-center font-bold text-emerald-800 hover:bg-emerald-100">Chat on WhatsApp ↗</a></div>)}</div>
    </main>
  )
}