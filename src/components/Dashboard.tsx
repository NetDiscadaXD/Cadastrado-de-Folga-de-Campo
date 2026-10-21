import { useMemo, useState } from "react";
import { Colaborador, Viagem, DisponibilidadeColaborador, ConfiguracaoCustos, AuditLog, Ferias } from "../types";
import { addDays, diffDays, formatBrDate } from "../utils/date";
import { obterStatusVigente, calcularDiasADisposicao, calcularCustoEstimado, CONFIG_CUSTOS_PADRAO } from "../utils/disponibilidade";
import { 
  Users, 
  FileSpreadsheet,
  Clock,
  TrendingUp,
  CreditCard,
  Plane,
  CalendarDays,
  Printer,
  UserCheck,
  CalendarClock,
  ArrowRightLeft,
  DollarSign,
  Building2,
  Briefcase,
  AlertTriangle,
  ArrowUpRight,
  Search,
  ClipboardList,
  CheckCircle,
  FileCheck,
  FolderOpen,
  Baby,
  HeartPulse,
  Award,
  MessageSquareText,
  UserX
} from "lucide-react";
import { exportToExcel } from "../utils/excel";
import * as XLSX from "xlsx";
import { getDirectDriveImageURL } from "../utils/drive";
import { obterStatusAtualColaborador, verificarExperienciaColaborador } from "../utils/colaboradorStatus";

interface DashboardProps {
  colaboradores: Colaborador[];
  viagens: Viagem[];
  ferias?: Ferias[];
  disponibilidades?: DisponibilidadeColaborador[];
  configCustos?: ConfiguracaoCustos;
  logs?: AuditLog[];
  onNavigate?: (tab: "dashboard" | "cadastro" | "folga" | "disponibilidade" | "observacoes" | "logs") => void;
  onPrint?: () => void;
  isAdmin?: boolean;
}

