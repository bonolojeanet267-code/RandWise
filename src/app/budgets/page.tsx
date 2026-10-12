"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

type BudgetRow = { id: string; category: string; limit_amount: number | string }
type ExpenseRow = { category: string; amount: number | string }

export default function Budgets() {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]); const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [form, setForm] = useState({ category:"Rent", limit_amount:1000 })
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: budgetData, error: budgetError }, { data: expenseData, error: expenseError }] = await Promise.all([
        supabase.from("budgets").select("id,category,limit_amount"),
        supabase.from("expenses").select("category,amount"),
      ])
      if (!active) return
      if (budgetError || expenseError) {
        setError(`Could not load budgets: ${budgetError?.message ?? expenseError?.message}`)
        return
      }
      setBudgets(budgetData ?? [])
      setExpenses(expenseData ?? [])
    }
    void load()
    return () => { active = false }
  }, [])

  const save = async () => {
    setError("")
    const { error: saveError } = await supabase.from("budgets").upsert(form, { onConflict: "business_id,category" })
    if (saveError) {
      setError(`Could not save budget: ${saveError.message}`)
      return
    }
    const [{ data: budgetData, error: budgetError }, { data: expenseData, error: expenseError }] = await Promise.all([
      supabase.from("budgets").select("id,category,limit_amount"),
      supabase.from("expenses").select("category,amount"),
    ])
    if (budgetError || expenseError) {
      setError(`Could not reload budgets: ${budgetError?.message ?? expenseError?.message}`)
      return
    }
    setBudgets(budgetData ?? [])
    setExpenses(expenseData ?? [])
  }
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <p className="eyebrow">Plan ahead</p>
        <h1 className="page-title mt-1">Budgets</h1>
        <p className="page-subtitle">Set spending limits and get a heads-up when a category reaches 85%.</p>
      </div>
      <div className="panel mb-7 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:p-6"><select aria-label="Budget category" value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="flex-1"><option>Rent</option><option>Stock</option><option>Transport</option><option>Electricity</option><option>Salaries</option></select><input aria-label="Budget limit amount" type="number" value={form.limit_amount} onChange={e=>setForm({...form, limit_amount:Number(e.target.value)})} className="sm:max-w-52"/><button onClick={save} className="primary-button px-5 py-3">Save budget</button></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {budgets.map(b=>{
        const spent = expenses.filter(e=>e.category===b.category).reduce((s,r)=>s+Number(r.amount),0)
        const limitAmount = Number(b.limit_amount)
        const pct = limitAmount ? (spent/limitAmount)*100 : 0
        return <div key={b.id} className="panel mb-3 p-5"><div className="mb-3 flex items-center justify-between gap-3"><span className="font-bold">{b.category}</span><span className="text-sm text-gray-600">R{Number(spent).toFixed(2)} <span className="text-gray-400">of</span> R{Number(b.limit_amount).toFixed(2)}</span></div><div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all ${pct>100?'bg-rose-600':pct>85?'bg-orange-500':'bg-emerald-600'}`} style={{width:`${Math.min(pct,100)}%`}}></div></div>{pct>85&&<p className="mt-3 text-sm font-bold text-orange-700">{pct>100?'Budget exceeded':'85% warning · Almost over'}</p>}</div>
      })}
    </main>
  )
}