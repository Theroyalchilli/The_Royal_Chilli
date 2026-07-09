"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { MenuCategory, MenuItem, CartItem } from "@/lib/types";

interface Props {
  categories: MenuCategory[];
  items: MenuItem[];
  onAddItem: (item: CartItem) => void;
}

export default function MenuPanel({ categories, items, onAddItem }: Props) {
  const [activeCat, setActiveCat] = useState<number>(categories[0]?.id || 0);

  const filteredItems = items.filter((i) => i.category_id === activeCat);

  const handleAdd = (item: MenuItem) => {
    onAddItem({
      menu_item_id: item.id,
      item_name: item.name,
      item_price: item.price,
      quantity: 1,
      is_veg: item.is_veg,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar flex-shrink-0">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCat(cat.id)}
            className={cn(
              "pos-btn no-select flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all border-2",
              activeCat === cat.id
                ? "text-white border-current"
                : "text-gray-400 border-gray-700 hover:text-gray-200 hover:border-gray-500"
            )}
            style={
              activeCat === cat.id
                ? { backgroundColor: cat.color + "33", borderColor: cat.color, color: cat.color }
                : undefined
            }
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 pb-2">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleAdd(item)}
              className="pos-btn no-select bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 hover:border-gray-500 rounded-xl p-3 text-left transition-all flex flex-col gap-1 min-h-[80px]"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-white text-sm font-semibold leading-tight flex-1">
                  {item.name}
                </span>
                <span className={item.is_veg ? "veg-dot mt-1" : "non-veg-dot mt-1"} />
              </div>
              <div className="text-orange-400 font-bold text-base mt-auto">
                {formatCurrency(item.price)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
