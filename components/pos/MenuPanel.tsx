"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { MenuCategory, MenuItem, CartItem, ModifierOption } from "@/lib/types";
import ModifierPickerModal from "./ModifierPickerModal";

type OrderType = "dine_in" | "takeaway" | "delivery" | "online";

const AVAILABILITY_KEY: Record<OrderType, keyof MenuItem> = {
  dine_in:  "available_dine_in",
  takeaway: "available_takeaway",
  delivery: "available_delivery",
  online:   "available_online",
};

interface Props {
  categories: MenuCategory[];
  items: MenuItem[];
  onAddItem: (item: CartItem) => void;
  layout?: "vertical" | "horizontal";
  orderType?: OrderType;
}

const categoryIcons: Record<string, string> = {
  "Veg Starters":     "🥗",
  "Non-Veg Starters": "🍗",
  "Veg Mains":        "🍛",
  "Non-Veg Mains":    "🍖",
  "Biryanis":         "🍚",
  "Breads":           "🫓",
  "Rice & Sides":     "🍱",
  "Soups":            "🍲",
  "Desserts":         "🍮",
  "Drinks":           "🥤",
};

export default function MenuPanel({ categories, items, onAddItem, layout = "vertical", orderType }: Props) {
  const [activeCat, setActiveCat] = useState<number>(0);
  const [pickerItem, setPickerItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (categories.length > 0 && activeCat === 0) {
      setActiveCat(categories[0].id);
    }
  }, [categories]);

  const availKey = orderType ? AVAILABILITY_KEY[orderType] : null;
  const visibleCategories = availKey
    ? categories.filter(c => items.some(i => i.category_id === c.id && i[availKey] !== false))
    : categories;
  const filteredItems = items.filter((i) => {
    if (i.category_id !== activeCat) return false;
    if (availKey && i[availKey] === false) return false;
    return true;
  });
  const activeCategory = visibleCategories.find(c => c.id === activeCat);

  const handleAdd = (item: MenuItem) => {
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setPickerItem(item);
      return;
    }
    onAddItem({
      menu_item_id: item.id,
      item_name: item.name,
      item_price: item.price,
      quantity: 1,
      is_veg: item.is_veg,
    });
  };

  const handleConfirmModifiers = (selected: ModifierOption[], unitPrice: number) => {
    if (!pickerItem) return;
    onAddItem({
      menu_item_id: pickerItem.id,
      item_name: pickerItem.name,
      item_price: unitPrice,
      quantity: 1,
      is_veg: pickerItem.is_veg,
      selected_modifiers: selected,
    });
    setPickerItem(null);
  };

  const picker = pickerItem && (
    <ModifierPickerModal item={pickerItem} onClose={() => setPickerItem(null)} onConfirm={handleConfirmModifiers} />
  );

  // ── Horizontal layout (mobile/tablet) ─────────────────────────────────
  if (layout === "horizontal") {
    return (
      <>
      {picker}
      <div className="flex flex-col h-full gap-2">

        {/* Categories — fixed to ~3 rows tall, scrolls for the rest */}
        <div className="flex-shrink-0 max-h-[132px] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:thin]">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {visibleCategories.map((cat) => {
              const isActive = activeCat === cat.id;
              const icon = categoryIcons[cat.name] ?? "🍽️";
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCat(cat.id)}
                  className={cn(
                    "pos-btn no-select flex items-center justify-center gap-1.5",
                    "rounded-xl h-10 px-2 transition-all border w-full",
                    isActive
                      ? "border-transparent shadow-lg"
                      : "bg-surface-hover border-border hover:bg-elevated"
                  )}
                  style={isActive ? {
                    backgroundColor: cat.color + "1a",
                    borderColor: cat.color,
                    boxShadow: `0 0 10px ${cat.color}20`,
                  } : undefined}
                >
                  <span className="text-base leading-none flex-shrink-0">{icon}</span>
                  <span
                    className={cn("text-[11px] font-bold leading-tight truncate", isActive ? "" : "text-muted-foreground")}
                    style={isActive ? { color: cat.color } : undefined}
                  >
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active category label */}
        {activeCategory && (
          <div className="flex items-center gap-2 flex-shrink-0 mb-1">
            <span className="text-base">{categoryIcons[activeCategory.name] ?? "🍽️"}</span>
            <span className="font-bold text-sm" style={{ color: activeCategory.color }}>{activeCategory.name}</span>
            <span className="text-xs text-muted-foreground">{filteredItems.length} items</span>
          </div>
        )}

        {/* Items grid */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No items in this category
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pb-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAdd(item)}
                  className="pos-btn no-select group bg-surface hover:bg-surface-hover active:scale-95 border border-border hover:border-elevated-hover rounded-xl p-3 text-left transition-all flex flex-col gap-1.5 min-h-[80px]"
                >
                  <div className="flex items-start justify-between gap-1.5 flex-1">
                    <span className="text-foreground text-[13px] font-semibold leading-snug flex-1">
                      {item.name}
                    </span>
                    <span className={item.is_veg ? "veg-dot mt-0.5 flex-shrink-0" : "non-veg-dot mt-0.5 flex-shrink-0"} />
                  </div>
                  <div
                    className="text-sm font-black mt-auto"
                    style={{ color: activeCategory?.color ?? "#dc2626" }}
                  >
                    {formatCurrency(item.price)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // ── Vertical layout (desktop) ──────────────────────────────────────────
  return (
    <>
    {picker}
    <div className="flex h-full gap-3">

      {/* Category Column */}
      <div className="w-[110px] flex-shrink-0 flex flex-col gap-1.5">
        {categories.map((cat) => {
          const isActive = activeCat === cat.id;
          const icon = categoryIcons[cat.name] ?? "🍽️";
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={cn(
                "pos-btn no-select w-full flex items-center gap-2",
                "rounded-xl h-[72px] px-2.5 transition-all duration-150 border text-left",
                isActive
                  ? "border-transparent shadow-lg"
                  : "bg-surface-hover border-border hover:bg-elevated hover:border-elevated-hover"
              )}
              style={isActive ? {
                backgroundColor: cat.color + "1a",
                borderColor: cat.color,
                boxShadow: `0 0 14px ${cat.color}25`,
              } : undefined}
            >
              <span className="text-2xl leading-none flex-shrink-0">{icon}</span>
              <span
                className={cn("text-[11px] font-bold leading-tight", isActive ? "" : "text-muted-foreground")}
                style={isActive ? { color: cat.color } : undefined}
              >
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Items Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {activeCategory && (
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <span className="text-lg">{categoryIcons[activeCategory.name] ?? "🍽️"}</span>
            <h2 className="text-base font-bold" style={{ color: activeCategory.color }}>
              {activeCategory.name}
            </h2>
            <span className="text-xs text-muted-foreground ml-1">{filteredItems.length} items</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No items in this category
            </div>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 pb-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleAdd(item)}
                  className="pos-btn no-select group bg-surface hover:bg-surface-hover active:scale-95 border border-border hover:border-elevated-hover rounded-xl p-3 text-left transition-all flex flex-col gap-1.5 min-h-[88px]"
                >
                  <div className="flex items-start justify-between gap-1.5 flex-1">
                    <span className="text-foreground text-[13px] font-semibold leading-snug flex-1">
                      {item.name}
                    </span>
                    <span className={item.is_veg ? "veg-dot mt-0.5 flex-shrink-0" : "non-veg-dot mt-0.5 flex-shrink-0"} />
                  </div>
                  <div
                    className="text-sm font-black mt-auto"
                    style={{ color: activeCategory?.color ?? "#dc2626" }}
                  >
                    {formatCurrency(item.price)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
