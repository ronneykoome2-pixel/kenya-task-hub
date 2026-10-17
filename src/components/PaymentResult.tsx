import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, ShieldCheck, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import successImage from "@/assets/payment-success.jpg";

export function PaymentResult({ success, name }: { success: boolean; name?: string | undefined }) {
  return (
    <section className="payment-result relative -mx-5 -my-8 overflow-hidden bg-card px-5 py-12 text-center sm:py-16">
      <div className={`absolute inset-x-0 top-0 h-2 ${success ? "bg-primary" : "bg-destructive"}`} />
      {success ? (
        <img src={successImage} alt="Green check mark surrounded by gold coins and colorful confetti" width={1024} height={1024} className="mx-auto mb-5 aspect-square w-64 max-w-full object-contain sm:w-80" />
      ) : (
        <div className="mx-auto mb-8 flex h-36 w-36 items-center justify-center rounded-full bg-destructive/10 text-destructive"><CircleX className="h-20 w-20" strokeWidth={1.5} /></div>
      )}
      <div className="mx-auto max-w-xl">
        <p className={`mb-3 text-sm font-bold uppercase ${success ? "text-primary" : "text-destructive"}`}>{success ? "Payment successful" : "Payment failed"}</p>
        <h1 className="text-4xl font-bold sm:text-5xl">{success ? `Welcome to WorkCash${name ? `, ${name}` : ""}!` : "Let’s try again."}</h1>
        <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground">{success ? "Your account is active and KSh 100 has been added to your earnings wallet. You’re ready to start earning." : "Your activation payment wasn’t completed. Your account is still inactive. You can try again with M-Pesa."}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to={success ? "/videos" : "/dashboard"}>{success ? "Start earning" : "Try again"}{success ? <ArrowRight /> : <RotateCcw />}</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/dashboard">{success ? "Go to my wallet" : "Back to my wallet"}</Link></Button>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">{success ? <><ShieldCheck className="h-4 w-4 text-primary" />Activation confirmed</> : "Already received a payment SMS? Submit your M-Pesa code from your wallet for review before paying again."}</p>
      </div>
      {success && <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 border-t pt-6 text-sm font-semibold"><span className="text-primary">Videos & surveys</span><span className="text-gold-foreground">Daily poll bonus</span><span className="text-primary">Invite & earn</span></div>}
    </section>
  );
}