import { NextRequest, NextResponse } from "next/server";
import { checkDeliveryEligibility, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, MIN_DELIVERY_ORDER } from "@/lib/delivery-zones";

export async function GET(req: NextRequest) {
  const postcode = new URL(req.url).searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "postcode is required" }, { status: 400 });

  const { deliverable } = await checkDeliveryEligibility(postcode);
  if (!deliverable) return NextResponse.json({ deliverable: false });
  return NextResponse.json({
    deliverable: true,
    fee: DELIVERY_FEE,
    free_over: FREE_DELIVERY_THRESHOLD,
    min_order: MIN_DELIVERY_ORDER,
  });
}
