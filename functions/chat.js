export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true, answer: "Endpoint /chat funcionando ✅", refs: [] }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
