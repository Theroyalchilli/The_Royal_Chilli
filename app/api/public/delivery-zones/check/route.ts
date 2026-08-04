import { NextRequest, NextResponse } from "next/server";
import { matchDeliveryZone } from "@/lib/delivery-zones";

export async function GET(req: NextRequest) {
  const postcode = new URL(req.url).searchParams.get("postcode");
  if (!postcode) return NextResponse.json({ error: "postcode is required" }, { status: 400 });

  const zone = await matchDeliveryZone(postcode);
  if (!zone) return NextResponse.json({ deliverable: false });
  return NextResponse.json({ deliverable: true, fee: zone.fee, min_order: zone.min_order, zone_name: zone.name });
}
