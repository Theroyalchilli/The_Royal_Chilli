"use client";

export default function CustomerDetailsModal({
  orderType,
  name,
  phone,
  address,
  onChangeName,
  onChangePhone,
  onChangeAddress,
  onConfirm,
  onClose,
}: {
  orderType: "takeaway" | "delivery";
  name: string;
  phone: string;
  address: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onChangeAddress: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const addressMissing = orderType === "delivery" && address.trim().length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-foreground text-lg font-bold">Customer details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {orderType === "delivery" ? "Name and phone are optional — an address is needed for the driver." : "Optional — add if the customer wants to be called when it's ready."}
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
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="pos-btn no-select flex-1 rounded-full border border-border py-2.5 font-semibold text-muted-foreground hover:bg-surface-hover">
            Back to order
          </button>
          <button
            onClick={() => !addressMissing && onConfirm()}
            disabled={addressMissing}
            className="pos-btn no-select flex-1 rounded-full bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
