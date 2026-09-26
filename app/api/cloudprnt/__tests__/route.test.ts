// The CloudPRNT endpoint is public-facing (the printer calls it over the
// internet) and queued tickets carry customer names/phones/addresses — it
// must refuse anything without the shared key.
import { NextRequest } from "next/server";

jest.mock("@/lib/supabase", () => {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "is", "lte", "gte", "order", "limit", "eq", "update"]) builder[m] = () => builder;
  builder.then = (resolve: (v: unknown) => void) => Promise.resolve({ data: [], error: null }).then(resolve);
  return { __esModule: true, default: { from: () => builder } };
});

import { POST } from "@/app/api/cloudprnt/route";

const poll = (url: string, headers: Record<string, string> = {}) =>
  POST(new NextRequest(url, { method: "POST", body: JSON.stringify({ statusCode: "200 OK" }), headers }));

describe("CloudPRNT auth", () => {
  const original = process.env.CLOUDPRNT_KEY;
  beforeEach(() => { process.env.CLOUDPRNT_KEY = "s3cret"; });
  afterAll(() => { process.env.CLOUDPRNT_KEY = original; });

  it("rejects a poll without the key", async () => {
    expect((await poll("http://x/api/cloudprnt")).status).toBe(401);
    expect((await poll("http://x/api/cloudprnt?key=wrong")).status).toBe(401);
  });

  it("accepts the key in the query string", async () => {
    const res = await poll("http://x/api/cloudprnt?key=s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jobReady: false });
  });

  it("accepts the key as the Basic auth password", async () => {
    const auth = "Basic " + Buffer.from("printer:s3cret").toString("base64");
    expect((await poll("http://x/api/cloudprnt", { authorization: auth })).status).toBe(200);
  });
});
