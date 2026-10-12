"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, Boxes, ClipboardList, FileText, HandCoins, ReceiptText, Search, WalletCards } from "lucide-react"

type DailyTotals = {
  key: string
  label: string
  sales: number
  expenses: number
}

type RecordedAmount = {
  total?: number | string
  amount?: number | string
  created_at?: string
  date?: string
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createLastSevenDays(): DailyTotals[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      key: localDateKey(date),
      label: date.toLocaleDateString("en-ZA", { weekday: "short" }),
      sales: 0,
      expenses: 0,
    }
  })
}

export default function Dashboard() {
  const [stats, setStats] = useState({ sales: 0, expenses: 0, outstanding: 0, lowStock: 0 })
  const [dailyTotals, setDailyTotals] = useState<DailyTotals[]>([])
  const [dashboardError, setDashboardError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      const [salesResult, expensesResult, invoicesResult, productsResult] = await Promise.all([
        supabase.from("sales").select("total,created_at"),
        supabase.from("expenses").select("amount,date"),
        supabase.from("invoices").select("total,status"),
        supabase.from("products").select("qty"),
      ])

      if (!active) return
      const queryError = salesResult.error ?? expensesResult.error ?? invoicesResult.error ?? productsResult.error
      if (queryError) {
        setDashboardError(`Could not load business summary: ${queryError.message}`)
        return
      }

      const sales = (salesResult.data ?? []) as RecordedAmount[]
      const expenses = (expensesResult.data ?? []) as RecordedAmount[]
      const invoices = invoicesResult.data ?? []
      const products = productsResult.data ?? []
      const totalSales = sales.reduce((sum, row) => sum + Number(row.total), 0)
      const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.amount), 0)
      const outstanding = invoices.filter((invoice) => invoice.status !== "paid").reduce((sum, row) => sum + Number(row.total), 0)
      const lowStock = products.filter((product) => product.qty < 5).length
      const lastSevenDays = createLastSevenDays()
      const totalsByDate = new Map(lastSevenDays.map((day) => [day.key, day]))

      for (const sale of sales) {
        if (!sale.created_at) continue
        const day = totalsByDate.get(localDateKey(new Date(sale.created_at)))
        if (day) day.sales += Number(sale.total)
      }
      for (const expense of expenses) {
        if (!expense.date) continue
        const day = totalsByDate.get(expense.date.slice(0, 10))
        if (day) day.expenses += Number(expense.amount)
      }

      setStats({ sales: totalSales, expenses: totalExpenses, outstanding, lowStock })
      setDailyTotals(lastSevenDays)
    }
    void load()
    return () => { active = false }
  }, [])

  const profit = stats.sales - stats.expenses
  const chartMax = Math.max(1, ...dailyTotals.flatMap((day) => [day.sales, day.expenses]))
  const weekSales = dailyTotals.reduce((sum, day) => sum + day.sales, 0)
  const weekExpenses = dailyTotals.reduce((sum, day) => sum + day.expenses, 0)
  const bestSalesDay = dailyTotals.reduce<DailyTotals | null>((best, day) => !best || day.sales > best.sales ? day : best, null)

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <section className="animate-enter relative mb-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#172033] via-[#294b99] to-[#6558c7] px-6 py-8 text-white shadow-xl shadow-indigo-950/15 sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-100/80">Your business at a glance</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Good business starts with clarity.</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-100/85 sm:text-base">Make every rand count. Keep your sales, stock and spending moving in the right direction.</p>
        </div>
        <div aria-hidden="true" className="animate-float absolute -right-10 -top-24 h-72 w-72 rounded-full border-[42px] border-white/[0.07]" />
        <div aria-hidden="true" className="animate-float absolute -bottom-36 right-36 h-64 w-64 rounded-full bg-[#ff8b61]/20 blur-2xl" />
      </section>

      <section className="mb-9">
        <div className="mb-4">
          <p className="eyebrow">Built around the challenge</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Support for every step of your business</h2>
          <p className="mt-1 text-sm text-gray-500">Core RandWise tools, connected in one place.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/start", title: "Start and formalise", description: "Follow practical business setup steps.", icon: FileText, tone: "from-cyan-50 to-white", iconTone: "bg-cyan-100 text-cyan-800" },
            { href: "/sales", title: "Bookkeeping and cash flow", description: "Keep sales, spending and money owed visible.", icon: WalletCards, tone: "from-sky-50 to-white", iconTone: "bg-sky-100 text-sky-800" },
            { href: "/inventory", title: "Procurement and stock", description: "Record supplier invoices and track stock.", icon: Boxes, tone: "from-blue-50 to-white", iconTone: "bg-blue-100 text-blue-800" },
            { href: "/payments", title: "Digital payment tracking", description: "Record invoice payment status and method.", icon: HandCoins, tone: "from-amber-50 to-white", iconTone: "bg-amber-100 text-amber-800" },
            { href: "/funding", title: "Funding readiness", description: "Prepare a summary of your business records.", icon: FileText, tone: "from-violet-50 to-white", iconTone: "bg-violet-100 text-violet-800" },
            { href: "/services", title: "Local IT support", description: "Connect with local technology providers.", icon: ArrowUpRight, tone: "from-teal-50 to-white", iconTone: "bg-teal-100 text-teal-800" },
            { href: "/audit", title: "Activity and oversight", description: "Review recorded sales and stock receipts.", icon: ClipboardList, tone: "from-orange-50 to-white", iconTone: "bg-orange-100 text-orange-800" },
            { href: "/discover", title: "Customer market access", description: "See the separate public product directory.", icon: Search, tone: "from-rose-50 to-white", iconTone: "bg-rose-100 text-rose-800" },
          ].map(({ href, title, description, icon: Icon, tone, iconTone }, index) => (
            <Link
              key={href}
              href={href}
              className={`panel group animate-enter flex min-h-36 flex-col items-start bg-gradient-to-br ${tone} p-4 transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg active:scale-[0.98] sm:p-5 ${index % 4 === 1 ? "stagger-1" : index % 4 === 2 ? "stagger-2" : index % 4 === 3 ? "stagger-3" : ""}`}
            >
              <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconTone}`}><Icon size={20} /></span>
              <span className="font-bold text-gray-900">{title}</span>
              <span className="mt-1 text-sm leading-5 text-gray-500">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Business snapshot</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Your numbers</h2>
        </div>
        <span className="hidden text-sm text-gray-500 sm:block">A quick look at how things are going</span>
      </div>
      <div className="mb-9 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total sales", amount: stats.sales, icon: ArrowUpRight, color: "bg-blue-50 text-blue-700", note: "Money coming in" },
          { label: "Expenses", amount: stats.expenses, icon: ArrowDownLeft, color: "bg-rose-50 text-rose-700", note: "Money going out" },
          { label: "Estimated profit", amount: profit, icon: WalletCards, color: "bg-sky-50 text-sky-700", note: "Sales less expenses" },
          { label: "Outstanding", amount: stats.outstanding, icon: FileText, color: "bg-amber-50 text-amber-700", note: "Invoices to follow up" },
        ].map(({ label, amount, icon: Icon, color, note }, index) => (
          <article key={label} className={`panel animate-enter p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg ${index % 3 === 1 ? "stagger-1" : index % 3 === 2 ? "stagger-2" : index === 3 ? "stagger-3" : ""}`}>
            <div className="mb-5 flex items-start justify-between">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={20} /></span>
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[0.68rem] font-semibold text-gray-500">ZAR</span>
            </div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-extrabold tracking-tight ${label === "Estimated profit" && profit < 0 ? "text-rose-700" : "text-gray-900"}`}>
              R {amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-2 text-xs text-gray-400">{note}</p>
          </article>
        ))}
      </div>

      {dashboardError && <p role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{dashboardError}</p>}

      <section className="panel animate-enter mb-9 overflow-hidden p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Business insights</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Sales and spending · last 7 days</h2>
            <p className="mt-1 text-sm text-gray-500">A daily comparison using the records you have entered.</p>
          </div>
          <div className="flex gap-4 text-xs font-semibold text-gray-600">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" />Sales</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#f47750]" />Expenses</span>
          </div>
        </div>

        {dailyTotals.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <svg role="img" aria-label="Bar chart comparing daily sales and expenses for the last seven days" viewBox="0 0 700 220" className="min-w-[560px] w-full">
                {[35, 78, 121, 164].map((y) => (
                  <line key={y} x1="38" x2="680" y1={y} y2={y} stroke="#e7ebf3" strokeDasharray="4 6" />
                ))}
                {dailyTotals.map((day, index) => {
                  const groupX = 54 + index * 90
                  const salesHeight = day.sales ? Math.max(4, day.sales / chartMax * 130) : 0
                  const expenseHeight = day.expenses ? Math.max(4, day.expenses / chartMax * 130) : 0
                  return (
                    <g key={day.key}>
                      <rect x={groupX} y={164 - salesHeight} width="24" height={salesHeight} rx="7" fill="#3159c9">
                        <title>{`${day.label} sales: R${day.sales.toFixed(2)}`}</title>
                      </rect>
                      <rect x={groupX + 30} y={164 - expenseHeight} width="24" height={expenseHeight} rx="7" fill="#f47750">
                        <title>{`${day.label} expenses: R${day.expenses.toFixed(2)}`}</title>
                      </rect>
                      <text x={groupX + 27} y="194" textAnchor="middle" fill="#687386" fontSize="12" fontWeight="600">{day.label}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
            <div className="mt-2 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sales this week</p><p className="mt-1 font-extrabold text-blue-800">R{weekSales.toFixed(2)}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Expenses this week</p><p className="mt-1 font-extrabold text-[#d85e3d]">R{weekExpenses.toFixed(2)}</p></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quick read</p>
                <p className="mt-1 text-sm font-semibold text-gray-700">
                  {weekSales === 0 && weekExpenses === 0
                    ? "Add sales and expenses to see your trend."
                    : weekSales >= weekExpenses
                      ? `Sales are R${(weekSales - weekExpenses).toFixed(2)} above recorded expenses.`
                      : `Recorded expenses are R${(weekExpenses - weekSales).toFixed(2)} above sales.`}
                </p>
                {bestSalesDay && bestSalesDay.sales > 0 && <p className="mt-1 text-xs text-gray-500">Best sales day: {bestSalesDay.label}.</p>}
              </div>
            </div>
          </>
        ) : (
          <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-gray-500">Loading your business trend...</p>
        )}
      </section>

      {stats.lowStock > 0 && (
        <div role="status" className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100"><Boxes size={20} /></span>
          <div><p className="font-bold">Stock needs attention</p><p className="text-sm text-amber-800">{stats.lowStock} products have fewer than 5 items left.</p></div>
          <Link href="/inventory" className="ml-auto shrink-0 text-sm font-bold text-amber-900 hover:underline">Review stock →</Link>
        </div>
      )}

      <div className="mb-3">
        <p className="eyebrow">Get things done</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">Quick actions</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          { href: "/inventory", title: "Manage inventory", description: "Update products and stock levels", icon: Boxes, tone: "bg-blue-50 text-blue-700" },
          { href: "/sales", title: "Record a sale", description: "Log a sale and update stock", icon: ArrowUpRight, tone: "bg-sky-50 text-sky-700" },
          { href: "/expenses", title: "Track expenses", description: "Keep business spending in check", icon: ReceiptText, tone: "bg-rose-50 text-rose-700" },
          { href: "/budgets", title: "Plan a budget", description: "Set limits and watch progress", icon: WalletCards, tone: "bg-violet-50 text-violet-700" },
          { href: "/invoices", title: "Create an invoice", description: "Bill customers and save a PDF", icon: FileText, tone: "bg-amber-50 text-amber-700" },
          { href: "/payments", title: "Track a payment", description: "Record paid invoices and payment methods", icon: HandCoins, tone: "bg-indigo-50 text-indigo-700" },
        ].map(({ href, title, description, icon: Icon, tone }, index) => (
          <Link key={href} href={href} className={`panel group animate-enter flex items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg sm:p-5 ${index % 3 === 1 ? "stagger-1" : index % 3 === 2 ? "stagger-2" : ""}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:rotate-3 ${tone}`}><Icon size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-gray-900">{title}</span>
              <span className="mt-1 block text-sm text-gray-500">{description}</span>
            </span>
            <span aria-hidden="true" className="text-lg text-gray-300 transition-colors group-hover:text-blue-700">→</span>
          </Link>
        ))}
      </div>
    </main>
  )
}