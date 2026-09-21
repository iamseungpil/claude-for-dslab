// 라이브 자료를 KV 에서 읽어 한 덩어리로 돌려준다. 읽기 전용이고, 값은 kv_push.py 만 쓴다.
// KV 바인딩(LIVE)이 없으면 404 를 준다 — 화면은 조용히 정적 data/live.json 으로 되돌아간다.
export async function onRequestGet({env}) {
  if (!env.LIVE) return new Response(JSON.stringify({error: "KV binding LIVE is not configured"}),
    {status: 404, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});
  const raw = await env.LIVE.get("live");
  if (!raw) return new Response(JSON.stringify({error: "no live snapshot yet"}),
    {status: 404, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});
  return new Response(raw, {headers: {"Content-Type": "application/json", "Cache-Control": "no-store"}});
}
