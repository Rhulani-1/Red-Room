// Client-side PayFast helpers — DO NOT include any secrets here.
// Signature generation and secret material must only live server-side in Edge Functions.

export type BuildPaymentFields = {
  amount: string; // e.g. "10.00"
  item_name: string;
  m_payment_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first?: string;
  email_address?: string;
  custom_str1?: string; // contentId
  custom_str2?: string; // paymentType
  custom_str3?: string; // creatorId
};

export const PAYFAST_PAYMENT_URL = "https://sandbox.payfast.co.za/eng/process";

export function buildPaymentFormFields(fields: BuildPaymentFields) {
  return {
    merchant_id: '', // left blank on client — server will inject
    merchant_key: '', // left blank on client — server will inject
    amount: fields.amount,
    item_name: fields.item_name,
    m_payment_id: fields.m_payment_id,
    return_url: fields.return_url,
    cancel_url: fields.cancel_url,
    notify_url: fields.notify_url,
    name_first: fields.name_first ?? '',
    email_address: fields.email_address ?? '',
    custom_str1: fields.custom_str1 ?? '',
    custom_str2: fields.custom_str2 ?? '',
    custom_str3: fields.custom_str3 ?? '',
  };
}

export async function createPayFastPayment({
  contentId,
  amount,
  itemName,
  paymentType = 'once_off',
  creatorId,
}: {
  contentId?: string;
  amount: number;
  itemName: string;
  paymentType?: 'once_off' | 'subscription' | 'wallet_deposit';
  creatorId?: string;
}) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be logged in to make a payment');

  const { data, error } = await supabase.functions.invoke('payfast-create-payment', {
    body: { contentId, amount, itemName, paymentType, creatorId },
  });
  if (error) throw error;
  return data as { paymentId: string; paymentLogId?: string | null; redirectUrl: string };
}

export async function payWithWallet(params: {
  contentId?: string;
  creatorId?: string;
  amount: number;
  description?: string;
  recipientUserId?: string;
  action?: 'pay' | 'transfer';
}) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be logged in');

  const { data, error } = await supabase.functions.invoke('wallet-pay', {
    body: {
      action: params.action ?? 'pay',
      amount: params.amount,
      contentId: params.contentId,
      creatorId: params.creatorId,
      description: params.description,
      recipientUserId: params.recipientUserId,
    },
  });

  if (error) {
    type FErr = { context?: { body?: string } } & { message?: string };
    const fe = error as FErr;
    let msg = fe.message || 'Wallet payment failed';
    try {
      if (fe.context?.body) {
        const parsed = JSON.parse(fe.context.body);
        if (parsed?.error) msg = parsed.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as { ok: boolean; paymentId?: string };
}

export async function checkContentUnlocked(contentId: string): Promise<boolean> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data } = await supabase
    .from('content_unlocks')
    .select('id')
    .eq('content_id', contentId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  return !!data;
}

export async function checkSubscription(creatorId: string): Promise<boolean> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data } = await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('creator_id', creatorId)
    .eq('subscriber_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();

  return !!data;
}
