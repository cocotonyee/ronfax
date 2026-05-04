import { NextRequest, NextResponse } from "next/server";
import { APP_NAME } from "@/lib/constants";
import {
  REPLY_UNLOCK_CENTS,
  getInboundReply,
} from "@/lib/reply-store";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Starts Stripe Checkout ($0.99) to unlock an inbound reply PDF.
 * Link from notification email: GET /api/reply/checkout?d={downloadToken}
 */
export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d")?.trim();
  if (!d) {
    return NextResponse.json({ error: "Missing d" }, { status: 400 });
  }

  const rec = await getInboundReply(d);
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not configured" },
      { status: 500 },
    );
  }

  if (rec.paid) {
    return NextResponse.redirect(
      `${appUrl}/api/reply/download?d=${encodeURIComponent(d)}`,
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: rec.notifyEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${APP_NAME} — Inbound reply PDF`,
              description: `Unlock PDF · Ref ${rec.refCode}`,
            },
            unit_amount: REPLY_UNLOCK_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/reply/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?reply=cancelled`,
      metadata: {
        purpose: "reply_download",
        downloadToken: String(d),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not start checkout" },
        { status: 502 },
      );
    }

    return NextResponse.redirect(session.url);
  } catch (e) {
    console.error("[reply/checkout]", e);
    return NextResponse.json(
      { error: "Payment provider unavailable" },
      { status: 502 },
    );
  }
}
