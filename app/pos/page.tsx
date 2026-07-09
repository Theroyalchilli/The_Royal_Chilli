"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, isHappyHour, isBreakfastTime } from "@/lib/utils";
import OrderTypeSelector from "@/components/pos/OrderTypeSelector";
import TableGrid from "@/components/pos/TableGrid";
import MenuPanel from "@/components/pos/MenuPanel";
import OrderTicket from "@/components/pos/OrderTicket";
import PaymentModal from "@/components/pos/PaymentModal";
import type {
  MenuCategory,
  MenuItem,
  RestaurantTable,
  CartItem,
} from "@/lib/types";

type OrderType = "dine_in" | "takeaway" | "delivery";

interface SessionUser {
  id: number;
  name: string;
  role: string;
}

export default function POSPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionUser | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Menu data
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);

  // Order state
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [currentOrderNumber, setCurrentOrderNumber] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  const happyHour = isHappyHour();
  const breakfastTime = isBreakfastTime();

  // Computed totals
  const subtotal = cartItems.reduce(
    (sum, i) => sum + i.item_price * i.quantity,
    0
  );
  const tax = Math.round((subtotal - discount) * 0.2 * 100) / 100;
  const total = Math.round((subtotal - discount + tax) * 100) / 100;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadMenuData();
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      const res = await fetch("/api/auth/login", { method: "GET" });
      // We rely on the cookie, just decode from the page
      // Actually let's get user info from a simpler approach
    } catch {
      // ignore
    }
    // Parse from document cookie is not possible (httpOnly), so we'll
    // just check if we can reach a protected endpoint
    try {
      const res = await fetch("/api/orders?status=open");
      if (!res.ok) {
        router.push("/login");
        return;
      }
    } catch {
      router.push("/login");
    }
  };

  const loadMenuData = async () => {
    try {
      const [menuRes, tablesRes] = await Promise.all([
        fetch("/api/menu"),
        fetch("/api/tables"),
      ]);
      const menuData = await menuRes.json();
      const tablesData = await tablesRes.json();
      setCategories(menuData.categories || []);
      setItems(menuData.items || []);
      setTables(tablesData.tables || []);
    } catch {
      console.error("Failed to load menu data");
    }
  };

  const refreshTables = useCallback(async () => {
    const res = await fetch("/api/tables");
    const data = await res.json();
    setTables(data.tables || []);
  }, []);

  const handleAddItem = (item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.menu_item_id === item.menu_item_id
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return updated;
      }
      return [...prev, item];
    });
  };

  const handleUpdateQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(idx);
      return;
    }
    setCartItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: qty };
      return updated;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSetDiscount = (d: number, reason: string) => {
    setDiscount(d);
    setDiscountReason(reason);
  };

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    setSelectedTable(null);
    setShowCustomerForm(type !== "dine_in");
  };

  // Recall an existing open order for a table (SambaPOS-style ticket recall)
  const recallOrderForTable = useCallback(async (tableId: number) => {
    try {
      const res = await fetch(`/api/orders?table_id=${tableId}&status=open`);
      const data = await res.json();
      const existing = data.orders?.[0];
      if (!existing) return false;

      // Load items into cart
      const itemsRes = await fetch(`/api/orders/${existing.id}/items`);
      const itemsData = await itemsRes.json();

      const recalled: CartItem[] = (itemsData.items || []).map((i: { menu_item_id: number; item_name: string; item_price: number; quantity: number; is_veg?: number }) => ({
        menu_item_id: i.menu_item_id,
        item_name: i.item_name,
        item_price: i.item_price,
        quantity: i.quantity,
        is_veg: i.is_veg ?? 0,
      }));

      setCartItems(recalled);
      setCurrentOrderId(existing.id);
      setCurrentOrderNumber(existing.order_number);
      setDiscount(existing.discount ?? 0);
      setDiscountReason(existing.discount_reason ?? "");
      setStatus(`Recalled order ${existing.order_number} — ready to pay`);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleSendToKitchen = async () => {
    if (cartItems.length === 0) {
      setStatus("Please add items to the order");
      return;
    }
    if (orderType === "dine_in" && !selectedTable) {
      setStatus("Please select a table");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_type: orderType,
          table_id: selectedTable,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          customer_address: customerAddress || null,
          items: cartItems,
          notes,
          discount,
          discount_reason: discountReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "Failed to create order");
        return;
      }

      const orderId = data.order.id;

      // Send to kitchen
      await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent_to_kitchen" }),
      });

      setCurrentOrderId(orderId);
      setCurrentOrderNumber(data.order.order_number);
      setStatus(`Order ${data.order.order_number} sent to kitchen!`);
      refreshTables();
    } catch {
      setStatus("Failed to send order");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (cartItems.length === 0) {
      setStatus("Please add items to the order");
      return;
    }
    if (orderType === "dine_in" && !selectedTable) {
      setStatus("Please select a table");
      return;
    }

    setLoading(true);
    try {
      if (!currentOrderId) {
        // Create order first
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_type: orderType,
            table_id: selectedTable,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            items: cartItems,
            notes,
            discount,
            discount_reason: discountReason,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus(data.error || "Failed to create order");
          return;
        }
        setCurrentOrderId(data.order.id);
        setCurrentOrderNumber(data.order.order_number);
      }
      setPaymentOpen(true);
    } catch {
      setStatus("Failed to process order");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentComplete = () => {
    refreshTables();
  };

  const handlePaymentClose = () => {
    setPaymentOpen(false);
    if (currentOrderId) {
      // Clear order after payment
      handleClear();
    }
  };

  const handleClear = () => {
    setCartItems([]);
    setDiscount(0);
    setDiscountReason("");
    setSelectedTable(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setNotes("");
    setCurrentOrderId(null);
    setCurrentOrderNumber("");
    setStatus("");
    refreshTables();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const timeStr = currentTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-orange-400 font-bold text-lg">🌶️ Royal Chilli</span>
          {breakfastTime && (
            <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
              BREAKFAST
            </span>
          )}
          {happyHour && (
            <span className="bg-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              HAPPY HOUR 🎉
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-white font-mono text-xl font-bold">{timeStr}</span>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/pos/kitchen")}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700 transition-colors"
            >
              🍳 Kitchen
            </button>
            <button
              onClick={() => router.push("/pos/tables")}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700 transition-colors"
            >
              🍽️ Tables
            </button>
            <button
              onClick={() => router.push("/pos/reports")}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg border border-gray-700 transition-colors"
            >
              📊 Reports
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-300 text-xs font-semibold rounded-lg border border-red-800 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Order */}
        <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-gray-800/60 bg-gray-900 overflow-hidden">

          {/* ── Order Type Tabs ── */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <OrderTypeSelector value={orderType} onChange={handleOrderTypeChange} />
          </div>

          {/* ── TABLE SECTION (dine-in only) ── */}
          {orderType === "dine_in" && (
            <div className="px-3 pb-3 flex-shrink-0">
              {/* Section header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Floor Plan</span>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>Free</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/>Busy</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Rsv</span>
                </div>
              </div>
              <TableGrid
                tables={tables}
                selectedTable={selectedTable}
                onSelect={async (t) => {
                  setSelectedTable(t.id);
                  if (t.status === "occupied") {
                    const found = await recallOrderForTable(t.id);
                    if (!found) setStatus("No open bill found for this table");
                  }
                }}
              />
              {/* Selected table pill */}
              {selectedTable && (
                <div className="mt-2 flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400"/>
                  <span className="text-orange-300 text-xs font-semibold">
                    Table {tables.find(t => t.id === selectedTable)?.table_number} selected
                    {tables.find(t => t.id === selectedTable)?.capacity && (
                      <span className="text-orange-400/60 font-normal ml-1">
                        · {tables.find(t => t.id === selectedTable)?.capacity} seats
                      </span>
                    )}
                  </span>
                  <button onClick={() => setSelectedTable(null)} className="ml-auto text-orange-400/50 hover:text-orange-300 text-xs">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Customer info for takeaway/delivery */}
          {(orderType === "takeaway" || orderType === "delivery") && (
            <div className="px-3 pb-3 flex-shrink-0 space-y-2">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer Name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone Number"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500" />
              {orderType === "delivery" && (
                <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Delivery Address" rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-orange-500 resize-none" />
              )}
            </div>
          )}

          {/* ── Divider ── */}
          <div className="mx-3 border-t border-gray-800/80 flex-shrink-0" />

          {/* ── ORDER ITEMS SECTION ── */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 px-3 pt-2">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Order Items</span>
              {cartItems.length > 0 && (
                <span className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5 font-semibold">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              )}
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <OrderTicket
                items={cartItems}
                discount={discount}
                onUpdateQty={handleUpdateQty}
                onRemove={handleRemoveItem}
                onSetDiscount={handleSetDiscount}
              />
            </div>
          </div>

          {/* ── Happy hour ── */}
          {happyHour && discount === 0 && cartItems.length > 0 && (
            <div className="px-3 pt-2 flex-shrink-0">
              <button onClick={() => handleSetDiscount(Math.round(subtotal * 0.1 * 100) / 100, "Happy Hour 10%")}
                className="w-full py-2 bg-purple-900/40 border border-purple-600/60 rounded-lg text-purple-300 text-xs font-semibold hover:bg-purple-800/50 transition-colors no-select">
                🎉 Apply Happy Hour 10% Discount
              </button>
            </div>
          )}

          {/* ── Status message ── */}
          {status && (
            <div className="px-3 pt-2 flex-shrink-0">
              <div className="bg-blue-900/40 border border-blue-600/50 rounded-lg px-3 py-2 text-blue-300 text-xs text-center">{status}</div>
            </div>
          )}

          {/* ── Action Buttons ── */}
          <div className="px-3 py-3 flex-shrink-0 border-t border-gray-800/60 mt-2 space-y-2">
            <button onClick={handleSendToKitchen} disabled={loading || cartItems.length === 0}
              className="pos-btn no-select w-full h-11 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
              {loading ? <span className="opacity-60">Processing…</span> : <><span>🍳</span><span>Send to Kitchen</span></>}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handlePayment} disabled={loading || cartItems.length === 0}
                className="pos-btn no-select h-11 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5">
                <span>💳</span>
                <span>{cartItems.length > 0 ? formatCurrency(total) : "Pay"}</span>
              </button>
              <button onClick={handleClear} disabled={loading}
                className="pos-btn no-select h-11 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5">
                <span>🗑️</span><span>Clear</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Menu */}
        <div className="flex-1 overflow-hidden flex flex-col p-3">
          <MenuPanel
            categories={categories}
            items={items}
            onAddItem={handleAddItem}
          />
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentOpen}
        onClose={handlePaymentClose}
        orderId={currentOrderId}
        orderNumber={currentOrderNumber}
        items={cartItems}
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}
