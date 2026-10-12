"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { ArrowRight, MapPin, PackageSearch, Search, Store } from "lucide-react"
import { supabase } from "@/lib/supabase"

type ProductListing = {
  product_id: string
  product_name: string
  price: number | string
  business_name: string
  business_location: string | null
  in_stock: boolean
  image_url: string | null
}

function ProductArtwork({ name, imageUrl, index }: { name: string; imageUrl: string | null; index: number }) {
  const palettes = [
    { from: "#dce7ff", to: "#f3e8ff", shape: "#3159c9", detail: "#ff8b61" },
    { from: "#ffeadf", to: "#fff3ce", shape: "#d65b42", detail: "#f8a24b" },
    { from: "#e2e8ff", to: "#dff6f4", shape: "#6558c7", detail: "#3159c9" },
  ]
  const palette = palettes[index % palettes.length]
  const isBottle = /oil|juice|milk|water|drink|bottle|sauce/i.test(name)
  const isLoaf = /bread|loaf|bun/i.test(name)

  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={`Photo of ${name}`}
        className="relative mb-4 h-40 overflow-hidden rounded-2xl bg-slate-100 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02]"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      >
        <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 backdrop-blur">{name}</span>
      </div>
    )
  }

  return (
    <div role="img" aria-label={`Illustration of ${name}`} className="relative mb-4 flex h-40 items-center justify-center overflow-hidden rounded-2xl" style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}>
      <span aria-hidden="true" className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[18px] border-white/35" />
      <span aria-hidden="true" className="absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-white/30 blur-sm" />
      <svg aria-hidden="true" viewBox="0 0 180 150" className="relative h-32 w-40 drop-shadow-xl">
        <ellipse cx="90" cy="128" rx="48" ry="9" fill="#172033" opacity=".12" />
        {isBottle ? (
          <>
            <path d="M76 28h28v17l10 12v56a10 10 0 0 1-10 10H76a10 10 0 0 1-10-10V57l10-12z" fill={palette.shape} />
            <rect x="78" y="18" width="24" height="13" rx="3" fill="#172033" />
            <rect x="70" y="68" width="40" height="31" rx="5" fill="white" opacity=".92" />
            <path d="M81 80h18M81 87h12" stroke={palette.detail} strokeWidth="4" strokeLinecap="round" />
          </>
        ) : isLoaf ? (
          <>
            <path d="M40 105c0-10 9-18 22-20 2-22 17-39 38-39s36 17 38 39c13 2 22 10 22 20v10H40z" fill={palette.detail} />
            <path d="M77 59l10 19M99 56l8 20M119 62l7 17" stroke="white" strokeWidth="5" strokeLinecap="round" opacity=".75" />
            <path d="M47 111h106" stroke={palette.shape} strokeWidth="5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M48 52h68l20 16v55H48z" fill={palette.shape} />
            <path d="M116 52l20 16h-68L48 52z" fill={palette.detail} />
            <path d="M116 52v71l20-16V68z" fill="#172033" opacity=".18" />
            <rect x="66" y="78" width="47" height="29" rx="4" fill="white" opacity=".92" />
            <path d="M77 88h25M77 96h18" stroke={palette.shape} strokeWidth="4" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 backdrop-blur">{name}</span>
    </div>
  )
}

