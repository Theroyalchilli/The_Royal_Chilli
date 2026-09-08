"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { siteContent } from "@/lib/site-content";
import type { MenuCategory, MenuItem } from "@/lib/menu";
import { readCart, writeCart, makeLineId, readOrderType, writeOrderType, type CartLine, type OrderType } from "@/lib/cart";
import { isRestaurantOpen } from "@/lib/hours";
import ModifierPickerModal from "./ModifierPickerModal";
import { CategoryHeading, CategoryNavBar, CategoryRail, slugify, useCategoryNav, useIsNarrow } from "./CategoryNav";

export default function OrderMenu({ categories }: { categories: MenuCategory[] }) {
  const router = useRouter();
  const isNarrow = useIsNarrow();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerFor, setPickerFor] = useState<MenuItem | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [openNow, setOpenNow] = useState(true);
  const [narrowActiveCategory, setNarrowActiveCategory] = useState<number | null>(categories[0]?.id ?? null);
  const { activeCategory, sectionRefs, navRefs, navScrollerRef, jumpTo } = useCategoryNav(categories);

  useEffect(() => setCart(readCart()), []);
  useEffect(() => {
    setOrderType(readOrderType());
    setOpenNow(isRestaurantOpen());
  }, []);

  function selectOrderType(type: OrderType) {
    setOrderType(type);
    writeOrderType(type);
  }

  function selectNarrowCategory(id: number) {
    setNarrowActiveCategory(id);
    navScrollerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addLine(item: MenuItem, selectedOptionIds: number[], unitPrice: number, quantity: number, notes: string) {
    const lineId = makeLineId(item.id, selectedOptionIds, notes);
    setCart((prev) => {
      const existing = prev.find((l) => l.lineId === lineId);
      const next = existing
        ? prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + quantity } : l))
        : [
            ...prev,
            {
              lineId,
              menu_item_id: item.id,
              name: item.name,
              unitPrice,
              quantity,
              selectedOptions: item.modifierGroups
                .flatMap((g) => g.options)
                .filter((o) => selectedOptionIds.includes(o.id))
                .map((o) => ({ id: o.id, name: o.name, price_delta: o.price_delta })),
              notes: notes || undefined,
            },
          ];
      writeCart(next);
      return next;
    });
  }

  function bumpLine(lineId: string, delta: number) {
    setCart((prev) => {
      const next = prev
        .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0);
      writeCart(next);
      return next;
    });
  }

  function handleAddClick(item: MenuItem) {
    if (isNarrow || item.modifierGroups.length > 0) {
      setPickerFor(item);
    } else {
      addLine(item, [], item.price, 1, "");
    }
  }

  const linesForItem = (id: number) => cart.filter((l) => l.menu_item_id === id);
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);
  const activeNarrowCategory = categories.find((c) => c.id === narrowActiveCategory) ?? categories[0];

  function renderWideItemRow(item: MenuItem) {
    const lines = linesForItem(item.id);
    const hasModifiers = item.modifierGroups.length > 0;
    return (
      <div key={item.id} className="py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full border ${
                  item.is_veg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"
                }`}
              />
              <h3 className="font-medium">{item.name}</h3>
            </div>
            {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
            {item.allergens.length > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground/80">Contains: <span className="capitalize">{item.allergens.join(", ")}</span></p>
            )}
            <p className="mt-1 font-semibold text-primary">{formatCurrency(item.price)}</p>
          </div>
          <div className="flex items-center gap-3">
            {!hasModifiers && lines[0] && (
              <>
                <button onClick={() => bumpLine(lines[0].lineId, -1)} className="h-8 w-8 rounded-full border border-border text-lg leading-none hover:border-primary">−</button>
                <span className="w-4 text-center">{lines[0].quantity}</span>
              </>
            )}
            <button onClick={() => handleAddClick(item)} className="h-8 w-8 rounded-full border border-border text-lg leading-none hover:border-primary">+</button>
          </div>
        </div>
        {hasModifiers && lines.length > 0 && (
          <div className="mt-2 space-y-1 pl-1">
            {lines.map((l) => (
              <div key={l.lineId} className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{l.selectedOptions.map((o) => o.name).join(", ") || "Standard"}{l.notes ? ` · ${l.notes}` : ""} · {formatCurrency(l.unitPrice)}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => bumpLine(l.lineId, -1)} className="h-9 w-9 rounded-full border border-border text-base leading-none">−</button>
                  <span className="w-3 text-center">{l.quantity}</span>
                  <button onClick={() => bumpLine(l.lineId, 1)} className="h-9 w-9 rounded-full border border-border text-base leading-none">+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderNarrowItemRow(item: MenuItem) {
    return (
      <div key={item.id} className="flex items-start justify-between gap-3 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border ${
                item.is_veg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"
              }`}
            />
            <h3 className="font-medium">{item.name}</h3>
          </div>
          {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
          {item.allergens.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">Contains: <span className="capitalize">{item.allergens.join(", ")}</span></p>
          )}
          <p className="mt-1 font-semibold text-primary">{formatCurrency(item.price)}</p>
        </div>
        <button
          onClick={() => handleAddClick(item)}
          className="flex-shrink-0 rounded-lg border border-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-primary hover:bg-primary hover:text-primary-foreground"
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <div className="pb-28 lg:pb-16">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-xs uppercase tracking-[0.3em] text-primary">Order Online</h1>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${openNow ? "bg-green-500" : "bg-amber-500"}`} />
            {openNow ? "Open now" : "Closed right now — you can still order for later"}
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-xs gap-3">
          {(["takeaway", "delivery"] as const).map((t) => (
            <button
              key={t}
              onClick={() => selectOrderType(t)}
              className={`flex-1 border px-4 py-2 text-xs uppercase tracking-[0.1em] ${
                orderType === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {t === "takeaway" ? "Collection" : "Delivery"}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-2 max-w-xs text-center text-xs text-muted-foreground">
          {orderType === "delivery"
            ? "Delivery fee and minimum order depend on your postcode — checked at checkout."
            : `Free collection from ${siteContent.contact.address}`}
        </p>
      </div>

      <div className="lg:hidden">
        <CategoryNavBar
          categories={categories}
          activeCategory={isNarrow ? narrowActiveCategory : activeCategory}
          navRefs={navRefs}
          navScrollerRef={navScrollerRef}
          jumpTo={selectNarrowCategory}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 lg:grid lg:grid-cols-[220px_1fr_320px] lg:items-start lg:gap-10">
        <div className="hidden lg:sticky lg:top-6 lg:block">
          <CategoryRail categories={categories} activeCategory={activeCategory} jumpTo={jumpTo} />
        </div>

        <div className="mt-6 lg:mt-0">
          {isNarrow ? (
            activeNarrowCategory && (
              <section>
                <CategoryHeading name={activeNarrowCategory.name} count={activeNarrowCategory.items.length} />
                <div className="mt-4 divide-y divide-border">
                  {activeNarrowCategory.items.map(renderNarrowItemRow)}
                </div>
              </section>
            )
          ) : (
            <div className="space-y-14">
              {categories.map((category) => (
                <section
                  key={category.id}
                  id={slugify(category.name)}
                  data-category-id={category.id}
                  ref={(el) => { sectionRefs.current[category.id] = el; }}
                  className="scroll-mt-[80px] md:scroll-mt-[120px]"
                >
                  <CategoryHeading name={category.name} count={category.items.length} />
                  <div className="mt-4 divide-y divide-border">
                    {category.items.map(renderWideItemRow)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:sticky lg:top-6 lg:block">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-[family-name:var(--font-playfair)] text-lg text-primary">Your Order</h2>
            {cart.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Your cart is empty.</p>
            ) : (
              <>
                <div className="mt-4 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
                  {cart.map((l) => (
                    <div key={l.lineId} className="text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{l.name}</span>
                        <span className="text-muted-foreground">{formatCurrency(l.unitPrice * l.quantity)}</span>
                      </div>
                      {(l.selectedOptions.length > 0 || l.notes) && (
                        <p className="text-xs text-muted-foreground">
                          {[l.selectedOptions.map((o) => o.name).join(", "), l.notes].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <button onClick={() => bumpLine(l.lineId, -1)} className="h-7 w-7 rounded-full border border-border text-sm leading-none hover:border-primary">−</button>
                        <span className="w-4 text-center text-xs">{l.quantity}</span>
                        <button onClick={() => bumpLine(l.lineId, 1)} className="h-7 w-7 rounded-full border border-border text-sm leading-none hover:border-primary">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold text-primary">{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={() => router.push("/order/checkout")}
                  className="mt-4 w-full bg-primary py-2.5 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90"
                >
                  Checkout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <span className="text-sm text-muted-foreground">
              {itemCount} item{itemCount > 1 ? "s" : ""} · {formatCurrency(total)}
            </span>
            <button
              onClick={() => router.push("/order/cart")}
              className="bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90"
            >
              View Order
            </button>
          </div>
        </div>
      )}

      {pickerFor && (
        <ModifierPickerModal
          item={pickerFor}
          withQuantityAndNotes={isNarrow}
          onClose={() => setPickerFor(null)}
          onConfirm={(ids, unitPrice, quantity, notes) => {
            addLine(pickerFor, ids, unitPrice, quantity, notes);
            setPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
