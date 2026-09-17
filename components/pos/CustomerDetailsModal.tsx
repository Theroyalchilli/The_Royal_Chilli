"use client";

export default function CustomerDetailsModal({
  orderType,
  name,
  phone,
  address,
  email,
  marketingConsent,
  onChangeName,
  onChangePhone,
  onChangeAddress,
  onChangeEmail,
  onChangeMarketingConsent,
  onConfirm,
  onClose,
}: {
  orderType: "takeaway" | "delivery" | "dine_in";
  name: string;
  phone: string;
  address: string;
  email: string;
  marketingConsent: boolean;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeAddress: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangeMarketingConsent: (v: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const addressMissing = orderType === "delivery" && address.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-foreground text-lg font-bold">{orderType === "dine_in" ? "Loyalty number?" : "Customer details"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {orderType === "delivery"
            ? "Name and phone are optional — an address is needed for the driver."
            : orderType === "dine_in"
            ? "Completely optional — add a phone number to track their loyalty points for this visit."
            : "Optional — add if the customer wants to be called when it's ready."}
        </p>

        <div className="mt-4 space-y-2.5">
          <input
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Customer Name"
            autoFocus
            className="w-full rounded-lg border border-border bg-surface-hover px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          <input
            value={phone}
            onChange={(e) => onChangePhone(e.target.value)}
            placeholder="Phone Number"
            className="w-full rounded-lg border border-border bg-surface-hover px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          {orderType === "delivery" && (
            <div>
              <textarea
                value={address}
                onChange={(e) => onChangeAddress(e.target.value)}
                placeholder="Delivery Address"
                rows={3}
                className={`w-full resize-none rounded-lg border bg-surface-hover px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-red-500 ${addressMissing ? "border-red-500" : "border-border"}`}
              />
              {addressMissing && <p className="mt-1 text-xs font-semibold text-red-500">Address is required for delivery</p>}
            </div>
          )}
          {orderType === "dine_in" && phone.trim() && (
            <>
              <input
                value={email}
                onChange={(e) => onChangeEmail(e.target.value)}
                placeholder="Email (optional)"
                type="email"
                className="w-full rounded-lg border border-border bg-surface-hover px-3 py-2.5 text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              {email.trim() && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={marketingConsent} onChange={(e) => onChangeMarketingConsent(e.target.checked)} className="mt-0.5" />
                  <span>Email them offers &amp; rewards updates</span>
                </label>
              )}
            </>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          {orderType === "dine_in" ? (
            <button onClick={onConfirm} className="pos-btn no-select flex-1 rounded-full border border-border py-2.5 font-semibold text-muted-foreground hover:bg-surface-hover">
              Skip
            </button>
          ) : (
            <button onClick={onClose} className="pos-btn no-select flex-1 rounded-full border border-border py-2.5 font-semibold text-muted-foreground hover:bg-surface-hover">
              Back to order
            </button>
          )}
          <button
            onClick={() => !addressMissing && onConfirm()}
            disabled={addressMissing}
            className="pos-btn no-select flex-1 rounded-full bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {orderType === "dine_in" ? "Add & Pay" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
