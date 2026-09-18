"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, isHappyHour, isBreakfastTime } from "@/lib/utils";
import OrderTypeSelector from "@/components/pos/OrderTypeSelector";
import TableGrid from "@/components/pos/TableGrid";
import MenuPanel from "@/components/pos/MenuPanel";
import OrderTicket from "@/components/pos/OrderTicket";
import PaymentModal from "@/components/pos/PaymentModal";
import OnlineOrdersPanel from "@/components/pos/OnlineOrdersPanel";
import OpenOrdersPanel from "@/components/pos/OpenOrdersPanel";
import CustomerDetailsModal from "@/components/pos/CustomerDetailsModal";
import type {
  MenuCategory,
  MenuItem,
  RestaurantTable,
  CartItem,
  WorkPeriod,
} from "@/lib/types";

type OrderType = "dine_in" | "takeaway" | "delivery" | "online";
type MobileTab = "floor" | "menu" | "order";

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
  const [customerEmail, setCustomerEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [notes, setNotes] = useState("");

  // Dine-in: must pick a table before adding items. Takeaway/delivery: items
  // come first, customer details are asked for when sending/paying.
  const [showTablePopup, setShowTablePopup] = useState(false);
  const [showCustomerPopup, setShowCustomerPopup] = useState(false);
  const [customerDetailsCollected, setCustomerDetailsCollected] = useState(false);
  const [pendingAction, setPendingAction] = useState<"kitchen" | "payment" | null>(null);

  // Payment state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [currentOrderNumber, setCurrentOrderNumber] = useState("");
  const [allOrderIds, setAllOrderIds] = useState<number[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("floor");
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [onlineBadge, setOnlineBadge] = useState(0);
  const [reservationBadge, setReservationBadge] = useState(0);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState("");
  const [cashOutReason, setCashOutReason] = useState("");
  const [cashOutSaving, setCashOutSaving] = useState(false);
  const [cashOutError, setCashOutError] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);


  // End of Day modal
  const [endOfDayOpen, setEndOfDayOpen] = useState(false);
  const [eodData, setEodData] = useState<{
    total_revenue: number;
    net_sales: number;
    discount_total: number;
    refunds_total: number;
    refunds: { order_number: string; amount: number; created_at: string }[];
    cash_total: number;
    card_total: number;
    total_orders: number;
    open_orders: number;
    pending_bills_total: number;
    pending_bills: { order_number: string; total: number; customer_name: string | null }[];
    unresolved_orders: { order_number: string; total: number; amount_paid: number; status: string }[];
    cash_paid_out_total: number;
    cash_paid_outs: { amount: number; reason: string; created_at: string }[];
    collected: {
      own_total: number;
      prior_total: number;
      total: number;
      cash_total: number;
      card_total: number;
      prior_settlements: { order_number: string; order_type: string | null; order_date: string | null; amount: number }[];
    };
  } | null>(null);
  const [eodClosingCash, setEodClosingCash] = useState("");
  const [eodOpeningCash, setEodOpeningCash] = useState(0);
  const [eodLoading, setEodLoading] = useState(false);
  const [eodClosed, setEodClosed] = useState(false);
  const [eodError, setEodError] = useState("");

  // Till (shift) open/close gate
  const [tillPeriod, setTillPeriod] = useState<WorkPeriod | null>(null);
  const [tillChecked, setTillChecked] = useState(false);
  const [tillFetchFailed, setTillFetchFailed] = useState(false);
  const [tillBypassed, setTillBypassed] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [openTillLoading, setOpenTillLoading] = useState(false);
  const [openTillError, setOpenTillError] = useState("");

  // Track last click/tap position for context-aware toast
  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const src = "touches" in e ? e.touches[0] : e;
      if (src) setClickPos({ x: src.clientX, y: src.clientY });
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("touchstart", handler as EventListener);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("touchstart", handler as EventListener);
    };
  }, []);

  // Auto-clear status toast after 3 seconds
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(""), 3000);
    return () => clearTimeout(t);
  }, [status]);

  const happyHour = isHappyHour();
  const breakfastTime = isBreakfastTime();
  const isManager = session?.role === "admin" || session?.role === "manager";

  // Computed totals — exclude voided items. Item prices are VAT-inclusive
  // (see lib/order-totals.ts computeBill) — total is just subtotal minus
  // discount, never with VAT added on top; tax is the 20% VAT component
  // embedded in that total, shown for information only.
  const subtotal = cartItems.filter(i => !i.voided).reduce(
    (sum, i) => sum + i.item_price * i.quantity, 0
  );
  const total = Math.round((subtotal - discount) * 100) / 100;
  const tax = Math.round((total - total / 1.2) * 100) / 100;
  const unsentCount = cartItems.filter(i => !i.sent && !i.voided).length;
  const cartCount = cartItems.filter(i => !i.voided).reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadMenuData();
    loadSession();
    checkTillStatus();
  }, []);

  // Runs regardless of which tab is active — OnlineOrdersPanel only mounts
  // (and only polls) while staff are actually on the Online tab, so without
  // this the badge count would freeze until they clicked into it.
  useEffect(() => {
    const fetchOnlineBadge = async () => {
      try {
        const res = await fetch("/api/orders?source=website&status=open", { cache: "no-store" });
        const data = await res.json();
        const orders: { status: string }[] = data.orders || [];
        setOnlineBadge(orders.filter(o => o.status === "sent_to_kitchen").length);
      } catch {
        // silent — badge just skips this tick
      }
    };
    fetchOnlineBadge();
    const t = setInterval(fetchOnlineBadge, 15000);
    return () => clearInterval(t);
  }, []);

  // "New bookings since staff last opened Reservations" — not a live pending
  // count, since a reservation staying "pending" shouldn't keep re-alerting
  // once someone's already seen it. /pos/reservations stamps this timestamp
  // in localStorage on mount, so opening that page clears the badge even if
  // the bookings underneath are still unprocessed.
  useEffect(() => {
    const fetchReservationBadge = async () => {
      try {
        const lastSeen = localStorage.getItem("pos_reservations_last_seen") || "1970-01-01T00:00:00.000Z";
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch(`/api/reservations?from=${today}`, { cache: "no-store" });
        const data = await res.json();
        const list: { created_at: string }[] = data.reservations || [];
        setReservationBadge(list.filter(r => r.created_at > lastSeen).length);
      } catch {
        // silent — badge just skips this tick
      }
    };
    fetchReservationBadge();
    const t = setInterval(fetchReservationBadge, 15000);
    return () => clearInterval(t);
  }, []);

  const checkTillStatus = async () => {
    try {
      const res = await fetch("/api/work-periods", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTillPeriod(data.period && data.period.status === "open" ? data.period : null);
      setTillFetchFailed(false);
    } catch {
      // Fail open — never lock staff out of taking orders because of a network blip.
      setTillFetchFailed(true);
    } finally {
      setTillChecked(true);
    }
  };

  const handleOpenTill = async () => {
    setOpenTillLoading(true);
    setOpenTillError("");
    try {
      const res = await fetch("/api/work-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opening_cash: parseFloat(openingCashInput) || 0,
          staff_id: session?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTillPeriod(data.period);
        setOpeningCashInput("");
      } else {
        const data = await res.json().catch(() => ({}));
        setOpenTillError(data.error || "Failed to open the till. Try again.");
      }
    } catch {
      setOpenTillError("Failed to open the till. Try again.");
    } finally {
      setOpenTillLoading(false);
    }
  };


  const loadSession = async () => {
    try {
      const res = await fetch("/api/orders?status=open");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      // Fetch session user details
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setSession(meData.user);
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

  // Two lines only merge if they're the same dish with the exact same
  // modifier selections — e.g. "Chicken Tikka" and "Malai Tikka" versions of
  // the same platter must stay as separate lines, same rule as the website cart.
  const modifierKey = (mods?: CartItem["selected_modifiers"]) =>
    (mods || []).map((m) => m.id).sort((a, b) => a - b).join(",");

  const handleAddItem = (item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.findIndex(
        (i) => i.menu_item_id === item.menu_item_id && !i.sent && modifierKey(i.selected_modifiers) === modifierKey(item.selected_modifiers)
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + 1 };
        return updated;
      }
      return [...prev, item];
    });
  };

  const handleUpdateQty = (idx: number, qty: number) => {
    if (cartItems[idx]?.sent) return;
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
    if (cartItems[idx]?.sent) return;
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleVoidItem = async (idx: number, newQty: number) => {
    const item = cartItems[idx];
    if (!item?.db_id || !item?.order_id) return;
    try {
      if (newQty === 0) {
        await fetch(`/api/orders/${item.order_id}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.db_id, action: "void" }),
        });
        setCartItems(prev => prev.map((i, n) => n === idx ? { ...i, voided: true } : i));
      } else {
        await fetch(`/api/orders/${item.order_id}/items`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: item.db_id, action: "reduce", quantity: newQty }),
        });
        setCartItems(prev => prev.map((i, n) => n === idx ? { ...i, quantity: newQty } : i));
      }
    } catch {
      // silent
    }
  };

  const handleSetDiscount = (d: number, reason: string) => {
    setDiscount(d);
    setDiscountReason(reason);
  };

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    setSelectedTable(null);
    setCartItems([]);
    setDiscount(0);
    setDiscountReason("");
    setCurrentOrderId(null);
    setCurrentOrderNumber("");
    setAllOrderIds([]);
    setShowCustomerForm(type !== "dine_in" && type !== "online");
    setShowTablePopup(false);
    setShowCustomerPopup(false);
    setCustomerDetailsCollected(false);
    setPendingAction(null);
    setMobileTab(type === "online" ? "order" : type === "dine_in" ? "floor" : "menu");
  };

  const recallOrderForTable = useCallback(async (tableId: number) => {
    try {
      const res = await fetch(`/api/orders?table_id=${tableId}&status=open`);
      const data = await res.json();
      const orders: { id: number; order_number: string; discount: number; discount_reason: string | null }[] = data.orders || [];
      if (orders.length === 0) return false;
      const ordersOldFirst = [...orders].reverse();
      const allItems: CartItem[] = [];
      for (const order of ordersOldFirst) {
        const itemsRes = await fetch(`/api/orders/${order.id}/items`);
        const itemsData = await itemsRes.json();
        const items: CartItem[] = (itemsData.items || [])
          .filter((i: { status: string }) => i.status !== "cancelled")
          .map((i: { id: number; menu_item_id: number; item_name: string; item_price: number; quantity: number; is_veg?: number }) => ({
            menu_item_id: i.menu_item_id,
            item_name: i.item_name,
            item_price: i.item_price,
            quantity: i.quantity,
            is_veg: i.is_veg ?? 0,
            sent: true,
            db_id: i.id,
            order_id: order.id,
          }));
        allItems.push(...items);
      }
      const firstOrder = ordersOldFirst[0];
      setCartItems(allItems);
      setCurrentOrderId(firstOrder.id);
      setCurrentOrderNumber(firstOrder.order_number);
      setAllOrderIds(ordersOldFirst.map(o => o.id));
      setDiscount(firstOrder.discount ?? 0);
      setDiscountReason(firstOrder.discount_reason ?? "");
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleSendToKitchen = async () => {
    const newItems = cartItems.filter(i => !i.sent);
    if (newItems.length === 0) return;
    if (orderType === "dine_in" && !selectedTable) return;
    setLoading(true);
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
          items: newItems,
          notes,
          discount: currentOrderId ? 0 : discount,
          discount_reason: currentOrderId ? null : discountReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      const orderId = data.order.id;
      await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent_to_kitchen" }),
      });
      if (!currentOrderId) {
        setCurrentOrderId(orderId);
        setCurrentOrderNumber(data.order.order_number);
      }
      setAllOrderIds(prev => prev.includes(orderId) ? prev : [...prev, orderId]);
      const returnedItems: { id: number; menu_item_id: number }[] = data.items || [];
      let itemIdx = 0;
      setCartItems(prev => prev.map(i => {
        if (i.sent) return i;
        const dbItem = returnedItems[itemIdx++];
        return { ...i, sent: true, db_id: dbItem?.id, order_id: orderId };
      }));
      refreshTables();
    } catch {
      // silent
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
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_type: orderType,
            table_id: selectedTable,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            customer_address: customerAddress || null,
            customer_email: customerEmail || null,
            marketing_consent: marketingConsent,
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
        setAllOrderIds([data.order.id]);
      } else if (customerPhone.trim()) {
        // Order already exists (e.g. dine-in sent to kitchen earlier) — a
        // phone just captured at payment time needs attaching after the
        // fact so loyalty picks it up when this payment completes.
        await fetch(`/api/orders/${currentOrderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_name: customerName || null, customer_phone: customerPhone, customer_email: customerEmail || null, marketing_consent: marketingConsent }),
        }).catch(() => {});
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

  // Takeaway/delivery: items come first. The first time either action button
  // is pressed on one of these order types, ask for customer details instead
  // of proceeding straight away — then continue once they're confirmed.
  const requestSendToKitchen = () => {
    if ((orderType === "takeaway" || orderType === "delivery") && !customerDetailsCollected) {
      setPendingAction("kitchen");
      setShowCustomerPopup(true);
      return;
    }
    handleSendToKitchen();
  };

  const requestPayment = () => {
    if ((orderType === "takeaway" || orderType === "delivery" || orderType === "dine_in") && !customerDetailsCollected) {
      setPendingAction("payment");
      setShowCustomerPopup(true);
      return;
    }
    handlePayment();
  };

  const handleCustomerDetailsConfirm = () => {
    setCustomerDetailsCollected(true);
    setShowCustomerPopup(false);
    const action = pendingAction;
    setPendingAction(null);
    if (action === "kitchen") handleSendToKitchen();
    else if (action === "payment") handlePayment();
  };

  const handleCustomerDetailsCancel = () => {
    setShowCustomerPopup(false);
    setPendingAction(null);
  };

  const handlePaymentClose = () => {
    setPaymentOpen(false);
    if (currentOrderId) {
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
    setCustomerEmail("");
    setMarketingConsent(false);
    setNotes("");
    setCurrentOrderId(null);
    setCurrentOrderNumber("");
    setAllOrderIds([]);
    setStatus("");
    setShowCustomerPopup(false);
    setCustomerDetailsCollected(false);
    setPendingAction(null);
    setMobileTab("floor");
    refreshTables();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleCashOut = async () => {
    setCashOutError("");
    const amt = parseFloat(cashOutAmount);
    if (!amt || amt <= 0) { setCashOutError("Enter an amount"); return; }
    if (!cashOutReason.trim()) { setCashOutError("A reason is required"); return; }
    setCashOutSaving(true);
    try {
      const res = await fetch("/api/work-periods/cash-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, reason: cashOutReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setCashOutError(data.error || "Failed to record cash out"); return; }
      setShowCashOutModal(false);
      setCashOutAmount("");
      setCashOutReason("");
    } catch {
      setCashOutError("Failed to record cash out");
    } finally {
      setCashOutSaving(false);
    }
  };

  const openEndOfDay = async () => {
    setEndOfDayOpen(true);
    setEodClosed(false);
    setEodClosingCash("");
    setEodError("");
    setEodLoading(true);
    try {
      const res = await fetch("/api/work-periods", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setEodData(data.summary);
        setEodOpeningCash(data.period?.opening_cash || 0);
      } else {
        setEodError("Couldn't load today's summary. Try again.");
      }
    } catch {
      setEodError("Couldn't load today's summary. Try again.");
    } finally {
      setEodLoading(false);
    }
  };

  const handleCloseDay = async () => {
    setEodLoading(true);
    setEodError("");
    try {
      const res = await fetch("/api/work-periods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closing_cash: parseFloat(eodClosingCash) || 0,
          staff_id: session?.id,
        }),
      });
      if (res.ok) {
        setEodClosed(true);
        setTillPeriod(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setEodError(data.error || "Failed to close the day. Try again.");
      }
    } catch {
      setEodError("Failed to close the day. Try again.");
    } finally {
      setEodLoading(false);
    }
  };

  const handlePrintEod = () => {
    if (!eodData) return;
    const date = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const html = `<!DOCTYPE html><html><head><title>End of Day Report</title>
    <style>
      body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 20px auto; color: #000; }
      h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      .sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 16px; }
      .divider { border-top: 1px dashed #000; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; margin: 4px 0; }
      .label { color: #555; }
      .value { font-weight: bold; }
      .total { font-size: 15px; font-weight: bold; }
      .footer { text-align: center; margin-top: 16px; font-size: 10px; color: #888; }
    </style></head><body>
    <h1>THE ROYAL CHILLI</h1>
    <div class="sub">43 Kingsley Road, Hounslow TW3 1PA</div>
    <div class="sub">END OF DAY REPORT</div>
    <div class="sub">${date} · ${time}</div>
    <div class="divider"></div>
    <div class="row"><span class="label">Total Orders</span><span class="value">${eodData.total_orders}</span></div>
    <div class="row"><span class="label">Sales (this shift)</span><span class="value">£${eodData.total_revenue.toFixed(2)}</span></div>
    <div class="row"><span class="label">Discounts</span><span class="value">−£${eodData.discount_total.toFixed(2)}</span></div>
    <div class="row"><span class="label">Refunds</span><span class="value">£${eodData.refunds_total.toFixed(2)}</span></div>
    <div class="row"><span class="label">Net Sales</span><span class="value total">£${eodData.net_sales.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="row"><span class="label">Collected Today</span><span class="value total">£${eodData.collected.total.toFixed(2)}</span></div>
    <div class="row"><span class="label">💵 Cash</span><span class="value">£${eodData.collected.cash_total.toFixed(2)}</span></div>
    <div class="row"><span class="label">💳 Card</span><span class="value">£${eodData.collected.card_total.toFixed(2)}</span></div>
    ${eodData.collected.prior_settlements.length > 0 ? `
    <div class="row"><span class="label">  incl. prior-shift settlements</span><span class="value">£${eodData.collected.prior_total.toFixed(2)}</span></div>
    ${eodData.collected.prior_settlements.map(s => `<div class="row"><span class="label">  ${s.order_number}${s.order_date ? ` — ${new Date(s.order_date).toLocaleDateString("en-GB")}` : ""}</span><span class="value">£${s.amount.toFixed(2)}</span></div>`).join("")}
    ` : ""}
    <div class="divider"></div>
    <div class="row"><span class="label">Opening Float</span><span class="value">£${eodOpeningCash.toFixed(2)}</span></div>
    <div class="row"><span class="label">Cash Paid Out</span><span class="value">−£${eodData.cash_paid_out_total.toFixed(2)}</span></div>
    ${eodData.cash_paid_outs.map(p => `<div class="row"><span class="label">  ${p.reason}</span><span class="value">£${p.amount.toFixed(2)}</span></div>`).join("")}
    <div class="row"><span class="label">Expected Cash</span><span class="value">£${(eodOpeningCash + eodData.collected.cash_total - eodData.cash_paid_out_total).toFixed(2)}</span></div>
    <div class="row"><span class="label">Closing Cash Count</span><span class="value">£${parseFloat(eodClosingCash || "0").toFixed(2)}</span></div>
    <div class="row"><span class="label">Cash Variance</span><span class="value">£${(parseFloat(eodClosingCash || "0") - (eodOpeningCash + eodData.collected.cash_total - eodData.cash_paid_out_total)).toFixed(2)}</span></div>
    ${eodData.pending_bills.length > 0 ? `
    <div class="divider"></div>
    <div class="row"><span class="label">📌 Pending Bills</span><span class="value total">£${eodData.pending_bills_total.toFixed(2)}</span></div>
    ${eodData.pending_bills.map(o => `<div class="row"><span class="label">${o.order_number}${o.customer_name ? ` — ${o.customer_name}` : ""}</span><span class="value">£${o.total.toFixed(2)}</span></div>`).join("")}
    ` : ""}
    ${eodData.unresolved_orders.length > 0 ? `
    <div class="divider"></div>
    <div class="row"><span class="label">⛔ UNRESOLVED — must pay or Pay Later</span><span class="value total">£${eodData.unresolved_orders.reduce((s, o) => s + (o.total - o.amount_paid), 0).toFixed(2)}</span></div>
    ${eodData.unresolved_orders.map(o => `<div class="row"><span class="label">${o.order_number}</span><span class="value">£${(o.total - o.amount_paid).toFixed(2)}</span></div>`).join("")}
    ` : ""}
    <div class="divider"></div>
    <div class="footer">Printed by ${session?.name || "Staff"} · Royal Chilli POS</div>
    <div style="margin-top:20px; font-size:11px;">
      Manager: ________________________________<br><br>
      Signature: ________________________________
    </div>
    </body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  };

  const handleTableSelect = async (t: RestaurantTable) => {
    if (t.id !== selectedTable) {
      setCartItems([]);
      setDiscount(0);
      setDiscountReason("");
      setCurrentOrderId(null);
      setCurrentOrderNumber("");
      setAllOrderIds([]);
      setStatus("");
      // A fresh table is a fresh (potential) customer — the loyalty prompt
      // at payment must ask again, not carry over "skipped" from whichever
      // table was open before.
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setMarketingConsent(false);
      setCustomerDetailsCollected(false);
    }
    setSelectedTable(t.id);
    setMobileTab("menu");
    if (t.status === "occupied") {
      const found = await recallOrderForTable(t.id);
      if (!found) setStatus("No open bill found for this table");
    }
  };

  const timeStr = currentTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Shared table header card
  const tbl = tables.find(t => t.id === selectedTable);
  const tableHeader = tbl ? (
    <div className="relative rounded-2xl overflow-hidden border border-red-500/30 bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0" />
      <div className="flex items-center gap-3 px-3 py-3">
        <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-400/30 flex flex-col items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/10">
          <span className="text-red-600/70 text-[9px] font-black leading-none tracking-widest uppercase">Table</span>
          <span className="text-red-200 text-lg font-black leading-tight">{tbl.table_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-foreground font-black text-base leading-tight">Table {tbl.table_number}</span>
            <span className="text-[9px] font-bold text-red-600 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              {tbl.location === "outdoor" ? "Outdoor" : tbl.location === "private" ? "VIP" : "Main"}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-muted-foreground text-xs">🪑 {tbl.capacity} seats</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-emerald-600 text-xs font-semibold">● Active</span>
          </div>
        </div>
        <button
          onClick={() => { setSelectedTable(null); handleClear(); }}
          className="flex-shrink-0 text-[11px] font-semibold text-muted-foreground hover:text-red-600 bg-surface-hover/80 hover:bg-red-50 border border-border hover:border-red-500/40 px-2.5 py-1.5 rounded-lg transition-all no-select"
        >
          ← Tables
        </button>
      </div>
    </div>
  ) : null;

  // Shared action buttons (totals + send + pay + clear)
  const actionButtons = (
    <div className="px-3 pb-3 pt-2 flex-shrink-0 border-t border-border/60 mt-2 space-y-2">
      {cartItems.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>{cartCount} items · VAT incl.</span>
          <div className="flex items-center gap-2">
            {discount > 0 && <span className="text-yellow-600">−{formatCurrency(discount)}</span>}
            <span className="text-muted-foreground">VAT {formatCurrency(tax)}</span>
            <span className="text-foreground font-bold">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
      {cartItems.some(i => !i.sent) && (
        <button onClick={requestSendToKitchen} disabled={loading}
          className="pos-btn no-select w-full h-12 bg-red-600 hover:bg-red-500 disabled:bg-surface-hover disabled:text-muted-foreground text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
          {loading ? <span className="opacity-60">Processing…</span> : <><span>🍳</span><span>Send to Kitchen</span></>}
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={requestPayment} disabled={loading || cartItems.length === 0}
          className="pos-btn no-select h-12 bg-emerald-600 hover:bg-emerald-500 disabled:bg-surface-hover disabled:text-muted-foreground text-white rounded-xl transition-all flex flex-col items-center justify-center leading-tight">
          <span className="text-[10px] font-semibold opacity-80">Pay Now</span>
          <span className="text-base font-black">{cartItems.length > 0 ? formatCurrency(total) : "—"}</span>
        </button>
        <button onClick={handleClear} disabled={loading}
          className="pos-btn no-select h-12 bg-surface-hover hover:bg-elevated border border-border text-foreground hover:text-foreground font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-1.5">
          <span>🗑️</span><span>Clear</span>
        </button>
      </div>
    </div>
  );

  // Bottom tab bar config
  const mobileTabs: { key: MobileTab; icon: string; label: string; badge: number | null }[] = [
    { key: "floor",  icon: "🪑",  label: "Tables", badge: null },
    { key: "menu",   icon: "🍽️", label: "Menu",   badge: unsentCount > 0 ? unsentCount : null },
    { key: "order",  icon: "📋",  label: "Order",  badge: cartCount > 0 ? cartCount : null },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-border flex-shrink-0 gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo.png" alt="The Royal Chilli" className="h-10 w-10 rounded-lg object-cover flex-shrink-0" />
          <div className="flex flex-col leading-none gap-0.5">
            <span style={{ fontFamily: "var(--font-cinzel)" }} className="text-foreground font-bold text-sm lg:text-[15px] tracking-wide leading-none">
              The Royal Chilli
            </span>
            <span style={{ fontFamily: "var(--font-playfair)" }} className="text-yellow-600 text-[11px] font-bold italic tracking-widest leading-none">
              Dil Se Desi
            </span>
          </div>
          {breakfastTime && (
            <span className="hidden sm:inline bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">BREAKFAST</span>
          )}
        </div>

        {/* Right side — clock + nav */}
        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <span className="text-foreground font-mono text-lg lg:text-xl font-bold tabular-nums">{timeStr}</span>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1.5">
            {session && (
              <div className="flex items-center gap-1.5 mr-1 px-2.5 py-1.5 bg-surface-hover/60 border border-border rounded-lg">
                <span className="text-foreground text-xs font-semibold">{session.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize bg-elevated px-1.5 py-0.5 rounded">{session.role}</span>
              </div>
            )}
            {tillChecked && !tillFetchFailed && (
              tillPeriod ? (
                <div title={`Opened ${new Date(tillPeriod.opened_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · Float £${tillPeriod.opening_cash.toFixed(2)}`}
                  className="hidden xl:flex items-center gap-1.5 mr-1 px-2.5 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-green-700 text-[11px] font-bold">Till Open</span>
                </div>
              ) : (
                <div className="hidden xl:flex items-center gap-1.5 mr-1 px-2.5 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-red-700 text-[11px] font-bold">Till Closed</span>
                </div>
              )
            )}
            {session && session.role !== "employee" && (
              <button onClick={() => router.push("/staff")}
                className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
                👥 Staff Hub
              </button>
            )}
            <button onClick={() => router.push("/pos/kitchen")}
              className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
              🍳 Kitchen
            </button>
            <button onClick={() => router.push("/pos/history")}
              className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
              📜 History
            </button>
            <button onClick={() => setShowCashOutModal(true)}
              className="px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
              💵 Cash Out
            </button>
            <button
              onClick={() => {
                localStorage.setItem("pos_reservations_last_seen", new Date().toISOString());
                setReservationBadge(0);
                router.push("/pos/reservations");
              }}
              className="relative px-3 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
              📅 Reservations
              {reservationBadge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                  {reservationBadge}
                </span>
              )}
            </button>
            {isManager && (
              <button onClick={openEndOfDay}
                className="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-300 transition-colors">
                🌙 End of Day
              </button>
            )}
            <button onClick={handleLogout}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg border border-red-300 transition-colors">
              Logout
            </button>
          </div>

          {/* Mobile: More menu + logout */}
          <div className="relative lg:hidden">
            <button onClick={() => setShowMobileMenu((v) => !v)}
              className="px-2.5 py-1.5 bg-surface-hover hover:bg-elevated text-foreground text-xs font-semibold rounded-lg border border-border transition-colors">
              ☰ More
            </button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
                  {session && (
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-foreground text-xs font-semibold">{session.name}</p>
                      <p className="text-muted-foreground text-[10px] capitalize">{session.role}</p>
                      {tillChecked && !tillFetchFailed && (
                        <p className={`text-[10px] font-bold mt-0.5 ${tillPeriod ? "text-green-600" : "text-red-600"}`}>
                          {tillPeriod ? "🟢 Till Open" : "🔴 Till Closed"}
                        </p>
                      )}
                    </div>
                  )}
                  {session && session.role !== "employee" && (
                    <button onClick={() => { setShowMobileMenu(false); router.push("/staff"); }}
                      className="w-full text-left px-3 py-2 text-foreground text-xs font-semibold hover:bg-surface-hover">
                      👥 Staff Hub
                    </button>
                  )}
                  <button onClick={() => { setShowMobileMenu(false); router.push("/pos/kitchen"); }}
                    className="w-full text-left px-3 py-2 text-foreground text-xs font-semibold hover:bg-surface-hover">
                    🍳 Kitchen
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); router.push("/pos/history"); }}
                    className="w-full text-left px-3 py-2 text-foreground text-xs font-semibold hover:bg-surface-hover">
                    📜 History
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); setShowCashOutModal(true); }}
                    className="w-full text-left px-3 py-2 text-foreground text-xs font-semibold hover:bg-surface-hover">
                    💵 Cash Out
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem("pos_reservations_last_seen", new Date().toISOString());
                      setReservationBadge(0);
                      setShowMobileMenu(false);
                      router.push("/pos/reservations");
                    }}
                    className="relative w-full text-left px-3 py-2 text-foreground text-xs font-semibold hover:bg-surface-hover">
                    📅 Reservations
                    {reservationBadge > 0 && (
                      <span className="absolute top-1 right-3 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                        {reservationBadge}
                      </span>
                    )}
                  </button>
                  {isManager && (
                    <button onClick={() => { setShowMobileMenu(false); openEndOfDay(); }}
                      className="w-full text-left px-3 py-2 text-indigo-700 text-xs font-semibold hover:bg-surface-hover">
                      🌙 End of Day
                    </button>
                  )}
                  <button onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-red-700 text-xs font-semibold hover:bg-surface-hover border-t border-border">
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          DESKTOP LAYOUT  (lg = 1024px and above)
      ══════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-1 overflow-hidden">

        {/* Left Panel */}
        <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-border/60 bg-surface overflow-hidden">

          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <OrderTypeSelector value={orderType} onChange={handleOrderTypeChange} onlineBadge={onlineBadge} />
          </div>

          {orderType === "online" && (
            <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
              <div className="mb-2 pt-1">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Online Orders</span>
              </div>
              <OnlineOrdersPanel />
            </div>
          )}

          {orderType !== "online" && orderType === "dine_in" && !selectedTable && (
            <div className="px-3 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Select a Table</span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>Free</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/>Busy</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Rsv</span>
                </div>
              </div>
              <TableGrid tables={tables} selectedTable={selectedTable} onSelect={handleTableSelect} />
              {cartCount > 0 ? (
                <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2.5 animate-pulse">
                  <span className="text-amber-600 text-base">⚠️</span>
                  <div>
                    <p className="text-amber-700 text-xs font-bold">{cartCount} item{cartCount > 1 ? "s" : ""} added — select a table</p>
                    <p className="text-amber-500/70 text-[10px]">Tap a table above to assign this order</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted-foreground text-xs mt-3">Tap a table to start an order</p>
              )}
            </div>
          )}

          {orderType !== "online" && orderType === "dine_in" && selectedTable && (
            <div className="mx-3 mb-3 flex-shrink-0">
              {tableHeader}
            </div>
          )}

          {(orderType === "takeaway" || orderType === "delivery") && customerDetailsCollected && (
            <div className="px-3 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 bg-surface-hover/60 border border-border rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-foreground text-sm font-semibold truncate">{customerName || "Guest"}</p>
                  <p className="text-muted-foreground text-xs truncate">
                    {customerPhone || "No phone"}{orderType === "delivery" && customerAddress ? ` · ${customerAddress}` : ""}
                  </p>
                </div>
                <button onClick={() => setShowCustomerPopup(true)} className="text-[11px] font-bold text-red-600 hover:underline flex-shrink-0">Edit</button>
              </div>
            </div>
          )}

          {(orderType === "takeaway" || orderType === "delivery") && cartItems.length === 0 && (
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-3">
              <div className="mb-2 pt-1">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
                  Open {orderType === "delivery" ? "Delivery" : "Takeaway"} Orders
                </span>
              </div>
              <OpenOrdersPanel orderType={orderType} />
            </div>
          )}

          {orderType !== "online" && (selectedTable || orderType !== "dine_in") &&
            !((orderType === "takeaway" || orderType === "delivery") && cartItems.length === 0) && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 px-3">
              <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Order Items</span>
                {cartItems.length > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-700 border border-red-500/30 rounded-full px-2 py-0.5 font-semibold">
                    {cartCount} items
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden min-h-0 h-full">
                <OrderTicket
                  items={cartItems}
                  onUpdateQty={handleUpdateQty}
                  onRemove={handleRemoveItem}
                  onVoid={handleVoidItem}
                />
              </div>
            </div>
          )}

          {/* Discount controls — manager only */}
          {cartItems.length > 0 && (
            <div className="px-3 pt-1 flex-shrink-0">
              {isManager ? (
                <>
                  {discount > 0 && (
                    <div className="flex items-center justify-between bg-yellow-100 border border-yellow-300/40 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-yellow-700 font-semibold">Discount: -{formatCurrency(discount)}</span>
                      <button onClick={() => handleSetDiscount(0, "")} className="text-muted-foreground hover:text-red-600 text-[10px]">✕ Remove</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 bg-surface-hover/60 border border-border rounded-lg px-3 py-1.5">
                  <span className="text-muted-foreground text-xs">🔒</span>
                  <span className="text-muted-foreground text-xs">Discounts — Manager only</span>
                </div>
              )}
            </div>
          )}

          {actionButtons}
        </div>

        {/* Right Panel - Menu (hidden for online orders) */}
        {orderType !== "online" && (
          <div className="flex-1 overflow-hidden flex flex-col p-3">
            <MenuPanel
              categories={categories}
              items={items}
              onAddItem={handleAddItem}
              layout="horizontal"
              orderType={orderType}
              disableAdd={orderType === "dine_in" && !selectedTable}
              onBlockedAdd={() => setShowTablePopup(true)}
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          MOBILE / TABLET LAYOUT  (below lg)
      ══════════════════════════════════════════ */}
      <div className="flex lg:hidden flex-1 flex-col overflow-hidden">

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">

          {/* ── Floor Tab ── */}
          {mobileTab === "floor" && (
            <div className="h-full overflow-y-auto">
              <div className="p-3 space-y-3">
                <OrderTypeSelector value={orderType} onChange={handleOrderTypeChange} onlineBadge={onlineBadge} />

                {orderType === "online" && (
                  <OnlineOrdersPanel />
                )}

                {orderType !== "online" && orderType === "dine_in" && !selectedTable && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Select a Table</span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>Free</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/>Busy</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>Rsv</span>
                      </div>
                    </div>
                    <TableGrid tables={tables} selectedTable={selectedTable} onSelect={handleTableSelect} />
                    {cartCount > 0 ? (
                      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2.5 animate-pulse">
                        <span className="text-amber-600 text-base">⚠️</span>
                        <div>
                          <p className="text-amber-700 text-xs font-bold">{cartCount} item{cartCount > 1 ? "s" : ""} added — select a table</p>
                          <p className="text-amber-500/70 text-[10px]">Tap a table above to assign this order</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground text-xs">Tap a table to start an order</p>
                    )}
                  </>
                )}

                {orderType !== "online" && orderType === "dine_in" && selectedTable && (
                  <>
                    {tableHeader}
                    <button onClick={() => setMobileTab("menu")}
                      className="w-full py-3 bg-red-600/20 border border-red-500/30 text-red-700 font-semibold rounded-xl text-sm no-select pos-btn">
                      🍽️ Browse Menu →
                    </button>
                    <button onClick={() => setMobileTab("order")}
                      className="w-full py-3 bg-surface-hover border border-border text-foreground font-semibold rounded-xl text-sm no-select pos-btn">
                      📋 View Order{cartCount > 0 ? ` (${cartCount} items)` : ""}
                    </button>
                  </>
                )}

                {(orderType === "takeaway" || orderType === "delivery") && (
                  <div className="space-y-2">
                    {customerDetailsCollected && (
                      <div className="flex items-center justify-between gap-2 bg-surface-hover/60 border border-border rounded-xl px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-foreground text-sm font-semibold truncate">{customerName || "Guest"}</p>
                          <p className="text-muted-foreground text-xs truncate">
                            {customerPhone || "No phone"}{orderType === "delivery" && customerAddress ? ` · ${customerAddress}` : ""}
                          </p>
                        </div>
                        <button onClick={() => setShowCustomerPopup(true)} className="text-[11px] font-bold text-red-600 hover:underline flex-shrink-0">Edit</button>
                      </div>
                    )}
                    {cartItems.length === 0 ? (
                      <>
                        <div>
                          <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">
                            Open {orderType === "delivery" ? "Delivery" : "Takeaway"} Orders
                          </span>
                        </div>
                        <OpenOrdersPanel orderType={orderType} />
                      </>
                    ) : (
                      <p className="text-center text-muted-foreground text-xs">
                        {orderType === "delivery" ? "Delivery" : "Takeaway"} orders don&apos;t use tables — customer details are asked for when you send or pay.
                      </p>
                    )}
                    <button onClick={() => setMobileTab("menu")}
                      className="w-full py-3 bg-red-600/20 border border-red-500/30 text-red-700 font-semibold rounded-xl text-sm no-select pos-btn">
                      🍽️ Browse Menu →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Menu Tab ── */}
          {mobileTab === "menu" && (
            <div className="h-full flex flex-col overflow-hidden p-2 gap-2">
              {orderType === "dine_in" && !selectedTable && (
                <div className="flex-shrink-0 flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2">
                  <span className="text-amber-600">⚠️</span>
                  <p className="text-amber-700 text-xs font-bold flex-1">No table selected — go to Tables tab first</p>
                  <button onClick={() => setMobileTab("floor")}
                    className="text-[10px] font-bold text-amber-600 bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-lg no-select">
                    → Tables
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-hidden min-h-0">
                <MenuPanel
                  categories={categories}
                  items={items}
                  onAddItem={handleAddItem}
                  layout="horizontal"
                  orderType={orderType}
                  disableAdd={orderType === "dine_in" && !selectedTable}
                  onBlockedAdd={() => setShowTablePopup(true)}
                />
              </div>
            </div>
          )}

          {/* ── Order Tab ── */}
          {mobileTab === "order" && (
            <div className="h-full flex flex-col overflow-hidden">
              {orderType === "dine_in" && selectedTable && (
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  {tableHeader}
                </div>
              )}
              {(orderType === "takeaway" || orderType === "delivery") && customerDetailsCollected && (
                <div className="px-3 pt-3 pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between gap-2 bg-surface-hover/60 rounded-xl px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-muted-foreground">Customer: </span>
                      <span className="text-foreground font-semibold">{customerName || "Guest"}</span>
                      {customerPhone && <span className="text-muted-foreground"> · {customerPhone}</span>}
                    </div>
                    <button onClick={() => setShowCustomerPopup(true)} className="text-[11px] font-bold text-red-600 hover:underline flex-shrink-0">Edit</button>
                  </div>
                </div>
              )}
              <div className="px-3 pb-1 flex-shrink-0 flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground tracking-widest uppercase">Order Items</span>
                {cartCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-700 border border-red-500/30 rounded-full px-2 py-0.5 font-semibold">
                    {cartCount} items
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden min-h-0 px-3">
                <OrderTicket
                  items={cartItems}
                  onUpdateQty={handleUpdateQty}
                  onRemove={handleRemoveItem}
                  onVoid={handleVoidItem}
                />
              </div>
              {/* Discount controls — manager only (mobile) */}
              {cartItems.length > 0 && (
                <div className="px-3 pt-1 flex-shrink-0">
                  {isManager ? (
                    <>
                      {happyHour && discount === 0 && (
                        <button onClick={() => handleSetDiscount(Math.round(subtotal * 0.1 * 100) / 100, "Happy Hour 10%")}
                          className="w-full py-1.5 bg-purple-100 border border-purple-300 rounded-lg text-purple-700 text-xs font-semibold hover:bg-purple-200 transition-colors no-select">
                          🎉 Happy Hour — tap to apply 10% off
                        </button>
                      )}
                      {discount > 0 && (
                        <div className="flex items-center justify-between bg-yellow-100 border border-yellow-300/40 rounded-lg px-3 py-1.5 text-xs">
                          <span className="text-yellow-700 font-semibold">Discount: -{formatCurrency(discount)}</span>
                          <button onClick={() => handleSetDiscount(0, "")} className="text-muted-foreground hover:text-red-600 text-[10px]">✕ Remove</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 bg-surface-hover/60 border border-border rounded-lg px-3 py-1.5">
                      <span className="text-muted-foreground text-xs">🔒</span>
                      <span className="text-muted-foreground text-xs">Discounts — Manager only</span>
                    </div>
                  )}
                </div>
              )}
              {actionButtons}
            </div>
          )}
        </div>

        {/* Bottom Tab Bar */}
        <div className="flex-shrink-0 flex border-t border-border bg-surface">
          {mobileTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`flex-1 relative flex flex-col items-center justify-center py-3 gap-0.5 transition-colors no-select ${
                mobileTab === tab.key
                  ? "text-red-600 border-t-2 border-red-400 -mt-[2px]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-semibold">{tab.label}</span>
              {tab.badge !== null && (
                <span className="absolute top-1.5 right-[calc(50%-22px)] bg-red-500 text-white text-[9px] font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Status Toast — appears near the last tap/click */}
      {status && (
        <div
          className="fixed z-50 pointer-events-none transition-opacity"
          style={clickPos ? {
            left: Math.min(clickPos.x, window.innerWidth - 220),
            top: Math.max(clickPos.y - 52, 64),
          } : { top: 64, left: "50%", transform: "translateX(-50%)" }}
        >
          <div className="bg-surface border border-red-500/70 text-foreground text-xs font-semibold px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 whitespace-nowrap">
            <span className="text-red-600">⚠️</span>
            <span>{status}</span>
          </div>
        </div>
      )}

      {/* Table required popup — dine-in with no table selected yet */}
      {showTablePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowTablePopup(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-3xl mb-2">🪑</div>
            <h2 className="text-foreground font-bold text-lg">Select a table first</h2>
            <p className="mt-1 text-sm text-muted-foreground">Dine-in orders need a table before you can add items.</p>
            <button
              onClick={() => { setShowTablePopup(false); setMobileTab("floor"); }}
              className="pos-btn no-select mt-5 w-full rounded-full bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500"
            >
              OK, pick a table
            </button>
          </div>
        </div>
      )}

      {/* Cash Out — cash physically leaving the till mid-shift, so EOD's
          Expected Cash can subtract it back out */}
      {showCashOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCashOutModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-3xl mb-2">💵</div>
              <h2 className="text-foreground font-bold text-lg">Cash Out</h2>
              <p className="mt-1 text-sm text-muted-foreground">Record cash taken out of the till right now — a driver tip, petty cash, etc.</p>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type="number" min="0" step="0.01" placeholder="Amount (£)"
                value={cashOutAmount} onChange={(e) => setCashOutAmount(e.target.value)}
                className="w-full bg-surface-hover border border-elevated text-foreground text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-500"
              />
              <input
                type="text" placeholder="Reason — e.g. paid delivery driver"
                value={cashOutReason} onChange={(e) => setCashOutReason(e.target.value)}
                className="w-full bg-surface-hover border border-elevated text-foreground text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-red-500"
              />
              {cashOutError && <p className="text-red-600 text-xs text-center">{cashOutError}</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setShowCashOutModal(false); setCashOutAmount(""); setCashOutReason(""); setCashOutError(""); }}
                className="flex-1 h-11 bg-elevated hover:bg-elevated-hover border border-elevated text-foreground font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCashOut}
                disabled={cashOutSaving}
                className="flex-1 h-11 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all"
              >
                {cashOutSaving ? "Saving…" : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer details popup — takeaway/delivery on Send to Kitchen or Pay; dine-in on Pay only */}
      {showCustomerPopup && (orderType === "takeaway" || orderType === "delivery" || orderType === "dine_in") && (
        <CustomerDetailsModal
          orderType={orderType}
          name={customerName}
          phone={customerPhone}
          address={customerAddress}
          email={customerEmail}
          marketingConsent={marketingConsent}
          onChangeName={setCustomerName}
          onChangePhone={setCustomerPhone}
          onChangeAddress={setCustomerAddress}
          onChangeEmail={setCustomerEmail}
          onChangeMarketingConsent={setMarketingConsent}
          onConfirm={handleCustomerDetailsConfirm}
          onClose={handleCustomerDetailsCancel}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={paymentOpen}
        onClose={handlePaymentClose}
        orderId={currentOrderId}
        orderNumber={currentOrderNumber}
        extraOrderIds={allOrderIds.filter(id => id !== currentOrderId)}
        items={cartItems}
        subtotal={subtotal}
        discount={discount}
        tax={tax}
        total={total}
        onPaymentComplete={handlePaymentComplete}
      />

      {/* End of Day Modal */}
      {endOfDayOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌙</span>
                <h2 className="text-foreground font-bold text-lg">End of Day</h2>
              </div>
              <button
                onClick={() => setEndOfDayOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xl font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {eodError && (
                <div className="bg-red-50 border border-red-300 rounded-xl px-3 py-2.5 text-red-700 text-sm font-semibold">
                  ⚠ {eodError}
                </div>
              )}
              {eodLoading && !eodData ? (
                <div className="text-muted-foreground text-center py-6 animate-pulse">Loading summary...</div>
              ) : eodClosed ? (
                /* Success State */
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-green-600 font-bold text-lg">Day Closed Successfully</p>
                    <p className="text-muted-foreground text-sm mt-1">Cash drawer reconciliation complete</p>
                  </div>
                  <button
                    onClick={handlePrintEod}
                    className="w-full py-3 bg-elevated hover:bg-elevated-hover text-foreground font-bold rounded-xl transition-colors"
                  >
                    🖨️ Print Report
                  </button>
                  <button
                    onClick={() => setEndOfDayOpen(false)}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Normal state */
                <>
                  {/* Sales — trading performance: orders served this shift, paid or not counted separately */}
                  <div>
                    <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1.5">📊 Sales (this shift)</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-hover rounded-xl p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide mb-1">Total Revenue</div>
                        <div className="text-red-600 text-xl font-bold">
                          £{(eodData?.total_revenue || 0).toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-surface-hover rounded-xl p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide mb-1">Total Orders</div>
                        <div className="text-blue-600 text-xl font-bold">{eodData?.total_orders || 0}</div>
                      </div>
                    </div>
                    <div className="mt-2 bg-surface-hover rounded-xl px-3 py-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Discounts given</span>
                        <span className="text-yellow-600 font-semibold">−£{(eodData?.discount_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Refunds</span>
                        <span className="text-red-600 font-semibold">£{(eodData?.refunds_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
                        <span className="text-foreground">Net Sales</span>
                        <span className="text-red-600">£{(eodData?.net_sales || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Collected — till reconciliation: money that actually landed today,
                      including any prior-shift Pay Later bill settled just now. This is
                      what Expected Cash below is based on, not Sales. */}
                  <div>
                    <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1.5">💰 Collected Today</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-hover rounded-xl p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide mb-1">💵 Cash</div>
                        <div className="text-green-600 text-xl font-bold">£{(eodData?.collected.cash_total || 0).toFixed(2)}</div>
                      </div>
                      <div className="bg-surface-hover rounded-xl p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide mb-1">💳 Card</div>
                        <div className="text-purple-600 text-xl font-bold">£{(eodData?.collected.card_total || 0).toFixed(2)}</div>
                      </div>
                    </div>
                    {(eodData?.collected.prior_settlements?.length || 0) > 0 && (
                      <div className="mt-2 bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-emerald-700 text-xs font-bold">Includes prior-shift settlements</span>
                          <span className="text-emerald-700 text-sm font-black">£{eodData?.collected.prior_total.toFixed(2)}</span>
                        </div>
                        <div className="space-y-1">
                          {eodData?.collected.prior_settlements.map((s, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] text-emerald-800">
                              <span>{s.order_number}{s.order_date ? ` — ${new Date(s.order_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</span>
                              <span className="font-semibold">£{s.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pending Bills — Pay Later orders, informational, doesn't block closing. */}
                  {(eodData?.pending_bills?.length || 0) > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 text-xs font-bold">📌 Pending Bills (this shift)</span>
                        <span className="text-amber-700 text-sm font-black">£{(eodData?.pending_bills_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="space-y-1">
                        {eodData?.pending_bills.map((o) => (
                          <div key={o.order_number} className="flex items-center justify-between text-[11px] text-amber-800">
                            <span>{o.order_number}{o.customer_name ? ` — ${o.customer_name}` : ""}</span>
                            <span className="font-semibold">£{o.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unresolved orders — blocks Close Day entirely. Every order this
                      shift must be paid or explicitly marked Pay Later before you can
                      close; this is what's stopping you. */}
                  {(eodData?.unresolved_orders?.length || 0) > 0 && (
                    <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-red-600">⛔</span>
                        <span className="text-red-700 text-xs font-bold">
                          Can't close yet — {eodData?.unresolved_orders.length} order{(eodData?.unresolved_orders.length || 0) > 1 ? "s" : ""} still need{(eodData?.unresolved_orders.length || 0) > 1 ? "" : "s"} to be paid or marked Pay Later
                        </span>
                      </div>
                      <div className="space-y-1">
                        {eodData?.unresolved_orders.map((o) => (
                          <div key={o.order_number} className="flex items-center justify-between text-[11px] text-red-800">
                            <span>{o.order_number}</span>
                            <span className="font-semibold">£{(o.total - o.amount_paid).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cash Paid Out — cash physically removed from the till this shift,
                      subtracted from Expected Cash below. */}
                  {(eodData?.cash_paid_outs?.length || 0) > 0 && (
                    <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-red-700 text-xs font-bold">💵 Cash Paid Out</span>
                        <span className="text-red-700 text-sm font-black">−£{(eodData?.cash_paid_out_total || 0).toFixed(2)}</span>
                      </div>
                      <div className="space-y-1">
                        {eodData?.cash_paid_outs.map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px] text-red-800">
                            <span>{p.reason}</span>
                            <span className="font-semibold">£{p.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opening float + expected cash — based on Collected (cash physically
                      taken this shift) minus any Cash Paid Out, not Sales, since a
                      prior-shift settlement adds real cash to the drawer today even
                      though it isn't today's sale, and a cash-out removes it. */}
                  <div className="flex items-center justify-between bg-surface-hover rounded-xl px-3 py-2.5 text-xs">
                    <span className="text-muted-foreground font-semibold">Opening Float + Cash Collected − Paid Out</span>
                    <span className="text-foreground font-bold">
                      £{(eodOpeningCash + (eodData?.collected.cash_total || 0) - (eodData?.cash_paid_out_total || 0)).toFixed(2)} expected
                    </span>
                  </div>

                  {/* Closing Cash Input */}
                  <div>
                    <label className="block text-muted-foreground text-xs font-semibold mb-1.5">
                      Closing Cash Count (£)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={eodClosingCash}
                      onChange={(e) => setEodClosingCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-hover border border-border text-foreground rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500"
                    />
                    {eodClosingCash && eodData && (
                      <p className={`mt-1.5 text-xs font-semibold ${Math.abs(parseFloat(eodClosingCash) - (eodOpeningCash + eodData.collected.cash_total - eodData.cash_paid_out_total)) < 0.01 ? "text-green-600" : "text-amber-600"}`}>
                        Variance: £{(parseFloat(eodClosingCash) - (eodOpeningCash + eodData.collected.cash_total - eodData.cash_paid_out_total)).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handlePrintEod}
                      disabled={!eodData}
                      className="py-3 bg-elevated hover:bg-elevated-hover disabled:opacity-40 text-foreground font-bold rounded-xl transition-colors text-sm"
                    >
                      🖨️ Print
                    </button>
                    <button
                      onClick={handleCloseDay}
                      disabled={eodLoading || (eodData?.unresolved_orders?.length || 0) > 0}
                      title={(eodData?.unresolved_orders?.length || 0) > 0 ? "Resolve every unpaid order first" : undefined}
                      className="py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
                    >
                      {eodLoading ? "Closing..." : "🔒 Close Day"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Open Till gate ──
          No open work_period for today: block ordering until a float is
          counted in. Managers get an escape hatch so a bug in this check
          can never lock the whole team out mid-service. */}
      {tillChecked && !tillFetchFailed && !tillPeriod && !tillBypassed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="px-6 py-5 border-b border-border text-center">
              <div className="text-3xl mb-2">🔐</div>
              <h2 className="text-foreground font-bold text-lg">Till Closed</h2>
              <p className="text-muted-foreground text-xs mt-1">Count in the float to open the till and start taking orders.</p>
            </div>
            <div className="px-6 py-5 space-y-4">
              {openTillError && (
                <div className="bg-red-50 border border-red-300 rounded-xl px-3 py-2.5 text-red-700 text-sm font-semibold">
                  ⚠ {openTillError}
                </div>
              )}
              <div>
                <label className="block text-muted-foreground text-xs font-semibold mb-1.5">
                  Opening Cash Float (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-surface-hover border border-border text-foreground rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={handleOpenTill}
                disabled={openTillLoading}
                className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {openTillLoading ? "Opening…" : "🔓 Open Till"}
              </button>
              {isManager && (
                <button
                  onClick={() => setTillBypassed(true)}
                  className="w-full text-center text-muted-foreground hover:text-foreground text-xs font-semibold underline underline-offset-2"
                >
                  Continue without opening (manager)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
