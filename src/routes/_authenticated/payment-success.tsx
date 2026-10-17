import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/lib/account";
import { PaymentResult } from "@/components/PaymentResult";

export const Route = createFileRoute("/_authenticated/payment-success")({
  head: () => ({ meta: [
    { title: "Payment successful — Welcome to WorkCash" },
    { name: "description", content: "Your WorkCash activation is confirmed. Start earning with videos, surveys and referrals." },
    { property: "og:title", content: "Payment successful — Welcome to WorkCash" },
    { property: "og:description", content: "Welcome to WorkCash. Your account is active and ready to earn." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: PaymentSuccess,
});

function PaymentSuccess() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  useEffect(() => {
    if (profile && !profile.is_activated) void navigate({ to: "/dashboard", replace: true });
  }, [profile, navigate]);
  if (!profile?.is_activated) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  return <PaymentResult success name={profile.full_name?.split(" ")[0]} />;
}