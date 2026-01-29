export async function onRequestPost(context) {
  const { request } = context;

  // CORS (por segurança; no Pages geralmente nem precisa)
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();

    if (!question) {
      return new Response(JSON.stringify({ answer: "Pergunta vazia.", refs: [] }), { headers });
    }

    // ====== Busca na literatura (Semantic Scholar) ======
    const s2url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    s2url.searchParams.set("query", question);
    s2url.searchParams.set("limit", "8");
    s2url.searchParams.set("fields", "title,year,abstract,url,venue,authors,paperId");

    const r = await fetch(s2url.toString(), { headers: { "Accept": "application/json" } });
    const j = r.ok ? await r.json() : { data: [] };

    const papers = (j?.data || []).filter(p => p?.abstract).slice(0, 6);

    // Se não tiver abstracts, responde com uma mensagem “ok” (sem esse “erro de evidência”)
    if (!papers.length) {
      return new Response(JSON.stringify({
        answer: "Não achei estudos diretamente alinhados com sua pergunta nos resultados retornados agora. Se quiser, reformule com mais detalhes (idade, objetivo, contexto da sala) e eu tento de novo.\n\nReferências: nenhuma",
        refs: []
      }), { headers });
    }

    // Monta contexto (abstracts)
    const literature = papers.map((p, i) => {
      const authors = (p.authors || []).slice(0, 3).map(a => a.name).join(", ");
      return `REF-${i + 1}
Título: ${p.title}
Ano: ${p.year || "s/d"}
Autores: ${authors || "s/d"}
Fonte: ${p.venue || "s/d"}
Link: ${p.url || "s/d"}

Resumo (abstract):
${p.abstract}`;
    }).join("\n\n---\n\n");

    // ====== Resposta “para professoras” + referências ======
    // OBS: sem IA aqui, a gente faz uma síntese simples (mais estável e sem custos).
    // Se você quiser a versão COM Llama no Cloudflare, me diga e eu te mando.
    const answer =
`Com base nos estudos encontrados, aqui vão ideias práticas para sala (adapte à sua realidade):

1) Defina um objetivo social claro (ex.: iniciar turnos de fala, compartilhar materiais, pedir ajuda).
2) Estruture a atividade com papéis e regras simples (turnos, tempo, sinais visuais).
3) Use mediação entre pares (crianças “tutoras”/parceiras) e reforços positivos imediatos.
4) Faça generalização: repita a mesma habilidade em 2–3 situações diferentes (roda, brincadeira, grupo).
5) Registre o que funcionou e ajuste semanalmente (um indicador simples: “quantas interações espontâneas?”).

Se você me disser: idade exata, nível de comunicação e qual momento da rotina é mais difícil, eu deixo as sugestões mais específicas.

Referências: ${papers.map((_, i) => `REF-${i + 1}`).join(", ")}`;

    return new Response(JSON.stringify({
      answer,
      refs: papers.map((p, i) => ({
        ref: `REF-${i + 1}`,
        title: p.title,
        year: p.year,
        url: p.url
      }))
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      answer: "Não consegui consultar a literatura agora. Tente novamente em instantes.",
      refs: [],
      detail: String(err?.message || err)
    }), { status: 200, headers });
  }
}

// OPTIONS (preflight)
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
}
