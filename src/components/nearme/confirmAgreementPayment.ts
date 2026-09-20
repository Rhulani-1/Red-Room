import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface ConfirmResult {
  ok: boolean;
  duplicate: boolean;
  error?: string;
}

/**
 * Inserts a single-row record into `agreement_payment_confirmations`.
 * The table has a UNIQUE constraint on `agreement_id`, so a second attempt
 * for the same agreement returns Postgres error code 23505 (unique_violation).
 *
 * Returns:
 *   - ok=true, duplicate=false   → first successful confirmation
 *   - ok=true, duplicate=true    → already confirmed (treat as idempotent success on UI)
 *   - ok=false, error=...        → unexpected failure
 */
export async function confirmAgreementPayment(
  agreementId: string
): Promise<ConfirmResult> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("agreement_payment_confirmations")
    .insert({
      agreement_id: agreementId,
      confirmed_by: userData.user?.id ?? null,
    });

  if (!error) {
    toast.success("Payment confirmed via QR");
    return { ok: true, duplicate: false };
  }

  const code = (error as { code?: string }).code;
  if (code === "23505") {
    toast.error("This agreement has already been confirmed.");
    return { ok: true, duplicate: true };
  }

  toast.error(error.message || "Could not confirm payment.");
  return { ok: false, duplicate: false, error: error.message };
}
