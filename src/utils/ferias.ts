/**
 * Cálculo de férias e rateio de custo entre projeto de origem e projeto atual.
 *
 * Regra: férias são um custo construído ao longo do período aquisitivo (PA). Os dias do PA
 * anteriores ao início no canteiro atual pertencem ao projeto de origem; os dias a partir do
 * início no canteiro pertencem ao projeto atual. O custo total das férias é dividido na
 * mesma proporção dos dias do PA.
 *
 * Todas as datas são strings YYYY-MM-DD e os cálculos usam UTC para não sofrer com fuso horário.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

function toUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().split("T")[0];
}

/** Dias corridos entre duas datas, contando início e fim (inclusivo). */
export function diasInclusivos(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const n = Math.round((toUtc(fim) - toUtc(inicio)) / MS_DIA) + 1;
  return n > 0 ? n : 0;
}

/** Fim do período aquisitivo: 12 meses após o início, menos 1 dia. */
export function fimPeriodoAquisitivo(paInicio: string): string {
  if (!paInicio) return "";
  const [y, m, d] = paInicio.split("-").map(Number);
  // Date.UTC normaliza 29/02 em ano não bissexto para 01/03; menos 1 dia resulta em 28/02.
  return fromUtc(Date.UTC(y + 1, m - 1, d) - MS_DIA);
}

/** Início do período aquisitivo de ordem n (0 = primeiro), a partir da data de admissão. */
export function inicioPeriodoAquisitivo(dataAdmissao: string, n: number): string {
  if (!dataAdmissao) return "";
  const [y, m, d] = dataAdmissao.split("-").map(Number);
  return fromUtc(Date.UTC(y + n, m - 1, d));
}

/**
 * Sugere o próximo período aquisitivo ainda sem férias lançadas:
 * o primeiro PA (contado da admissão) cujo início não está em `paIniciosUsados`.
 */
export function sugerirPeriodoAquisitivo(
  dataAdmissao: string,
  paIniciosUsados: string[]
): { paInicio: string; paFim: string } {
  if (!dataAdmissao) return { paInicio: "", paFim: "" };
  const usados = new Set(paIniciosUsados);
  let n = 0;
  while (usados.has(inicioPeriodoAquisitivo(dataAdmissao, n)) && n < 60) n++;
  const paInicio = inicioPeriodoAquisitivo(dataAdmissao, n);
  return { paInicio, paFim: fimPeriodoAquisitivo(paInicio) };
}

export interface EntradaRateioFerias {
  paInicio: string;
  paFim: string;
  feriasInicio: string;
  feriasFim: string;
  tipoLancamento?: 'nova' | 'credito'; // 'nova' = Nova Férias (aquisitivo padrão), 'credito' = Utilizar Crédito de Férias
  creditoFerias?: number; // Saldo de dias que o colaborador tinha de férias para retirar (padrão 30)
  projetoDevido?: string; // Projeto que é devido / devedor desse crédito de férias
  diasAbono: number;
  salarioBase: number; // Valor bruto mensal (R$) já com encargos inclusos
  encargosPct?: number; // Percentual de encargos adicionais/extras (padrão 0%)
  incluirTerco?: boolean; // 1/3 constitucional (padrão true)
  projetoOrigem: string;
  projetoAtual: string;
  dataInicioCanteiro: string;
}

export interface ResultadoRateioFerias {
  tipoLancamento: 'nova' | 'credito';
  projetoDevido: string;
  diasGozo: number;
  diasPA: number;
  creditoFerias: number; // Saldo de dias que o colaborador tinha de férias para retirar
  diasUtilizados: number; // Total de dias retirados (gozo + abono)
  saldoRestante: number; // Saldo restante (creditoFerias - diasUtilizados)
  diasOrigem: number;
  diasAtual: number;
  pctOrigem: number; // 0 a 1
  pctAtual: number; // 0 a 1
  valorBrutoMensal: number; // Valor bruto mensal informado
  valorGozo: number; // valor bruto proporcional aos dias de gozo
  valorAbono: number; // abono pecuniário (dias vendidos)
  tercoConstitucional: number; // 1/3 sobre gozo + abono (se ativado)
  encargos: number; // encargos adicionais (se houver % informada)
  custoTotal: number;
  custoOrigem: number;
  custoAtual: number;
  rateado: boolean; // false quando não há projeto devedor/origem distinto (100% projeto atual)
}

