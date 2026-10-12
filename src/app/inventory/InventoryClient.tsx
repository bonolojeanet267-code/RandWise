"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { ImagePlus } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Product = {
  id: string
  name: string
  qty: number
  cost_price: number | string
  sell_price: number | string
  public_listed: boolean
  image_url: string | null
}

type BusinessProfile = {
  id: string
  name: string
  location: string | null
}

type StockLine = {
  id: string
  productId: string
  newProductName: string
  quantity: string
  unitCost: string
  sellPrice: string
}

const NEW_PRODUCT = "__new_product__"

type StockReceipt = {
  id: string
  supplier_name: string
  invoice_number: string
  invoice_date: string
  invoice_total: number | string
  stock_receipt_items: { quantity: number }[]
}

const newLine = (id: string): StockLine => ({
  id,
  productId: NEW_PRODUCT,
  newProductName: "",
  quantity: "",
  unitCost: "",
  sellPrice: "",
})

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [receipts, setReceipts] = useState<StockReceipt[]>([])
  const [supplier, setSupplier] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [invoiceTotal, setInvoiceTotal] = useState("")
  const [lines, setLines] = useState<StockLine[]>([newLine("line-1")])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [listingBusyId, setListingBusyId] = useState("")
  const [imageUploadingId, setImageUploadingId] = useState("")

  const loadData = useCallback(async () => {
    const [productResult, receiptResult, profileResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,qty,cost_price,sell_price,public_listed,image_url")
        .order("name"),
      supabase
        .from("stock_receipts")
        .select("id,supplier_name,invoice_number,invoice_date,invoice_total,stock_receipt_items(quantity)")
        .order("invoice_date", { ascending: false })
        .limit(10),
      supabase
        .from("businesses")
        .select("id,name,location")
        .maybeSingle(),
    ])

    if (productResult.error) throw new Error(`Could not load products: ${productResult.error.message}`)
    if (receiptResult.error) throw new Error(`Could not load stock invoice history: ${receiptResult.error.message}`)
    if (profileResult.error) throw new Error(`Could not load business profile: ${profileResult.error.message}`)

    setProducts(productResult.data ?? [])
    setReceipts((receiptResult.data ?? []) as StockReceipt[])
    setBusinessProfile(profileResult.data)
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        await loadData()
      } catch (cause: unknown) {
        if (active) setError(getErrorMessage(cause))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [loadData])

  function updateLine(id: string, changes: Partial<StockLine>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line))
  }

  function addLine() {
    setLines((current) => [...current, newLine(crypto.randomUUID())])
  }

  async function saveBusinessProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!businessProfile) return
    setError("")
    setNotice("")
    setProfileSaving(true)
    const { error: profileError } = await supabase
      .from("businesses")
      .update({ name: businessProfile.name.trim(), location: businessProfile.location?.trim() || null })
      .eq("id", businessProfile.id)
    setProfileSaving(false)
    if (profileError) {
      setError(`Could not save store details: ${profileError.message}`)
      return
    }
    setNotice("Store details saved. Customers can find your shared products in this area.")
  }

  async function toggleProductListing(product: Product) {
    setError("")
    setNotice("")
    setListingBusyId(product.id)
    const nextListed = !product.public_listed
    const { error: listingError } = await supabase
      .from("products")
      .update({ public_listed: nextListed })
      .eq("id", product.id)
    setListingBusyId("")
    if (listingError) {
      setError(`Could not update product visibility: ${listingError.message}`)
      return
    }
    setProducts((current) => current.map((entry) => entry.id === product.id ? { ...entry, public_listed: nextListed } : entry))
    setNotice(nextListed ? `${product.name} is now visible in Find products.` : `${product.name} was removed from public search.`)
  }

  async function uploadProductImage(product: Product, file: File | undefined) {
    if (!file || !businessProfile) return
    setError("")
    setNotice("")

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP product photo.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Product photos must be 5 MB or smaller.")
      return
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"
    const objectPath = `${businessProfile.id}/${product.id}/product.${extension}`
    setImageUploadingId(product.id)

    const { error: uploadError } = await supabase.storage
      .from("rw-product-images")
      .upload(objectPath, file, { upsert: true, contentType: file.type, cacheControl: "3600" })
    if (uploadError) {
      setImageUploadingId("")
      setError(`Could not upload product photo: ${uploadError.message}`)
      return
    }

    const { data: publicUrl } = supabase.storage.from("rw-product-images").getPublicUrl(objectPath)
    const { error: saveError } = await supabase
      .from("products")
      .update({ image_url: publicUrl.publicUrl })
      .eq("id", product.id)
    setImageUploadingId("")
    if (saveError) {
      setError(`Photo uploaded but could not be linked to the product: ${saveError.message}`)
      return
    }

    setProducts((current) => current.map((entry) => entry.id === product.id ? { ...entry, image_url: publicUrl.publicUrl } : entry))
    setNotice(`${product.name} photo saved.`)
  }

  async function receiveStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setNotice("")
    setSaving(true)

    const items = lines.map((line) => {
      const product = products.find((entry) => entry.id === line.productId)
      return {
        product_id: line.productId === NEW_PRODUCT ? null : line.productId,
        product_name: product?.name ?? line.newProductName.trim(),
        quantity: Number(line.quantity),
        unit_cost: Number(line.unitCost),
        sell_price: Number(line.sellPrice),
      }
    })

    try {
      const { error: receiveError } = await supabase.rpc("receive_stock_invoice", {
        p_supplier_name: supplier.trim(),
        p_invoice_number: invoiceNumber.trim(),
        p_invoice_date: invoiceDate,
        p_invoice_total: Number(invoiceTotal),
        p_items: items,
      })

      if (receiveError) {
        setError(`Could not record stock invoice: ${receiveError.message}`)
        return
      }

      setSupplier("")
      setInvoiceNumber("")
      setInvoiceDate("")
      setInvoiceTotal("")
      setLines([newLine(crypto.randomUUID())])

      try {
        await loadData()
        setNotice("Supplier invoice recorded and stock quantities updated.")
      } catch (cause: unknown) {
        setError(`Invoice was recorded, but the inventory could not be refreshed: ${getErrorMessage(cause)}`)
      }
    } catch (cause: unknown) {
      setError(`Could not record stock invoice: ${getErrorMessage(cause)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-7">
        <p className="eyebrow">Stock control</p>
        <h1 className="page-title mt-1">Receive stock</h1>
        <p className="page-subtitle">Record the supplier invoice. Existing stock increases automatically, and new products are added to your inventory.</p>
      </div>

      {businessProfile && (
        <form onSubmit={saveBusinessProfile} className="panel mb-6 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Store name shown to customers
            <input required minLength={2} value={businessProfile.name} onChange={(event) => setBusinessProfile({ ...businessProfile, name: event.target.value })} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
            Area shown in product search
            <input value={businessProfile.location ?? ""} onChange={(event) => setBusinessProfile({ ...businessProfile, location: event.target.value })} placeholder="e.g. Soweto, Johannesburg" />
          </label>
          <button type="submit" disabled={profileSaving} className="primary-button px-5 py-3 disabled:opacity-60">{profileSaving ? "Saving..." : "Save store details"}</button>
        </form>
      )}
      <p className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm leading-6 text-blue-950">
        Your stock and sales stay in your private business workspace. Use <strong>Share with customers</strong> only for items you want customers to find on RandWise&apos;s separate public product directory.
      </p>

      <form onSubmit={receiveStock} className="panel mb-9 grid gap-6 p-5 sm:p-7">
        <section>
          <h2 className="mb-4 font-bold">Supplier invoice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Supplier name
              <input required value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="e.g. Wholesale supplier" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Invoice number
              <input required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="e.g. INV-1042" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Invoice date
              <input required type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
              Invoice total (R)
              <input required type="number" min="0" step="0.01" value={invoiceTotal} onChange={(event) => setInvoiceTotal(event.target.value)} placeholder="0.00" />
            </label>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Items on this invoice</h2>
              <p className="mt-1 text-sm text-gray-500">Choose a product already in stock or add a new one.</p>
            </div>
            <button type="button" onClick={addLine} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50">
              + Add item
            </button>
          </div>

          <div className="space-y-4">
            {lines.map((line, index) => (
              <div key={line.id} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Item {index + 1}</p>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))} className="text-sm font-semibold text-rose-700 hover:underline">
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="grid gap-1.5 text-sm font-semibold text-gray-700 lg:col-span-2">
                    Product
                    <select required value={line.productId} onChange={(event) => updateLine(line.id, { productId: event.target.value, newProductName: "" })}>
                      <option value={NEW_PRODUCT}>Add as a new product</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.qty} in stock</option>)}
                    </select>
                  </label>
                  {line.productId === NEW_PRODUCT && (
                    <label className="grid gap-1.5 text-sm font-semibold text-gray-700 lg:col-span-2">
                      New product name
                      <input required value={line.newProductName} onChange={(event) => updateLine(line.id, { newProductName: event.target.value })} placeholder="Product name" />
                    </label>
                  )}
                  <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                    Quantity received
                    <input required type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} placeholder="0" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                    Unit cost (R)
                    <input required type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(line.id, { unitCost: event.target.value })} placeholder="0.00" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-gray-700">
                    Selling price (R)
                    <input required type="number" min="0" step="0.01" value={line.sellPrice} onChange={(event) => updateLine(line.id, { sellPrice: event.target.value })} placeholder="0.00" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        <button type="submit" disabled={saving} className="primary-button p-3 disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Recording invoice..." : "Record invoice and update stock"}
        </button>
      </form>

      <section className="mb-9">
        <div className="mb-3">
          <p className="eyebrow">Live quantities</p>
          <h2 className="mt-1 text-xl font-bold">Current inventory</h2>
        </div>
        {loading ? (
          <p role="status" className="text-sm text-gray-500">Loading inventory...</p>
        ) : products.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">No products yet. Record a supplier invoice to add your first stock.</p>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <article key={product.id} className={`panel flex flex-wrap items-center justify-between gap-4 p-4 ${product.qty < 5 ? "border-amber-200 bg-amber-50/70" : ""}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    aria-label={product.image_url ? `Photo of ${product.name}` : undefined}
                    role={product.image_url ? "img" : undefined}
                    className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-cover bg-center"
                    style={product.image_url ? { backgroundImage: `url("${product.image_url}")` } : { background: "linear-gradient(135deg, #dce7ff, #f3e8ff)" }}
                  >
                    {!product.image_url && <ImagePlus aria-hidden="true" className="m-auto mt-4 text-blue-700" size={20} />}
                  </div>
                  <div className="min-w-0">
                  <h3 className="font-bold">{product.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">Cost R{Number(product.cost_price).toFixed(2)} · Sell R{Number(product.sell_price).toFixed(2)}</p>
                    <label className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-950">
                      {imageUploadingId === product.id ? "Uploading photo..." : product.image_url ? "Change product photo" : "Add product photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={imageUploadingId === product.id}
                        className="sr-only"
                        onChange={(event) => {
                          void uploadProductImage(product, event.target.files?.[0])
                          event.currentTarget.value = ""
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold">{product.qty} left</p>
                    {product.qty < 5 && <span className="text-xs font-bold text-amber-800">Low stock</span>}
                  </div>
                  <button
                    type="button"
                    disabled={listingBusyId === product.id}
                    onClick={() => void toggleProductListing(product)}
                    aria-pressed={product.public_listed}
                    className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60 ${product.public_listed ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    {listingBusyId === product.id ? "Saving..." : product.public_listed ? "Listed publicly" : "Share with customers"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3">
          <p className="eyebrow">Purchase history</p>
          <h2 className="mt-1 text-xl font-bold">Recent supplier invoices</h2>
        </div>
        {receipts.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-600">Supplier invoices you record will appear here.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((receipt) => (
              <article key={receipt.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <h3 className="font-bold">{receipt.supplier_name}</h3>
                  <p className="mt-1 text-sm text-gray-500">Invoice {receipt.invoice_number} · {new Date(`${receipt.invoice_date}T00:00:00`).toLocaleDateString("en-ZA")} · {receipt.stock_receipt_items.length} items</p>
                </div>
                <p className="font-bold">R{Number(receipt.invoice_total).toFixed(2)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
