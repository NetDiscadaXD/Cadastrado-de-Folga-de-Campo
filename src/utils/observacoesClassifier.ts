import { CategoriaObservacao } from "../types";

export const TODAS_CATEGORIAS_OBSERVACAO: CategoriaObservacao[] = [
  "À disposição e transferência",
  "Mobilização e documentação",
  "Folga de campo",
  "Férias e descanso",
  "Saúde ocupacional e exames",
  "Segurança e portaria",
  "Desempenho e conduta",
  "Custos e benefícios",
  "Transporte e hospedagem",
  "Administrativo",
  "Outros"
];

interface RegraClassificacao {
  categoria: CategoriaObservacao;
  keywords: string[];
}

const REGRAS: RegraClassificacao[] = [
  {
    categoria: "Férias e descanso",
    keywords: [
      "férias", "ferias", "período aquisitivo", "periodo aquisitivo", "abono pecuniário",
      "abono", "1/3 constitucional", "um terço", "venda de férias", "gozo de férias",
      "recesso", "descanso anual", "retorno de férias", "programação de férias"
    ]
  },
  {
    categoria: "À disposição e transferência",
    keywords: [
      "desmobilização", "desmobilizado", "desmobilizar", "fim de contrato", "término de obra",
      "liberado pelo projeto", "liberado", "liberação", "liberar",
      "disponível para transferência", "disponível", "disponibilidade",
      "aguardando novo projeto", "sem alocação", "remanejamento", "à disposição",
      "transferência", "transferir", "transferido", "devolução de epi", "desligamento",
      "rescisão", "acerto final", "baixa na portaria"
    ]
  },
  {
    categoria: "Segurança e portaria",
    keywords: [
      "crachá", "cracha", "bloqueio", "bloqueado", "desbloqueio", "portaria",
      "restrição aura", "restricao aura", "restrição", "restricao", "acesso barrado",
      "liberação de crachá", "segurança do trabalho", "nr-", "nr10", "nr35", "nr33",
      "treinamento pendente", "treinamento vencido", "portaria central", "guarita"
    ]
  },
  {
    categoria: "Saúde ocupacional e exames",
    keywords: [
      "aso", "exame", "inapto", "apto", "médico", "clínico", "audiometria",
      "psicossocial", "periódico", "periodico", "eeg", "ecg", "raio-x", "atestado", "laudo",
      "retorno ao trabalho", "mudança de função", "cid", "afastamento inss", "consulta"
    ]
  },
  {
    categoria: "Folga de campo",
    keywords: [
      "folga vencida", "folga de campo", "folga", "passagem pendente", "passagem", "venda de folga",
      "vendeu folga", "voo", "desembarque", "embarque aéreo", "embarque", "viagem",
      "adiantamento de viagem", "bilhete", "rodoviário", "aeroporto"
    ]
  },
  {
    categoria: "Mobilização e documentação",
    keywords: [
      "espelho de ponto", "espelho", "espelhos", "holerite", "holerites", "batida de ponto",
      "ponto eletrônico", "documentação pendente", "documentação", "documentos", "cadastro incompleto",
      "cadastro", "ctps", "carteira de trabalho", "ficha de registro", "contrato", "admissão",
      "pendência documental", "qualificação", "dados bancários", "sindicato", "ficha cadastral"
    ]
  },
  {
    categoria: "Transporte e hospedagem",
    keywords: [
      "hospedagem", "hotel", "pousada", "alojamento", "ônibus", "van",
      "translado", "itinerário", "transporte terrestre", "check-in hotel", "quarto", "motorista"
    ]
  },
  {
    categoria: "Custos e benefícios",
    keywords: [
      "salário", "salario", "benefício", "beneficio", "adiantamento", "vt", "vr", "va", "plano de saúde",
      "reembolso", "alimentação", "desconto", "custo de mobilização", "custo", "pagamento"
    ]
  },
  {
    categoria: "Desempenho e conduta",
    keywords: [
      "advertência", "advertencia", "elogio", "conduta", "atraso", "falta injustificada", "falta",
      "produção", "desempenho", "produtividade", "comportamento", "disciplina", "avaliação",
      "insubordinação", "reconhecimento", "líder de equipe"
    ]
  },
  {
    categoria: "Administrativo",
    keywords: [
      "memorando", "comunicado", "geral", "notificação", "termo",
      "assinatura de documento", "aviso prévio", "solicitação interna", "ofício"
    ]
  }
];

export interface ResultadoClassificacao {
  categoria: CategoriaObservacao;
  confianca: number;
  termoEncontrado?: string;
  isAutomatica: boolean;
}

/**
 * Classifica e gera automaticamente a categoria de acordo com o texto escrito.
 */
export function sugerirCategoria(conteudo: string): ResultadoClassificacao {
  if (!conteudo || conteudo.trim().length === 0) {
    return { categoria: "Outros", confianca: 0, isAutomatica: false };
  }

  const textoNorm = conteudo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let melhorCategoria: CategoriaObservacao = "Outros";
  let maiorScore = 0;
  let termoMelhor: string | undefined = undefined;

  for (const regra of REGRAS) {
    let score = 0;
    let termoAtual: string | undefined = undefined;

    for (const kw of regra.keywords) {
      const kwNorm = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (textoNorm.includes(kwNorm)) {
        // Frases completas com mais de uma palavra valem mais pontos
        const pontos = kwNorm.includes(" ") ? 4 : 2;
        score += pontos;
        if (!termoAtual) termoAtual = kw;
      }
    }

    if (score > maiorScore) {
      maiorScore = score;
      melhorCategoria = regra.categoria;
      termoMelhor = termoAtual;
    }
  }

  if (maiorScore === 0) {
    return { categoria: "Outros", confianca: 0, isAutomatica: false };
  }

  const confianca = Math.min(1, maiorScore / 4);
  return { 
    categoria: melhorCategoria, 
    confianca, 
    termoEncontrado: termoMelhor,
    isAutomatica: true 
  };
}
