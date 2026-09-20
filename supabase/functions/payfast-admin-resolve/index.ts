import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYFAST_SANDBOX = (Deno.env.get("PAYFAST_SANDBOX") ?? "true") === "true";
const PAYFAST_HOST = PAYFAST_SANDBOX ? "sandbox.payfast.co.za" : "www.payfast.co.za";

type Action =
  | { action: "verify"; paymentId: string }
  | { action: "mark_payment"; paymentId: string; status: "completed" | "failed" | "cancelled" }
  | { action: "mark_boost"; boostId: string; status: "active" | "failed" };

function jres(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Query PayFast for the latest known state of a transaction by pf_payment_id
async function fetchPayFastTxn(pfPaymentId: string) {
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID")!;
  const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY")!;
  const passPhrase = Deno.env.get("PAYFAST_PASSPHRASE") ?? "";
  const timestamp = new Date().toISOString();
  const fields: Record<string, string> = {
    "merchant-id": merchantId,
    "version": "v1",
    "timestamp": timestamp,
  };
  // Build signature per PayFast API: sorted alphabetically + passphrase
  const sigBase = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(fields[k]).replace(/%20/g, "+")}`)
    .join("&");
  const toHash = passPhrase ? `${sigBase}&passphrase=${encodeURIComponent(passPhrase).replace(/%20/g, "+")}` : sigBase;
  const sigBuf = await crypto.subtle.digest("MD5", new TextEncoder().encode(toHash)).catch(() => null);
  // Deno doesn't ship MD5 in subtle — fallback to a tiny MD5
  const signature = sigBuf
    ? Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("")
    : md5(toHash);

  const url = `https://api.payfast.co.za/transactions/history/daily?date=${timestamp.slice(0, 10)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "merchant-id": merchantId,
      "version": "v1",
      "timestamp": timestamp,
      "signature": signature,
      "Accept": "application/json",
    },
  });
  if (!res.ok) {
    return { ok: false, raw: await res.text(), status: res.status };
  }
  const data = await res.json().catch(() => null);
  // API returns array of txns; locate by pf_payment_id
  type Txn = { pf_payment_id?: string; payment_status?: string; amount_gross?: string };
  const txns: Txn[] = Array.isArray(data?.data?.response) ? data.data.response : [];
  const match = txns.find((t) => String(t.pf_payment_id) === String(pfPaymentId));
  return { ok: true, match, all: txns, _: PAYFAST_HOST };
}

