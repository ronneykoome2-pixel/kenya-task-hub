import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return "254" + d.slice(1);
  return "254" + d;
}

export const startActivationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phone: z.string().regex(/^(?:\+?254|0)[17]\d{8}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["MPESA_CONSUMER_KEY"];
    const secret = process.env["MPESA_CONSUMER_SECRET"];
    const shortcode = process.env["MPESA_SHORTCODE"];
    const passkey = process.env["MPESA_PASSKEY"];
    const env = process.env["MPESA_ENV"] === "production" ? "production" : "sandbox";
    if (!key || !secret || !shortcode || !passkey) {
      return { ok: false as const, error: "M-Pesa payments are not set up yet. Use the M-Pesa code option instead." };
    }

    const { data: prof } = await context.supabase.from("profiles").select("is_activated").eq("id", context.userId).single();
    if (prof?.is_activated) return { ok: false as const, error: "Your account is already activated." };

    const base = env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const phone = normalizePhone(data.phone);
    try {
      const tokRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: "Basic " + btoa(`${key}:${secret}`) },
      });
      const tok = (await tokRes.json()) as { access_token?: string };
      if (!tok.access_token) throw new Error("token failed");

      const now = new Date(Date.now() + 3 * 3600 * 1000); // EAT
      const ts = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const origin = new URL(getRequest().url).origin;
      const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: btoa(shortcode + passkey + ts),
          Timestamp: ts,
          TransactionType: "CustomerPayBillOnline",
          Amount: 100,
          PartyA: phone,
          PartyB: shortcode,
          PhoneNumber: phone,
          CallBackURL: `${origin}/api/public/mpesa-callback`,
          AccountReference: "WorkCash",
          TransactionDesc: "Account activation",
        }),
      });
      const out = (await res.json()) as { CheckoutRequestID?: string; ResponseCode?: string; errorMessage?: string };
      if (out.ResponseCode !== "0" || !out.CheckoutRequestID) {
        console.error("STK push failed", out);
        return { ok: false as const, error: "Could not send the M-Pesa prompt. Please try again." };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("activation_payments").insert({
        user_id: context.userId,
        phone,
        method: "stk",
        checkout_request_id: out.CheckoutRequestID,
        status: "pending",
      });
      return { ok: true as const };
    } catch (e) {
      console.error(e);
      return { ok: false as const, error: "M-Pesa is unavailable right now. Please try again." };
    }
  });
