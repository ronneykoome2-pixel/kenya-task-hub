export type PaymentAttempt = { previousPaymentId: string | null; startedAt: number };
export type PaymentStatus = { id: string; status: string; method: string; created_at: string };

export function paymentOutcome(activated: boolean, attempt: PaymentAttempt | null, latest?: PaymentStatus) {
  if (!attempt) return null;
  if (activated) return "success";
  if (latest && latest.id !== attempt.previousPaymentId &&
    new Date(latest.created_at).getTime() >= attempt.startedAt - 30000 &&
    (latest.status === "failed" || latest.status === "rejected")) return "failed";
  return null;
}