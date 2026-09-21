// 사람이 남기는 의도(다음 순서 · 중단 요청 · 메모)를 KV 의 `control` 키에 둔다.
// GET 은 누구나(=Access 를 통과한 사람) 읽는다. POST 는 Access JWT 를 검증해야만 쓴다 —
// ACCESS_AUD 가 설정돼 있지 않으면 쓰기를 막고(503) 화면에는 읽기 전용이라고 알린다.
// 검증 논리는 템플릿의 access.js 와 같다(WebCrypto 만 쓰고 외부 패키지 없음).

const TEAM = "https://iamseungpil.cloudflareaccess.com";
const CERTS_URL = TEAM + "/cdn-cgi/access/certs";
const CERTS_TTL_MS = 60 * 60 * 1000;
const KEY = "control";
let certs = {at: 0, keys: []};

const json = (body, status = 200) => new Response(JSON.stringify(body),
  {status, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});
const b64 = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};
const decode = (p) => JSON.parse(new TextDecoder().decode(b64(p)));

async function publicKeys(force) {
  if (force || Date.now() - certs.at > CERTS_TTL_MS || !certs.keys.length) {
    const res = await fetch(CERTS_URL, {cf: {cacheTtl: 300}});
    if (!res.ok) throw new Error("access certs unavailable: " + res.status);
    certs = {at: Date.now(), keys: (await res.json()).keys || []};
  }
  return certs.keys;
}
async function verifyAccess(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Error("missing Cf-Access-Jwt-Assertion");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed jwt");
  const header = decode(parts[0]);
  if (header.alg !== "RS256") throw new Error("unexpected alg " + header.alg);
  const byKid = (keys) => keys.find((k) => k.kid === header.kid);
  const jwk = byKid(await publicKeys()) || byKid(await publicKeys(true));
  if (!jwk) throw new Error("unknown kid");
  const key = await crypto.subtle.importKey("jwk", {kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true},
    {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("bad signature");
  const c = decode(parts[1]), now = Math.floor(Date.now() / 1000);
  if (typeof c.exp !== "number" || c.exp < now) throw new Error("token expired");
  if (c.iss !== TEAM) throw new Error("wrong issuer");
  const auds = Array.isArray(c.aud) ? c.aud : [c.aud];
  const allowed = String(env.ACCESS_AUD).split(",").map((s) => s.trim()).filter(Boolean);
  if (!auds.some((a) => allowed.includes(a))) throw new Error("wrong audience");
  if (!c.email) throw new Error("no email claim");
  return c.email;
}

const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

export async function onRequest({request, env}) {
  if (!env.LIVE) return json({read_only: true, why: "KV 바인딩(LIVE)이 없어 제어를 쓸 수 없습니다."}, 200);
  const cur = JSON.parse((await env.LIVE.get(KEY)) || "{}");
  if (request.method === "GET") {
    const ro = !env.ACCESS_AUD;
    return json({...cur, read_only: ro,
                 why: ro ? "이 배포에는 Access 확인값(ACCESS_AUD)이 없어 쓰기를 막아 두었습니다 — 읽기 전용입니다." : ""});
  }
  if (request.method !== "POST") return json({error: "method not allowed"}, 405);
  if (!env.ACCESS_AUD) return json({error: "ACCESS_AUD 가 없어 쓰기를 막았습니다 (읽기 전용)"}, 503);
  let who;
  try { who = await verifyAccess(request, env); }
  catch (e) { return json({error: e.message}, 401); }
  let body;
  try { body = await request.json(); }
  catch { return json({error: "bad json"}, 400); }
  const next = {...cur, by: who, at: new Date().toISOString()};
  if (Array.isArray(body.queue_order)) next.queue_order = body.queue_order.slice(0, 50).map((v) => str(v, 40)).filter(Boolean);
  if (Array.isArray(body.stop)) next.stop = [...new Set([...(cur.stop || []), ...body.stop.slice(0, 20).map((v) => str(v, 40))])].filter(Boolean);
  if (typeof body.note === "string") next.note = str(body.note, 2000);
  await env.LIVE.put(KEY, JSON.stringify(next));
  return json({ok: true, control: next}, 200);
}
