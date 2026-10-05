import { createFileRoute } from "@tanstack/react-router";

type Item = { Name: string; Value?: string | number };
type Body = { Body?: { stkCallback?: { CheckoutRequestID?: string; ResultCode?: number; ResultDesc?: string; CallbackMetadata?: { Item?: Item[] } } } };

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ack = () => Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
        let body: Body;
        try { body = (await request.json()) as Body; } catch { return ack(); }
        const cb = body.Body?.stkCallback;
        const id = cb?.CheckoutRequestID;
        if (!cb || typeof id !== "string" || id.length > 100) return ack();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Only touch a payment we created ourselves and that is still pending
        const { data: pay } = await supabaseAdmin.from("activation_payments").select("id,status").eq("checkout_request_id", id).maybeSingle();
        if (!pay || pay.status !== "pending") return ack();

        if (cb.ResultCode === 0) {
          const items = cb.CallbackMetadata?.Item ?? [];
          const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "");
          const amount = Number(items.find((i) => i.Name === "Amount")?.Value ?? 0);
          await supabaseAdmin.from("activation_payments").update({
            status: amount >= 100 ? "paid" : "failed",
            mpesa_receipt: receipt.slice(0, 20),
            note: amount >= 100 ? null : `Paid ${amount}`,
          }).eq("id", pay.id);
        } else {
          await supabaseAdmin.from("activation_payments").update({ status: "failed", note: String(cb.ResultDesc ?? "").slice(0, 200) }).eq("id", pay.id);
        }
        return ack();
      },
    },
  },
});
