import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useProfile } from "@/lib/account";
import { PaymentResult } from "@/components/PaymentResult";

export const Route = createFileRoute("/_authenticated/payment-failed")({
  head: () => ({ meta: [
    { title: "Payment failed — Try again | WorkCash" },
    { name: "description", content: "Retry your WorkCash activation payment with M-Pesa or submit a missing payment code for review." },
    { property: "og:title", content: "Payment failed — Try again | WorkCash" },
    { property: "og:description", content: "Your activation payment was not completed. Return to your wallet to try again." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: PaymentFailed,
});

function PaymentFailed() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  useEffect(() => {
    if (profile?.is_activated) void navigate({ to: "/payment-success", replace: true });
  }, [profile, navigate]);
  if (!profile || profile.is_activated) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  return <PaymentResult success={false} />;
}