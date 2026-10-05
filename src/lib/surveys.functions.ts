import { createServerFn } from "@tanstack/react-start";
import { createHash } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSurveyWallUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const appId = process.env["CPX_APP_ID"];
    const hash = process.env["CPX_SECURE_HASH"];
    if (!appId || !hash) return { url: null as string | null, reason: "not_configured" };
    const { data: prof } = await context.supabase.from("profiles").select("is_activated,email,full_name").eq("id", context.userId).single();
    if (!prof?.is_activated) return { url: null, reason: "not_activated" };
    const secure = createHash("md5").update(`${context.userId}-${hash}`).digest("hex");
    const p = new URLSearchParams({
      app_id: appId,
      ext_user_id: context.userId,
      secure_hash: secure,
      username: prof.full_name ?? "",
      email: prof.email ?? "",
    });
    return { url: `https://offers.cpx-research.com/index.php?${p.toString()}`, reason: null };
  });
