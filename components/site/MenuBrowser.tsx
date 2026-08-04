"use client";

import type { MenuCategory } from "@/lib/menu";
import { formatCurrency } from "@/lib/utils";
import { CategoryHeading, CategoryNavBar, slugify, useCategoryNav } from "./CategoryNav";

export default function MenuBrowser({ categories }: { categories: MenuCategory[] }) {
  const { activeCategory, sectionRefs, navRefs, navScrollerRef, jumpTo } = useCategoryNav(categories);

  return (
    <>
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
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full border ${
                            item.is_veg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"
                          }`}
                          title={item.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        />
                        <h3 className="font-medium">{item.name}</h3>
                      </div>
                      {item.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      )}
                      {(item.allergens.length > 0 || item.calories) && (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {item.allergens.length > 0 && <>Contains: <span className="capitalize">{item.allergens.join(", ")}</span></>}
                          {item.allergens.length > 0 && item.calories && " · "}
                          {item.calories && `${item.calories} kcal`}
                        </p>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-semibold text-primary">{formatCurrency(item.price)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
