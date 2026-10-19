import { useMemo, useState } from "react";
import { Colaborador, Viagem } from "../types";
import { addDays, diffDays, formatBrDate } from "../utils/date";
import { 
  Users, 
  FileSpreadsheet,
  Clock,
  TrendingUp,
  CreditCard,
  Plane,
  CalendarDays,
  Printer
} from "lucide-react";
import { exportToExcel } from "../utils/excel";
import * as XLSX from "xlsx";
import { getDirectDriveImageURL } from "../utils/drive";

interface DashboardProps {
  colaboradores: Colaborador[];
  viagens: Viagem[];
  onNavigate?: (tab: "dashboard" | "cadastro" | "folga") => void;
  onPrint?: () => void;
  isAdmin?: boolean;
}

export default function Dashboard({ colaboradores, viagens, onNavigate, onPrint, isAdmin = true }: DashboardProps) {
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

      {/* Alerta de Folgas Próximas de Vencer (<30 dias) */}
      <div 
        id="alert-upcoming-field-leaves" 
        onClick={() => onNavigate?.("folga")}
        className="bg-white border border-[#141414] p-6 space-y-4 cursor-pointer hover:border-black hover:bg-[#141414]/5 transition-all duration-150 shadow-xs group"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#141414]/15 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414] group-hover:text-amber-800 transition-colors">
                Controle de Folga de Campo (Próximos a Vencer em até 30 Dias)
              </h3>
              <span className="text-[9px] font-mono opacity-65 uppercase block">Programação preditiva com base nos ciclos corporativos de MOI (59 dias) e MOD (89 dias).</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono bg-amber-400 text-black px-2.5 py-1 font-bold uppercase border border-amber-600 tracking-wider">
              ⚠️ REGRA: Exclusivo Regime Alojado
            </span>
            <span className="text-[10px] font-mono font-bold bg-[#141414] text-[#E4E3E0] px-2 py-1 flex items-center gap-1 group-hover:bg-neutral-800 transition-colors">
              ABRIR ROTEIRO →
            </span>
          </div>
        </div>

        {folgasProximasVencer.length === 0 ? (
          <p className="text-xs font-mono text-emerald-800 uppercase">[ NENHUM COLABORADOR COM CICLO DE FOLGA DE CAMPO PRÓXIMO DE VENCER OU ATRASADO (EXCEDEU 30 DIAS) ]</p>
        ) : (
          <div className="overflow-x-auto border border-[#141414]/15">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] uppercase tracking-wider">
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Matrícula</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Colaborador</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Mão de Obra</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0]">Prazo Previsto de Folga</th>
                  <th className="px-4 py-2.5 bg-neutral-900 text-[#E4E3E0] text-center">Status de Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15 bg-white">
                {folgasProximasVencer.map(item => {
                  const isFolgaVencida = item.diasAteFolga < 0;
                  return (
                    <tr key={item.matricula} className={`hover:bg-[#141414]/5 transition-colors ${isFolgaVencida ? "bg-red-50" : "bg-amber-50"}`}>
                      <td className="px-4 py-2.5 font-bold text-red-700">{item.matricula}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          {item.fotoUrl ? (
                            <img 
                              src={getDirectDriveImageURL(item.fotoUrl)} 
                              alt={item.nome}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 object-cover border border-[#141414] rounded-none"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold text-xs font-mono flex-shrink-0">
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
                })}
              </tbody>
            </table>
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
          <div className="overflow-x-auto border border-[#141414]/15">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[800px]">
              <thead>
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
          <div className="overflow-x-auto border border-[#141414]/15">
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[800px]">
              <thead>
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

    </div>
  );
}
