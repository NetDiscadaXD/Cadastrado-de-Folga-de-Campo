import { Colaborador, Ferias, DisponibilidadeColaborador } from "../types";
import { formatBrDate, addDays, diffDays } from "./date";
import { obterStatusVigente, calcularDiasADisposicao } from "./disponibilidade";

export type TipoStatusIntegrado = 
  | 'Ativo no Projeto' 
  | 'Em Férias' 
  | 'À Disposição' 
  | 'Afastado'
  | 'Licença-maternidade'
  | 'Desmobilizado' 
  | 'Demitido'
  | 'Inativo';

export interface InfoStatusIntegrado {
  status: TipoStatusIntegrado;
  label: string;
  badgeClass: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  detalhe?: string;
  periodo?: string;
  dataReferencia?: string;
}

export interface InfoExperiencia {
  emExperiencia: boolean;
  dataAdmissao: string;
  dataFimExperiencia: string;
  diasRestantes: number;
  diasCumpridos: number;
  mensagem: string;
}

/**
 * Mapeamento dos meses em português para cálculo de vigência documental
 */
export const MESES_ANO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Verifica se o colaborador está dentro do período de experiência de 89 dias (Admissão + 89 dias).
 * Conforme regra: caso já tenha vencido a experiência, NÃO será contabilizado no bloco de experiência.
 */
export function verificarExperienciaColaborador(
  col: Colaborador,
  hojeISO?: string
): InfoExperiencia {
  const hoje = hojeISO ? hojeISO.split("T")[0] : new Date().toISOString().split("T")[0];
  
  if (
    !col.dataAdmissao || 
    col.status === "Inativo" || 
    col.status === "Demitido" || 
    col.status === "Desmobilizado" || 
    col.situacao === "Demitido" || 
    col.situacao === "Desmobilizado" || 
    !!col.dataDemissao || 
    !!col.dataDesmobilizacao || 
    !!col.dataInativacao
  ) {
    return {
      emExperiencia: false,
      dataAdmissao: col.dataAdmissao || "",
      dataFimExperiencia: "",
      diasRestantes: 0,
      diasCumpridos: 0,
      mensagem: "Não aplicável (Desligado/Desmobilizado/Sem admissão)"
    };
  }

  // Data de Admissão + 89 dias
  const dataFimExperiencia = addDays(col.dataAdmissao, 89);
  const diasDesdeAdmissao = diffDays(col.dataAdmissao, hoje);
  const diasRestantes = diffDays(hoje, dataFimExperiencia);

  // Se já venceu a experiência (hoje > dataFimExperiencia), NÃO será contabilizado no bloco
  if (hoje > dataFimExperiencia) {
    return {
      emExperiencia: false,
      dataAdmissao: col.dataAdmissao,
      dataFimExperiencia,
      diasRestantes: 0,
      diasCumpridos: diasDesdeAdmissao,
      mensagem: `Experiência concluída em ${formatBrDate(dataFimExperiencia)}`
    };
  }

  // Se a admissão for futura
  if (hoje < col.dataAdmissao) {
    return {
      emExperiencia: false,
      dataAdmissao: col.dataAdmissao,
      dataFimExperiencia,
      diasRestantes: 89,
      diasCumpridos: 0,
      mensagem: `Admissão futura (${formatBrDate(col.dataAdmissao)})`
    };
  }

  // Está vigente no período de experiência!
  return {
    emExperiencia: true,
    dataAdmissao: col.dataAdmissao,
    dataFimExperiencia,
    diasRestantes: Math.max(0, diasRestantes),
    diasCumpridos: Math.max(0, diasDesdeAdmissao),
    mensagem: diasRestantes === 0 
      ? `Último dia de experiência hoje (${formatBrDate(dataFimExperiencia)})`
      : `${diasRestantes} dia(s) restantes (término em ${formatBrDate(dataFimExperiencia)})`
  };
}

/**
 * Obtém o status operacional integrado do colaborador com base no cruzamento
 * de Cadastro, Férias, À Disposição, Afastamentos, Licença-Maternidade, Desmobilização e Demissão.
 */