export default function Dashboard({ 
  colaboradores, 
  viagens, 
  ferias = [],
  disponibilidades = [], 
  configCustos = CONFIG_CUSTOS_PADRAO, 
  logs = [],
  onNavigate, 
  onPrint, 
  isAdmin = true 
}: DashboardProps) {
  // Inicialização dinâmica que detecta automaticamente o mês de calendário atual (ex: 2026-06)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  });

  const todayStr = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Filtragem e tratamento de colaboradores ativos
  const stats = useMemo(() => {
    const ativos = colaboradores.filter(c => c.status !== "Inativo");
    const totalAtivos = ativos.length;
    const totalMOI = ativos.filter(c => c.tipoMaoDeObra === "MOI").length;
    const totalMOD = ativos.filter(c => c.tipoMaoDeObra === "MOD").length;

    // Filtrar viagens iniciadas no mês selecionado para calcular o gasto real
    const viagensDoMes = viagens.filter(v => v.dataRealInicio && v.dataRealInicio.startsWith(selectedMonth));
    
    let totalGeralPassagens = 0;
    let totalGeralAdiantamentos = 0;
    let totalGeralVendas = 0;

    viagensDoMes.forEach(v => {
      totalGeralPassagens += v.valorPassagem || 0;
      totalGeralAdiantamentos += v.adiantamento || 0;
      totalGeralVendas += v.valorVendaFolga || 0;
    });

    const totalGastosNoMes = totalGeralPassagens + totalGeralAdiantamentos + totalGeralVendas;

    return {
      totalAtivos,
      totalMOI,
      totalMOD,
      totalGastosNoMes,
      totalGeralPassagens,
      totalGeralAdiantamentos,
      totalGeralVendas,
      qtdViagensNoMes: viagensDoMes.length
    };
  }, [colaboradores, viagens, selectedMonth]);

  // Indicadores do Módulo de Mobilização & À Disposição
  const statsMobilizacao = useMemo(() => {
    const colMap = new Map<string, Colaborador>();
    colaboradores.forEach(c => colMap.set(c.matricula, c));

    let disponiveis = 0;
    let programadas = 0;
    let emNegociacao = 0;
    let transferidosPeriodo = 0;
    let totalTransferidosGeral = 0;
    let diasTotaisTransferencia = 0;
    let totalTransferidosComData = 0;
    let custoTotalAcumulado = 0;

    const porProjetoOrigem: Record<string, number> = {};
    const porFuncao: Record<string, number> = {};
    const evolucaoMensal: Record<string, { disponibilidades: number; transferencias: number }> = {};

    disponibilidades.forEach(d => {
      const col = colMap.get(d.matricula);
      const statusVigente = obterStatusVigente(d, todayStr);
      const dias = calcularDiasADisposicao(d, todayStr);
      const custo = calcularCustoEstimado(col, dias, configCustos);

      if (d.dataDisponibilidade) {
        const mesDisp = d.dataDisponibilidade.slice(0, 7);
        if (!evolucaoMensal[mesDisp]) evolucaoMensal[mesDisp] = { disponibilidades: 0, transferencias: 0 };
        evolucaoMensal[mesDisp].disponibilidades++;
      }

      if (statusVigente === "À disposição") {
        disponiveis++;
        custoTotalAcumulado += custo.custoAcumulado;

        const proj = d.projetoOrigem || col?.projetoAtual || "Sem Projeto";
        porProjetoOrigem[proj] = (porProjetoOrigem[proj] || 0) + 1;

        const func = col?.funcao || d.funcao || "Outros";
        porFuncao[func] = (porFuncao[func] || 0) + 1;

      } else if (statusVigente === "Disponibilidade programada") {
        programadas++;
      } else if (statusVigente === "Em negociação") {
        emNegociacao++;
        custoTotalAcumulado += custo.custoAcumulado;
      } else if (statusVigente === "Transferido") {
        totalTransferidosGeral++;
        
        if (d.dataTransferencia && d.dataTransferencia.startsWith(selectedMonth)) {
          transferidosPeriodo++;
        } else if (!d.dataTransferencia && d.dataAtualizacao?.startsWith(selectedMonth)) {
          transferidosPeriodo++;
        }

        if (d.dataTransferencia) {
          const mesTransf = d.dataTransferencia.slice(0, 7);
          if (!evolucaoMensal[mesTransf]) evolucaoMensal[mesTransf] = { disponibilidades: 0, transferencias: 0 };
          evolucaoMensal[mesTransf].transferencias++;
        }

        if (d.dataDisponibilidade && d.dataTransferencia) {
          const diasAteTransf = diffDays(d.dataDisponibilidade, d.dataTransferencia);
          if (diasAteTransf >= 0) {
            diasTotaisTransferencia += diasAteTransf;
            totalTransferidosComData++;
          }
        }
      }
    });

    const tempoMedioTransferenciaDias = totalTransferidosComData > 0
      ? Math.round((diasTotaisTransferencia / totalTransferidosComData) * 10) / 10
      : 0;

    return {
      disponiveis,
      programadas,
      emNegociacao,
      transferidosPeriodo,
      totalTransferidosGeral,
      tempoMedioTransferenciaDias,
      custoTotalAcumulado,
      porProjetoOrigem,
      porFuncao,
      evolucaoMensal
    };
  }, [disponibilidades, colaboradores, configCustos, todayStr, selectedMonth]);

  // Alerta de Folgas Próximas de Vencer (Próximos 30 dias)
  const folgasProximasVencer = useMemo(() => {
    const list: { 
      matricula: string; 
      nome: string; 
      tipoMaoDeObra: string; 
      proximaFolga: string; 
      diasAteFolga: number;
      fotoUrl?: string;
    }[] = [];

    colaboradores.forEach(col => {
      // Filtra apenas se estiver ativo
      if (col.status === "Inativo") return;

      // Filtra viagens apenas para quem está sob o regime "Alojado" (regime aplicável para folga de campo)
      if (col.regimeTrabalho !== "Alojado") return;

      const colViagens = viagens.filter(v => v.matricula === col.matricula);
      const diasCiclo = col.tipoMaoDeObra === "MOI" ? 59 : 89;
      let proximaFolga = "";

      if (colViagens.length === 0) {
        proximaFolga = addDays(col.dataInicioProjeto, diasCiclo);
      } else {
        const sortedViagens = [...colViagens]
          .filter(v => v.dataRealRetorno)
          .sort((a, b) => new Date(b.dataRealRetorno).getTime() - new Date(a.dataRealRetorno).getTime());
        if (sortedViagens.length > 0) {
          proximaFolga = addDays(sortedViagens[0].dataRealRetorno, diasCiclo);
        } else {
          proximaFolga = addDays(col.dataInicioProjeto, diasCiclo);
        }
      }

      if (proximaFolga) {
        const diasAteFolga = diffDays(todayStr, proximaFolga);
        // Exibir somente as folgas que vencem em 30 dias ou menos (inclui as já vencidas)
        if (diasAteFolga <= 30) {
          list.push({
            matricula: col.matricula,
            nome: col.nomeCompleto,
            tipoMaoDeObra: col.tipoMaoDeObra,
            proximaFolga,
            diasAteFolga,
            fotoUrl: col.fotoUrl
          });
        }
      }
    });

    return list.sort((a, b) => a.diasAteFolga - b.diasAteFolga);
  }, [colaboradores, viagens, todayStr]);

  // Estados para pesquisa, filtro e rolagem no Controle de Folga de Campo do Dashboard
  const [buscaFolgaDashboard, setBuscaFolgaDashboard] = useState("");
  const [filtroStatusFolgaDashboard, setFiltroStatusFolgaDashboard] = useState<"todos" | "vencidos" | "proximos">("todos");

  const folgasFiltradasDashboard = useMemo(() => {
    return folgasProximasVencer.filter((item) => {
      const isFolgaVencida = item.diasAteFolga < 0;
      if (filtroStatusFolgaDashboard === "vencidos" && !isFolgaVencida) return false;
      if (filtroStatusFolgaDashboard === "proximos" && isFolgaVencida) return false;
      if (buscaFolgaDashboard.trim()) {
        const termo = buscaFolgaDashboard.toLowerCase().trim();
        return (
          item.nome.toLowerCase().includes(termo) ||
          item.matricula.toLowerCase().includes(termo) ||
          item.tipoMaoDeObra.toLowerCase().includes(termo)
        );
      }
      return true;
    });
  }, [folgasProximasVencer, filtroStatusFolgaDashboard, buscaFolgaDashboard]);

  const totalVencidosFolga = useMemo(() => {
    return folgasProximasVencer.filter((i) => i.diasAteFolga < 0).length;
  }, [folgasProximasVencer]);

  const totalProximosFolga = useMemo(() => {
    return folgasProximasVencer.filter((i) => i.diasAteFolga >= 0).length;
  }, [folgasProximasVencer]);

  // ==========================================
  // RELAÇÃO DE FUNCIONÁRIOS DO PROJETO POR SITUAÇÃO
  // (Ativos no projeto, Férias, À Disposição, Afastados, Licença-Maternidade e Bloco de Experiência até 89 dias)
  // ==========================================
  const relacaoSituacao = useMemo(() => {
    let countAtivos = 0;
    let countFerias = 0;
    let countDisposicao = 0;
    let countAfastados = 0;
    let countLicencaMat = 0;
    let countExperiencia = 0;
    let countDesmobilizados = 0;
    let countDemitidos = 0;

    const lista = colaboradores.map(c => {
      const statusInfo = obterStatusAtualColaborador(c, ferias, disponibilidades, todayStr);
      const expInfo = verificarExperienciaColaborador(c, todayStr);

      if (statusInfo.status === 'Ativo no Projeto') countAtivos++;
      else if (statusInfo.status === 'Em Férias') countFerias++;
      else if (statusInfo.status === 'À Disposição') countDisposicao++;
      else if (statusInfo.status === 'Afastado') countAfastados++;
      else if (statusInfo.status === 'Licença-maternidade') countLicencaMat++;
      else if (statusInfo.status === 'Demitido') countDemitidos++;
      else if (statusInfo.status === 'Desmobilizado' || statusInfo.status === 'Inativo') countDesmobilizados++;

      if (expInfo.emExperiencia) {
        countExperiencia++;
      }

      return {
        colaborador: c,
        statusInfo,
        expInfo
      };
    });

    return {
      lista,
      countAtivos,
      countFerias,
      countDisposicao,
      countAfastados,
      countLicencaMat,
      countExperiencia,
      countDesmobilizados,
      countDemitidos,
      totalGeral: colaboradores.length
    };
  }, [colaboradores, ferias, disponibilidades, todayStr]);

  const [filtroSituacao, setFiltroSituacao] = useState<
    "todos" | "ativos" | "ferias" | "disposicao" | "afastados" | "licenca_mat" | "experiencia" | "desmobilizados" | "demitidos"
  >("todos");
  const [buscaSituacao, setBuscaSituacao] = useState("");

  const colaboradoresSituacaoFiltrados = useMemo(() => {
    return relacaoSituacao.lista.filter(item => {
      const { colaborador: c, statusInfo, expInfo } = item;

      if (filtroSituacao === "ativos" && statusInfo.status !== 'Ativo no Projeto') return false;
      if (filtroSituacao === "ferias" && statusInfo.status !== 'Em Férias') return false;
      if (filtroSituacao === "disposicao" && statusInfo.status !== 'À Disposição') return false;
      if (filtroSituacao === "afastados" && statusInfo.status !== 'Afastado') return false;
      if (filtroSituacao === "licenca_mat" && statusInfo.status !== 'Licença-maternidade') return false;
      if (filtroSituacao === "experiencia" && !expInfo.emExperiencia) return false;
      if (filtroSituacao === "desmobilizados" && statusInfo.status !== 'Desmobilizado' && statusInfo.status !== 'Inativo') return false;
      if (filtroSituacao === "demitidos" && statusInfo.status !== 'Demitido') return false;

      if (buscaSituacao.trim()) {
        const t = buscaSituacao.toLowerCase().trim();
        return (
          c.nomeCompleto.toLowerCase().includes(t) ||
          c.matricula.toLowerCase().includes(t) ||
          c.funcao.toLowerCase().includes(t) ||
          (c.cpf && c.cpf.includes(t))
        );
      }
      return true;
    }).sort((a, b) => a.colaborador.nomeCompleto.localeCompare(b.colaborador.nomeCompleto, "pt-BR"));
  }, [relacaoSituacao, filtroSituacao, buscaSituacao]);

  const handleExportRelacaoSituacao = () => {
    const rows = colaboradoresSituacaoFiltrados.map(({ colaborador: c, statusInfo, expInfo }) => ({
      "Matrícula": c.matricula,
      "Nome Completo": c.nomeCompleto,
      "CPF": c.cpf || "-",
      "Função": c.funcao,
      "Mão de Obra": c.tipoMaoDeObra,
      "Regime de Trabalho": c.regimeTrabalho || "-",
      "Cidade / UF": `${c.cidade || "-"}/${c.estado || "-"}`,
      "Data de Admissão": formatBrDate(c.dataAdmissao),
      "Situação Atual no Projeto": statusInfo.label,
      "Detalhe / Observação Situação": statusInfo.detalhe || "-",
      "Data da Demissão": c.dataDemissao ? formatBrDate(c.dataDemissao) : "-",
      "Motivo da Demissão": c.motivoDemissao || "-",
      "Data de Desmobilização": c.dataDesmobilizacao ? formatBrDate(c.dataDesmobilizacao) : "-",
      "Observação / Motivo Desmobilização": c.motivoDesmobilizacao || "-",
      "Crédito de Férias Acumulado (Dias)": c.creditoFeriasAcumulado !== undefined ? c.creditoFeriasAcumulado : "-",
      "Projeto Devido do Crédito": c.projetoDevidoCredito || "-",
      "Em Período de Experiência (≤ 89d)": expInfo.emExperiencia ? "SIM (Vigente)" : "NÃO (Concluída ou Dispensada)",
      "Término da Experiência (Admissão + 89d)": expInfo.dataFimExperiencia ? formatBrDate(expInfo.dataFimExperiencia) : "-",
      "Dias Cumpridos na Experiência": expInfo.diasCumpridos,
      "Dias Restantes de Experiência": expInfo.emExperiencia ? expInfo.diasRestantes : 0,
      "Diagnóstico Experiência": expInfo.mensagem
    }));

    exportToExcel(rows, `Relacao_Funcionarios_Situacao_Borborema_${todayStr}`, "Quadro de Pessoal");
  };

  // Colaboradores que têm viagens registradas no mês selecionado
  const viagensLancadasNoMes = useMemo(() => {
    return viagens
      .filter(v => v.dataRealInicio && v.dataRealInicio.startsWith(selectedMonth))
      .map(v => {
        const col = colaboradores.find(c => c.matricula === v.matricula);
        
        let statusGozo: "Em Gozo" | "Lançado" | "Retornado" = "Lançado";
        if (todayStr >= v.dataRealInicio && todayStr <= v.dataRealRetorno) {
          statusGozo = "Em Gozo";
        } else if (todayStr > v.dataRealRetorno) {
          statusGozo = "Retornado";
        }

        const custoTotalViagem = (v.valorPassagem || 0) + (v.adiantamento || 0) + (v.valorVendaFolga || 0);

        return {
          id: v.id,
          matricula: v.matricula,
          nome: col ? col.nomeCompleto : "Desconhecido/Inativo",
          fotoUrl: col ? col.fotoUrl : undefined,
          tipoMaoDeObra: col ? col.tipoMaoDeObra : "-",
          dataRealInicio: v.dataRealInicio,
          dataRealRetorno: v.dataRealRetorno,
          tipoTransporte: v.tipoTransporte,
          statusGozo,
          passagem: v.valorPassagem || 0,
          adiantamento: v.adiantamento || 0,
          vendaFolga: v.valorVendaFolga || 0,
          custoTotalViagem,
          cidade: col ? col.cidade : "",
          estado: col ? col.estado : ""
        };
      })
      .sort((a, b) => new Date(a.dataRealInicio).getTime() - new Date(b.dataRealInicio).getTime());
  }, [viagens, colaboradores, selectedMonth, todayStr]);

  // Exportação rápida dos indicadores e do relatório de custos em planilha Excel mantendo a estrutura completa
  const handleExportExcel = () => {
    // A. Resumo Executivo (Dados do Dashboard)
    const summaryData = [
      { "Indicador / Métrica": "Total Colaboradores Ativos", "Valor": stats.totalAtivos },
      { "Indicador / Métrica": "Mão de Obra Indireta (MOI)", "Valor": stats.totalMOI },
      { "Indicador / Métrica": "Mão de Obra Direta (MOD)", "Valor": stats.totalMOD },
      { "Indicador / Métrica": `Total de Gastos no Mês Selecionado (${selectedMonth})`, "Valor": `R$ ${stats.totalGastosNoMes.toFixed(2)}` },
      { "Indicador / Métrica": "• 01. Custo de Passagem", "Valor": `R$ ${stats.totalGeralPassagens.toFixed(2)}` },
      { "Indicador / Métrica": "• 02. Adiantamento Ajuda de Custos", "Valor": `R$ ${stats.totalGeralAdiantamentos.toFixed(2)}` },
      { "Indicador / Métrica": "• 03. Vendas de Folga de Campo", "Valor": `R$ ${stats.totalGeralVendas.toFixed(2)}` },
      { "Indicador / Métrica": "Quantidade Geral de Viagens Lançadas", "Valor": stats.qtdViagensNoMes },
    ];

    // B. Detalhamento de Custos (Tabela Detalhada com Nome Completo, Matrícula, etc)
    const detailedData = viagensLancadasNoMes.map(v => ({
      "Matrícula": v.matricula,
      "Nome Completo": v.nome,
      "Mão de Obra": v.tipoMaoDeObra,
      "Cidade de Destino": v.cidade || "-",
      "Estado (UF)": v.estado || "-",
      "Início da Viagem": formatBrDate(v.dataRealInicio),
      "Retorno da Viagem": formatBrDate(v.dataRealRetorno),
      "Status da Folga": v.statusGozo,
      "01. Custo de Passagem (R$)": v.passagem,
      "02. Adiantamento Ajuda de Custos (R$)": v.adiantamento,
      "03. Vendas de Folga de Campo (R$)": v.vendaFolga,
      "Custo Total (R$)": v.custoTotalViagem,
    }));

    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);

    // Ajustes de tamanho de coluna para ficar apresentável
    wsSummary["!cols"] = [{ wch: 45 }, { wch: 20 }];
    wsDetailed["!cols"] = [
      { wch: 12 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Executivo");
    XLSX.utils.book_append_sheet(wb, wsDetailed, "Minúcia de Custos e Despesas");

    XLSX.writeFile(wb, `ERP_Relatorio_Despesas_FolgadeCampo_Borborema_${selectedMonth}.xlsx`);
  };

  return (
    <div id="section-dashboard" className="space-y-6">
      
      {/* Cabeçalho de Introdução */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Dashboard Executivo • Projeto Borborema
          </h2>
          <p className="text-[#141414]/75 text-xs font-mono uppercase tracking-tight mt-1">
            Métricas de Ativos, Programação de Folga e Demonstrativo Financeiro de Despesas de Campo.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor do Mês de Referência */}
          <div className="flex items-center gap-2 border border-[#141414] bg-neutral-50 px-3 py-1.5 font-mono select-none">
            <span className="text-[10px] font-bold uppercase tracking-tight opacity-75">Ref:</span>
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:ring-0 focus:outline-none text-[#141414]"
            />
          </div>

          {isAdmin && (
            <button
              id="btn-export-dashboard"
              onClick={handleExportExcel}
              className="flex items-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
          )}

          <button
            id="btn-print-dashboard"
            onClick={() => onPrint ? onPrint() : window.print()}
            className="flex items-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir PDF
          </button>
        </div>
      </div>

      {/* Grid de KPIs - Redesenhados somente para Ativos Totais, MOI/MOD e Custos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Colaboradores Ativos */}
        <div 
          onClick={() => onNavigate?.("cadastro")}
          className="border border-[#141414] p-5 bg-white flex flex-col justify-between cursor-pointer hover:bg-[#141414]/5 transition-all duration-150 group shadow-xs"
        >
          <div>
            <div className="font-serif italic text-xs text-[#141414]/70 font-semibold group-hover:text-black">Ativos Totais</div>
            <div className="text-4xl font-mono mt-1 text-[#141414] font-black">{stats.totalAtivos}</div>
          </div>
          <div className="w-full bg-[#141414]/15 h-1 mt-4">
            <div className="bg-[#141414] h-1" style={{ width: "100%" }}></div>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-tight opacity-70 mt-1.5 font-bold flex justify-between items-center">
            <span>Colaboradores em Atividade</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-indigo-700">Ir para Fichas →</span>
          </span>
        </div>

        {/* KPI 2: Splits MOI / MOD */}
        <div 
          onClick={() => onNavigate?.("cadastro")}
          className="border border-[#141414] p-5 bg-white flex flex-col justify-between cursor-pointer hover:bg-[#141414]/5 transition-all duration-150 group shadow-xs"
        >
          <div>
            <div className="font-serif italic text-xs text-[#141414]/70 font-semibold">Divisão MOI / MOD</div>
            <div className="text-4.5xl font-mono mt-1 text-[#141414] font-bold tracking-tight">
              {stats.totalMOI} <span className="opacity-25">/</span> {stats.totalMOD}
            </div>
          </div>
          <div className="w-full bg-[#141414]/15 h-1 mt-4">
            <div 
              className="bg-[#141414] h-1" 
              style={{ width: stats.totalAtivos > 0 ? `${(stats.totalMOD / stats.totalAtivos) * 100}%` : "0%" }}
            ></div>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-tight opacity-70 mt-1.5 font-bold flex justify-between items-center">
            <span>MOI (Indireto) / MOD (Direto)</span>
            <span className="opacity-100 font-mono text-[9px] text-[#141414]">
              {stats.totalAtivos > 0 ? Math.round((stats.totalMOD / stats.totalAtivos) * 100) : 0}% MOD
            </span>
          </span>
        </div>

        {/* KPI 3: Gasto Geral no Mês */}
        <div 
          onClick={() => onNavigate?.("folga")}
          className="border border-[#141414] p-5 bg-amber-50/20 hover:bg-amber-50/40 transition-all duration-150 group shadow-xs flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="font-serif italic text-xs text-amber-900 font-bold">Gastos Viagens no Mês</div>
            <div className="text-3xl font-mono font-black mt-1 text-emerald-800">
              R$ {stats.totalGastosNoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-full bg-[#141414]/15 h-1 mt-4">
            <div className="bg-[#141414] h-1 w-full"></div>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-tight text-[#141414]/80 mt-1.5 font-bold flex justify-between items-center">
            <span>Passagem, adto, venda folga</span>
            <span className="font-bold text-emerald-800">Ref: {selectedMonth}</span>
          </span>
        </div>

        {/* KPI 4: Viagens de Folga Lançadas no Mês */}
        <div 
          onClick={() => onNavigate?.("folga")}
          className="border border-[#141414] p-5 bg-white flex flex-col justify-between cursor-pointer hover:bg-[#141414]/5 transition-all duration-150 group shadow-xs"
        >
          <div>
            <div className="font-serif italic text-xs text-[#141414]/70 font-semibold group-hover:text-black">Folgas Ativas no Mês</div>
            <div className="text-4xl font-mono mt-1 text-[#141414] font-black">{stats.qtdViagensNoMes}</div>
          </div>
          <div className="w-full bg-[#141414]/15 h-1 mt-4">
            <div 
              className="bg-[#141414] h-1" 
              style={{ width: stats.qtdViagensNoMes > 0 ? "100%" : "0%" }}
            ></div>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-tight opacity-70 mt-1.5 font-bold flex justify-between items-center">
            <span>Viagens de Folga Registradas</span>
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-indigo-700 font-bold">Gerenciar →</span>
          </span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* RELAÇÃO DE FUNCIONÁRIOS DO PROJETO POR SITUAÇÃO & EXPERIÊNCIA */}
      {/* ========================================================================= */}
      <div id="section-relacao-situacao" className="bg-white border border-[#141414] p-6 space-y-5 shadow-xs">
        
        {/* Header da Seção */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#141414]/15 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 text-[9px] font-mono font-bold uppercase rounded border border-indigo-300">
                Quadro de Pessoal • Projeto Borborema
              </span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">
                • Gestão de Lotação & Experiência
              </span>
            </div>
            <h3 className="text-base font-mono uppercase tracking-wider font-extrabold text-[#141414] mt-1.5 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-700" />
              <span>Relação de Funcionários por Situação & Experiência</span>
            </h3>
            <p className="text-[11px] text-slate-600 font-sans mt-0.5">
              Identificação completa e quantitativo de colaboradores por situação operacional (Ativos no projeto, de férias, à disposição, afastados e em licença-maternidade) e bloco probatório de experiência (Admissão + 89 dias).
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={handleExportRelacaoSituacao}
                className="flex items-center gap-1.5 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2 transition-colors cursor-pointer shadow-2xs"
                title="Exportar Relação de Funcionários com Situação e Experiência em Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Exportar Relação</span>
              </button>
            )}

            <button
              onClick={() => onNavigate?.("cadastro")}
              className="flex items-center gap-1.5 border border-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2 transition-colors cursor-pointer shadow-2xs"
              title="Acessar Fichas e Cadastrar Funcionários"
            >
              <span>Gerenciar Cadastros</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CARDS DE QUANTIDADE POR SITUAÇÃO & BLOCO DE EXPERIÊNCIA */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          
          {/* 1. Ativos no Projeto */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "ativos" ? "todos" : "ativos")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "ativos" 
                ? "border-emerald-600 bg-emerald-100/70 ring-2 ring-emerald-500 shadow-sm" 
                : "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/50 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Ativos</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countAtivos}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-emerald-800 font-medium">
              <span>em atividade</span>
              {filtroSituacao === "ativos" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 2. De Férias */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "ferias" ? "todos" : "ferias")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "ferias" 
                ? "border-sky-600 bg-sky-100/70 ring-2 ring-sky-500 shadow-sm" 
                : "border-sky-200 bg-sky-50/50 hover:bg-sky-100/50 hover:border-sky-400"
            }`}
          >
            <div className="flex items-center justify-between text-sky-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">De Férias</span>
              <CalendarDays className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countFerias}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-sky-800 font-medium">
              <span>gozo de férias</span>
              {filtroSituacao === "ferias" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 3. À Disposição */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "disposicao" ? "todos" : "disposicao")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "disposicao" 
                ? "border-amber-600 bg-amber-100/70 ring-2 ring-amber-500 shadow-sm" 
                : "border-amber-200 bg-amber-50/50 hover:bg-amber-100/50 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">À Disposição</span>
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countDisposicao}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-amber-800 font-medium">
              <span>p/ remanejamento</span>
              {filtroSituacao === "disposicao" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 4. Afastados */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "afastados" ? "todos" : "afastados")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "afastados" 
                ? "border-purple-600 bg-purple-100/70 ring-2 ring-purple-500 shadow-sm" 
                : "border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 hover:border-purple-400"
            }`}
          >
            <div className="flex items-center justify-between text-purple-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Afastados</span>
              <HeartPulse className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countAfastados}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-purple-800 font-medium">
              <span>médico / INSS</span>
              {filtroSituacao === "afastados" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 5. Licença-Maternidade */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "licenca_mat" ? "todos" : "licenca_mat")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "licenca_mat" 
                ? "border-pink-600 bg-pink-100/70 ring-2 ring-pink-500 shadow-sm" 
                : "border-pink-200 bg-pink-50/50 hover:bg-pink-100/50 hover:border-pink-400"
            }`}
          >
            <div className="flex items-center justify-between text-pink-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Maternidade</span>
              <Baby className="w-4 h-4 text-pink-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countLicencaMat}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-pink-800 font-medium">
              <span>licença legal</span>
              {filtroSituacao === "licenca_mat" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 6. Desmobilizados (Canteiro/Obra) */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "desmobilizados" ? "todos" : "desmobilizados")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "desmobilizados" 
                ? "border-rose-600 bg-rose-100/80 ring-2 ring-rose-500 shadow-sm" 
                : "border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 hover:border-rose-400"
            }`}
          >
            <div className="flex items-center justify-between text-rose-800 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Desmobilizados</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-mono font-black text-slate-900">{relacaoSituacao.countDesmobilizados}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-rose-800 font-medium">
              <span>fora do canteiro</span>
              {filtroSituacao === "desmobilizados" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

          {/* 7. Demitidos (Rescisão Contratual CLT) */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "demitidos" ? "todos" : "demitidos")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "demitidos" 
                ? "border-zinc-900 bg-zinc-800 text-white ring-2 ring-zinc-700 shadow-sm" 
                : "border-zinc-300 bg-zinc-100/70 hover:bg-zinc-200/80 hover:border-zinc-500"
            }`}
          >
            <div className={`flex items-center justify-between mb-1 ${filtroSituacao === "demitidos" ? "text-zinc-200" : "text-zinc-800"}`}>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Demitidos</span>
              <UserX className={`w-4 h-4 ${filtroSituacao === "demitidos" ? "text-red-400" : "text-zinc-700"}`} />
            </div>
            <div className={`text-2xl font-mono font-black ${filtroSituacao === "demitidos" ? "text-white" : "text-slate-900"}`}>{relacaoSituacao.countDemitidos}</div>
            <div className={`flex items-center justify-between mt-1 text-[9px] font-medium ${filtroSituacao === "demitidos" ? "text-zinc-300" : "text-zinc-700"}`}>
              <span>rescisão contratual</span>
              {filtroSituacao === "demitidos" && <span className="font-bold text-[8px] uppercase text-red-300">● Ativo</span>}
            </div>
          </div>

          {/* 8. Bloco de Experiência (Admissão + 89 dias) */}
          <div 
            onClick={() => setFiltroSituacao(filtroSituacao === "experiencia" ? "todos" : "experiencia")}
            className={`p-3 border transition-all cursor-pointer rounded-lg relative ${
              filtroSituacao === "experiencia" 
                ? "border-indigo-600 bg-indigo-100/80 ring-2 ring-indigo-500 shadow-sm" 
                : "border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/50 hover:border-indigo-400"
            }`}
          >
            <div className="flex items-center justify-between text-indigo-900 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                <span>Experiência</span>
              </span>
              <span className="text-[8px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-1 py-0.2 rounded border border-indigo-300">
                ≤ 89d
              </span>
            </div>
            <div className="text-2xl font-mono font-black text-indigo-950">{relacaoSituacao.countExperiencia}</div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-indigo-800 font-medium">
              <span>vigentes no prazo</span>
              {filtroSituacao === "experiencia" && <span className="font-bold text-[8px] uppercase">● Ativo</span>}
            </div>
          </div>

        </div>

        {/* Card Informativo da Regra de Experiência */}
        <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Clock className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-mono font-bold uppercase tracking-tight text-indigo-900 block sm:inline">
                Regra do Bloco de Experiência (Data de Admissão + 89 dias):
              </span>{" "}
              <span className="text-slate-700 font-sans text-[11px]">
                Contabiliza apenas colaboradores cuja experiência está <strong>vigente</strong> (até 89 dias a partir da data de admissão). Caso já tenha vencido a experiência (&gt; 89 dias), <strong>não é contabilizado</strong> neste bloco de experiência.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-300 rounded">
              {relacaoSituacao.countExperiencia} colaboradores em experiência
            </span>
          </div>
        </div>

        {/* Barra de Busca e Filtros Rápidos */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 pt-1">
          {/* Campo de Busca */}
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Buscar colaborador, matrícula, função ou CPF..."
              value={buscaSituacao}
              onChange={(e) => setBuscaSituacao(e.target.value)}
              className="w-full bg-white text-[#141414] pl-9 pr-8 py-2 text-xs border border-[#141414]/30 focus:border-[#141414] rounded-md outline-none font-mono"
            />
            {buscaSituacao && (
              <button
                onClick={() => setBuscaSituacao("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-black text-xs font-mono"
              >
                ✕
              </button>
            )}
          </div>

          {/* Abas / Chips de Filtragem Rápida */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
            <button
              onClick={() => setFiltroSituacao("todos")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "todos"
                  ? "bg-[#141414] text-white border-[#141414]"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              Todos ({relacaoSituacao.totalGeral})
            </button>

            <button
              onClick={() => setFiltroSituacao("ativos")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "ativos"
                  ? "bg-emerald-700 text-white border-emerald-700"
                  : "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              Ativos ({relacaoSituacao.countAtivos})
            </button>

            <button
              onClick={() => setFiltroSituacao("ferias")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "ferias"
                  ? "bg-sky-700 text-white border-sky-700"
                  : "bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100"
              }`}
            >
              Em Férias ({relacaoSituacao.countFerias})
            </button>

            <button
              onClick={() => setFiltroSituacao("disposicao")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "disposicao"
                  ? "bg-amber-700 text-white border-amber-700"
                  : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
              }`}
            >
              À Disposição ({relacaoSituacao.countDisposicao})
            </button>

            <button
              onClick={() => setFiltroSituacao("afastados")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "afastados"
                  ? "bg-purple-700 text-white border-purple-700"
                  : "bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100"
              }`}
            >
              Afastados ({relacaoSituacao.countAfastados})
            </button>

            <button
              onClick={() => setFiltroSituacao("licenca_mat")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "licenca_mat"
                  ? "bg-pink-700 text-white border-pink-700"
                  : "bg-pink-50 text-pink-800 border-pink-300 hover:bg-pink-100"
              }`}
            >
              Licença-Maternidade ({relacaoSituacao.countLicencaMat})
            </button>

            <button
              onClick={() => setFiltroSituacao("experiencia")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "experiencia"
                  ? "bg-indigo-700 text-white border-indigo-700"
                  : "bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100"
              }`}
            >
              ⭐ Experiência ({relacaoSituacao.countExperiencia})
            </button>

            <button
              onClick={() => setFiltroSituacao("desmobilizados")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "desmobilizados"
                  ? "bg-rose-700 text-white border-rose-700"
                  : "bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100"
              }`}
            >
              Desmobilizados ({relacaoSituacao.countDesmobilizados})
            </button>

            <button
              onClick={() => setFiltroSituacao("demitidos")}
              className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-colors rounded-md border cursor-pointer ${
                filtroSituacao === "demitidos"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-zinc-100 text-zinc-900 border-zinc-300 hover:bg-zinc-200"
              }`}
            >
              Demitidos ({relacaoSituacao.countDemitidos})
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* TABELA DE IDENTIFICAÇÃO DOS COLABORADORES */}
        {/* ===================================================================== */}
        <div className="overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar border border-[#141414]/15 bg-white">
          {colaboradoresSituacaoFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="font-bold uppercase tracking-wider text-slate-700">
                Nenhum colaborador encontrado para o filtro selecionado.
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-sans">
                {buscaSituacao 
                  ? `Nenhum resultado corresponde à busca "${buscaSituacao}".` 
                  : "Não há colaboradores cadastrados nesta situação."}
              </p>
              {(buscaSituacao || filtroSituacao !== "todos") && (
                <button
                  onClick={() => { setBuscaSituacao(""); setFiltroSituacao("todos"); }}
                  className="mt-3 px-3 py-1.5 bg-[#141414] text-white text-[10px] uppercase font-bold rounded cursor-pointer"
                >
                  Limpar Filtros e Ver Todos
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
              <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider">
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] w-12 text-center">Foto</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Colaborador / Matrícula</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Função & Mão de Obra</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Data Admissão</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Situação Operacional</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Bloco de Experiência (≤ 89d)</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/10 bg-white">
                {colaboradoresSituacaoFiltrados.map(({ colaborador: col, statusInfo, expInfo }) => {
                  return (
                    <tr key={col.matricula} className="hover:bg-[#141414]/5 transition-colors">
                      {/* Avatar / Foto */}
                      <td className="px-4 py-2.5 text-center">
                        {col.fotoUrl ? (
                          <img
                            src={getDirectDriveImageURL(col.fotoUrl)}
                            alt={col.nomeCompleto}
                            className="w-8 h-8 rounded-full object-cover border border-[#141414]/20 mx-auto"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-mono font-bold text-[10px] flex items-center justify-center border border-slate-300 mx-auto">
                            {col.nomeCompleto.split(" ").slice(0, 2).map(n => n[0]).join("")}
                          </div>
                        )}
                      </td>

                      {/* Nome e Matrícula */}
                      <td className="px-4 py-2.5">
                        <div className="font-serif italic font-extrabold text-slate-900 text-[13px] leading-tight">
                          {col.nomeCompleto}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono">
                          <span className="font-bold text-slate-700 select-all">Mat: {col.matricula}</span>
                          {col.cpf && <span className="text-slate-400">• CPF: {col.cpf}</span>}
                          {col.matriculaAura && <span className="text-indigo-600 font-bold">• Aura: {col.matriculaAura}</span>}
                        </div>
                      </td>

                      {/* Função e Mão de Obra */}
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900 font-sans text-xs">
                          {col.funcao}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase border ${
                            col.tipoMaoDeObra === "MOI"
                              ? "bg-slate-100 text-slate-800 border-slate-300"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}>
                            {col.tipoMaoDeObra || "MOD"}
                          </span>
                          <span className="text-slate-500 font-sans">
                            {col.regimeTrabalho || "Local"} • {col.cidade || "-"}/{col.estado || "-"}
                          </span>
                        </div>
                      </td>

                      {/* Data de Admissão */}
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <div className="font-bold text-slate-800">
                          {formatBrDate(col.dataAdmissao)}
                        </div>
                        {col.dataAdmissao && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            {Math.max(0, diffDays(col.dataAdmissao, todayStr))} dias de casa
                          </div>
                        )}
                      </td>

                      {/* Situação Operacional */}
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-bold uppercase rounded-md border ${statusInfo.badgeClass}`}>
                            {statusInfo.status === 'Ativo no Projeto' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                            {statusInfo.status === 'Em Férias' && <CalendarDays className="w-3 h-3 text-sky-600" />}
                            {statusInfo.status === 'À Disposição' && <ArrowRightLeft className="w-3 h-3 text-amber-600" />}
                            {statusInfo.status === 'Afastado' && <HeartPulse className="w-3 h-3 text-purple-600" />}
                            {statusInfo.status === 'Licença-maternidade' && <Baby className="w-3 h-3 text-pink-600" />}
                            {statusInfo.status === 'Desmobilizado' && <AlertTriangle className="w-3 h-3 text-red-600" />}
                            {statusInfo.status === 'Demitido' && <UserX className="w-3 h-3 text-red-400" />}
                            <span>{statusInfo.label}</span>
                          </span>

                          {statusInfo.detalhe && (
                            <span className="text-[10px] text-slate-600 font-sans leading-tight">
                              {statusInfo.detalhe}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Bloco de Experiência (Admissão + 89 dias) */}
                      <td className="px-4 py-2.5">
                        {expInfo.emExperiencia ? (
                          <div className="space-y-1 bg-indigo-50/60 p-2 rounded border border-indigo-200 max-w-[240px]">
                            <div className="flex items-center justify-between gap-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-indigo-950 bg-indigo-200/80 px-1.5 py-0.5 rounded">
                                <Award className="w-3 h-3 text-indigo-700" />
                                <span>Em Experiência</span>
                              </span>
                              <span className="text-[10px] font-mono font-black text-indigo-900">
                                {expInfo.diasRestantes}d restantes
                              </span>
                            </div>

                            {/* Barra de Progresso visual */}
                            <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-indigo-600 h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.round((expInfo.diasCumpridos / 89) * 100))}%`
                                }}
                              ></div>
                            </div>

                            <div className="flex items-center justify-between text-[9px] font-mono text-indigo-800">
                              <span>Cumpridos: {expInfo.diasCumpridos}/89d</span>
                              <span>Fim: {formatBrDate(expInfo.dataFimExperiencia)}</span>
                            </div>
                          </div>
                        ) : col.dataAdmissao && (col.status !== "Inativo" && !col.dataDesmobilizacao) ? (
                          <div className="text-[10px] font-mono text-slate-500">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[9px] font-bold uppercase">
                              <CheckCircle className="w-2.5 h-2.5 text-slate-400" />
                              <span>Experiência Concluída</span>
                            </span>
                            <div className="text-[9px] text-slate-400 mt-0.5 font-sans">
                              {expInfo.dataFimExperiencia ? `Término em ${formatBrDate(expInfo.dataFimExperiencia)}` : "> 89 dias"} (não contabilizado no bloco)
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">
                            Não aplicável
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => onNavigate?.("cadastro")}
                          className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-tight bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hover:border-slate-500 transition-colors rounded cursor-pointer"
                          title="Abrir Ficha do Colaborador no Cadastro"
                        >
                          Ver Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé da Relação */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-1 text-[11px] font-mono text-slate-500 border-t border-slate-200">
          <div>
            Exibindo <strong>{colaboradoresSituacaoFiltrados.length}</strong> de <strong>{relacaoSituacao.totalGeral}</strong> colaboradores cadastrados.
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ativos: {relacaoSituacao.countAtivos}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span> Férias: {relacaoSituacao.countFerias}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> À Disp: {relacaoSituacao.countDisposicao}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Experiência: {relacaoSituacao.countExperiencia}
            </span>
          </div>
        </div>

      </div>

      {/* PAINEL DE MOBILIZAÇÃO E DISPONIBILIDADE (ITEM 2 DO ESCOPO) */}
      <div className="bg-white border border-[#141414] p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414]/15 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold uppercase rounded border border-emerald-300">
                Indicadores em Tempo Real
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                • Gestão de Mobilização
              </span>
            </div>
            <h3 className="text-sm font-mono uppercase tracking-wider font-extrabold text-[#141414] mt-1">
              Painel de Disponibilidade & Transferência de Colaboradores
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Colaboradores liberados pelos canteiros, disponibilidades futuras, pessoas em negociação e tempo médio de realocação.
            </p>
          </div>

          <button
            onClick={() => onNavigate?.("disponibilidade")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
          >
            <span>Gerenciar Disponibilidades</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 CARDS DE INDICADORES DE MOBILIZAÇÃO */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Disponíveis Atuais */}
          <div 
            onClick={() => onNavigate?.("disponibilidade")}
            className="p-4 border border-emerald-300/80 bg-emerald-50/40 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors"
          >
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">À Disposição</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-mono font-black text-slate-900">{statsMobilizacao.disponiveis}</div>
            <span className="text-[10px] text-emerald-800 font-medium">aptos hoje</span>
          </div>

          {/* Programadas */}
          <div 
            onClick={() => onNavigate?.("disponibilidade")}
            className="p-4 border border-sky-300/80 bg-sky-50/40 rounded-xl cursor-pointer hover:bg-sky-50 transition-colors"
          >
            <div className="flex items-center justify-between text-sky-700 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Programadas</span>
              <CalendarClock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-3xl font-mono font-black text-slate-900">{statsMobilizacao.programadas}</div>
            <span className="text-[10px] text-sky-800 font-medium">liberação futura</span>
          </div>

          {/* Em Negociação */}
          <div 
            onClick={() => onNavigate?.("disponibilidade")}
            className="p-4 border border-amber-300/80 bg-amber-50/40 rounded-xl cursor-pointer hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Negociação</span>
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-3xl font-mono font-black text-slate-900">{statsMobilizacao.emNegociacao}</div>
            <span className="text-[10px] text-amber-800 font-medium">em tratativa</span>
          </div>

          {/* Transferências */}
          <div 
            onClick={() => onNavigate?.("disponibilidade")}
            className="p-4 border border-indigo-300/80 bg-indigo-50/40 rounded-xl cursor-pointer hover:bg-indigo-50 transition-colors"
          >
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Transferências</span>
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-mono font-black text-slate-900">{statsMobilizacao.totalTransferidosGeral}</div>
            <span className="text-[10px] text-indigo-800 font-medium">
              {statsMobilizacao.transferidosPeriodo} no mês ({selectedMonth})
            </span>
          </div>

          {/* Tempo Médio */}
          <div className="p-4 border border-slate-300 bg-slate-50/60 rounded-xl">
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Tempo Médio</span>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-3xl font-mono font-black text-slate-900">
              {statsMobilizacao.tempoMedioTransferenciaDias}d
            </div>
            <span className="text-[10px] text-slate-500 font-medium">disp. até transferência</span>
          </div>

          {/* Custo Ociosidade Estimado */}
          <div 
            onClick={() => onNavigate?.("disponibilidade")}
            className="p-4 border border-rose-300/80 bg-rose-50/40 rounded-xl cursor-pointer hover:bg-rose-50 transition-colors"
          >
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Custo Ociosidade</span>
              <DollarSign className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-mono font-black text-rose-900 truncate" title={`R$ ${statsMobilizacao.custoTotalAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}>
              R$ {statsMobilizacao.custoTotalAcumulado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-rose-700 font-medium">acumulado s/ alocação</span>
          </div>
        </div>

        {/* DETALHAMENTO: DISTRIBUIÇÃO POR PROJETO E POR FUNÇÃO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Disponíveis por Projeto de Origem */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-mono font-bold uppercase text-slate-800">
                  Disponíveis por Projeto de Origem
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {Object.keys(statsMobilizacao.porProjetoOrigem).length} projetos
              </span>
            </div>

            {Object.keys(statsMobilizacao.porProjetoOrigem).length === 0 ? (
              <p className="text-[11px] text-slate-400 font-mono py-4 text-center">
                [ NENHUM COLABORADOR À DISPOSIÇÃO NO MOMENTO ]
              </p>
            ) : (
              <div className="space-y-2">
                {(Object.entries(statsMobilizacao.porProjetoOrigem) as [string, number][]).map(([projeto, qtd]) => {
                  const pct = statsMobilizacao.disponiveis > 0 ? (Number(qtd) / statsMobilizacao.disponiveis) * 100 : 0;
                  return (
                    <div key={projeto} className="text-xs font-sans">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-medium text-slate-800 truncate max-w-[220px]">{projeto}</span>
                        <span className="font-mono font-bold text-slate-900">{qtd} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Disponíveis por Função */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-mono font-bold uppercase text-slate-800">
                  Disponíveis por Função / Cargo
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {Object.keys(statsMobilizacao.porFuncao).length} cargos
              </span>
            </div>

            {Object.keys(statsMobilizacao.porFuncao).length === 0 ? (
              <p className="text-[11px] text-slate-400 font-mono py-4 text-center">
                [ NENHUM CARGO PENDENTE DE REMANEJAMENTO ]
              </p>
            ) : (
              <div className="space-y-2">
                {(Object.entries(statsMobilizacao.porFuncao) as [string, number][]).map(([funcao, qtd]) => {
                  const pct = statsMobilizacao.disponiveis > 0 ? (Number(qtd) / statsMobilizacao.disponiveis) * 100 : 0;
                  return (
                    <div key={funcao} className="text-xs font-sans">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="font-medium text-slate-800 truncate max-w-[220px]">{funcao}</span>
                        <span className="font-mono font-bold text-slate-900">{qtd} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* EVOLUÇÃO MENSAL DE DISPONIBILIDADES E TRANSFERÊNCIAS */}
        {Object.keys(statsMobilizacao.evolucaoMensal).length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-[11px] font-mono font-bold uppercase text-slate-600 mb-2">
              Evolução Mensal (Disponibilidades vs Transferências Efetivadas)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {(Object.entries(statsMobilizacao.evolucaoMensal) as [string, { disponibilidades: number; transferencias: number }][])
                .sort(([mA], [mB]) => mA.localeCompare(mB))
                .slice(-6)
                .map(([mes, dados]) => (
                  <div key={mes} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                    <span className="text-[10px] font-mono font-bold text-slate-700 block">{mes}</span>
                    <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
                      +{dados.disponibilidades} disp.
                    </div>
                    <div className="text-[10px] font-mono text-indigo-700">
                      ✓ {dados.transferencias} transf.
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Alerta de Folgas Próximas de Vencer (<30 dias) com Rolagem e Filtro */}
      <div 
        id="alert-upcoming-field-leaves" 
        className="bg-white border border-[#141414] p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#141414]/15 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414]">
                Controle de Folga de Campo (Próximos a Vencer em até 30 Dias)
              </h3>
              <span className="text-[9px] font-mono opacity-65 uppercase block">
                Programação preditiva com base nos ciclos corporativos de MOI (59 dias) e MOD (89 dias).
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono bg-amber-400 text-black px-2.5 py-1 font-bold uppercase border border-amber-600 tracking-wider">
              ⚠️ REGRA: Exclusivo Regime Alojado
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.("folga")}
              className="text-[10px] font-mono font-bold bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 px-3 py-1 flex items-center gap-1 transition-colors cursor-pointer"
            >
              ABRIR ROTEIRO COMPLETO →
            </button>
          </div>
        </div>

        {folgasProximasVencer.length === 0 ? (
          <p className="text-xs font-mono text-emerald-800 uppercase p-4 bg-emerald-50 border border-emerald-200">
            [ NENHUM COLABORADOR COM CICLO DE FOLGA DE CAMPO PRÓXIMO DE VENCER OU ATRASADO (EXCEDEU 30 DIAS) ]
          </p>
        ) : (
          <div className="space-y-3">
            {/* Barra de Filtros e Pesquisa com Rolagem */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-50 p-2.5 border border-[#141414]/15 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] uppercase font-bold text-neutral-500">Filtrar:</span>
                <button
                  type="button"
                  onClick={() => setFiltroStatusFolgaDashboard("todos")}
                  className={`px-2 py-1 text-[10px] font-bold uppercase border transition-colors cursor-pointer ${
                    filtroStatusFolgaDashboard === "todos"
                      ? "bg-[#141414] text-[#E4E3E0] border-[#141414]"
                      : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                  }`}
                >
                  Todos ({folgasProximasVencer.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatusFolgaDashboard("vencidos")}
                  className={`px-2 py-1 text-[10px] font-bold uppercase border transition-colors cursor-pointer ${
                    filtroStatusFolgaDashboard === "vencidos"
                      ? "bg-red-700 text-white border-red-800"
                      : "bg-white text-red-700 border-red-300 hover:bg-red-50"
                  }`}
                >
                  Críticos / Vencidos ({totalVencidosFolga})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatusFolgaDashboard("proximos")}
                  className={`px-2 py-1 text-[10px] font-bold uppercase border transition-colors cursor-pointer ${
                    filtroStatusFolgaDashboard === "proximos"
                      ? "bg-amber-500 text-black border-amber-600"
                      : "bg-white text-amber-800 border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  A Vencer em até 30d ({totalProximosFolga})
                </button>
              </div>

              {/* Busca e Indicador de Rolagem */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={buscaFolgaDashboard}
                    onChange={(e) => setBuscaFolgaDashboard(e.target.value)}
                    placeholder="Pesquisar colaborador ou matrícula..."
                    className="w-full pl-8 pr-2.5 py-1 text-[11px] bg-white border border-[#141414]/30 focus:border-[#141414] outline-none font-mono"
                  />
                  {buscaFolgaDashboard && (
                    <button
                      onClick={() => setBuscaFolgaDashboard("")}
                      className="absolute right-2 top-1 text-neutral-400 hover:text-black font-bold text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
                <span className="hidden sm:inline-block text-[9px] uppercase text-neutral-500 font-bold bg-white px-2 py-1 border border-neutral-200">
                  ↕ Rolagem Ativada ({folgasFiltradasDashboard.length})
                </span>
              </div>
            </div>

            {/* Container com Rolagem Vertical (max-height) e Cabeçalho Fixo */}
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="max-h-[380px] sm:max-h-[420px] overflow-y-auto overflow-x-auto border border-[#141414]/20 shadow-inner bg-white relative scrollbar-thin"
            >
              <table className="w-full text-left text-xs font-mono border-collapse min-w-[750px]">
                <thead className="sticky top-0 z-10 bg-neutral-900 text-[#E4E3E0] shadow-xs">
                  <tr className="text-[9px] uppercase tracking-wider">
                    <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Matrícula</th>
                    <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Colaborador</th>
                    <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Mão de Obra</th>
                    <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Prazo Previsto de Folga</th>
                    <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-center">Status de Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/15 bg-white">
                  {folgasFiltradasDashboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-neutral-400 font-mono text-xs">
                        Nenhum colaborador encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    folgasFiltradasDashboard.map(item => {
                      const isFolgaVencida = item.diasAteFolga < 0;
                      return (
                        <tr key={item.matricula} className={`hover:bg-[#141414]/5 transition-colors ${isFolgaVencida ? "bg-red-50/60" : "bg-amber-50/50"}`}>
                          <td className="px-4 py-2.5 font-bold text-red-700">{item.matricula}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              {item.fotoUrl ? (
                                <img 
                                  src={getDirectDriveImageURL(item.fotoUrl)} 
                                  alt={item.nome}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 object-cover border border-[#141414] rounded-none shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold text-xs font-mono shrink-0">
                                  {item.nome.charAt(0)}
                                </div>
                              )}
                              <span className="font-serif font-extrabold italic text-black leading-tight">{item.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="border border-[#141414] px-1.5 py-0.5 text-[9px] font-bold bg-white">{item.tipoMaoDeObra}</span>
                          </td>
                          <td className="px-4 py-2.5 font-bold">{formatBrDate(item.proximaFolga)}</td>
                          <td className="px-4 py-2.5 text-center">
                            {isFolgaVencida ? (
                              <span className="bg-red-700 text-white font-black text-[9px] px-2 py-0.5 uppercase tracking-wide">
                                CRÍTICO: VENCIDO HÁ {Math.abs(item.diasAteFolga)} DIAS
                              </span>
                            ) : (
                              <span className="bg-amber-500 text-black font-extrabold text-[9px] px-2 py-0.5 border border-amber-600 uppercase tracking-wide">
                                FALTAM {item.diasAteFolga} DIAS
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 px-1">
              <span>Use a barra de rolagem vertical para navegar entre os {folgasFiltradasDashboard.length} colaboradores</span>
              <span>Ciclo: MOI 59 dias | MOD 89 dias</span>
            </div>
          </div>
        )}
      </div>

      {/* Seção Nova: Viagens Lançadas / Estão de Folga no Mês de Referência */}
      <div className="bg-white border border-[#141414] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#141414]/15 pb-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-650" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414]">
                Colaboradores Programados ou de Folga no Mês (Ref: {selectedMonth})
              </h3>
              <span className="text-[9px] font-mono opacity-65 uppercase block">Monitoramento em tempo real do início de folgas lançadas e gozos de campo ativos.</span>
            </div>
          </div>
          <div>
            <span className="text-[9px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 font-bold uppercase">
              Período de Referência Ativo
            </span>
          </div>
        </div>

        {viagensLancadasNoMes.length === 0 ? (
          <p className="text-xs font-mono text-neutral-500 uppercase py-2">[ NENHUM ACORDADO OU FOLGA LANÇADA COM DATA DE INÍCIO NESTE MÊS SELECIONADO ]</p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[360px] custom-scrollbar border border-[#141414]/15 bg-white">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Matrícula</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Colaborador</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Data Início</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Data Retorno</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Transporte</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-center">Status da Folga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15 bg-white">
                {viagensLancadasNoMes.map(v => (
                  <tr key={v.id} className="hover:bg-[#141414]/5 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-[#141414]/85">{v.matricula}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {v.fotoUrl ? (
                          <img 
                            src={getDirectDriveImageURL(v.fotoUrl)} 
                            alt={v.nome}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 object-cover border border-[#141414] rounded-none"
                          />
                        ) : (
                          <div className="w-9 h-9 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold text-xs font-mono flex-shrink-0">
                            {v.nome.charAt(0)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-serif font-extrabold italic text-black leading-tight">{v.nome}</span>
                          <span className="text-[9px] font-mono uppercase text-neutral-500 font-semibold mt-0.5">
                            Origem: {v.cidade || "Não cadastrada"}{v.estado ? ` - ${v.estado}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold">{formatBrDate(v.dataRealInicio)}</td>
                    <td className="px-4 py-2.5 font-bold">{formatBrDate(v.dataRealRetorno)}</td>
                    <td className="px-4 py-2.5">
                      <span className="border border-[#141414]/25 px-1.5 py-0.5 text-[9px] font-bold bg-neutral-50">{v.tipoTransporte}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {v.statusGozo === "Em Gozo" ? (
                        <span className="bg-emerald-600 border border-emerald-800 text-white font-extrabold text-[9px] px-2 py-0.5 uppercase tracking-wide animate-pulse">
                          🟢 EM GOZO DE FOLGA (EM CURSO)
                        </span>
                      ) : v.statusGozo === "Lançado" ? (
                        <span className="bg-indigo-100 border border-indigo-300 text-indigo-700 font-bold text-[9px] px-2 py-0.5 uppercase tracking-wide">
                          📅 LANÇADA / PROGRAMADA
                        </span>
                      ) : (
                        <span className="bg-neutral-100 border border-neutral-300 text-neutral-500 font-medium text-[9px] px-2 py-0.5 uppercase tracking-wide">
                          ↩️ FOLGA CONCLUÍDA (RETORNOU)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Relatório Financeiro Detalhado de Gastos do Mês */}
      <div className="bg-white border border-[#141414] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#141414]/15 pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414]">
                Relatório de Custos e Despesas com Folgas de Campo (Mês de Ref: {selectedMonth})
              </h3>
              <span className="text-[9px] font-mono opacity-65 uppercase block">Consolidação quantitativa de custos logísticos, adiantamentos e aquisição de folgas (vendas) no período.</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-mono font-bold uppercase text-[#141414] tracking-tight">Filtrar Mês:</label>
              <div className="border border-[#141414] bg-neutral-50 px-2 py-1 font-mono">
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 focus:outline-none text-[#141414] cursor-pointer"
                />
              </div>
            </div>
            
            {isAdmin && (
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-[10px] font-mono font-bold uppercase px-3 py-2 transition-colors cursor-pointer"
                title="Exportar Planilha Excel com Resumo e Consulta Detalhada"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Planilha Excel
              </button>
            )}

            <button
              onClick={() => onPrint ? onPrint() : window.print()}
              className="flex items-center gap-1.5 border border-[#141414] bg-neutral-900 text-[#E4E3E0] hover:bg-neutral-800 text-[10px] font-mono font-bold uppercase px-3 py-2 transition-colors cursor-pointer"
              title="Salvar ou Imprimir Relatório PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              Salvar PDF
            </button>
          </div>
        </div>

        {/* Breakdown Card de Custos */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
          <div className="bg-neutral-50 border border-[#141414] p-4 font-mono">
            <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">01. Custo de Passagem</span>
            <span className="text-xl font-black text-[#141414] block mt-1">
              R$ {stats.totalGeralPassagens.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-neutral-50 border border-[#141414] p-4 font-mono">
            <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">02. Adiantamento Ajuda de Custos</span>
            <span className="text-xl font-black text-[#141414] block mt-1">
              R$ {stats.totalGeralAdiantamentos.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-neutral-50 border border-[#141414] p-4 font-mono">
            <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">03. Vendas de Folga de Campo</span>
            <span className="text-xl font-black text-[#141414] block mt-1">
              R$ {stats.totalGeralVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-emerald-50 border border-emerald-800 p-4 font-mono">
            <span className="text-[9px] text-emerald-800 font-extrabold uppercase tracking-tight block">CUSTO TOTAL NO PERÍODO</span>
            <span className="text-xl font-black text-emerald-900 block mt-1">
              R$ {stats.totalGastosNoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Tabela de Lançamentos de Despesa */}
        {viagensLancadasNoMes.length === 0 ? (
          <p className="text-xs font-mono text-neutral-500 uppercase py-2">[ NENHUM DETALHE FINANCEIRO LANÇADO NESTE PERÍODO ]</p>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[360px] custom-scrollbar border border-[#141414]/15 bg-white">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[800px]">
              <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Matrícula</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Nome do Colaborador</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-right">01. Custo de Passagem</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-right">02. Adiantamento Ajuda de Custos</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-right">03. Vendas de Folga de Campo</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-right bg-neutral-850">Custo Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15 bg-white">
                {viagensLancadasNoMes.map(v => (
                  <tr key={v.id} className="hover:bg-[#141414]/5 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-neutral-700">{v.matricula}</td>
                    <td className="px-4 py-2.5 font-serif font-extrabold italic text-black">{v.nome}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-neutral-750">
                      R$ {v.passagem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-neutral-750">
                      R$ {v.adiantamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-neutral-750">
                      R$ {v.vendaFolga.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-extrabold bg-[#141414]/2 text-black">
                      R$ {v.custoTotalViagem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trilha de Auditoria - Últimas Ações Registradas no Sistema */}
      <div className="bg-white border border-[#141414] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#141414]/15 pb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414]">
                Trilha de Auditoria - Ações Recentes no Sistema
              </h3>
              <span className="text-[9px] font-mono opacity-65 uppercase block">
                Histórico em tempo real de alterações, inclusões de documentos, memorandos e férias.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.("logs")}
              className="text-[10px] font-mono font-bold bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 px-3 py-1.5 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              VER TODA A AUDITORIA ({logs.length}) →
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs font-mono text-neutral-400 uppercase py-4 text-center">
            [ NENHUM LOG REGISTRADO ATÉ O MOMENTO ]
          </p>
        ) : (
          <div className="divide-y divide-[#141414]/10 border border-[#141414]/15 bg-white">
            {logs.slice(0, 6).map((log) => {
              const formattedTime = new Date(log.dataHora).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit"
              });
              const formattedDate = new Date(log.dataHora).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit"
              });

              return (
                <div
                  key={log.id}
                  className="p-3 hover:bg-[#141414]/5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-start sm:items-center gap-2 flex-1">
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-800 font-bold border border-neutral-300 text-[9px] uppercase shrink-0">
                      {log.modulo}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0 border ${
                      log.acao === "Inclusão"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : log.acao === "Edição"
                        ? "bg-blue-50 text-blue-800 border-blue-300"
                        : log.acao === "Exclusão"
                        ? "bg-red-50 text-red-800 border-red-300"
                        : "bg-purple-50 text-purple-800 border-purple-300"
                    }`}>
                      {log.acao}
                    </span>
                    <span className="text-neutral-900 font-medium text-[11px] leading-snug">
                      {log.descricao}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 shrink-0 self-end sm:self-center font-bold">
                    <span>{log.usuario}</span>
                    <span>•</span>
                    <span>{formattedDate} às {formattedTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
