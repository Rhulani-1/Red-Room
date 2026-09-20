import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sonner
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// Mock supabase client. The first insert succeeds, the second returns 23505.
const insertMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-123" } } }),
    },
    from: (_table: string) => ({
      insert: (row: unknown) => insertMock(row),
    }),
  },
}));

import { confirmAgreementPayment } from "./confirmAgreementPayment";

describe("confirmAgreementPayment", () => {
  beforeEach(() => {
    insertMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("succeeds on first confirmation and shows success toast", async () => {
    insertMock.mockResolvedValueOnce({ error: null });

    const res = await confirmAgreementPayment("agr-1");

    expect(res).toEqual({ ok: true, duplicate: false });
    expect(insertMock).toHaveBeenCalledWith({
      agreement_id: "agr-1",
      confirmed_by: "user-123",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Payment confirmed via QR");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("treats unique_violation (23505) as duplicate and shows error toast", async () => {
    insertMock.mockResolvedValueOnce({
      error: { code: "23505", message: "duplicate key value" },
    });

    const res = await confirmAgreementPayment("agr-1");

    expect(res).toEqual({ ok: true, duplicate: true });
    expect(toastError).toHaveBeenCalledWith(
      "This agreement has already been confirmed."
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("only the first of two concurrent attempts succeeds; the second is a duplicate", async () => {
    insertMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({
        error: { code: "23505", message: "duplicate key value" },
      });

    const [first, second] = await Promise.all([
      confirmAgreementPayment("agr-2"),
      confirmAgreementPayment("agr-2"),
    ]);

    expect(first).toEqual({ ok: true, duplicate: false });
    expect(second).toEqual({ ok: true, duplicate: true });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      "This agreement has already been confirmed."
    );
  });

  it("surfaces unexpected errors via error toast and returns ok=false", async () => {
    insertMock.mockResolvedValueOnce({
      error: { code: "42501", message: "permission denied" },
    });

    const res = await confirmAgreementPayment("agr-3");

    expect(res.ok).toBe(false);
    expect(res.duplicate).toBe(false);
    expect(toastError).toHaveBeenCalledWith("permission denied");
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
