import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startActivationPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string().trim().regex(/^(?:\+?254|0)[17]\d{8}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["MPESA_CONSUMER_KEY"], secret = process.env["MPESA_CONSUMER_SECRET"];
    const passkey = process.env["MPESA_PASSKEY"], short = process.env["MPESA_SHORTCODE"], till = process.env["MPESA_TILL"];
    if (!key || !secret || !passkey || !short || !till) throw new Error("M-Pesa is not configured");

    const { data: prof } = await context.supabase.from("profiles").select("is_activated").eq("id", context.userId).single();
    if (prof?.is_activated) throw new Error("Your account is already active");

    const phone = "254" + data.phone.replace(/^\+?254|^0/, "");
    const tok = await fetch("https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
      headers: { Authorization: "Basic " + btoa(`${key}:${secret}`) },
    });
    if (!tok.ok) throw new Error("Could not reach M-Pesa. Try again.");
    const { access_token } = (await tok.json()) as { access_token: string };

    const d = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
    const ts = d.slice(0, 19).replace(/[-T:]/g, "");
    const origin = new URL(getRequestUrl()).origin;
    const res = await fetch("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: short,
        Password: btoa(short + passkey + ts),
        Timestamp: ts,
        TransactionType: "CustomerBuyGoodsOnline",
        Amount: 100,
        PartyA: phone,
        PartyB: till,
        PhoneNumber: phone,
        CallBackURL: `${origin}/api/public/mpesa-callback`,
        AccountReference: "WorkCash",
        TransactionDesc: "Activation",
      }),
    });
    const body = (await res.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; CustomerMessage?: string };
    if (body.ResponseCode !== "0" || !body.CheckoutRequestID) throw new Error(body.errorMessage ?? "M-Pesa request failed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activation_payments").insert({
      user_id: context.userId, phone, method: "stk", checkout_request_id: body.CheckoutRequestID, status: "pending",
    });
    return { ok: true };
  });
