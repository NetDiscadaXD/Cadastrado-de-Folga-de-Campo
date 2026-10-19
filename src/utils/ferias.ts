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
  diasAbono: number;
  salarioBase: number; // Valor bruto mensal (R$) já com encargos inclusos
  encargosPct?: number; // Percentual de encargos adicionais/extras (padrão 0%)
  incluirTerco?: boolean; // 1/3 constitucional (padrão true)
  projetoOrigem: string;
  projetoAtual: string;
  dataInicioCanteiro: string;
}

export interface ResultadoRateioFerias {
  diasGozo: number;
  diasPA: number;
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
  rateado: boolean; // false quando não há projeto de origem distinto (100% projeto atual)
}

const arredonda = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function calcularRateioFerias(e: EntradaRateioFerias): ResultadoRateioFerias {
  const diasGozo = diasInclusivos(e.feriasInicio, e.feriasFim);
  const diasPA = diasInclusivos(e.paInicio, e.paFim);
  const diasAbono = Math.max(0, e.diasAbono || 0);
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

  const origem = (e.projetoOrigem || "").trim();
  const atual = (e.projetoAtual || "").trim();
  const rateado = !!origem && origem !== atual && !!e.dataInicioCanteiro && diasPA > 0;

  let diasAtual = diasPA;
  if (rateado) {
    if (e.dataInicioCanteiro <= e.paInicio) diasAtual = diasPA;
    else if (e.dataInicioCanteiro > e.paFim) diasAtual = 0;
    else diasAtual = diasInclusivos(e.dataInicioCanteiro, e.paFim);
  }
  const diasOrigem = diasPA - diasAtual;

  const pctAtual = diasPA > 0 ? diasAtual / diasPA : 1;
  const pctOrigem = diasPA > 0 ? diasOrigem / diasPA : 0;

  // O projeto de origem recebe a parte arredondada; o atual fica com o restante, para a soma fechar.
  const custoOrigem = arredonda(custoTotal * pctOrigem);
  const custoAtual = arredonda(custoTotal - custoOrigem);

  return {
    diasGozo,
    diasPA,
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
  if (e.feriasInicio && e.feriasFim && e.feriasFim < e.feriasInicio) {
    avisos.push("O fim das férias é anterior ao início.");
  }
  if (e.diasAbono < 0 || e.diasAbono > 10) {
    avisos.push("O abono pecuniário permite vender no máximo 10 dias.");
  }
  if (gozo + (e.diasAbono || 0) > 30) {
    avisos.push("Gozo + abono ultrapassa 30 dias.");
  }
  if (e.feriasInicio && e.paFim && e.feriasInicio <= e.paFim) {
    avisos.push("As férias começam antes do fim do período aquisitivo.");
  }
  return avisos;
}
