"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Code2, Database, GraduationCap, MapPin, MessageCircle, MonitorCog } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Provider = {
  id: string
  company_name: string
  services: string[] | null
  location: string | null
  price_from: number | string | null
  whatsapp: string | null
  verified: boolean
  bio: string | null
}

const supportOptions = [
  { title: "Websites & catalogues", detail: "Get help setting up a simple online presence.", icon: Code2 },
  { title: "POS & equipment", detail: "Support for point-of-sale systems and printers.", icon: MonitorCog },
  { title: "Data & training", detail: "Organise business information and build digital skills.", icon: Database },
]

export default function Services() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    async function loadProviders() {
      const { data, error: queryError } = await supabase
        .from("it_providers")
        .select("id,company_name,services,location,price_from,whatsapp,verified,bio")

      if (!active) return
      if (queryError) {
        setError(`Could not load IT support providers: ${queryError.message}`)
        setLoading(false)
        return
      }

      setProviders((data ?? []) as Provider[])
      setLoading(false)
    }

    void loadProviders()
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-10 grid items-center gap-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#2d2141] p-5 text-white shadow-xl shadow-black/10 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-5 lg:p-10">
        <div className="max-w-xl py-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f79193]">RandWise Connect</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">The right digital support, for your next step.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/70 sm:text-base">
            Find practical help with websites, business technology and digital skills—so you can spend more time growing your business.
          </p>
          <Link href="/request-help" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#246bfd] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1552d8]">
            Tell us what you need <ArrowRight size={16} />
          </Link>
          <p className="mt-3 text-xs text-white/45">Describe the support you need. You stay in control of what happens next.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[35rem]">
          <Image
            src="/randwise-it-support.svg"
            alt="Illustration of a small business owner working on a laptop with coding and digital support tools"
            width={960}
            height={640}
            priority
            className="h-auto w-full"
          />
        </div>
      </section>

      <section aria-labelledby="support-options-title" className="mb-10">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f79193]">Support that fits your business</p>
          <h2 id="support-options-title" className="mt-1 text-xl font-bold text-white">What can you get help with?</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {supportOptions.map(({ title, detail, icon: Icon }) => (
            <article key={title} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#246bfd]/15 text-blue-200">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/60">{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="providers-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f79193]">Local connections</p>
            <h2 id="providers-title" className="mt-1 text-xl font-bold text-white">IT support providers</h2>
          </div>
          <Link href="/request-help" className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-200 hover:text-white">
            Request support <ArrowRight size={15} />
          </Link>
        </div>

        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
        {loading ? (
          <p role="status" className="rounded-xl border border-white/10 bg-white/[0.06] p-5 text-sm text-white/60">Loading local providers...</p>
        ) : !error && providers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 sm:p-6">
            <p className="font-semibold text-white">No providers are listed yet.</p>
            <p className="mt-1 text-sm leading-6 text-white/60">You can still tell us what kind of IT support your business needs.</p>
            <Link href="/request-help" className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">
              Request IT help <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {providers.map((provider) => {
              const whatsappNumber = provider.whatsapp?.replace(/\D/g, "") ?? ""
              return (
                <article key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 transition hover:border-white/20">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-white">{provider.company_name}</h3>
                      {provider.location && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-white/55"><MapPin size={13} />{provider.location}</p>
                      )}
                    </div>
                    {provider.verified && <span className="rounded-full bg-[#8ec97b]/15 px-2.5 py-1 text-[11px] font-bold text-[#b7e6a7]">Verified</span>}
                  </div>
                  {provider.bio && <p className="mt-3 text-sm leading-6 text-white/70">{provider.bio}</p>}
                  {provider.services?.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {provider.services.map((service) => (
                        <li key={service} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/65">{service}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    {provider.price_from !== null && provider.price_from !== undefined ? (
                      <p className="text-xs text-white/55">From <span className="font-bold text-white">R{Number(provider.price_from).toLocaleString("en-ZA")}</span></p>
                    ) : <span />}
                    {whatsappNumber ? (
                      <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#8ec97b]/15 px-3.5 py-2 text-xs font-bold text-[#b7e6a7] hover:bg-[#8ec97b]/25">
                        <MessageCircle size={14} /> Contact provider
                      </a>
                    ) : (
                      <span className="text-xs text-white/45">Contact details unavailable</span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <aside className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-white/55">
        <GraduationCap size={18} className="mt-0.5 shrink-0 text-blue-200" />
        <p>Compare providers and confirm services, prices and experience directly before sharing sensitive business information or agreeing to work.</p>
      </aside>
    </main>
  )
}