// Minimal MD5 (sync) as a fallback if Web Crypto MD5 isn't supported.
function md5(str: string): string {
  function rh(n: number) { let s = "", j = 0; for (; j < 4; j++) s += "0123456789abcdef".charAt((n >> (j * 8 + 4)) & 0x0F) + "0123456789abcdef".charAt((n >> (j * 8)) & 0x0F); return s; }
  function ad(a: number, b: number) { return (a + b) & 0xFFFFFFFF; }
  function cm(q: number, a: number, b: number, x: number, s: number, t: number) { a = ad(ad(a, q), ad(x, t)); return ad((a << s) | (a >>> (32 - s)), b); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cm((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cm((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cm(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cm(c ^ (b | (~d)), a, b, x, s, t); }
  function blk(s: string) { const a: number[] = []; for (let i = 0; i < 64; i += 4) a[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24); return a; }
  function cyc(x: number[], k: number[]) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936); d = ff(d, a, b, c, k[1], 12, -389564586); c = ff(c, d, a, b, k[2], 17, 606105819); b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897); d = ff(d, a, b, c, k[5], 12, 1200080426); c = ff(c, d, a, b, k[6], 17, -1473231341); b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416); d = ff(d, a, b, c, k[9], 12, -1958414417); c = ff(c, d, a, b, k[10], 17, -42063); b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682); d = ff(d, a, b, c, k[13], 12, -40341101); c = ff(c, d, a, b, k[14], 17, -1502002290); b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510); d = gg(d, a, b, c, k[6], 9, -1069501632); c = gg(c, d, a, b, k[11], 14, 643717713); b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691); d = gg(d, a, b, c, k[10], 9, 38016083); c = gg(c, d, a, b, k[15], 14, -660478335); b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438); d = gg(d, a, b, c, k[14], 9, -1019803690); c = gg(c, d, a, b, k[3], 14, -187363961); b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467); d = gg(d, a, b, c, k[2], 9, -51403784); c = gg(c, d, a, b, k[7], 14, 1735328473); b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558); d = hh(d, a, b, c, k[8], 11, -2022574463); c = hh(c, d, a, b, k[11], 16, 1839030562); b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060); d = hh(d, a, b, c, k[4], 11, 1272893353); c = hh(c, d, a, b, k[7], 16, -155497632); b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174); d = hh(d, a, b, c, k[0], 11, -358537222); c = hh(c, d, a, b, k[3], 16, -722521979); b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487); d = hh(d, a, b, c, k[12], 11, -421815835); c = hh(c, d, a, b, k[15], 16, 530742520); b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844); d = ii(d, a, b, c, k[7], 10, 1126891415); c = ii(c, d, a, b, k[14], 15, -1416354905); b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571); d = ii(d, a, b, c, k[3], 10, -1894986606); c = ii(c, d, a, b, k[10], 15, -1051523); b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359); d = ii(d, a, b, c, k[15], 10, -30611744); c = ii(c, d, a, b, k[6], 15, -1560198380); b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070); d = ii(d, a, b, c, k[11], 10, -1120210379); c = ii(c, d, a, b, k[2], 15, 718787259); b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = ad(a, x[0]); x[1] = ad(b, x[1]); x[2] = ad(c, x[2]); x[3] = ad(d, x[3]);
  }
  const n = str.length;
  const st = [1732584193, -271733879, -1732584194, 271733878];
  let i;
  for (i = 64; i <= n; i += 64) cyc(st, blk(str.substring(i - 64, i)));
  str = str.substring(i - 64);
  const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < str.length; i++) tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) { cyc(st, tail); for (i = 0; i < 16; i++) tail[i] = 0; }
  tail[14] = n * 8; cyc(st, tail);
  return st.map(rh).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseService);

    // Auth + admin gate
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return jres({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return jres({ error: "Invalid auth" }, 401);
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return jres({ error: "Admin only" }, 403);

    const body = await req.json() as Action;

    if (body.action === "verify") {
      const { data: payment } = await supabase
        .from("payments")
        .select("id, status, amount, payfast_payment_id, content_id, payment_type")
        .eq("id", body.paymentId)
        .maybeSingle();
      if (!payment) return jres({ error: "Payment not found" }, 404);
      if (!payment.payfast_payment_id) {
        return jres({ ok: false, reason: "No pf_payment_id recorded yet — PayFast never delivered an ITN." });
      }
      const result = await fetchPayFastTxn(payment.payfast_payment_id);
      return jres({ ok: true, payment, payfast: result });
    }

    if (body.action === "mark_payment") {
      const { error } = await supabase
        .from("payments")
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq("id", body.paymentId);
      if (error) return jres({ error: error.message }, 400);
      return jres({ ok: true });
    }

    if (body.action === "mark_boost") {
      const update: Record<string, unknown> = {
        status: body.status,
        updated_at: new Date().toISOString(),
      };
      if (body.status === "active") {
        const { data: b } = await supabase
          .from("post_boosts")
          .select("duration_hours")
          .eq("id", body.boostId)
          .maybeSingle();
        const hrs = b?.duration_hours ?? 24;
        update.expires_at = new Date(Date.now() + hrs * 3600_000).toISOString();
      }
      const { error } = await supabase
        .from("post_boosts")
        .update(update)
        .eq("id", body.boostId);
      if (error) return jres({ error: error.message }, 400);
      return jres({ ok: true });
    }

    return jres({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("admin-resolve error", e);
    const msg = e instanceof Error ? e.message : "error";
    return jres({ error: msg }, 500);
  }
});
