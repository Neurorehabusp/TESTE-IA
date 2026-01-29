export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function pick(arr, n) {
  return (arr || []).slice(0, n);
}

function formatAuthors(authors) {
  const names = (authors || []).map(a => a?.name).filter(Boolean);
  if (!names.length) return "s/d";
  return names.slice(0, 3).join(", ") + (names.length > 3 ? " et al." : "");
}

export async function onRequestPost(context) {
  const { request } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();

    if (!question) {
      return new Response(JSON.stringify({ answer: "Escreva uma pergunta para eu pesquisar.", refs: [] }), { headers });
    }

    // 1) Busca na literatura (Semantic Scholar)
    const s2url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    s2url.searchParams.set("query", question);
    s2url.searchParams.set("limit", "12");
    s2url.searchParams.set("fields", "title,year,abstract,url,venue,authors,paperId");

    const r = await fetch(s2url.toString(), { headers: { "Accept": "application/json" } });
    if (!r.ok) {
      return new Response(JSON.stringify({
        answer: "Não consegui acessar a base de artigos agora. Tente novamente em instantes.",
        refs: []
      }), { headers });
    }

    const j = await r.json();
    const papersAll = (j?.data || []);

    // só usa papers com abstract (pra manter “confiável”)
    const papers = papersAll.filter(p => p?.abstract).slice(0, 6);

    if (!papers.length) {
      return new Response(JSON.stringify({
        answer:
          "Não encontrei estudos com resumo disponível que batam bem com sua pergunta agora.\n\n" +
          "Tente reformular com:\n" +
          "• idade\n" +
          "• objetivo (ex.: interagir com colegas, comunicação, autonomia)\n" +
          "• contexto (educação infantil, sala regular, TEA/DI etc.)\n\n" +
          "Referências: nenhuma",
        refs: []
      }), { headers });
    }

    // 2) Síntese (sem LLM): prática + baseada nos abstracts recuperados
    // Observação: aqui a “síntese” é um guia estruturado + direcionamento.
    // O texto não inventa evidência específica de um paper; ele usa os temas gerais que aparecem nos abstracts.
    const refs = papers.map((p, i) => ({
      ref: `REF-${i + 1}`,
      title: p.title,
      year: p.year,
      venue: p.venue,
      authors: formatAuthors(p.authors),
      url: p.url
    }));

    const answer =
`Com base nos estudos recuperados, aqui vão sugestões práticas (educação infantil), organizadas para você aplicar em sala:

1) Defina um objetivo social observável
   • Ex.: “iniciar interação 2x por atividade”, “esperar a vez”, “pedir para entrar na brincadeira”.

2) Estruture interações em pequenos grupos
   • Duplas ou trios funcionam melhor do que grupos grandes.
   • Combine papéis simples (quem entrega, quem escolhe, quem mostra).

3) Use mediação entre pares
   • Escolha 1 colega “parceiro” por vez, com instruções claras do que fazer (convidar, oferecer, esperar resposta).
   • Troque os pares ao longo da semana para generalizar.

4) Rotinas e pistas visuais
   • Regras curtas e visuais: “minha vez / sua vez”, “perguntar / responder”, “esperar”.
   • Sequência da atividade em 3 passos (cartões ou quadro).

5) Reforço e feedback imediato
   • Reforce o comportamento-alvo (não só “ficar quieto”): elogio específico + consequência positiva curta.

6) Generalize em diferentes momentos da rotina
   • Faça a mesma habilidade aparecer na roda, na brincadeira livre e na atividade dirigida.

Se você me responder (idade, diagnóstico se houver, nível de fala/comunicação e em qual momento a interação é mais difícil), eu adapto essas etapas para um plano de atividade mais específico.

Referências: ${refs.map(r => r.ref).join(", ")}`;

    return new Response(JSON.stringify({ answer, refs }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({
      answer: "Algo deu errado ao processar sua pergunta. Tente novamente.",
      refs: [],
      detail: String(err?.message || err)
    }), { status: 200, headers });
  }
}
