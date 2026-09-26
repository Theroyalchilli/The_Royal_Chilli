// SumUp Cloud API client for the till's Solo reader: the requests we send,
// and how SumUp's transaction statuses map to "paid" / "declined" / waiting.
import {
  checkReaderPayment,
  interpretTransaction,
  pairReader,
  refundTransaction,
  startReaderCheckout,
  sumupReference,
  sumupTransactionFromReference,
} from "@/lib/sumup";

const fetchMock = jest.fn();
const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.SUMUP_API_KEY = "sup_sk_test";
  process.env.SUMUP_MERCHANT_CODE = "MABC123";
  process.env.SUMUP_AFFILIATE_APP_ID = "com.royalchilli.pos";
  process.env.SUMUP_AFFILIATE_KEY = "aff_key";
});

describe("startReaderCheckout", () => {
  it("sends the amount in pence with the affiliate key and returns the client transaction id", async () => {
    fetchMock.mockReturnValue(reply(201, { data: { client_transaction_id: "ctx-1" } }));
    const id = await startReaderCheckout("rdr1", 23.5, "https://pos.example/api/sumup/webhook", "Royal Chilli RC-7");
    expect(id).toBe("ctx-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sumup.com/v0.1/merchants/MABC123/readers/rdr1/checkout");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sup_sk_test");
    expect(JSON.parse(init.body)).toEqual({
      total_amount: { currency: "GBP", minor_unit: 2, value: 2350 },
      affiliate: { app_id: "com.royalchilli.pos", key: "aff_key" },
      return_url: "https://pos.example/api/sumup/webhook",
      description: "Royal Chilli RC-7",
    });
  });

  it("refuses to start without an affiliate key", async () => {
    delete process.env.SUMUP_AFFILIATE_KEY;
    await expect(startReaderCheckout("rdr1", 5, "https://x/y")).rejects.toThrow(/affiliate/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces SumUp's error message", async () => {
    fetchMock.mockReturnValue(reply(422, { detail: "Reader is offline" }));
    await expect(startReaderCheckout("rdr1", 5, "https://x/y")).rejects.toThrow("Reader is offline");
  });
});

describe("checkReaderPayment", () => {
  it("looks the transaction up by client transaction id", async () => {
    fetchMock.mockReturnValue(reply(200, { id: "tx9", status: "SUCCESSFUL", amount: 23.5 }));
    expect(await checkReaderPayment("ctx 1")).toEqual({ status: "successful", transactionId: "tx9", amount: 23.5 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.sumup.com/v2.1/merchants/MABC123/transactions?client_transaction_id=ctx%201");
  });

  it("treats 'no transaction yet' as still waiting for the card", async () => {
    fetchMock.mockReturnValue(reply(404, { message: "Not found" }));
    expect(await checkReaderPayment("ctx-1")).toEqual({ status: "pending" });
  });
});

describe("interpretTransaction", () => {
  it.each([
    ["FAILED", "failed"],
    ["CANCELLED", "cancelled"],
    ["PENDING", "pending"],
  ])("%s -> %s", (status, expected) => {
    expect(interpretTransaction({ id: "t", status, amount: 1 }).status).toBe(expected);
  });
});

describe("pairReader / refundTransaction", () => {
  it("pairs with the code from the Solo", async () => {
    fetchMock.mockReturnValue(reply(201, { id: "rdr_1", name: "Reception", status: "paired" }));
    expect(await pairReader("ABCD1234", "Reception")).toEqual({ id: "rdr_1", name: "Reception", status: "paired" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ pairing_code: "ABCD1234", name: "Reception" });
  });

  it("refunds a transaction by amount", async () => {
    fetchMock.mockReturnValue(reply(204, undefined));
    await refundTransaction("tx9", 10.5);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sumup.com/v1.0/merchants/MABC123/payments/tx9/refunds");
    expect(JSON.parse(init.body)).toEqual({ amount: 10.5 });
  });
});

describe("payment references", () => {
  it("round-trips a SumUp transaction id and ignores Stripe references", () => {
    expect(sumupTransactionFromReference(sumupReference("tx9"))).toBe("tx9");
    expect(sumupTransactionFromReference("pi_123")).toBeNull();
    expect(sumupTransactionFromReference(null)).toBeNull();
  });
});
