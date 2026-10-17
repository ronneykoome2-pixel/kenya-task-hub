import { describe, expect, it } from "vitest";
import { paymentOutcome } from "@/lib/payment-outcome";

const attempt = { previousPaymentId: "old", startedAt: Date.parse("2026-10-17T10:00:00Z") };
const payment = { id: "new", method: "stk", status: "pending", created_at: "2026-10-17T10:00:01Z" };

describe("Payment result routing", () => {
  it("welcomes users only after their account is confirmed active", () => {
    expect(paymentOutcome(true, attempt, payment)).toBe("success");
    expect(paymentOutcome(false, attempt, { ...payment, status: "paid" })).toBeNull();
  });
  it("shows retry after a failed current payment", () => {
    expect(paymentOutcome(false, attempt, { ...payment, status: "failed" })).toBe("failed");
  });
  it("never treats a pending payment as failed", () => {
    expect(paymentOutcome(false, attempt, payment)).toBeNull();
  });
  it("ignores a failure from an older payment", () => {
    expect(paymentOutcome(false, attempt, { ...payment, id: "old", status: "failed" })).toBeNull();
    expect(paymentOutcome(false, attempt, { ...payment, status: "failed", created_at: "2026-10-16T10:00:01Z" })).toBeNull();
  });
  it("does not redirect users who have no payment attempt", () => {
    expect(paymentOutcome(true, null, payment)).toBeNull();
  });
});