"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Boxes,
  CalendarClock,
  CircleAlert,
  FileText,
  HandCoins,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

type Sale = { total: number | string; created_at: string }
type Expense = { amount: number | string; date: string; category: string }
type Invoice = {
  id: string
  invoice_no: string
  customer_name: string
  total: number | string
  status: string
  paid_amount: number | string
  due_date: string | null
}
type Product = { id: string; name: string; qty: number; public_listed: boolean }
type Budget = { category: string; limit_amount: number | string }
type RentReminder = { id: string; title: string; amount: number | string; due_date: string }
type MonthTotal = { key: string; label: string; sales: number; expenses: number }
type CategoryTotal = { category: string; amount: number; color: string }
type HealthInsight = { label: string; detail: string; href: string; tone: "warning" | "positive" | "info" }
type GrowthAction = { title: string; detail: string; href: string; label: string }

type DashboardData = {
  sales: Sale[]
  expenses: Expense[]
  invoices: Invoice[]
  products: Product[]
  budgets: Budget[]
  rentReminders: RentReminder[]
}

const brandColors = ["#246bfd", "#f79193", "#8ec97b", "#67577f", "#80a9f7", "#c86d78"]

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function amount(value: number) {
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortAmount(value: number) {
  if (value >= 1_000_000) return `R${(value / 1_000_000).toFixed(1)}m`
  if (value >= 10_000) return `R${(value / 1_000).toFixed(0)}k`
  if (value >= 1_000) return `R${(value / 1_000).toFixed(1)}k`
  return `R${Math.round(value)}`
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function buildMonths(): MonthTotal[] {
  const now = new Date()
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
    return {
      key: monthKey(date),
      label: date.toLocaleDateString("en-ZA", { month: "short" }),
      sales: 0,
      expenses: 0,
    }
  })
}

function invoiceBalance(invoice: Invoice) {
  return Math.max(0, Number(invoice.total) - Number(invoice.paid_amount ?? 0))
}

function invoiceState(invoice: Invoice, today: string) {
  const balance = invoiceBalance(invoice)
  if (balance <= 0 || invoice.status.toLowerCase() === "paid") return "paid"
  if (invoice.due_date && invoice.due_date < today) return "overdue"
  if (Number(invoice.paid_amount) > 0 || invoice.status.toLowerCase() === "partial") return "partial"
  return "unpaid"
}

function createHealthInsights(
  products: Product[],
  expenses: Expense[],
  budgets: Budget[],
  invoices: Invoice[],
  today: string,
  monthStart: string,
  currentMonthSales: number,
  previousMonthSales: number,
): HealthInsight[] {
  const insights: HealthInsight[] = []
  const lowStock = products.filter((product) => Number(product.qty) < 5)
  if (lowStock.length) {
    insights.push({
      label: "Low stock",
      detail: `${lowStock.length} product${lowStock.length === 1 ? "" : "s"} have fewer than 5 units.`,
      href: "/inventory",
      tone: "warning",
    })
  }

  for (const budget of budgets) {
    const spent = expenses
      .filter((expense) => expense.category === budget.category && expense.date >= monthStart && expense.date <= today)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    const limit = Number(budget.limit_amount)
    if (limit <= 0 || spent / limit < 0.85) continue
    const percent = Math.round(spent / limit * 100)
    insights.push({
      label: percent >= 100 ? `${budget.category} budget exceeded` : `${budget.category} budget nearly reached`,
      detail: `${percent}% of the ${amount(limit)} monthly limit has been recorded.`,
      href: "/budgets",
      tone: "warning",
    })
  }

  const overdue = invoices.filter((invoice) => invoiceState(invoice, today) === "overdue")
  if (overdue.length) {
    insights.push({
      label: "Overdue invoices",
      detail: `${overdue.length} invoice${overdue.length === 1 ? " has" : "s have"} an unpaid balance past the due date.`,
      href: "/payments",
      tone: "warning",
    })
  }

  if (previousMonthSales > 0 && currentMonthSales < previousMonthSales * 0.85) {
    insights.push({
      label: "Sales pace is lower",
      detail: "Recorded month-to-date sales are below the previous month's total. Compare the same point in each month.",
      href: "/sales",
      tone: "info",
    })
  }

  if (!insights.length) {
    insights.push({
      label: products.length || expenses.length || invoices.length ? "No urgent alerts" : "Start recording business activity",
      detail: products.length || expenses.length || invoices.length
        ? "No low-stock, overdue-invoice, or 85% budget warnings were found in the records checked."
        : "Record sales, expenses, and stock to make your dashboard insights useful.",
      href: products.length || expenses.length || invoices.length ? "/audit" : "/sales",
      tone: products.length || expenses.length || invoices.length ? "positive" : "info",
    })
  }
  return insights
}

