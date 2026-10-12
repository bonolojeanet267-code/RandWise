"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { BellRing, CalendarClock, Check, CircleAlert, RotateCcw } from "lucide-react"
import { supabase } from "@/lib/supabase"

type RentReminder = {
  id: string
  title: string
  amount: number | string
  due_date: string
  paid_at: string | null
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function daysUntil(dueDate: string) {
  const [year, month, day] = dueDate.split("-").map(Number)
  const [todayYear, todayMonth, todayDay] = localDateKey(new Date()).split("-").map(Number)
  const dueUtc = Date.UTC(year, month - 1, day)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  return Math.round((dueUtc - todayUtc) / 86_400_000)
}

function dueLabel(dueDate: string) {
  const days = daysUntil(dueDate)
  if (days < 0) return `Overdue by ${Math.abs(days)} day${days === -1 ? "" : "s"}`
  if (days === 0) return "Due today"
  if (days <= 7) return `Due in ${days} day${days === 1 ? "" : "s"}`
  return "Upcoming"
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

export default function RentRemindersClient() {
  const [reminders, setReminders] = useState<RentReminder[]>([])
  const [title, setTitle] = useState("Premises rent")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadReminders = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("rent_reminders")
      .select("id,title,amount,due_date,paid_at")
      .order("due_date", { ascending: true })

    if (queryError) throw new Error(`Could not load rent reminders: ${queryError.message}`)
    setReminders(data ?? [])
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadReminders()
      } catch (cause: unknown) {
        if (active) setError(errorMessage(cause))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [loadReminders])

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    setSaving(true)

    try {
      const { error: insertError } = await supabase.from("rent_reminders").insert({
        title: title.trim(),
        amount: Number(amount),
        due_date: dueDate,
      })
      if (insertError) throw new Error(`Could not save rent reminder: ${insertError.message}`)

      setTitle("Premises rent")
      setAmount("")
      setDueDate("")
      await loadReminders()
      setNotice("Rent reminder saved. It will appear on your dashboard when you sign in.")
    } catch (cause: unknown) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function setPaid(reminder: RentReminder, paid: boolean) {
    setError("")
    setNotice("")
    setSavingId(reminder.id)
    try {
      const { error: updateError } = await supabase
        .from("rent_reminders")
        .update({ paid_at: paid ? new Date().toISOString() : null })
        .eq("id", reminder.id)
      if (updateError) throw new Error(`Could not update rent reminder: ${updateError.message}`)

      await loadReminders()
      setNotice(paid ? "Rent marked as paid." : "Rent marked as unpaid.")
    } catch (cause: unknown) {
      setError(errorMessage(cause))
    } finally {
      setSavingId("")
    }
  }

  const outstanding = reminders.filter((reminder) => !reminder.paid_at)
  const completed = reminders.filter((reminder) => reminder.paid_at)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-7">
        <p className="eyebrow">Business expenses</p>
        <h1 className="page-title mt-1">Rent &amp; bills</h1>
        <p className="page-subtitle">
          Keep your business premises rent due date visible and mark it paid when you have settled it.
        </p>
      </header>

      <section className="panel mb-7 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f79193]/25 text-[#a8434a]">
            <CalendarClock size={22} />
          </span>
          <div>
            <h2 className="font-bold">Add a rent reminder</h2>
            <p className="text-sm text-gray-500">Enter one due date at a time. Add the next month when needed.</p>
          </div>
        </div>
        <form onSubmit={createReminder} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Reminder name
            <input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Amount (R)
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 4500.00" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Due date
            <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <button type="submit" disabled={saving} className="primary-button px-5 py-3 disabled:cursor-not-allowed">
            {saving ? "Saving..." : "Add reminder"}
          </button>
        </form>
      </section>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error.includes("rent_reminders")
            ? "Rent reminders are not set up in this Supabase project yet. Apply the 20261012050000_rent_reminders.sql migration, then reload this page. "
            : ""}
          {error}
        </p>
      )}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#8ec97b]/60 bg-[#8ec97b]/20 p-3 text-sm text-[#27491d]">{notice}</p>}

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <BellRing size={19} className="text-[#246bfd]" />
          <h2 className="text-lg font-bold">Upcoming and overdue</h2>
        </div>
        {loading ? (
          <p role="status" className="panel p-4 text-sm text-gray-500">Loading rent reminders...</p>
        ) : outstanding.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">No unpaid rent reminders. Add one above to see its due status here and on your dashboard.</p>
        ) : (
          <div className="space-y-3">
            {outstanding.map((reminder) => {
              const overdue = daysUntil(reminder.due_date) < 0
              return (
                <article key={reminder.id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overdue ? "bg-red-50 text-red-700" : "bg-[#246bfd]/10 text-[#246bfd]"}`}>
                      {overdue ? <CircleAlert size={20} /> : <CalendarClock size={20} />}
                    </span>
                    <div>
                      <p className="font-bold">{reminder.title}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        R{Number(reminder.amount).toFixed(2)} · Due {new Date(`${reminder.due_date}T00:00:00`).toLocaleDateString("en-ZA")}
                      </p>
                      <p className={`mt-1 text-sm font-semibold ${overdue ? "text-red-700" : "text-[#1552d8]"}`}>{dueLabel(reminder.due_date)}</p>
                    </div>
                  </div>
                  <button type="button" disabled={savingId === reminder.id} onClick={() => void setPaid(reminder, true)} className="primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:cursor-not-allowed">
                    <Check size={16} /> {savingId === reminder.id ? "Saving..." : "Mark paid"}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Marked as paid</h2>
          <div className="space-y-2">
            {completed.map((reminder) => (
              <article key={reminder.id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{reminder.title} <span className="font-normal text-gray-500">· R{Number(reminder.amount).toFixed(2)}</span></p>
                  <p className="text-sm text-gray-500">Due {new Date(`${reminder.due_date}T00:00:00`).toLocaleDateString("en-ZA")}</p>
                </div>
                <button type="button" disabled={savingId === reminder.id} onClick={() => void setPaid(reminder, false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#246bfd]/25 px-3 py-2 text-sm font-semibold text-[#1552d8] hover:bg-[#246bfd]/5 disabled:cursor-not-allowed">
                  <RotateCcw size={15} /> Mark unpaid
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="mt-7 rounded-xl border border-[#246bfd]/20 bg-[#246bfd]/5 p-4 text-sm leading-6 text-gray-600">
        These are in-app reminders shown when you open RandWise. They do not send SMS, email, or push notifications, and they do not automatically create expense records.
      </p>
    </main>
  )
}
