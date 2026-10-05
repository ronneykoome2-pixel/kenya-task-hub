import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

// CPX Research postback URL (set in the CPX publisher dashboard):
// https://YOUR-SITE/api/public/cpx-postback?status={status}&trans_id={trans_id}&user_id={user_id}&amount_local={amount_local}&hash={secure_hash}
export const Route = createFileRoute("/api/public/cpx-postback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CPX_SECURE_HASH"];
        if (!secret) return new Response("not configured", { status: 500 });
        const q = new URL(request.url).searchParams;
        const status = q.get("status");
        const trans = q.get("trans_id") ?? "";
        const user = q.get("user_id") ?? "";
        const amount = Number(q.get("amount_local") ?? "0");
        const hash = q.get("hash") ?? "";

        const expected = createHash("md5").update(`${trans}-${secret}`).digest("hex");
        if (hash.length !== expected.length || !timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
          return new Response("bad hash", { status: 401 });
        }
        if (!/^[0-9a-f-]{36}$/i.test(user) || !trans || trans.length > 100 || !Number.isFinite(amount) || amount < 0 || amount > 5000) {
          return new Response("bad input", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (status === "1") {
          const { error } = await supabaseAdmin.from("survey_completions").insert({ user_id: user, trans_id: trans, amount });
          if (!error) {
            await supabaseAdmin.rpc("credit_wallet", { _user: user, _amount: amount, _kind: "survey", _desc: "Survey completed" });
          }
        } else if (status === "2") {
          const { data: row } = await supabaseAdmin.from("survey_completions").select("id,amount,status").eq("trans_id", trans).maybeSingle();
          if (row && row.status === "credited") {
            await supabaseAdmin.from("survey_completions").update({ status: "reversed" }).eq("id", row.id);
            await supabaseAdmin.rpc("credit_wallet", { _user: user, _amount: -Number(row.amount), _kind: "survey", _desc: "Survey reversed" });
          }
        }
        return new Response("1");
      },
    },
  },
});
