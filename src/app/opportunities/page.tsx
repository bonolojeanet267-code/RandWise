"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { ExternalLink, Handshake, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

type OpportunityStatus = "interested" | "applied" | "closed"

type Opportunity = {
  id: string
  title: string
  organisation: string
  sector: string | null
  closing_date: string | null
  source_url: string | null
  notes: string | null
  status: OpportunityStatus
  created_at: string
}

const statusLabels: Record<OpportunityStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  closed: "Closed",
}

function getErrorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : String(cause)
}

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [form, setForm] = useState({ title: "", organisation: "", sector: "", closingDate: "", sourceUrl: "", notes: "" })
  const [statusFilter, setStatusFilter] = useState<"all" | OpportunityStatus>("all")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadOpportunities = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("procurement_opportunities")
      .select("id,title,organisation,sector,closing_date,source_url,notes,status,created_at")
      .order("closing_date", { ascending: true, nullsFirst: false })
    if (queryError) throw new Error(`Could not load opportunities: ${queryError.message}`)
    setOpportunities((data ?? []) as Opportunity[])
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        await loadOpportunities()
      } catch (cause: unknown) {
        if (active) setError(getErrorMessage(cause))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [loadOpportunities])

  async function addOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    if (form.sourceUrl.trim()) {
      try {
        const source = new URL(form.sourceUrl.trim())
        if (source.protocol !== "http:" && source.protocol !== "https:") {
          setError("Use a secure HTTP or HTTPS link for the original notice.")
          return
        }
      } catch {
        setError("Enter a valid HTTP or HTTPS link, or leave the source link blank.")
        return
      }
    }
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from("procurement_opportunities").insert({
        title: form.title.trim(),
        organisation: form.organisation.trim(),
        sector: form.sector.trim() || null,
        closing_date: form.closingDate || null,
        source_url: form.sourceUrl.trim() || null,
        notes: form.notes.trim() || null,
      })
      if (insertError) throw new Error(`Could not save opportunity: ${insertError.message}`)
      setForm({ title: "", organisation: "", sector: "", closingDate: "", sourceUrl: "", notes: "" })
      await loadOpportunities()
      setNotice("Opportunity saved to your private tracker.")
    } catch (cause: unknown) {
      setError(getErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function updateOpportunity(id: string, update: Partial<Pick<Opportunity, "status">> | { delete: true }) {
    setError("")
    setNotice("")
    setBusyId(id)
    try {
      const query = "delete" in update
        ? await supabase.from("procurement_opportunities").delete().eq("id", id)
        : await supabase.from("procurement_opportunities").update(update).eq("id", id)
      if (query.error) throw new Error(`Could not update opportunity: ${query.error.message}`)
      await loadOpportunities()
      setNotice("Opportunity tracker updated.")
    } catch (cause: unknown) {
      setError(getErrorMessage(cause))
    } finally {
      setBusyId("")
    }
  }

  const visible = statusFilter === "all"
    ? opportunities
    : opportunities.filter((opportunity) => opportunity.status === statusFilter)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-7">
        <p className="eyebrow">Market access</p>
        <h1 className="page-title mt-1">Supplier &amp; opportunity tracker</h1>
        <p className="page-subtitle">Save procurement notices and supplier opportunities you find, then track your next step.</p>
      </header>

      <aside className="mb-6 rounded-2xl border border-[#246bfd]/20 bg-[#246bfd]/5 p-4 text-sm leading-6 text-gray-700">
        This is a private tracker, not a live or verified opportunity feed. Check every notice, eligibility rule, deadline, and supplier directly with its issuing organisation before applying.
        <div className="mt-2 flex flex-wrap gap-4">
          <a href="https://www.etenders.gov.za/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#1552d8] hover:underline">
            Visit National Treasury eTenders <ExternalLink size={14} />
          </a>
          <a href="https://secure.csd.gov.za/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#1552d8] hover:underline">
            Visit Central Supplier Database <ExternalLink size={14} />
          </a>
        </div>
      </aside>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-[#8ec97b] bg-[#8ec97b] p-3 text-sm font-semibold text-[#231934]">{notice}</p>}

      <section className="panel mb-7 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f79193]/25 text-[#a8434a]"><Handshake size={20} /></span>
          <div><h2 className="font-bold">Save an opportunity</h2><p className="text-sm text-gray-500">Only add notices you have checked yourself.</p></div>
        </div>
        <form onSubmit={addOpportunity} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Opportunity or supplier name
            <input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Local catering supply request" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Issuing organisation
            <input required maxLength={160} value={form.organisation} onChange={(event) => setForm({ ...form, organisation: event.target.value })} placeholder="Organisation or supplier" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Sector or category
            <input maxLength={120} value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} placeholder="e.g. Catering, stationery" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Closing date (if applicable)
            <input type="date" value={form.closingDate} onChange={(event) => setForm({ ...form, closingDate: event.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700 sm:col-span-2">
            Source link
            <input type="url" maxLength={2000} value={form.sourceUrl} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} placeholder="https://..." />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700 sm:col-span-2">
            Notes or eligibility checks
            <textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Note documents needed, requirements, or who to contact." />
          </label>
          <button type="submit" disabled={saving} className="primary-button inline-flex items-center justify-center gap-2 px-5 py-3 disabled:cursor-not-allowed sm:col-span-2 sm:justify-self-start">
            <Plus size={17} /> {saving ? "Saving..." : "Save to tracker"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your saved opportunities</h2>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-600">
            Show
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="w-auto">
              <option value="all">All statuses</option>
              <option value="interested">Interested</option>
              <option value="applied">Applied</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
        {loading ? (
          <p role="status" className="panel p-4 text-sm text-gray-500">Loading your tracker...</p>
        ) : visible.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">No saved opportunities here yet. Add a notice you have verified to track it privately.</p>
        ) : (
          <div className="space-y-3">
            {visible.map((opportunity) => {
              const closing = opportunity.closing_date
                ? new Date(`${opportunity.closing_date}T00:00:00`).toLocaleDateString("en-ZA")
                : "No closing date"
              const pastDeadline = opportunity.closing_date && opportunity.closing_date < new Date().toISOString().slice(0, 10)
              return (
                <article key={opportunity.id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{opportunity.title}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${opportunity.status === "applied" ? "bg-[#246bfd]/10 text-[#1552d8]" : opportunity.status === "closed" ? "bg-gray-100 text-gray-600" : "bg-[#8ec97b]/25 text-[#315526]"}`}>
                        {statusLabels[opportunity.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-gray-600">{opportunity.organisation}{opportunity.sector ? ` · ${opportunity.sector}` : ""}</p>
                    <p className={`mt-1 text-sm ${pastDeadline ? "font-semibold text-rose-700" : "text-gray-500"}`}>Closing date: {closing}{pastDeadline ? " · deadline passed" : ""}</p>
                    {opportunity.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{opportunity.notes}</p>}
                    {opportunity.source_url && (
                      <a href={opportunity.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-sm font-semibold text-[#1552d8] hover:underline">
                        Open original notice <ExternalLink size={14} className="shrink-0" />
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="sr-only" htmlFor={`status-${opportunity.id}`}>Status for {opportunity.title}</label>
                    <select id={`status-${opportunity.id}`} disabled={busyId === opportunity.id} value={opportunity.status} onChange={(event) => void updateOpportunity(opportunity.id, { status: event.target.value as OpportunityStatus })} className="w-auto">
                      <option value="interested">Interested</option>
                      <option value="applied">Applied</option>
                      <option value="closed">Closed</option>
                    </select>
                    <button type="button" disabled={busyId === opportunity.id} onClick={() => void updateOpportunity(opportunity.id, { delete: true })} aria-label={`Delete ${opportunity.title}`} title="Delete opportunity" className="rounded-lg border border-rose-200 p-2 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