export default function DiscoverPage() {
  const [searchInput, setSearchInput] = useState("")
  const [areaInput, setAreaInput] = useState("")
  const [search, setSearch] = useState("")
  const [area, setArea] = useState("")
  const [listings, setListings] = useState<ProductListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadListings = useCallback(async () => {
    setError("")
    const { data, error: searchError } = await supabase.rpc("search_public_products", {
      p_search: search || null,
      p_area: area || null,
    })
    if (searchError) {
      setError(`Product search is unavailable: ${searchError.message}`)
      setListings([])
      setLoading(false)
      return
    }
    setListings(data ?? [])
    setLoading(false)
  }, [search, area])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (!active) return
      await loadListings()
    }
    const debounce = window.setTimeout(() => { void refresh() }, 250)
    const interval = window.setInterval(() => { void refresh() }, 30000)
    return () => {
      active = false
      window.clearTimeout(debounce)
      window.clearInterval(interval)
    }
  }, [loadListings])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearch(searchInput.trim())
    setArea(areaInput.trim())
    setLoading(true)
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="border-b border-slate-950/20 bg-[#172033] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-200"><Store size={19} /></span>
            <span>RandWise<span className="text-[#ff8b61]">.</span></span>
          </Link>
          <Link href="/" className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white/85 transition hover:bg-white/10">
            Business dashboard <ArrowRight className="ml-1 inline" size={15} />
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-gradient-to-br from-[#172033] via-[#294b99] to-[#6558c7] px-4 py-14 text-white sm:py-20">
        <div aria-hidden="true" className="animate-float absolute -right-16 -top-24 h-72 w-72 rounded-full border-[44px] border-white/[0.08]" />
        <div aria-hidden="true" className="animate-float absolute -bottom-40 left-[12%] h-80 w-80 rounded-full bg-orange-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl animate-enter">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-blue-50">
            <PackageSearch size={15} /> Shop closer, shop smarter
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.04] tracking-tight sm:text-6xl">
            Find what you need.<br /><span className="text-[#ffad8e]">Before you travel.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100/85 sm:text-lg">
            Search products shared by local small businesses, compare prices, and check availability before heading to the store.
          </p>

          <form onSubmit={submitSearch} className="mt-8 grid gap-3 rounded-3xl bg-white p-3 shadow-2xl shadow-slate-950/25 sm:grid-cols-[1fr_0.7fr_auto] sm:rounded-full sm:p-2">
            <label className="flex min-w-0 items-center gap-3 px-3 text-gray-400 sm:px-4">
              <Search size={20} className="shrink-0 text-blue-700" />
              <input aria-label="Product or store" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="What are you looking for?" className="min-w-0 border-0 bg-transparent px-0 py-3 text-gray-900 shadow-none focus:border-0 focus:ring-0" />
            </label>
            <label className="flex min-w-0 items-center gap-3 border-t border-gray-100 px-3 text-gray-400 sm:border-l sm:border-t-0 sm:px-4">
              <MapPin size={19} className="shrink-0 text-orange-600" />
              <input aria-label="Area" value={areaInput} onChange={(event) => setAreaInput(event.target.value)} placeholder="Your area e.g. Soweto" className="min-w-0 border-0 bg-transparent px-0 py-3 text-gray-900 shadow-none focus:border-0 focus:ring-0" />
            </label>
            <button type="submit" className="rounded-full bg-[#f47750] px-7 py-3 font-extrabold text-white shadow-lg shadow-orange-900/15 transition hover:-translate-y-0.5 hover:bg-[#df5c39]">
              Search nearby
            </button>
          </form>
          <p className="mt-3 pl-2 text-xs text-white/65">Only items a shop has chosen to share are shown. Stock availability refreshes automatically.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Local stock, one search</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Products near you</h2>
          </div>
          <p className="text-sm text-gray-500">{loading ? "Checking availability..." : `${listings.length} ${listings.length === 1 ? "item" : "items"} available`}</p>
        </div>

        {error && <p role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

        {loading && listings.length === 0 ? (
          <p role="status" className="panel p-6 text-sm text-gray-600">Searching local product listings...</p>
        ) : listings.length === 0 ? (
          <div className="panel px-5 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-800"><PackageSearch size={27} /></span>
            <h3 className="mt-4 text-lg font-bold">No matching products yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Try another product or area. Local businesses can publish stocked items from their RandWise inventory.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing, index) => (
              <article key={listing.product_id} className={`panel animate-enter group overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:shadow-xl ${index % 3 === 1 ? "stagger-1" : index % 3 === 2 ? "stagger-2" : ""}`}>
                <div className="relative">
                  <ProductArtwork name={listing.product_name} imageUrl={listing.image_url} index={index} />
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-blue-800 shadow-sm backdrop-blur">In stock</span>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900">{listing.product_name}</h3>
                <p className="mt-1 text-2xl font-black tracking-tight text-blue-800">R{Number(listing.price).toFixed(2)}</p>
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-gray-800"><Store size={15} className="text-[#e56843]" />{listing.business_name}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-500"><MapPin size={15} />{listing.business_location || "Location not provided"}</p>
                </div>
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Availability may change. Contact or visit the shop to confirm before travelling.</p>
              </article>
            ))}
          </div>
        )}
        <p className="mt-6 text-center text-xs leading-5 text-gray-400">RandWise shows business-reported availability. Listings are refreshed every 30 seconds; stock is not reserved.</p>
      </section>

    </main>
  )
}