function createGrowthActions(data: DashboardData, today: string): GrowthAction[] {
  const actions: GrowthAction[] = []
  const overdueInvoices = data.invoices.filter((invoice) => invoiceState(invoice, today) === "overdue")
  const lowStockProducts = data.products.filter((product) => Number(product.qty) < 5)

  if (overdueInvoices.length) {
    actions.push({
      title: "Follow up on overdue invoices",
      detail: `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? " has" : "s have"} an outstanding balance past its due date.`,
      href: "/payments",
      label: "Review payments",
    })
  }

  if (lowStockProducts.length) {
    actions.push({
      title: "Review stock before your next sale",
      detail: `${lowStockProducts.length} product${lowStockProducts.length === 1 ? " has" : "s have"} fewer than 5 units recorded.`,
      href: "/inventory",
      label: "Review stock",
    })
  }

  if (!data.products.length) {
    actions.push({
      title: "Set up your product list",
      detail: "Add products and prices to start tracking stock and recording sales.",
      href: "/inventory",
      label: "Add products",
    })
  } else if (!data.sales.length && data.products.some((product) => Number(product.qty) > 0)) {
    actions.push({
      title: "Record your first sale",
      detail: "Use recorded sales to build a clearer picture of trading activity.",
      href: "/sales",
      label: "Record a sale",
    })
  }

  if (!data.expenses.length) {
    actions.push({
      title: "Start recording business costs",
      detail: "Log expenses to compare money going out with recorded sales.",
      href: "/expenses",
      label: "Add an expense",
    })
  }

  const outstandingInvoices = data.invoices.filter((invoice) => invoiceBalance(invoice) > 0)
  if (!overdueInvoices.length && outstandingInvoices.length) {
    actions.push({
      title: "Check customer balances",
      detail: `${outstandingInvoices.length} invoice${outstandingInvoices.length === 1 ? " has" : "s have"} a balance still to track.`,
      href: "/payments",
      label: "Track payments",
    })
  } else if (!data.invoices.length) {
    actions.push({
      title: "Create a customer invoice",
      detail: "Add due dates and track what customers still owe.",
      href: "/invoices",
      label: "Create invoice",
    })
  }

  if (data.products.length && !data.products.some((product) => product.public_listed)) {
    actions.push({
      title: "Help nearby customers find your products",
      detail: "Choose which in-stock products to share in the public customer directory.",
      href: "/inventory",
      label: "Choose products",
    })
  }

  if (!data.budgets.length) {
    actions.push({
      title: "Set a spending limit",
      detail: "Create a category budget to spot costs approaching your limit.",
      href: "/budgets",
      label: "Set a budget",
    })
  }

  if (!actions.length) {
    actions.push({
      title: "Prepare your records for the next opportunity",
      detail: "Review your funding-readiness checklist and save opportunities to follow up.",
      href: "/funding",
      label: "Review readiness",
    })
  }

  return actions.slice(0, 4)
}

function ExpenseDonut({ categories, total }: { categories: CategoryTotal[]; total: number }) {
  const slices = categories.filter((category) => category.amount > 0)
  const { stops } = slices.reduce<{ progress: number; stops: string[] }>(
    (result, slice) => {
      const end = result.progress + slice.amount / Math.max(total, 1) * 100
      return { progress: end, stops: [...result.stops, `${slice.color} ${result.progress}% ${end}%`] }
    },
    { progress: 0, stops: [] },
  )
  const style = {
    background: stops.length
      ? `conic-gradient(${stops.join(", ")})`
      : "conic-gradient(#e9e5ed 0% 100%)",
  }

  return (
    <div
      role="img"
      aria-label={slices.length ? `Expense breakdown totalling ${amount(total)}` : "No recorded expenses this month"}
      className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full"
      style={style}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white text-center">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Expenses</span>
        <span className="mt-1 max-w-[5.5rem] truncate text-sm font-extrabold text-[#231934]">{shortAmount(total)}</span>
      </div>
    </div>
  )
}

