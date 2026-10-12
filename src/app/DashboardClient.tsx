"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, BellRing, Boxes, CalendarClock, ClipboardList, FileText, HandCoins, ReceiptText, Search, WalletCards } from "lucide-react"

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

type RentReminder = {
  id: string
  title: string
  amount: number | string
  due_date: string
}

type CashFlowOverview = {
  last30Sales: number
  last30Expenses: number
  projectedSales: number | null
  projectedExpenses: number | null
  incomingInvoices: number
  scheduledRent: number
  salesEntries: number
  expenseEntries: number
  confidenceNote: string
  healthInsights: { label: string; detail: string; href: string; tone: "warning" | "positive" | "info" }[]
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function rentReminderLabel(dueDate: string) {
  const [year, month, day] = dueDate.split("-").map(Number)
  const [todayYear, todayMonth, todayDay] = localDateKey(new Date()).split("-").map(Number)
  const days = Math.round(
    (Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / 86_400_000,
  )
  if (days < 0) return `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`
  if (days === 0) return "Due today"
  if (days <= 7) return `Due in ${days} day${days === 1 ? "" : "s"}`
  return "Upcoming"
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
  const [rentReminders, setRentReminders] = useState<RentReminder[]>([])
  const [rentReminderError, setRentReminderError] = useState("")
  const [cashFlowOverview, setCashFlowOverview] = useState<CashFlowOverview | null>(null)
  const [cashFlowError, setCashFlowError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      const [salesResult, expensesResult, invoicesResult, productsResult] = await Promise.all([
        supabase.from("sales").select("total,created_at"),
        supabase.from("expenses").select("amount,date"),
        supabase.from("invoices").select("total,status,paid_amount"),
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
      const outstanding = invoices.reduce((sum, row) => sum + Math.max(0, Number(row.total) - Number(row.paid_amount)), 0)
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

  useEffect(() => {
    let active = true

    async function loadCashFlowOverview() {
      const now = new Date()
      const today = localDateKey(now)
      const currentWindowStart = localDateKey(addDays(now, -29))
      const previousWindowStart = localDateKey(addDays(now, -59))
      const projectionEnd = localDateKey(addDays(now, 30))
      const recentRunRateStart = localDateKey(addDays(now, -6))

      const [salesResult, expenseResult, allExpensesResult, invoiceResult, rentResult, productResult, budgetResult] = await Promise.all([
        supabase.from("sales").select("total,created_at").gte("created_at", `${previousWindowStart}T00:00:00`),
        supabase.from("expenses").select("amount,date,category").gte("date", previousWindowStart),
        supabase.from("expenses").select("amount,category"),
        supabase.from("invoices").select("total,paid_amount,due_date").not("due_date", "is", null).gte("due_date", today).lte("due_date", projectionEnd),
        supabase.from("rent_reminders").select("amount,due_date").is("paid_at", null).gte("due_date", today).lte("due_date", projectionEnd),
        supabase.from("products").select("name,qty"),
        supabase.from("budgets").select("category,limit_amount"),
      ])

      if (!active) return
      const failed = [salesResult, expenseResult, allExpensesResult, invoiceResult, rentResult, productResult, budgetResult].find((result) => result.error)
      if (failed?.error) {
        setCashFlowError(`Could not prepare cash-flow insights: ${failed.error.message}`)
        return
      }

      const sales = salesResult.data ?? []
      const expenses = expenseResult.data ?? []
      const currentSales = sales.filter((row) => {
        const key = row.created_at ? localDateKey(new Date(row.created_at)) : ""
        return key >= currentWindowStart && key <= today
      })
      const lastSevenSales = currentSales.filter((row) => row.created_at && localDateKey(new Date(row.created_at)) >= recentRunRateStart)
      const currentExpenses = expenses.filter((row) => row.date >= currentWindowStart && row.date <= today)
      const lastSevenExpenses = currentExpenses.filter((row) => row.date >= recentRunRateStart)
      const previousSales = sales.filter((row) => {
        const key = row.created_at ? localDateKey(new Date(row.created_at)) : ""
        return key >= previousWindowStart && key < currentWindowStart
      })
      const total = (rows: { total?: number | string; amount?: number | string }[]) =>
        rows.reduce((sum, row) => sum + Number(row.total ?? row.amount ?? 0), 0)
      const last30Sales = total(currentSales)
      const last30Expenses = total(currentExpenses)
      const projectedSales = lastSevenSales.length > 0 ? total(lastSevenSales) / 7 * 30 : null
      const projectedExpenses = lastSevenExpenses.length > 0 ? total(lastSevenExpenses) / 7 * 30 : null
      const previousSalesTotal = total(previousSales)
      const incomeChange = previousSalesTotal > 0
        ? Math.round(((last30Sales - previousSalesTotal) / previousSalesTotal) * 100)
        : null

      const receivables = (invoiceResult.data ?? []).reduce((sum, invoice) =>
        sum + Math.max(0, Number(invoice.total) - Number(invoice.paid_amount)), 0)
      const rentCommitment = (rentResult.data ?? []).reduce((sum, reminder) => sum + Number(reminder.amount), 0)
      const insights: CashFlowOverview["healthInsights"] = []
      const lowStock = (productResult.data ?? []).filter((product) => Number(product.qty) < 5)
      if (lowStock.length) {
        insights.push({
          label: "Stock needs attention",
          detail: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} have fewer than 5 units: ${lowStock.slice(0, 3).map((product) => product.name).join(", ")}${lowStock.length > 3 ? "…" : ""}.`,
          href: "/inventory",
          tone: "warning",
        })
      }

      for (const budget of budgetResult.data ?? []) {
        const spent = (allExpensesResult.data ?? [])
          .filter((expense) => expense.category === budget.category)
          .reduce((sum, expense) => sum + Number(expense.amount), 0)
        const limit = Number(budget.limit_amount)
        const percentage = limit > 0 ? spent / limit * 100 : 0
        if (percentage >= 85) {
          insights.push({
            label: percentage >= 100 ? `${budget.category} budget exceeded` : `${budget.category} budget nearly reached`,
            detail: `Recorded ${percentage.toFixed(0)}% of the R${limit.toFixed(2)} limit across saved expenses.`,
            href: "/budgets",
            tone: "warning",
          })
        }
      }

      const overdueQuery = await supabase
        .from("invoices")
        .select("id,total,paid_amount,due_date")
        .not("due_date", "is", null)
        .lt("due_date", today)
      if (!active) return
      if (overdueQuery.error) {
        setCashFlowError(`Could not check overdue invoices: ${overdueQuery.error.message}`)
        return
      }
      const overdueInvoices = (overdueQuery.data ?? []).filter((invoice) => Number(invoice.paid_amount) < Number(invoice.total))
      if (overdueInvoices.length) {
        insights.push({
          label: "Invoices need follow-up",
          detail: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? " is" : "s are"} past the due date with a remaining balance.`,
          href: "/payments",
          tone: "warning",
        })
      }
      if (incomeChange !== null && incomeChange <= -15) {
        insights.push({
          label: "Recorded sales have slowed",
          detail: `Sales are ${Math.abs(incomeChange)}% lower than the previous 30-day period.`,
          href: "/sales",
          tone: "warning",
        })
      } else if (!insights.length && (currentSales.length > 0 || currentExpenses.length > 0)) {
        insights.push({
          label: "Core records look up to date",
          detail: "No low-stock, overdue-invoice, or 85% budget alerts were found in the records checked.",
          href: "/audit",
          tone: "positive",
        })
      } else if (!insights.length) {
        insights.push({
          label: "Add business records to get started",
          detail: "Record sales, expenses, and stock so RandWise can check for trends and useful alerts.",
          href: "/sales",
          tone: "info",
        })
      }

      const confidenceNote = projectedSales === null || projectedExpenses === null
        ? `Not enough recent ${projectedSales === null && projectedExpenses === null ? "sales and expense records" : projectedSales === null ? "sales records" : "expense records"} to estimate both sides of cash flow. Enter records before relying on an outlook.`
        : lastSevenSales.length + lastSevenExpenses.length < 5
          ? "Early estimate: based on fewer than five recent sales and expense entries. Add records to improve the run-rate."
          : "Directional estimate: last 7 days’ recorded sales and expenses are extended across 30 days."

      setCashFlowOverview({
        last30Sales,
        last30Expenses,
        projectedSales,
        projectedExpenses,
        incomingInvoices: receivables,
        scheduledRent: rentCommitment,
        salesEntries: currentSales.length,
        expenseEntries: currentExpenses.length,
        confidenceNote,
        healthInsights: insights,
      })
    }

    void loadCashFlowOverview()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true

    async function loadRentReminders() {
      const { data, error } = await supabase
        .from("rent_reminders")
        .select("id,title,amount,due_date")
        .is("paid_at", null)
        .order("due_date", { ascending: true })
        .limit(3)

      if (!active) return
      if (error) {
        setRentReminderError(`Could not load rent reminders: ${error.message}`)
        return
      }
      setRentReminders(data ?? [])
    }

    void loadRentReminders()
    return () => { active = false }
  }, [])

  const profit = stats.sales - stats.expenses
  const chartMax = Math.max(1, ...dailyTotals.flatMap((day) => [day.sales, day.expenses]))
  const weekSales = dailyTotals.reduce((sum, day) => sum + day.sales, 0)
  const weekExpenses = dailyTotals.reduce((sum, day) => sum + day.expenses, 0)
  const bestSalesDay = dailyTotals.reduce<DailyTotals | null>((best, day) => !best || day.sales > best.sales ? day : best, null)
  const forecastNetMovement = cashFlowOverview && cashFlowOverview.projectedSales !== null && cashFlowOverview.projectedExpenses !== null
    ? cashFlowOverview.projectedSales - cashFlowOverview.projectedExpenses
    : null

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <section className="animate-enter relative mb-8 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#231934] via-[#34264c] to-[#246bfd] px-6 py-8 text-white shadow-xl shadow-black/20 sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-blue-100/80">Your business at a glance</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Good business starts with clarity.</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-100/85 sm:text-base">Make every rand count. Keep your sales, stock and spending moving in the right direction.</p>
        </div>
        <div aria-hidden="true" className="animate-float absolute -right-10 -top-24 h-72 w-72 rounded-full border-[42px] border-white/[0.07]" />
        <div aria-hidden="true" className="animate-float absolute -bottom-36 right-36 h-64 w-64 rounded-full bg-[#f79193]/25 blur-2xl" />
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
            { href: "/sales", title: "Bookkeeping and cash flow", description: "Keep sales, spending and money owed visible.", icon: WalletCards, tone: "from-sky-50 to-white", iconTone: "bg-[#f79193]/25 text-[#a8434a]" },
            { href: "/inventory", title: "Procurement and stock", description: "Record supplier invoices and track stock.", icon: Boxes, tone: "from-blue-50 to-white", iconTone: "bg-blue-100 text-blue-800" },
            { href: "/payments", title: "Digital payment tracking", description: "Record invoice payment status and method.", icon: HandCoins, tone: "from-amber-50 to-white", iconTone: "bg-amber-100 text-amber-800" },
            { href: "/funding", title: "Funding readiness", description: "Prepare a summary of your business records.", icon: FileText, tone: "from-violet-50 to-white", iconTone: "bg-violet-100 text-violet-800" },
            { href: "/opportunities", title: "Market opportunities", description: "Track procurement notices you have verified.", icon: ReceiptText, tone: "from-blue-50 to-white", iconTone: "bg-blue-100 text-blue-800" },
            { href: "/services", title: "Local IT support", description: "Connect with local technology providers.", icon: ArrowUpRight, tone: "from-teal-50 to-white", iconTone: "bg-[#f79193]/25 text-[#a8434a]" },
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
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#f79193]" />Expenses</span>
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
                      <rect x={groupX} y={164 - salesHeight} width="24" height={salesHeight} rx="7" fill="#246bfd">
                        <title>{`${day.label} sales: R${day.sales.toFixed(2)}`}</title>
                      </rect>
                      <rect x={groupX + 30} y={164 - expenseHeight} width="24" height={expenseHeight} rx="7" fill="#f79193">
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

      <section className="panel mb-8 overflow-hidden p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Plan the next month</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Cash-flow outlook</h2>
            <p className="mt-1 text-sm text-gray-500">A simple run-rate estimate from recent sales and expenses—not a bank balance.</p>
          </div>
          <Link href="/payments" className="text-sm font-bold text-[#246bfd] hover:underline">Review payments →</Link>
        </div>
        {cashFlowError ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Cash-flow outlook is unavailable: {cashFlowError}
          </p>
        ) : !cashFlowOverview ? (
          <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-gray-500">Calculating from your records...</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1.25fr_1fr_1fr]">
              <article className={`rounded-2xl p-5 text-white ${forecastNetMovement !== null && forecastNetMovement < 0 ? "bg-[#7b344a]" : "bg-[#231934]"}`}>
                <p className="text-sm font-semibold text-white/75">Estimated net movement · next 30 days</p>
                {cashFlowOverview.projectedSales === null || cashFlowOverview.projectedExpenses === null ? (
                  <>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight">More records needed</p>
                    <p className="mt-2 text-xs leading-5 text-white/75">{cashFlowOverview.confidenceNote}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight">
                      R{forecastNetMovement?.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/75">
                      {forecastNetMovement !== null && forecastNetMovement < 0
                        ? "The recent run-rate suggests recorded expenses may exceed sales. Review spending and collections."
                        : "Based on the last 7 days of recorded sales and expenses, extended across 30 days."}
                    </p>
                  </>
                )}
              </article>
              <article className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-500">Estimated sales</p>
                <p className="mt-2 text-2xl font-extrabold text-[#1552d8]">{cashFlowOverview.projectedSales === null ? "—" : `R${cashFlowOverview.projectedSales.toFixed(2)}`}</p>
                <p className="mt-2 text-xs text-gray-500">Last 30 days: R{cashFlowOverview.last30Sales.toFixed(2)}</p>
              </article>
              <article className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-500">Estimated expenses</p>
                <p className="mt-2 text-2xl font-extrabold text-[#a8434a]">{cashFlowOverview.projectedExpenses === null ? "—" : `R${cashFlowOverview.projectedExpenses.toFixed(2)}`}</p>
                <p className="mt-2 text-xs text-gray-500">Last 30 days: R{cashFlowOverview.last30Expenses.toFixed(2)}</p>
              </article>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#246bfd]/15 bg-[#246bfd]/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Unpaid invoices due in next 30 days</p>
                <p className="mt-1 text-xl font-extrabold text-[#1552d8]">R{cashFlowOverview.incomingInvoices.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Shown separately; not added to the sales run-rate.</p>
              </div>
              <div className="rounded-xl border border-[#f79193]/40 bg-[#f79193]/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Unpaid rent due in next 30 days</p>
                <p className="mt-1 text-xl font-extrabold text-[#a8434a]">R{cashFlowOverview.scheduledRent.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Reminder commitments shown separately from expense history.</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-500">{cashFlowOverview.confidenceNote} This estimate is not accounting advice, a guarantee, or a forecast of actual cash in your bank account.</p>
          </>
        )}
      </section>

      <section className="panel mb-8 p-5 sm:p-7">
        <div className="mb-4">
          <p className="eyebrow">Based on your records</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Business health alerts</h2>
          <p className="mt-1 text-sm text-gray-500">Practical checks from stock, budgets, sales trends, and invoice due dates.</p>
        </div>
        {cashFlowError ? (
          <p role="status" className="text-sm text-gray-500">Health checks need the required financial tables and migrations to be available.</p>
        ) : cashFlowOverview?.healthInsights.length ? (
          <div className="space-y-2">
            {cashFlowOverview.healthInsights.map((insight) => (
              <Link key={insight.label} href={insight.href} className={`flex flex-col gap-1 rounded-xl border p-4 transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between ${insight.tone === "warning" ? "border-[#f79193]/50 bg-[#f79193]/10" : insight.tone === "positive" ? "border-[#8ec97b]/50 bg-[#8ec97b]/15" : "border-[#246bfd]/20 bg-[#246bfd]/5"}`}>
                <span className="font-bold text-gray-900">{insight.label}</span>
                <span className="text-sm text-gray-600">{insight.detail}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p role="status" className="text-sm text-gray-500">Checking your records...</p>
        )}
      </section>

      <section className="panel mb-8 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f79193]/25 text-[#a8434a]">
              <BellRing size={20} />
            </span>
            <div>
              <p className="eyebrow">Stay ahead</p>
              <h2 className="font-bold">Rent reminders</h2>
            </div>
          </div>
          <Link href="/rent-reminders" className="text-sm font-bold text-[#246bfd] hover:underline">
            Manage reminders →
          </Link>
        </div>
        {rentReminderError ? (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Rent reminders are not available yet. Apply the `20261012050000_rent_reminders.sql` Supabase migration. {rentReminderError}
          </p>
        ) : rentReminders.length === 0 ? (
          <p className="text-sm text-gray-500">No unpaid rent reminders. Add one to see upcoming and overdue rent here.</p>
        ) : (
          <div className="space-y-2">
            {rentReminders.map((reminder) => {
              const overdue = rentReminderLabel(reminder.due_date).startsWith("Overdue")
              return (
                <Link key={reminder.id} href="/rent-reminders" className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 transition hover:border-[#246bfd]/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2 font-semibold text-gray-800">
                    <CalendarClock size={17} className={overdue ? "text-red-600" : "text-[#246bfd]"} />
                    {reminder.title} · R{Number(reminder.amount).toFixed(2)}
                  </span>
                  <span className={`text-sm font-semibold ${overdue ? "text-red-700" : "text-[#1552d8]"}`}>
                    {rentReminderLabel(reminder.due_date)} · {new Date(`${reminder.due_date}T00:00:00`).toLocaleDateString("en-ZA")}
                  </span>
                </Link>
              )
            })}
          </div>
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
          { href: "/rent-reminders", title: "Set a rent reminder", description: "See upcoming and overdue premises rent", icon: CalendarClock, tone: "bg-[#f79193]/25 text-[#a8434a]" },
          { href: "/budgets", title: "Plan a budget", description: "Set limits and watch progress", icon: WalletCards, tone: "bg-violet-50 text-violet-700" },
          { href: "/invoices", title: "Create an invoice", description: "Bill customers and save a PDF", icon: FileText, tone: "bg-amber-50 text-amber-700" },
          { href: "/payments", title: "Track a payment", description: "Record paid invoices and payment methods", icon: HandCoins, tone: "bg-indigo-50 text-indigo-700" },
          { href: "/opportunities", title: "Track an opportunity", description: "Save procurement notices and deadlines", icon: ReceiptText, tone: "bg-[#246bfd]/10 text-[#1552d8]" },
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