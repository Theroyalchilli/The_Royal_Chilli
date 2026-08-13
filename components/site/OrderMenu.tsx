"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/menu";
import { readCart, writeCart, makeLineId, type CartLine } from "@/lib/cart";
import ModifierPickerModal from "./ModifierPickerModal";
import { CategoryHeading, CategoryNavBar, slugify, useCategoryNav } from "./CategoryNav";

export default function OrderMenu({ categories }: { categories: MenuCategory[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [pickerFor, setPickerFor] = useState<MenuItem | null>(null);
  const { activeCategory, sectionRefs, navRefs, navScrollerRef, jumpTo } = useCategoryNav(categories);

  useEffect(() => setCart(readCart()), []);

  function addLine(item: MenuItem, selectedOptionIds: number[], unitPrice: number) {
    const lineId = makeLineId(item.id, selectedOptionIds);
    setCart((prev) => {
      const existing = prev.find((l) => l.lineId === lineId);
      const next = existing
        ? prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l))
        : [
            ...prev,
            {
              lineId,
              menu_item_id: item.id,
              name: item.name,
              unitPrice,
              quantity: 1,
              selectedOptions: item.modifierGroups
                .flatMap((g) => g.options)
                .filter((o) => selectedOptionIds.includes(o.id))
                .map((o) => ({ id: o.id, name: o.name, price_delta: o.price_delta })),
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
    if (item.modifierGroups.length > 0) {
      setPickerFor(item);
    } else {
      addLine(item, [], item.price);
    }
  }

  const linesForItem = (id: number) => cart.filter((l) => l.menu_item_id === id);
  const total = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Order Online</p>
          <h1 className="mt-3 font-[family-name:var(--font-playfair)] text-4xl">
            Collection &amp; <span className="italic text-primary">Delivery</span>
          </h1>
        </div>

      </div>

      <CategoryNavBar
        categories={categories}
        activeCategory={activeCategory}
        navRefs={navRefs}
        navScrollerRef={navScrollerRef}
        jumpTo={jumpTo}
      />

      <div className="mx-auto max-w-4xl px-4">
        <div className="mt-10 space-y-14">
          {categories.map((category) => (
            <section
              key={category.id}
              id={slugify(category.name)}
              data-category-id={category.id}
              ref={(el) => { sectionRefs.current[category.id] = el; }}
              className="scroll-mt-[160px] md:scroll-mt-[110px]"
            >
              <CategoryHeading name={category.name} count={category.items.length} />
              <div className="mt-4 divide-y divide-border">
                {category.items.map((item) => {
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
                              <span>{l.selectedOptions.map((o) => o.name).join(", ") || "Standard"} · {formatCurrency(l.unitPrice)}</span>
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
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <span className="text-sm text-muted-foreground">
              {itemCount} item{itemCount > 1 ? "s" : ""} · {formatCurrency(total)}
            </span>
            <button
              onClick={() => router.push("/order/checkout")}
              className="bg-primary px-6 py-2.5 text-xs uppercase tracking-[0.15em] text-primary-foreground hover:opacity-90"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      {pickerFor && (
        <ModifierPickerModal
          item={pickerFor}
          onClose={() => setPickerFor(null)}
          onConfirm={(ids, unitPrice) => {
            addLine(pickerFor, ids, unitPrice);
            setPickerFor(null);
          }}
        />
      )}
    </div>
  );
}
