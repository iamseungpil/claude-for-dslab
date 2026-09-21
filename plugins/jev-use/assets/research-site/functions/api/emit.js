// 피드 한 줄을 실시간으로 받는 엔드포인트 (Cloudflare Pages Functions).
// 상담 파일럿의 functions/api/label.js 와 functions/_lib/access.js 를 본떴다 — Access JWT로 사람을 확인하고,
// 검사한 값만 저장한다. 다만 **지금은 배포하지 않는다**: KV/D1 바인딩 권한이 아직 없다.
// 붙일 때: wrangler.toml 에 ACCESS_AUD 와 KV 바인딩(FEED)을 넣고 functions/ 를 배포에 포함한다.
//
// POST /api/emit  {ts?, kind, title, plain?, body?, status?, stage?, numbers?, links?}
// → 201 {ok:true, n}   저장 뒤 라이브 탭은 다음 빌드나 GET /api/emit 에서 읽는다.

const TEAM = "https://iamseungpil.cloudflareaccess.com";
const CERTS_URL = TEAM + "/cdn-cgi/access/certs";
const CERTS_TTL_MS = 60 * 60 * 1000;
const KINDS = ["event", "metric", "note", "result", "decision"];
const STATUSES = ["확정", "미확인", "잡음"];
const KEY = "feed";
const MAX = 500;

let certs = {at: 0, keys: []};

class AccessError extends Error {
  constructor(message) { super(message); this.status = 401; }
}
const b64 = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};
const decode = (part) => JSON.parse(new TextDecoder().decode(b64(part)));

async function publicKeys(force) {
  if (force || Date.now() - certs.at > CERTS_TTL_MS || !certs.keys.length) {
    const res = await fetch(CERTS_URL, {cf: {cacheTtl: 300}});
    if (!res.ok) throw new AccessError("access certs unavailable: " + res.status);
    certs = {at: Date.now(), keys: (await res.json()).keys || []};
  }
  return certs.keys;
}
// Access 가 붙인 헤더의 JWT를 팀 도메인 공개키로 검증하고 email 을 돌려준다.
async function verifyAccess(request, env) {
  if (!env.ACCESS_AUD) throw new AccessError("ACCESS_AUD is not configured");
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new AccessError("missing Cf-Access-Jwt-Assertion");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AccessError("malformed jwt");
  const header = decode(parts[0]);
  if (header.alg !== "RS256") throw new AccessError("unexpected alg " + header.alg);
  const byKid = (keys) => keys.find((k) => k.kid === header.kid);
  const jwk = byKid(await publicKeys()) || byKid(await publicKeys(true));  // 키 회전 직후 한 번 더
  if (!jwk) throw new AccessError("unknown kid");
  const key = await crypto.subtle.importKey("jwk", {kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true},
    {name: "RSASSA-PKCS1-v1_5", hash: "SHA-256"}, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new AccessError("bad signature");
  const claims = decode(parts[1]), now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) throw new AccessError("token expired");
  if (claims.iss !== TEAM) throw new AccessError("wrong issuer");
  const auds = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const allowed = env.ACCESS_AUD.split(",").map((s) => s.trim()).filter(Boolean);
  if (!auds.some((a) => allowed.includes(a))) throw new AccessError("wrong audience");
  if (!claims.email) throw new AccessError("no email claim");
  return claims.email;
}
const json = (body, status = 200) => new Response(JSON.stringify(body),
  {status, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});

const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
function clean(item, who) {
  const kind = KINDS.includes(item.kind) ? item.kind : "note";
  const out = {ts: new Date().toISOString(), kind, author: who,
               title: str(item.title, 200), plain: str(item.plain, 600), body: str(item.body, 4000),
               stage: str(item.stage, 8)};
  if (STATUSES.includes(item.status)) out.status = item.status;
  if (item.numbers && typeof item.numbers === "object") {
    out.numbers = {};
    for (const [k, v] of Object.entries(item.numbers).slice(0, 12))
      if (typeof v === "number" || typeof v === "string") out.numbers[str(k, 40)] = typeof v === "number" ? v : str(v, 40);
  }
  if (Array.isArray(item.links)) out.links = item.links.slice(0, 6)
    .map((l) => ({label: str(l && l.label, 60), href: str(l && l.href, 300)})).filter((l) => l.label && l.href);
  return out;
}

export async function onRequest({request, env}) {
  if (!env.FEED) return json({error: "KV binding FEED is not configured"}, 503);
  let who;
  try { who = await verifyAccess(request, env); }
  catch (e) { return json({error: e.message}, e.status || 401); }
  const read = async () => JSON.parse((await env.FEED.get(KEY)) || "[]");
  if (request.method === "GET") return json({feed: await read()});
  if (request.method !== "POST") return json({error: "method not allowed"}, 405);
  let item;
  try { item = await request.json(); }
  catch { return json({error: "bad json"}, 400); }
  if (!item || !str(item.title, 1)) return json({error: "title is required"}, 400);
  const feed = await read();
  feed.unshift(clean(item, who));
  await env.FEED.put(KEY, JSON.stringify(feed.slice(0, MAX)));
  return json({ok: true, n: feed.length}, 201);
}