const arredonda = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function calcularRateioFerias(e: EntradaRateioFerias): ResultadoRateioFerias {
  const tipoLancamento = e.tipoLancamento || 'nova';
  const diasGozo = diasInclusivos(e.feriasInicio, e.feriasFim);
  const diasPA = diasInclusivos(e.paInicio, e.paFim);
  const creditoFerias = (e.creditoFerias !== undefined && e.creditoFerias !== null && !isNaN(e.creditoFerias) && e.creditoFerias > 0)
    ? e.creditoFerias
    : 30;
  const diasAbono = Math.max(0, e.diasAbono || 0);
  const diasUtilizados = diasGozo + diasAbono;
  const saldoRestante = creditoFerias - diasUtilizados;
  const valorBruto = Math.max(0, e.salarioBase || 0);
  const incluirTerco = e.incluirTerco !== false;
  const encargosPct = Math.max(0, e.encargosPct || 0);

  const valorDia = valorBruto / 30;
  const valorGozo = valorDia * diasGozo;
  const valorAbono = valorDia * diasAbono;
  const tercoGozo = incluirTerco ? valorGozo / 3 : 0;
  const tercoAbono = incluirTerco ? valorAbono / 3 : 0;
  // O valor informado já contempla encargos normais. Só adiciona encargos se o usuário preencher encargosPct > 0:
  const encargos = encargosPct > 0 ? (valorGozo + tercoGozo) * (encargosPct / 100) : 0;
  const custoTotal = arredonda(valorGozo + valorAbono + tercoGozo + tercoAbono + encargos);

  const atual = (e.projetoAtual || "").trim();
  const projetoDevido = (e.projetoDevido || e.projetoOrigem || "").trim();

  let custoOrigem = 0;
  let custoAtual = custoTotal;
  let diasOrigem = 0;
  let diasAtual = diasPA;
  let pctOrigem = 0;
  let pctAtual = 1;
  let rateado = false;

  if (tipoLancamento === 'credito' && projetoDevido && projetoDevido !== atual) {
    // Quando o lançamento utiliza crédito de férias devido por outro projeto:
    // O custo é atribuído integralmente ao projeto que deve esse crédito
    rateado = true;
    custoOrigem = custoTotal;
    custoAtual = 0;
    diasOrigem = diasUtilizados;
    diasAtual = 0;
    pctOrigem = 1;
    pctAtual = 0;
  } else {
    // Lançamento normal de férias (rateio por período aquisitivo se houver projeto de origem)
    const origem = (e.projetoOrigem || "").trim();
    rateado = !!origem && origem !== atual && !!e.dataInicioCanteiro && diasPA > 0;

    if (rateado) {
      if (e.dataInicioCanteiro <= e.paInicio) diasAtual = diasPA;
      else if (e.dataInicioCanteiro > e.paFim) diasAtual = 0;
      else diasAtual = diasInclusivos(e.dataInicioCanteiro, e.paFim);

      diasOrigem = diasPA - diasAtual;
      pctAtual = diasPA > 0 ? diasAtual / diasPA : 1;
      pctOrigem = diasPA > 0 ? diasOrigem / diasPA : 0;

      custoOrigem = arredonda(custoTotal * pctOrigem);
      custoAtual = arredonda(custoTotal - custoOrigem);
    }
  }

  return {
    tipoLancamento,
    projetoDevido,
    diasGozo,
    diasPA,
    creditoFerias,
    diasUtilizados,
    saldoRestante,
    diasOrigem,
    diasAtual,
    pctOrigem,
    pctAtual,
    valorBrutoMensal: arredonda(valorBruto),
    valorGozo: arredonda(valorGozo),
    valorAbono: arredonda(valorAbono),
    tercoConstitucional: arredonda(tercoGozo + tercoAbono),
    encargos: arredonda(encargos),
    custoTotal,
    custoOrigem,
    custoAtual,
    rateado,
  };
}

/** Avisos de consistência (não bloqueiam o lançamento). */
export function validarFerias(e: EntradaRateioFerias): string[] {
  const avisos: string[] = [];
  const gozo = diasInclusivos(e.feriasInicio, e.feriasFim);
  const credito = (e.creditoFerias !== undefined && e.creditoFerias !== null && !isNaN(e.creditoFerias) && e.creditoFerias > 0)
    ? e.creditoFerias
    : 30;

  if (e.feriasInicio && e.feriasFim && e.feriasFim < e.feriasInicio) {
    avisos.push("O fim das férias é anterior ao início.");
  }
  if (e.diasAbono < 0 || e.diasAbono > 10) {
    avisos.push("O abono pecuniário permite vender no máximo 10 dias.");
  }
  if (gozo + (e.diasAbono || 0) > credito) {
    avisos.push(`Dias retirados (${gozo + (e.diasAbono || 0)} dias: ${gozo} gozo + ${e.diasAbono || 0} abono) ultrapassam o crédito de férias informado (${credito} dias).`);
  }
  if (e.feriasInicio && e.paFim && e.feriasInicio <= e.paFim) {
    avisos.push("As férias começam antes do fim do período aquisitivo.");
  }
  return avisos;
}