function CashFlowChart({ months }: { months: MonthTotal[] }) {
  const max = Math.max(1, ...months.flatMap((month) => [month.sales, month.expenses]))
  const lines = [32, 76, 120, 164]
  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Monthly recorded sales and expenses for the last twelve months"
        viewBox="0 0 850 225"
        className="min-w-[690px] w-full"
      >
        {lines.map((y, index) => (
          <g key={y}>
            <line x1="54" x2="838" y1={y} y2={y} stroke="#e9e5ed" strokeDasharray="3 5" />
            <text x="46" y={y + 4} textAnchor="end" fill="#81778d" fontSize="10">
              {shortAmount(max * (lines.length - 1 - index) / (lines.length - 1))}
            </text>
          </g>
        ))}
        {months.map((month, index) => {
          const x = 72 + index * 64
          const saleHeight = month.sales ? Math.max(3, month.sales / max * 142) : 0
          const expenseHeight = month.expenses ? Math.max(3, month.expenses / max * 142) : 0
          return (
            <g key={month.key}>
              <rect x={x} y={176 - saleHeight} width="19" height={saleHeight} rx="4" fill="#246bfd">
                <title>{`${month.label} sales: ${amount(month.sales)}`}</title>
              </rect>
              <rect x={x + 23} y={176 - expenseHeight} width="19" height={expenseHeight} rx="4" fill="#f79193">
                <title>{`${month.label} expenses: ${amount(month.expenses)}`}</title>
              </rect>
              <text x={x + 21} y="199" textAnchor="middle" fill="#756b81" fontSize="10" fontWeight="600">{month.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    sales: [],
    expenses: [],
    invoices: [],
    products: [],
    budgets: [],
    rentReminders: [],
  })
  const [loading, setLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState("")
  const [rentReminderError, setRentReminderError] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      const [salesResult, expenseResult, invoiceResult, productResult, budgetResult, rentResult] = await Promise.all([
        supabase.from("sales").select("total,created_at"),
        supabase.from("expenses").select("amount,date,category"),
        supabase.from("invoices").select("id,invoice_no,customer_name,total,status,paid_amount,due_date"),
        supabase.from("products").select("id,name,qty,public_listed").order("qty", { ascending: true }),
        supabase.from("budgets").select("category,limit_amount"),
        supabase.from("rent_reminders").select("id,title,amount,due_date").is("paid_at", null).order("due_date", { ascending: true }).limit(5),
      ])
      if (!active) return

      const failed = [salesResult, expenseResult, invoiceResult, productResult, budgetResult].find((result) => result.error)
      if (failed?.error) {
        setDashboardError(`Could not load business analytics: ${failed.error.message}`)
        setLoading(false)
        return
      }
      if (rentResult.error) setRentReminderError(`Could not load rent reminders: ${rentResult.error.message}`)

      setData({
        sales: salesResult.data ?? [],
        expenses: expenseResult.data ?? [],
        invoices: (invoiceResult.data ?? []) as Invoice[],
        products: (productResult.data ?? []) as Product[],
        budgets: budgetResult.data ?? [],
        rentReminders: (rentResult.data ?? []) as RentReminder[],
      })
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  const now = new Date()
  const today = dateKey(now)
  const thisMonthKey = monthKey(now)
  const monthStart = `${thisMonthKey}-01`
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthKey = monthKey(previousMonthDate)
  const previousMonthStart = `${previousMonthKey}-01`
  const previousMonthEnd = dateKey(new Date(now.getFullYear(), now.getMonth(), 0))
  const monthLabel = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })

  const currentMonthSalesRows = data.sales.filter((sale) => dateKey(new Date(sale.created_at)) >= monthStart && dateKey(new Date(sale.created_at)) <= today)
  const currentMonthExpenseRows = data.expenses.filter((expense) => expense.date >= monthStart && expense.date <= today)
  const previousMonthSales = data.sales
    .filter((sale) => {
      const key = dateKey(new Date(sale.created_at))
      return key >= previousMonthStart && key <= previousMonthEnd
    })
    .reduce((sum, sale) => sum + Number(sale.total), 0)
  const currentSales = currentMonthSalesRows.reduce((sum, sale) => sum + Number(sale.total), 0)
  const currentExpenses = currentMonthExpenseRows.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const netProfit = currentSales - currentExpenses
  const margin = currentSales > 0 ? netProfit / currentSales * 100 : 0

  const categoryMap = new Map<string, number>()
  for (const expense of currentMonthExpenseRows) {
    categoryMap.set(expense.category || "Other", (categoryMap.get(expense.category || "Other") ?? 0) + Number(expense.amount))
  }
  const expenseCategories: CategoryTotal[] = [...categoryMap.entries()]
    .map(([category, categoryAmount], index) => ({ category, amount: categoryAmount, color: brandColors[index % brandColors.length] }))
    .sort((a, b) => b.amount - a.amount)

  const currentBudgetLimit = data.budgets.reduce((sum, budget) => sum + Number(budget.limit_amount), 0)
  const budgetPercent = currentBudgetLimit > 0 ? currentExpenses / currentBudgetLimit * 100 : 0
  const overBudgetCategories = data.budgets.filter((budget) => {
    const spent = currentMonthExpenseRows
      .filter((expense) => expense.category === budget.category)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
    return Number(budget.limit_amount) > 0 && spent / Number(budget.limit_amount) >= 0.85
  })

  const invoiceStates = data.invoices.map((invoice) => ({ invoice, state: invoiceState(invoice, today) }))
  const paidInvoices = invoiceStates.filter((entry) => entry.state === "paid")
  const partialInvoices = invoiceStates.filter((entry) => entry.state === "partial")
  const overdueInvoices = invoiceStates.filter((entry) => entry.state === "overdue")
  const unpaidInvoices = invoiceStates.filter((entry) => entry.state === "unpaid")
  const invoiceValue = data.invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0)
  const paidValue = paidInvoices.reduce((sum, entry) => sum + Number(entry.invoice.total), 0)
  const overdueValue = overdueInvoices.reduce((sum, entry) => sum + invoiceBalance(entry.invoice), 0)
  const outstandingValue = data.invoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)
  const lowStockProducts = data.products.filter((product) => Number(product.qty) < 5)

  const months = buildMonths()
  const monthTotals = new Map(months.map((month) => [month.key, month]))
  for (const sale of data.sales) {
    const month = monthTotals.get(monthKey(new Date(sale.created_at)))
    if (month) month.sales += Number(sale.total)
  }
  for (const expense of data.expenses) {
    const month = monthTotals.get(expense.date.slice(0, 7))
    if (month) month.expenses += Number(expense.amount)
  }
  const chartMonths = months
  const last30Start = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29))
  const last30Sales = data.sales
    .filter((sale) => dateKey(new Date(sale.created_at)) >= last30Start && dateKey(new Date(sale.created_at)) <= today)
    .reduce((sum, sale) => sum + Number(sale.total), 0)
  const last30Expenses = data.expenses
    .filter((expense) => expense.date >= last30Start && expense.date <= today)
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
  const projectedSales = last30Sales > 0 ? last30Sales : null
  const projectedExpenses = last30Expenses > 0 ? last30Expenses : null
  const forecastNet = projectedSales !== null && projectedExpenses !== null ? projectedSales - projectedExpenses : null
  const receivablesDueSoon = data.invoices
    .filter((invoice) => invoice.due_date && invoice.due_date >= today && invoice.due_date <= dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)))
    .reduce((sum, invoice) => sum + invoiceBalance(invoice), 0)
  const rentDueSoon = data.rentReminders
    .filter((reminder) => reminder.due_date >= today && reminder.due_date <= dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)))
    .reduce((sum, reminder) => sum + Number(reminder.amount), 0)
  const insights = createHealthInsights(
    data.products,
    data.expenses,
    data.budgets,
    data.invoices,
    today,
    monthStart,
    currentSales,
    previousMonthSales,
  )
  const growthActions = createGrowthActions(data, today)

  const quickLinks = [
    { href: "/sales", title: "Add income", detail: "Record a sale", icon: ArrowUpRight },
    { href: "/expenses", title: "Add expense", detail: "Log a business cost", icon: ArrowDownLeft },
    { href: "/invoices", title: "Manage invoices", detail: `${data.invoices.length} total`, icon: FileText },
    { href: "/inventory", title: "Update stock", detail: `${lowStockProducts.length} low-stock alert${lowStockProducts.length === 1 ? "" : "s"}`, icon: Boxes },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Small business growth companion</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Your growth hub</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">Turn everyday business records into practical next steps—from getting started to reaching new customers.</p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white">
          Month to date <span className="ml-2 text-white/70">{monthLabel}</span>
        </div>
      </header>

      {dashboardError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{dashboardError}</p>}

      <section aria-label="Business growth pathway" className="panel mb-4 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wide text-[#1552d8]">One connected journey</p>
          <h2 className="mt-1 text-lg font-bold text-[#231934]">From first steps to formal markets</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">Use RandWise to build records, get paid, reach customers and prepare to grow.</p>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
          {[
            { number: "01", title: "Start", detail: "Setup checklist and official links", href: "/start" },
            { number: "02", title: "Trade", detail: "Products, stock, sales and costs", href: "/inventory" },
            { number: "03", title: "Get paid", detail: "Invoices and payment tracking", href: "/payments" },
            { number: "04", title: "Reach customers", detail: "Share selected products locally", href: "/inventory" },
            { number: "05", title: "Grow", detail: "Funding readiness and opportunities", href: "/funding" },
          ].map((step) => (
            <Link key={step.number} href={step.href} className="group rounded-xl border border-gray-100 p-3 transition hover:-translate-y-0.5 hover:border-[#246bfd]/30 hover:bg-[#246bfd]/5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#246bfd]/10 text-[11px] font-extrabold text-[#1552d8]">{step.number}</span>
              <span className="mt-2 flex items-center justify-between gap-2 text-sm font-bold text-[#231934]">
                {step.title}<ArrowRight size={14} className="shrink-0 text-[#1552d8] transition group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-xs leading-5 text-gray-500">{step.detail}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Next actions and safe trading guidance" className="mb-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Based on your records</p>
              <h2 className="mt-1 text-lg font-bold text-[#231934]">Practical next steps</h2>
            </div>
            <span className="rounded-full bg-[#246bfd]/10 px-3 py-1 text-[11px] font-bold text-[#1552d8]">No AI guesswork</span>
          </div>
          {loading ? (
            <p role="status" className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Reviewing your business records...</p>
          ) : (
            <div className="space-y-2">
              {growthActions.map((action) => (
                <div key={action.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#231934]">{action.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{action.detail}</p>
                  </div>
                  <Link href={action.href} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#246bfd]/10 px-3 py-2 text-xs font-bold text-[#1552d8] hover:bg-[#246bfd]/15">
                    {action.label}<ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-5 text-gray-400">Suggestions use the business records you have entered. Review them and decide what is right for your business.</p>
        </article>

        <article className="rounded-[1.25rem] border border-[#8ec97b]/30 bg-[#8ec97b]/10 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#315526]"><ShieldCheck size={19} /></span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#426b38]">Protect your business</p>
              <h2 className="mt-0.5 text-lg font-bold text-[#231934]">Safer ways to trade</h2>
            </div>
          </div>
          <ul className="space-y-2 text-xs leading-5 text-gray-700">
            <li className="rounded-lg bg-white/75 p-3">Confirm a payment in your bank or payment app before recording it as received; do not rely on a screenshot alone.</li>
            <li className="rounded-lg bg-white/75 p-3">Verify supplier bank-detail changes using a contact method you already trust.</li>
            <li className="rounded-lg bg-white/75 p-3">Use a unique password for your account and sign out on shared devices.</li>
          </ul>
          <Link href="/services" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#315526] hover:underline">Find local IT support<ArrowRight size={13} /></Link>
        </article>
      </section>

      <section aria-label="Lean business improvement practices" className="panel mb-4 p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Build lean, improve as you go</p>
          <h2 className="mt-1 text-lg font-bold text-[#231934]">Small improvements that make work easier</h2>
          <p className="mt-1 text-sm leading-5 text-gray-500">Use the tools and support that fit your business now. Review what works as the business changes.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-xl bg-[#246bfd]/5 p-4">
            <h3 className="text-sm font-bold text-[#231934]">Keep one useful record</h3>
            <p className="mt-1 text-xs leading-5 text-gray-600">Start with sales, costs and stock you can act on. Regular records make patterns easier to spot without needing expensive software.</p>
            <Link href="/audit" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1552d8] hover:underline">Review activity<ArrowRight size={13} /></Link>
          </article>
          <article className="rounded-xl bg-[#f79193]/10 p-4">
            <h3 className="text-sm font-bold text-[#231934]">Improve one repeated task</h3>
            <p className="mt-1 text-xs leading-5 text-gray-600">Notice a process that takes too long, ask customers or your team what could be simpler, then try one small change and review the result.</p>
            <Link href="/discover" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1552d8] hover:underline">Explore customer view<ArrowRight size={13} /></Link>
          </article>
          <article className="rounded-xl bg-[#8ec97b]/10 p-4">
            <h3 className="text-sm font-bold text-[#231934]">Get help where it counts</h3>
            <p className="mt-1 text-xs leading-5 text-gray-600">Focus your time on what your business does best. Explore local IT support for practical setup, training or data help.</p>
            <Link href="/services" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#315526] hover:underline">Browse IT support<ArrowRight size={13} /></Link>
          </article>
        </div>
      </section>

      <section aria-label="Business overview" className="mb-4 grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr]">
        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Net profit · month to date</p>
              <p className={`mt-2 text-3xl font-extrabold tracking-tight ${netProfit < 0 ? "text-[#a8434a]" : "text-[#231934]"}`}>{loading ? "—" : amount(netProfit)}</p>
              <p className={`mt-1 text-xs font-bold ${margin < 0 ? "text-[#a8434a]" : "text-[#426b38]"}`}>{currentSales > 0 ? `${margin.toFixed(1)}% recorded margin` : "Add sales to calculate a margin"}</p>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#246bfd]/10 text-[#246bfd]"><WalletCards size={21} /></span>
          </div>
          <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Recorded sales</span><strong className="text-[#1552d8]">{loading ? "—" : amount(currentSales)}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Recorded expenses</span><strong className="text-[#a8434a]">{loading ? "—" : amount(currentExpenses)}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Outstanding invoices</span><strong className="text-[#231934]">{loading ? "—" : amount(outstandingValue)}</strong></div>
          </div>
          <Link href="/funding" className="mt-4 inline-flex text-xs font-bold text-[#1552d8] hover:underline">View business summary →</Link>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Expense breakdown</p><h2 className="mt-1 text-sm font-bold text-[#231934]">{monthLabel}</h2></div>
            <Link href="/expenses" className="text-xs font-bold text-[#1552d8] hover:underline">View expenses</Link>
          </div>
          <div className="flex items-center gap-5">
            <ExpenseDonut categories={expenseCategories} total={currentExpenses} />
            <div className="min-w-0 flex-1 space-y-2">
              {expenseCategories.length ? expenseCategories.slice(0, 4).map((category) => (
                <div key={category.category} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-gray-600">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: category.color }} />
                    <span className="truncate">{category.category}</span>
                  </span>
                  <strong className="shrink-0 text-[#231934]">{Math.round(category.amount / Math.max(currentExpenses, 1) * 100)}%</strong>
                </div>
              )) : <p className="text-xs leading-5 text-gray-500">Record expenses to see your spending mix.</p>}
              {expenseCategories.length > 4 && <p className="text-[11px] text-gray-400">+{expenseCategories.length - 4} more categories</p>}
            </div>
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Monthly budget</p><h2 className="mt-1 text-sm font-bold text-[#231934]">Spending progress</h2></div>
            {data.budgets.length > 0 && <Link href="/budgets" className="rounded-lg border border-[#246bfd]/30 px-2.5 py-1.5 text-xs font-bold text-[#1552d8] hover:bg-[#246bfd]/5">Update budget</Link>}
          </div>
          {currentBudgetLimit > 0 ? (
            <>
              <div className="mb-2 flex items-end justify-between gap-2">
                <span className="text-2xl font-extrabold text-[#231934]">{amount(currentExpenses)}</span>
                <span className="text-xs text-gray-500">of {amount(currentBudgetLimit)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-[#231934]/10">
                <div className={`h-full rounded-full transition-all ${budgetPercent >= 100 ? "bg-[#f79193]" : budgetPercent >= 85 ? "bg-[#f79193]" : "bg-[#246bfd]"}`} style={{ width: `${Math.min(100, budgetPercent)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className={budgetPercent >= 85 ? "font-bold text-[#a8434a]" : "text-gray-500"}>{budgetPercent.toFixed(0)}% used</span>
                <span className="text-gray-500">{amount(Math.max(0, currentBudgetLimit - currentExpenses))} remaining</span>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-[#246bfd]/5 p-4">
              <p className="text-sm font-semibold text-[#231934]">No spending limits yet</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">Set category limits to compare planned and recorded costs.</p>
              {data.budgets.length === 0 && <Link href="/budgets" className="mt-3 inline-flex text-xs font-bold text-[#1552d8] hover:underline">Set a budget →</Link>}
            </div>
          )}
          {overBudgetCategories.length > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#a8434a]"><CircleAlert size={14} />{overBudgetCategories.length} category limit alert{overBudgetCategories.length === 1 ? "" : "s"}</p>}
        </article>
      </section>

      <section aria-label="Invoice and stock summary" className="mb-4 grid gap-4 xl:grid-cols-2">
        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Receivables</p><h2 className="mt-1 text-lg font-bold text-[#231934]">Invoices</h2></div>
            <Link href="/invoices" className="text-xs font-bold text-[#1552d8] hover:underline">View invoices →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Total value", value: invoiceValue, count: data.invoices.length, color: "bg-[#8ec97b]/20 text-[#315526]" },
              { label: "Paid", value: paidValue, count: paidInvoices.length, color: "bg-[#246bfd]/10 text-[#1552d8]" },
              { label: "Partial", value: partialInvoices.reduce((sum, entry) => sum + Number(entry.invoice.paid_amount), 0), count: partialInvoices.length, color: "bg-[#f79193]/20 text-[#8e3f48]" },
              { label: "Overdue", value: overdueValue + unpaidInvoices.filter((entry) => entry.invoice.due_date && entry.invoice.due_date < today).reduce((sum, entry) => sum + invoiceBalance(entry.invoice), 0), count: overdueInvoices.length, color: "bg-[#231934]/10 text-[#231934]" },
            ].map((tile) => (
              <div key={tile.label} className={`rounded-xl p-3 ${tile.color}`}>
                <p className="text-[11px] font-semibold">{tile.label}</p>
                <p className="mt-1 text-sm font-extrabold">{amount(tile.value)}</p>
                <p className="mt-1 text-[10px] opacity-75">{tile.count} invoice{tile.count === 1 ? "" : "s"}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs">
            <span className="text-gray-500">Remaining customer balances</span>
            <strong className="text-[#231934]">{amount(outstandingValue)}</strong>
            <Link href="/payments" className="font-bold text-[#1552d8] hover:underline">Track payments →</Link>
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory</p><h2 className="mt-1 text-lg font-bold text-[#231934]">Stock alerts</h2></div>
            <Link href="/inventory" className="text-xs font-bold text-[#1552d8] hover:underline">View inventory →</Link>
          </div>
          {lowStockProducts.length ? (
            <div className="divide-y divide-gray-100">
              {lowStockProducts.slice(0, 4).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f79193]/20 text-[#a8434a]"><Boxes size={16} /></span>
                    <span className="truncate text-sm font-semibold text-[#231934]">{product.name}</span>
                  </div>
                  <span className="shrink-0 text-right">
                    <strong className="block text-xs text-[#a8434a]">{product.qty} left</strong>
                    <Link href="/inventory" className="text-[10px] font-bold text-[#1552d8] hover:underline">Restock</Link>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-28 items-center gap-3 rounded-xl bg-[#8ec97b]/10 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8ec97b]/25 text-[#315526]"><Boxes size={20} /></span>
              <div><p className="text-sm font-bold text-[#231934]">{data.products.length ? "No low-stock alerts" : "No products recorded yet"}</p><p className="mt-1 text-xs text-gray-500">{data.products.length ? "Products below 5 units will appear here." : "Add products to start monitoring stock."}</p></div>
            </div>
          )}
        </article>
      </section>

      <section aria-label="Cash-flow analysis" className="mb-4 grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="panel min-w-0 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Financial trend</p>
              <h2 className="mt-1 text-lg font-bold text-[#231934]">Cash-flow trend</h2>
              <p className="mt-1 text-xs text-gray-500">Recorded income and expenses · last 12 months</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-gray-600">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#246bfd]" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#f79193]" />Expenses</span>
            </div>
          </div>
          <CashFlowChart months={chartMonths} />
          <div className="mt-2 grid gap-2 border-t border-gray-100 pt-3 text-xs sm:grid-cols-3">
            <div><p className="text-gray-500">Month-to-date income</p><strong className="mt-1 block text-sm text-[#1552d8]">{amount(currentSales)}</strong></div>
            <div><p className="text-gray-500">Month-to-date expenses</p><strong className="mt-1 block text-sm text-[#a8434a]">{amount(currentExpenses)}</strong></div>
            <div><p className="text-gray-500">Month-to-date net</p><strong className={`mt-1 block text-sm ${netProfit < 0 ? "text-[#a8434a]" : "text-[#231934]"}`}>{amount(netProfit)}</strong></div>
          </div>
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plan ahead</p><h2 className="mt-1 text-lg font-bold text-[#231934]">Next 30 days</h2></div>
            <Link href="/payments" aria-label="Review payment tracking" className="rounded-lg bg-[#246bfd]/10 p-2 text-[#1552d8] hover:bg-[#246bfd]/15"><CalendarClock size={17} /></Link>
          </div>
          <div className={`rounded-2xl p-4 text-white ${forecastNet !== null && forecastNet < 0 ? "bg-[#8e3f48]" : "bg-[#231934]"}`}>
            <p className="text-xs font-semibold text-white/75">Estimated net run-rate</p>
            <p className="mt-1 text-2xl font-extrabold">{forecastNet === null ? "More records needed" : amount(forecastNet)}</p>
            <p className="mt-1 text-[11px] leading-5 text-white/75">Uses the last 30 days of recorded sales and expenses. Not a bank balance.</p>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#246bfd]/5 p-3">
              <span className="text-xs text-gray-600">Unpaid invoices due</span><strong className="text-sm text-[#1552d8]">{amount(receivablesDueSoon)}</strong>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#f79193]/10 p-3">
              <span className="text-xs text-gray-600">Unpaid rent reminders</span><strong className="text-sm text-[#a8434a]">{amount(rentDueSoon)}</strong>
            </div>
          </div>
          <Link href="/rent-reminders" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1552d8] hover:underline"><BellRing size={14} />Manage rent reminders</Link>
        </article>
      </section>

      <section className="mb-4 grid gap-4 xl:grid-cols-[1fr_1.25fr]">
        <article className="panel p-5 sm:p-6">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Business health</p>
            <h2 className="mt-1 text-lg font-bold text-[#231934]">Items to review</h2>
          </div>
          <div className="space-y-2">
            {insights.slice(0, 3).map((insight) => (
              <Link key={insight.label} href={insight.href} className={`block rounded-xl border p-3 transition hover:-translate-y-0.5 ${insight.tone === "warning" ? "border-[#f79193]/40 bg-[#f79193]/10" : insight.tone === "positive" ? "border-[#8ec97b]/40 bg-[#8ec97b]/10" : "border-[#246bfd]/20 bg-[#246bfd]/5"}`}>
                <p className="text-xs font-bold text-[#231934]">{insight.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-600">{insight.detail}</p>
              </Link>
            ))}
          </div>
          {rentReminderError && <p role="alert" className="mt-3 text-xs text-[#a8434a]">{rentReminderError}</p>}
        </article>

        <article className="panel p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Get things done</p><h2 className="mt-1 text-lg font-bold text-[#231934]">Quick actions</h2></div>
            <Link href="/opportunities" className="text-xs font-bold text-[#1552d8] hover:underline">Market opportunities →</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {quickLinks.map(({ href, title, detail, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:-translate-y-0.5 hover:border-[#246bfd]/30 hover:bg-[#246bfd]/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#246bfd]/10 text-[#1552d8]"><Icon size={18} /></span>
                <span className="min-w-0"><strong className="block text-xs text-[#231934]">{title}</strong><span className="mt-0.5 block truncate text-[10px] text-gray-500">{detail}</span></span>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-xs">
            <Link href="/funding" className="inline-flex items-center gap-1 font-semibold text-[#1552d8] hover:underline"><FileText size={14} /> Funding readiness</Link>
            <Link href="/services" className="inline-flex items-center gap-1 font-semibold text-[#1552d8] hover:underline"><HandCoins size={14} /> Local IT support</Link>
            <Link href="/discover" className="inline-flex items-center gap-1 font-semibold text-[#1552d8] hover:underline"><ReceiptText size={14} /> Customer product search</Link>
          </div>
        </article>
      </section>

      <p className="px-1 pb-3 text-[11px] leading-5 text-white/60">
        Analytics are calculated from records entered in RandWise. They are operational summaries, not audited accounts or a promise of future cash flow.
      </p>
    </main>
  )
}
