import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const [{ data: profile, error }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", u.user.id).single(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);
      if (error) throw error;
      return { ...profile, isAdmin: !!isAdmin };
    },
  });
}

export const ksh = (n: number | string) => `KSh ${Number(n).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";
}