export function obterStatusAtualColaborador(
  col: Colaborador,
  todasFerias: Ferias[] = [],
  todasDisponibilidades: DisponibilidadeColaborador[] = [],
  dataReferenciaISO?: string
): InfoStatusIntegrado {
  const hoje = dataReferenciaISO ? dataReferenciaISO.split("T")[0] : new Date().toISOString().split("T")[0];

  // 1. PRIORIDADE MÁXIMA: Demitido (Rescisão formal de contrato de trabalho)
  const isDemitido = col.status === 'Demitido' || col.situacao === 'Demitido' || !!col.dataDemissao;
  if (isDemitido) {
    const dataFmt = col.dataDemissao ? formatBrDate(col.dataDemissao) : undefined;
    const mot = col.motivoDemissao ? ` • ${col.motivoDemissao}` : '';
    return {
      status: 'Demitido',
      label: 'Demitido',
      badgeClass: 'bg-zinc-800 text-white border-zinc-950 font-bold',
      badgeBg: 'bg-zinc-800',
      badgeText: 'text-white',
      badgeBorder: 'border-zinc-950',
      detalhe: dataFmt ? `Demitido em ${dataFmt}${mot}` : (col.motivoDemissao || 'Rescisão de contrato'),
      dataReferencia: col.dataDemissao
    };
  }

  // 2. PRIORIDADE: Desmobilizado do canteiro/obra (diferente de Demitido!)
  const dataDesmob = col.dataDesmobilizacao || col.dataInativacao;
  const isDesmobilizado = 
    col.status === 'Desmobilizado' || 
    col.situacao === 'Desmobilizado' || 
    (col.status === 'Inativo' && !isDemitido) || 
    !!dataDesmob;

  if (isDesmobilizado) {
    const dataFmt = dataDesmob ? formatBrDate(dataDesmob) : undefined;
    const obs = col.motivoDesmobilizacao || col.observacao || '';
    return {
      status: 'Desmobilizado',
      label: 'Desmobilizado',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
      badgeBg: 'bg-rose-50',
      badgeText: 'text-rose-700',
      badgeBorder: 'border-rose-300',
      detalhe: dataFmt ? `Desmobilizado em ${dataFmt}${obs ? ` • ${obs}` : ''}` : (obs || 'Desmobilizado do canteiro'),
      dataReferencia: dataDesmob
    };
  }

  // 2. PRIORIDADE: Licença-Maternidade
  const isLicencaMat = 
    col.situacao === 'Licença-maternidade' ||
    col.motivoAfastamento?.toLowerCase().includes("maternidade") ||
    col.observacao?.toLowerCase().includes("maternidade") ||
    col.observacao?.toLowerCase().includes("licença-maternidade") ||
    col.observacao?.toLowerCase().includes("licenca maternidade");

  if (isLicencaMat) {
    const prevRetorno = col.dataPrevisaoRetorno ? formatBrDate(col.dataPrevisaoRetorno) : undefined;
    return {
      status: 'Licença-maternidade',
      label: 'Licença-Maternidade',
      badgeClass: 'bg-pink-50 text-pink-700 border-pink-300 font-bold',
      badgeBg: 'bg-pink-50',
      badgeText: 'text-pink-700',
      badgeBorder: 'border-pink-300',
      detalhe: prevRetorno ? `Retorno previsto: ${prevRetorno}` : 'Em licença-maternidade',
      dataReferencia: col.dataInicioAfastamento
    };
  }

  // 3. PRIORIDADE: Afastamento Previdenciário / Médico / INSS
  const isAfastado = 
    col.situacao === 'Afastado' ||
    (col.motivoAfastamento && !col.motivoAfastamento.toLowerCase().includes("maternidade")) ||
    col.observacao?.toLowerCase().includes("afastad") ||
    col.observacao?.toLowerCase().includes("inss") ||
    col.observacao?.toLowerCase().includes("auxílio doença") ||
    col.observacao?.toLowerCase().includes("auxilio doenca") ||
    col.observacao?.toLowerCase().includes("atestado médico") ||
    col.observacao?.toLowerCase().includes("atestado medico");

  if (isAfastado) {
    const motivo = col.motivoAfastamento || 'Afastamento médico/INSS';
    const prevRetorno = col.dataPrevisaoRetorno ? formatBrDate(col.dataPrevisaoRetorno) : undefined;
    return {
      status: 'Afastado',
      label: 'Afastado',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-300 font-bold',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-300',
      detalhe: prevRetorno ? `${motivo} • Retorno: ${prevRetorno}` : motivo,
      dataReferencia: col.dataInicioAfastamento
    };
  }

  // 4. PRIORIDADE: Férias vigentes na data de hoje
  const feriasColab = todasFerias.filter((f) => f.matricula === col.matricula);
  const feriasAtiva = feriasColab.find((f) => {
    if (!f.feriasInicio || !f.feriasFim) return false;
    return hoje >= f.feriasInicio && hoje <= f.feriasFim;
  });

  if (feriasAtiva || col.situacao === 'Férias') {
    const inicioFmt = feriasAtiva?.feriasInicio ? formatBrDate(feriasAtiva.feriasInicio) : "";
    const fimFmt = feriasAtiva?.feriasFim ? formatBrDate(feriasAtiva.feriasFim) : "";
    let detalhePeriodo = (inicioFmt && fimFmt) ? `Período: ${inicioFmt} a ${fimFmt}` : 'Em gozo de férias';

    if (feriasAtiva) {
      const credito = feriasAtiva.creditoFerias ?? 30;
      // Cálculo dos dias corridos inclusivos
      const [y1, m1, d1] = feriasAtiva.feriasInicio.split("-").map(Number);
      const [y2, m2, d2] = feriasAtiva.feriasFim.split("-").map(Number);
      const ms1 = Date.UTC(y1, m1 - 1, d1);
      const ms2 = Date.UTC(y2, m2 - 1, d2);
      const gozo = Math.max(0, Math.round((ms2 - ms1) / (24 * 60 * 60 * 1000)) + 1);
      const utilizado = gozo + (feriasAtiva.diasAbono || 0);
      const saldo = credito - utilizado;
      detalhePeriodo += ` • Crédito: ${credito}d (Saldo: ${saldo}d)`;
    }

    return {
      status: 'Em Férias',
      label: 'Em Férias',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-300 font-bold',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-300',
      detalhe: detalhePeriodo,
      periodo: (inicioFmt && fimFmt) ? `${inicioFmt} a ${fimFmt}` : undefined,
      dataReferencia: feriasAtiva?.feriasInicio
    };
  }

  // 5. PRIORIDADE: À Disposição para remanejamento
  const dispAtiva = todasDisponibilidades.find((d) => {
    if (d.matricula !== col.matricula) return false;
    const vig = obterStatusVigente(d, hoje);
    return vig === "À disposição" || vig === "Em negociação";
  });

  if (dispAtiva || col.situacao === 'À disposição') {
    const dias = dispAtiva ? calcularDiasADisposicao(dispAtiva, hoje) : 0;
    return {
      status: 'À Disposição',
      label: 'À Disposição',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-bold',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-300',
      detalhe: dispAtiva ? `${dias} dia(s) aguardando transferência` : 'À disposição',
      dataReferencia: dispAtiva?.dataDisponibilidade
    };
  }

  // 6. ATIVO NO PROJETO
  return {
    status: 'Ativo no Projeto',
    label: 'Ativo no Projeto',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    detalhe: col.projetoAtual || 'Canteiro Borborema'
  };
}

