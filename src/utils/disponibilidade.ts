import { DisponibilidadeColaborador, StatusDisponibilidade, ConfiguracaoCustos, Colaborador } from "../types";
import { diffDays } from "./date";

export const CONFIG_CUSTOS_PADRAO: ConfiguracaoCustos = {
  id: "default",
  encargosAdicionaisPct: 0, // 0% pois o valor bruto já contempla encargos normais
  beneficiosMensalPadrao: 800, // VR + VT + Benefícios médios mensais estimativos
  outrosCustosMensalPadrao: 400, // Custos de infraestrutura/gestão
  salarioBasePadraoFallback: 0, // 0 para indicar ausência de dado se não preenchido
};

/**
 * Retorna o status vigente da disponibilidade no tempo com base na data de disponibilidade efetiva.
 * Garante que a pessoa NÃO seja disponibilizada antecipadamente.
 */
export function obterStatusVigente(disp: DisponibilidadeColaborador, dataReferencia?: string): StatusDisponibilidade {
  if (disp.status === "Transferido" || disp.status === "Encerrado/cancelado" || disp.status === "Em negociação") {
    return disp.status;
  }

  const hoje = dataReferencia || new Date().toISOString().split("T")[0];
  if (disp.dataDisponibilidade && hoje < disp.dataDisponibilidade) {
    return "Disponibilidade programada";
  }
  return "À disposição";
}

/**
 * Calcula os dias que o colaborador está ou esteve à disposição.
 */
export function calcularDiasADisposicao(disp: DisponibilidadeColaborador, dataReferencia?: string): number {
  const hoje = dataReferencia || new Date().toISOString().split("T")[0];
  const dtInicio = disp.dataDisponibilidade || disp.dataLiberacao;
  if (!dtInicio) return 0;

  const statusVigente = obterStatusVigente(disp, hoje);

  if (statusVigente === "Disponibilidade programada") {
    return 0;
  }

  if (statusVigente === "Transferido") {
    const dtFim = disp.dataTransferencia || disp.dataAtualizacao?.slice(0, 10) || hoje;
    const dias = diffDays(dtInicio, dtFim);
    return Math.max(0, dias);
  }

  if (statusVigente === "Encerrado/cancelado") {
    const dtFim = disp.dataAtualizacao?.slice(0, 10) || hoje;
    const dias = diffDays(dtInicio, dtFim);
    return Math.max(0, dias);
  }

  // "À disposição" ou "Em negociação"
  const dias = diffDays(dtInicio, hoje);
  return Math.max(0, dias);
}

export interface ResultadoCustoEstimado {
  temDadosSalario: boolean;
  salarioBaseMensal: number;
  encargosMensal: number;
  beneficiosMensal: number;
  outrosCustosMensal: number;
  custoTotalMensal: number;
  custoDiario: number;
  diasSemAlocacao: number;
  custoAcumulado: number;
}

/**
 * Calcula o custo estimado de colaboradores sem alocação conforme metodologia transparente.
 */
export function calcularCustoEstimado(
  colaborador: Colaborador | undefined,
  diasSemAlocacao: number,
  config: ConfiguracaoCustos = CONFIG_CUSTOS_PADRAO
): ResultadoCustoEstimado {
  const salarioInformado = colaborador?.salarioBase && colaborador.salarioBase > 0;
  const salarioBaseMensal = salarioInformado
    ? colaborador!.salarioBase!
    : (config.salarioBasePadraoFallback || 0);

  const encargosMensal = salarioBaseMensal * ((config.encargosAdicionaisPct || 0) / 100);
  const beneficiosMensal = config.beneficiosMensalPadrao || 0;
  const outrosCustosMensal = config.outrosCustosMensalPadrao || 0;

  const custoTotalMensal = salarioBaseMensal + encargosMensal + beneficiosMensal + outrosCustosMensal;
  const custoDiario = custoTotalMensal / 30;
  const custoAcumulado = custoDiario * Math.max(0, diasSemAlocacao);

  return {
    temDadosSalario: salarioInformado || (config.salarioBasePadraoFallback > 0),
    salarioBaseMensal,
    encargosMensal,
    beneficiosMensal,
    outrosCustosMensal,
    custoTotalMensal,
    custoDiario,
    diasSemAlocacao: Math.max(0, diasSemAlocacao),
    custoAcumulado
  };
}
