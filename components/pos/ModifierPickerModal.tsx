"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem, ModifierOption } from "@/lib/types";

export default function ModifierPickerModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (selected: ModifierOption[], unitPrice: number) => void;
}) {
  const groups = item.modifierGroups || [];
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, number[]>>({});

  function toggle(groupId: number, optionId: number, single: boolean, max: number | null) {
    setSelectedByGroup((prev) => {
      const current = prev[groupId] || [];
      if (single) {
        return { ...prev, [groupId]: current.includes(optionId) ? [] : [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (max !== null && current.length >= max) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  const allOptions = groups.flatMap((g) => g.options);
  const selectedIds = new Set(Object.values(selectedByGroup).flat());
  const selectedOptions = allOptions.filter((o) => selectedIds.has(o.id));
  const priceDelta = selectedOptions.reduce((s, o) => s + o.price_delta, 0);
  const unitPrice = Math.round((item.price + priceDelta) * 100) / 100;

  const unmetRequired = groups.filter((g) => g.required && (selectedByGroup[g.id] || []).length === 0);
  const canConfirm = unmetRequired.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-foreground text-xl font-bold">{item.name}</h2>
        {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}

        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="text-sm font-semibold text-foreground">
                {group.name} {group.required && <span className="text-red-500">*</span>}
                {group.selection_type === "multiple" && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (choose {group.max_select ? `up to ${group.max_select}` : "any"})
                  </span>
                )}
              </p>
              <div className="mt-2 space-y-1.5">
                {group.options.map((opt) => {
                  const checked = (selectedByGroup[group.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(group.id, opt.id, group.selection_type === "single", group.max_select)}
                      className={`pos-btn no-select flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        checked ? "border-red-500 bg-red-500/10 text-foreground" : "border-border text-muted-foreground hover:border-elevated-hover"
                      }`}
                    >
                      <span>{opt.name}</span>
                      <span className="text-muted-foreground">
                        {opt.price_delta > 0 ? `+${formatCurrency(opt.price_delta)}` : opt.price_delta < 0 ? formatCurrency(opt.price_delta) : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="pos-btn no-select flex-1 rounded-full border border-border py-2.5 font-semibold text-muted-foreground hover:bg-surface-hover">
            Cancel
          </button>
          <button
            onClick={() => canConfirm && onConfirm(selectedOptions, unitPrice)}
            disabled={!canConfirm}
            className="pos-btn no-select flex-1 rounded-full bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            Add · {formatCurrency(unitPrice)}
          </button>
        </div>
      </div>
    </div>
  );
}