export type StatusCobrancaDocumento = 
  | 'a_cobrar'
  | 'nao_mobilizado'
  | 'desmobilizado';

export interface InfoElegibilidadeDocumento {
  cobrar: boolean;
  statusCobranca: StatusCobrancaDocumento;
  mensagem: string;
  detalheData?: string;
}

/**
 * Regra de Cobrança de Espelhos e Holerites:
 * - Cobrar a partir do mês de mobilização (dataInicioProjeto ou dataAdmissao).
 *   Antes da data/mês de mobilização: NÃO COBRAR.
 * - Cobrar até o mês de desmobilização (dataDesmobilizacao ou dataInativacao).
 *   Após o mês de desmobilização: NÃO COBRAR MAIS.
 */
export function verificarElegibilidadeDocumentoMes(
  col: Colaborador,
  mesNome: string,
  ano: number
): InfoElegibilidadeDocumento {
  const mesIndex = MESES_ANO.indexOf(mesNome);
  const mesAlvo = mesIndex >= 0 ? mesIndex : 0;
  // Período numérico em meses absolutos (ex: 2026 * 12 + 1)
  const periodoAlvo = ano * 12 + mesAlvo;

  // 1. Verificação de Mobilização
  const dataMobilizacao = col.dataInicioProjeto || col.dataAdmissao;
  if (dataMobilizacao) {
    const parts = dataMobilizacao.split("-");
    if (parts.length === 3) {
      const mobAno = parseInt(parts[0], 10);
      const mobMes = parseInt(parts[1], 10) - 1; // 0-indexed
      const periodoMob = mobAno * 12 + mobMes;

      if (periodoAlvo < periodoMob) {
        const mobFmt = `${String(mobMes + 1).padStart(2, "0")}/${mobAno}`;
        return {
          cobrar: false,
          statusCobranca: 'nao_mobilizado',
          mensagem: `Não mobilizado no período (Mobilização em ${mobFmt})`,
          detalheData: formatBrDate(dataMobilizacao)
        };
      }
    }
  }

  // 2. Verificação de Desmobilização
  const dataDesmob = col.dataDesmobilizacao || col.dataInativacao;
  if (dataDesmob && (col.status === "Inativo" || !!col.dataDesmobilizacao)) {
    const parts = dataDesmob.split("-");
    if (parts.length === 3) {
      const desAno = parseInt(parts[0], 10);
      const desMes = parseInt(parts[1], 10) - 1; // 0-indexed
      const periodoDes = desAno * 12 + desMes;

      // Se o período alvo for POSTERIOR ao mês de desmobilização, não cobrar mais!
      if (periodoAlvo > periodoDes) {
        const desFmt = `${String(desMes + 1).padStart(2, "0")}/${desAno}`;
        return {
          cobrar: false,
          statusCobranca: 'desmobilizado',
          mensagem: `Desmobilizado (Saída em ${desFmt})`,
          detalheData: formatBrDate(dataDesmob)
        };
      }
    }
  }

  // Está dentro da vigência ativa do colaborador no projeto: COBRAR DOCUMENTO
  return {
    cobrar: true,
    statusCobranca: 'a_cobrar',
    mensagem: 'Documentação exigida para o período'
  };
}
