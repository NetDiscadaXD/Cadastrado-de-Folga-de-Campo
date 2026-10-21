import React, { useState, useMemo } from "react";
import { Colaborador } from "../types";
import { formatBrDate, addDays } from "../utils/date";
import { 
  ShieldCheck, 
  Search, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  Save, 
  Check, 
  Clock, 
  User, 
  Briefcase,
  AlertCircle,
  Lock,
  Unlock,
  AlertTriangle
} from "lucide-react";
import { exportToExcel } from "../utils/excel";

interface RelatorioCrachaViewProps {
  colaboradores: Colaborador[];
  onUpdateColaborador: (matricula: string, dados: Partial<Colaborador>) => Promise<void>;
  onPrint: () => void;
  isAdmin?: boolean;
}

// Funções utilitárias locais de cálculo de data
function getCalendarDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const sDate = new Date(start + "T12:00:00");
  const eDate = new Date(end + "T12:00:00");
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return null;
  if (sDate > eDate) return 0;
  
  const diffTime = eDate.getTime() - sDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // Contagem inclusiva
  return diffDays;
}

function getWorkingDays(start: string, end: string): number | null {
  if (!start || !end) return null;
  const sDate = new Date(start + "T12:00:00");
  const eDate = new Date(end + "T12:00:00");
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return null;
  if (sDate > eDate) return 0;

  let count = 0;
  const current = new Date(sDate.getTime());
  while (current <= eDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclui Domingo (0) e Sábado (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export default function RelatorioCrachaView({ 
  colaboradores, 
  onUpdateColaborador, 
  onPrint, 
  isAdmin = true 
}: RelatorioCrachaViewProps) {
  
  // Estados para Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Ativo" | "Inativo">("Ativo");
  const [releaseFilter, setReleaseFilter] = useState<"Todos" | "Liberado" | "Pendente">("Todos");
  const [clientBlockFilter, setClientBlockFilter] = useState<"Todos" | "Sim" | "Não">("Todos");
  const [viewType, setViewType] = useState<"geral" | "corridos" | "uteis">("geral");

  // Estado unificado para edições temporárias dos colaboradores
  const [tempChanges, setTempChanges] = useState<Record<string, {
    dataLiberacaoCracha?: string;
    bloqueioCliente?: boolean;
    dataBloqueioCliente?: string;
    motivoBloqueioCliente?: string;
    desbloqueioCliente?: boolean;
    dataDesbloqueioCliente?: string;
    motivoDesbloqueioCliente?: string;
    dataTreinamentoAura?: string;
    matriculaAura?: string;
  }>>({});
  const [savingMatriculas, setSavingMatriculas] = useState<Record<string, boolean>>({});

  // Obter valor ativo (temporário ou persistido) para o colaborador
  const getColValue = <K extends keyof Colaborador>(col: Colaborador, key: K): any => {
    const changes = tempChanges[col.matricula];
    if (changes && changes[key as any] !== undefined) {
      return changes[key as any];
    }
    return col[key];
  };

  // Verificar se o colaborador tem restrição Aura de forma abrangente
  const getHasAuraRestriction = (col: Colaborador): boolean => {
    const obs = String(getColValue(col, "observacao") || "").toLowerCase();
    const motive = String(getColValue(col, "motivoBloqueioCliente") || "").toLowerCase();
    
    // Se contiver a palavra "restri" AND "aura", ou se contiver explicitamente "restrição aura" / "restricao aura"
    const hasRestri = obs.includes("restri") || motive.includes("restri") || obs.includes("bloque") || motive.includes("bloque");
    const hasAura = obs.includes("aura") || motive.includes("aura");
    
    return (hasRestri && hasAura) ||
           obs.includes("restrição aura") || 
           obs.includes("restricao aura") || 
           obs.includes("restrição-aura") || 
           obs.includes("restricao-aura") ||
           motive.includes("restrição aura") || 
           motive.includes("restricao aura") ||
           motive.includes("restrição-aura") || 
           motive.includes("restricao-aura");
  };

  // Verificar se a linha foi modificada
  const isRowModified = (col: Colaborador) => {
    const changes = tempChanges[col.matricula];
    if (!changes) return false;
    
    const releaseDiff = changes.dataLiberacaoCracha !== undefined && changes.dataLiberacaoCracha !== (col.dataLiberacaoCracha || "");
    const blockDiff = changes.bloqueioCliente !== undefined && changes.bloqueioCliente !== (col.bloqueioCliente || false);
    const blockDateDiff = changes.dataBloqueioCliente !== undefined && changes.dataBloqueioCliente !== (col.dataBloqueioCliente || "");
    const blockMotiveDiff = changes.motivoBloqueioCliente !== undefined && changes.motivoBloqueioCliente !== (col.motivoBloqueioCliente || "");
    
    const unblockDiff = changes.desbloqueioCliente !== undefined && changes.desbloqueioCliente !== (col.desbloqueioCliente || false);
    const unblockDateDiff = changes.dataDesbloqueioCliente !== undefined && changes.dataDesbloqueioCliente !== (col.dataDesbloqueioCliente || "");
    const unblockMotiveDiff = changes.motivoDesbloqueioCliente !== undefined && changes.motivoDesbloqueioCliente !== (col.motivoDesbloqueioCliente || "");
    const auraTrainingDiff = changes.dataTreinamentoAura !== undefined && changes.dataTreinamentoAura !== (col.dataTreinamentoAura || "");
    const matriculaAuraDiff = changes.matriculaAura !== undefined && changes.matriculaAura !== (col.matriculaAura || "");

    return releaseDiff || blockDiff || blockDateDiff || blockMotiveDiff || unblockDiff || unblockDateDiff || unblockMotiveDiff || auraTrainingDiff || matriculaAuraDiff;
  };

  // Filtragem dos colaboradores
  const filteredEmployees = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    const list = colaboradores.filter((col) => {
      // Busca simples por matricula, nome ou funcao
      const matchesSearch = 
        col.matricula.toLowerCase().includes(query) || 
        col.nomeCompleto.toLowerCase().includes(query) || 
        col.funcao.toLowerCase().includes(query);

      const matchesStatus = 
        statusFilter === "Todos" || 
        (statusFilter === "Ativo" && col.status !== "Inativo") || 
        (statusFilter === "Inativo" && col.status === "Inativo");

      const hasRelease = !!col.dataLiberacaoCracha;
      const matchesRelease = 
        releaseFilter === "Todos" ||
        (releaseFilter === "Liberado" && hasRelease) ||
        (releaseFilter === "Pendente" && !hasRelease);

      const isClientBlocked = !!col.bloqueioCliente;
      const matchesClientBlock = 
        clientBlockFilter === "Todos" ||
        (clientBlockFilter === "Sim" && isClientBlocked) ||
        (clientBlockFilter === "Não" && !isClientBlocked);

      return matchesSearch && matchesStatus && matchesRelease && matchesClientBlock;
    });

    // Sempre ordenar em ordem alfabética de nome completo
    return [...list].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
  }, [colaboradores, searchTerm, statusFilter, releaseFilter, clientBlockFilter]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    let total = filteredEmployees.length;
    let liberados = filteredEmployees.filter(c => {
      const hasAuraRestriction = getHasAuraRestriction(c);
      return !hasAuraRestriction && !!getColValue(c, "dataLiberacaoCracha");
    }).length;
    let totalBloqueadosCliente = filteredEmployees.filter(c => !!getColValue(c, "bloqueioCliente")).length;
    let pendentes = total - liberados;

    let totalDiasCorridos = 0;
    let countCorridos = 0;
    let totalDiasUteis = 0;
    let countUteis = 0;

    filteredEmployees.forEach(col => {
      const hasAuraRestriction = getHasAuraRestriction(col);
      const release = hasAuraRestriction ? "" : (getColValue(col, "dataLiberacaoCracha") || "");
      if (col.dataInicioProjeto && release) {
        const cal = getCalendarDays(col.dataInicioProjeto, release);
        const wrk = getWorkingDays(col.dataInicioProjeto, release);
        if (cal !== null) {
          totalDiasCorridos += cal;
          countCorridos++;
        }
        if (wrk !== null) {
          totalDiasUteis += wrk;
          countUteis++;
        }
      }
    });

    const mediaCorridos = countCorridos > 0 ? (totalDiasCorridos / countCorridos).toFixed(1) : "0";
    const mediaUteis = countUteis > 0 ? (totalDiasUteis / countUteis).toFixed(1) : "0";

    return {
      total,
      liberados,
      totalBloqueadosCliente,
      pendentes,
      mediaCorridos,
      mediaUteis
    };
  }, [filteredEmployees]);

  // Handler para atualizar dados do colaborador
  const handleSaveDate = async (col: Colaborador) => {
    const matricula = col.matricula;
    const changes = tempChanges[matricula] || {};
    
    const dataLiberacaoCracha = changes.dataLiberacaoCracha !== undefined ? changes.dataLiberacaoCracha : (col.dataLiberacaoCracha || "");
    const rawBloqueio = changes.bloqueioCliente !== undefined ? changes.bloqueioCliente : (col.bloqueioCliente || false);
    const dataBloqueioCliente = changes.dataBloqueioCliente !== undefined ? changes.dataBloqueioCliente : (col.dataBloqueioCliente || "");
    const motivoBloqueioCliente = changes.motivoBloqueioCliente !== undefined ? changes.motivoBloqueioCliente : (col.motivoBloqueioCliente || "");

    const desbloqueioCliente = changes.desbloqueioCliente !== undefined ? changes.desbloqueioCliente : (col.desbloqueioCliente || false);
    const dataDesbloqueioCliente = changes.dataDesbloqueioCliente !== undefined ? changes.dataDesbloqueioCliente : (col.dataDesbloqueioCliente || "");
    const motivoDesbloqueioCliente = changes.motivoDesbloqueioCliente !== undefined ? changes.motivoDesbloqueioCliente : (col.motivoDesbloqueioCliente || "");
    const dataTreinamentoAura = changes.dataTreinamentoAura !== undefined ? changes.dataTreinamentoAura : (col.dataTreinamentoAura || "");
    const matriculaAura = changes.matriculaAura !== undefined ? changes.matriculaAura : (col.matriculaAura || "");

    // Se o desbloqueio está ativo, então remove o bloqueio principal automaticamente!
    const finalBloqueioCliente = desbloqueioCliente ? false : rawBloqueio;

    setSavingMatriculas(prev => ({ ...prev, [matricula]: true }));
    try {
      await onUpdateColaborador(matricula, { 
        dataLiberacaoCracha,
        bloqueioCliente: finalBloqueioCliente,
        dataBloqueioCliente: finalBloqueioCliente ? dataBloqueioCliente : "",
        motivoBloqueioCliente: finalBloqueioCliente ? motivoBloqueioCliente : "",
        desbloqueioCliente,
        dataDesbloqueioCliente: desbloqueioCliente ? dataDesbloqueioCliente : "",
        motivoDesbloqueioCliente: desbloqueioCliente ? motivoDesbloqueioCliente : "",
        dataTreinamentoAura,
        matriculaAura
      });
      
      // Feedback visual e sincronização de estado temporário
      setTempChanges(prev => {
        const copy = { ...prev };
        delete copy[matricula]; // Limpa para ler o valor tempo e persistido atualizado
        return copy;
      });
    } catch (err) {
      console.error("Erro ao atualizar dados do colaborador:", err);
      alert("Não foi possível salvar os dados. Tente novamente.");
    } finally {
      setSavingMatriculas(prev => ({ ...prev, [matricula]: false }));
    }
  };

  // Exportar para planilha Excel
  const handleExportExcel = () => {
    const reportData = filteredEmployees.map((col) => {
      const hasAuraRestriction = getHasAuraRestriction(col);
      const start = col.dataInicioProjeto || "";
      const release = hasAuraRestriction ? "" : (getColValue(col, "dataLiberacaoCracha") || "");
      const calendar = getCalendarDays(start, release);
      const working = getWorkingDays(start, release);

      const auraTrainingDate = getColValue(col, "dataTreinamentoAura") || "";
      const auraTrainingRange = auraTrainingDate ? `${formatBrDate(auraTrainingDate)} - ${formatBrDate(addDays(auraTrainingDate, 1))}` : "-";
      const matriculaAuraVal = getColValue(col, "matriculaAura") || "";

      let statusCracha = "Pendente";
      if (hasAuraRestriction) {
        statusCracha = "Restrição";
      } else if (release) {
        statusCracha = "Liberado";
      }

      return {
        "Mat. Px": col.matricula,
        "Mat. Aura": matriculaAuraVal || "-",
        "Nome Completo": col.nomeCompleto,
        "Função": col.funcao,
        "Mão de Obra (MOI/MOD)": col.tipoMaoDeObra,
        "Status": col.status || "Ativo",
        "Data de Chegada": start ? formatBrDate(start) : "-",
        "Status de Liberação": statusCracha,
        "Início Treinamento Aura": auraTrainingDate ? formatBrDate(auraTrainingDate) : "-",
        "Treinamento Introdutório Aura (2 dias)": auraTrainingRange,
        "Data Liberação Crachá": release ? formatBrDate(release) : (hasAuraRestriction ? "" : "Pendente"),
        "Dias Corridos (Qtd)": calendar !== null ? calendar : "-",
        "Dias Úteis (Qtd)": working !== null ? working : "-",
        "Bloqueado pelo Cliente": col.bloqueioCliente ? "Sim" : "Não",
        "Data do Bloqueio Cliente": col.dataBloqueioCliente ? formatBrDate(col.dataBloqueioCliente) : "-",
        "Motivo do Bloqueio Cliente": col.motivoBloqueioCliente || "-",
        "Desbloqueado pelo Cliente": col.desbloqueioCliente ? "Sim" : "Não",
        "Data do Desbloqueio Cliente": col.dataDesbloqueioCliente ? formatBrDate(col.dataDesbloqueioCliente) : "-",
        "Motivo do Desbloqueio Cliente": col.motivoDesbloqueioCliente || "-",
        "Observações / Restrições": col.observacao || ""
      };
    });

    const prefix = viewType === "corridos" ? "Relatorio_Dias_Corridos" : viewType === "uteis" ? "Relatorio_Dias_Uteis" : "Relatorio_Geral_Liberacao_Cracha";
    exportToExcel(reportData, `${prefix}_Borborema`, "Liberação de Crachá");
  };

  return (
    <div className="space-y-6">
      
      {/* Analytics widgets no topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
        <div className="border border-[#141414] p-4 bg-white font-mono shadow-[2px_2px_0px_#141414]">
          <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">Total de Colaboradores</span>
          <div className="text-2xl font-black text-[#141414] mt-1 flex items-baseline gap-1">
            {stats.total}
            <span className="text-xs font-normal text-neutral-500 uppercase">da busca</span>
          </div>
        </div>

        <div className="border border-[#141414] p-4 bg-[#f0fdf4] font-mono shadow-[2px_2px_0px_#141414]">
          <span className="text-[9px] text-emerald-800 font-extrabold uppercase tracking-tight block">Crachás Liberados</span>
          <div className="text-2xl font-black text-emerald-900 mt-1 flex items-baseline gap-1.5">
            {stats.liberados}
            <span className="text-xs font-semibold text-emerald-700 font-sans">
              ({stats.total > 0 ? Math.round((stats.liberados / stats.total) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className={`border border-[#141414] p-4 font-mono shadow-[2px_2px_0px_#141414] ${stats.totalBloqueadosCliente > 0 ? "bg-red-50" : "bg-white"}`}>
          <span className="text-[9px] text-[#141414]/65 font-bold font-extrabold uppercase tracking-tight block text-red-800">Bloqueados Cliente</span>
          <div className="text-2xl font-black text-red-700 mt-1 flex items-baseline gap-1">
            {stats.totalBloqueadosCliente}
            <span className="text-xs font-semibold text-red-600 font-sans">
              ({stats.total > 0 ? Math.round((stats.totalBloqueadosCliente / stats.total) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="border border-[#141414] p-4 bg-white font-mono shadow-[2px_2px_0px_#141414]">
          <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">Tempo Médio (Corridos)</span>
          <div className="text-2xl font-black text-[#141414] mt-1">
            {stats.mediaCorridos} <span className="text-[10px] font-bold text-neutral-500 uppercase">dias</span>
          </div>
        </div>

        <div className="border border-[#141414] p-4 bg-white font-mono shadow-[2px_2px_0px_#141414]">
          <span className="text-[9px] text-[#141414]/65 font-bold uppercase tracking-tight block">Tempo Médio (Úteis)</span>
          <div className="text-2xl font-black text-indigo-900 mt-1">
            {stats.mediaUteis} <span className="text-[10px] font-bold text-indigo-700 uppercase">dias úteis</span>
          </div>
        </div>
      </div>

      {/* Caixa de Ações, Filtros e Guias */}
      <div className="bg-white border border-[#141414] p-5 shadow-[4px_4px_0px_#141414] print:hidden">
        
        {/* Superior da caixa com Título e botões de exportação */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#141414]/15 pb-4 mb-4">
          <div>
            <h3 className="font-serif italic font-bold text-base text-[#141414] leading-tight">Análise e Monitoramento</h3>
            <p className="text-[10px] font-mono text-[#141414]/65 uppercase tracking-wider">Configure filtros e exportações para emissão de relatórios</p>
          </div>
 
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-[10px] font-mono font-bold uppercase px-3 py-2 transition-colors cursor-pointer"
              title="Exportar Planilha Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
 
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 border border-[#141414] bg-neutral-900 text-[#E4E3E0] hover:bg-neutral-800 text-[10px] font-mono font-bold uppercase px-3 py-2 transition-colors cursor-pointer"
              title="Gerar/Imprimir Relatório PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Salvar PDF</span>
            </button>
          </div>
        </div>
 
        {/* Linha de Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Caixa de Pesquisa */}
          <div className="lg:col-span-4 relative">
            <label className="block text-[9px] font-mono font-bold uppercase text-[#141414]/65 mb-1">Buscar Colaborador</label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Matrícula, Nome ou Função..."
                className="w-full bg-white border border-[#141414] pl-9 pr-3 py-1.5 text-xs font-mono focus:outline-none focus:bg-[#141414]/5 text-[#141414]"
              />
              <Search className="w-3.5 h-3.5 text-[#141414]/50 absolute left-3 top-2.5" />
            </div>
          </div>
 
          {/* Filtro de Status Ocupacional */}
          <div className="col-span-1 lg:col-span-2">
            <label className="block text-[9px] font-mono font-bold uppercase text-[#141414]/65 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full bg-white border border-[#141414] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:bg-[#141414]/5 text-[#141414]"
            >
              <option value="Todos">Todos da Base</option>
              <option value="Ativo">Apenas Ativos</option>
              <option value="Inativo">Apenas Inativos</option>
            </select>
          </div>
 
          {/* Filtro por Liberação de Crachá */}
          <div className="col-span-1 lg:col-span-2">
            <label className="block text-[9px] font-mono font-bold uppercase text-[#141414]/65 mb-1">Crachá</label>
            <select
              value={releaseFilter}
              onChange={(e) => setReleaseFilter(e.target.value as any)}
              className="w-full bg-white border border-[#141414] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:bg-[#141414]/5 text-[#141414]"
            >
              <option value="Todos">Todos</option>
              <option value="Liberado">Liberados</option>
              <option value="Pendente">Pendentes</option>
            </select>
          </div>

          {/* Filtro de Bloqueio Cliente */}
          <div className="col-span-1 lg:col-span-2">
            <label className="block text-[9px] font-mono font-bold uppercase text-[#141414]/65 mb-1">Bloqueio Cliente</label>
            <select
              value={clientBlockFilter}
              onChange={(e) => setClientBlockFilter(e.target.value as any)}
              className="w-full bg-white border border-[#141414] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:bg-[#141414]/5 text-[#141414]"
            >
              <option value="Todos">Todos</option>
              <option value="Sim">Bloqueados</option>
              <option value="Não">Não Bloqueados</option>
            </select>
          </div>
 
          {/* Alternador de Modo de Relatório */}
          <div className="lg:col-span-2 flex flex-col justify-end">
            <label className="block text-[9px] font-mono font-bold uppercase text-[#141414]/65 mb-1">Modalidade</label>
            <div className="grid grid-cols-3 border border-[#141414]">
              <button
                onClick={() => setViewType("geral")}
                className={`text-[9.5px] font-mono font-bold py-1.5 uppercase transition-colors text-center border-r border-[#141414] cursor-pointer ${
                  viewType === "geral" ? "bg-indigo-650 text-white" : "bg-neutral-50 hover:bg-[#141414]/5 text-[#141414]/80"
                }`}
                title="Mostrar todas as colunas de dias acumuladas"
              >
                Geral
              </button>
              <button
                onClick={() => setViewType("corridos")}
                className={`text-[9.5px] font-mono font-bold py-1.5 uppercase transition-colors text-center border-r border-[#141414] cursor-pointer ${
                  viewType === "corridos" ? "bg-amber-600 text-white" : "bg-neutral-50 hover:bg-[#141414]/5 text-[#141414]/80"
                }`}
                title="Relatório focado em Dias Corridos (Calendário)"
              >
                Corr.
              </button>
              <button
                onClick={() => setViewType("uteis")}
                className={`text-[9.5px] font-mono font-bold py-1.5 uppercase transition-colors text-center cursor-pointer ${
                  viewType === "uteis" ? "bg-indigo-650 text-white" : "bg-neutral-50 hover:bg-[#141414]/5 text-[#141414]/80"
                }`}
                title="Relatório focado em Dias Úteis (Seg à Sex)"
              >
                Úteis
              </button>
            </div>
          </div>
 
        </div>

      </div>

      {/* ÁREA DE RELATÓRIO DO PROJETO (Tabela) */}
      <div className="border border-[#141414] bg-white shadow-[4px_4px_0px_#141414]">
        
        {/* Cabeçalho da Tabela */}
        <div className="bg-[#141414] p-4 text-[#E4E3E0] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-xs font-bold font-serif italic block">
                {viewType === "geral" && "Relatório Geral de Entrada e Liberações"}
                {viewType === "corridos" && "Relatório Focado em Dias Corridos (Calendário)"}
                {viewType === "uteis" && "Relatório Focado em Dias Úteis de Entrada"}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider opacity-60">PROJETO BORBOREMA • FILTRAGEM</span>
            </div>
          </div>
          <span className="text-[9px] font-mono font-bold bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded tracking-wide uppercase">
            {filteredEmployees.length} registros
          </span>
        </div>

        {/* Tabela de Dados */}
        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar border-t border-[#141414]/15">
          {filteredEmployees.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-neutral-400 uppercase">
              [ NENHUM COLABORADOR ENCONTRADO PARA OS FILTROS SELECIONADOS ]
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono border-collapse min-w-[1050px]">
              <thead className="sticky top-0 z-10 shadow-xs bg-neutral-100">
                <tr className="bg-neutral-100 text-[#141414] border-b border-[#141414] text-[9px] uppercase tracking-wider font-bold">
                  <th className="px-4 py-3 bg-neutral-150">Mat. Px</th>
                  <th className="px-4 py-3 bg-neutral-155 border-l border-[#141414]/15 min-w-[140px]">Mat. Aura</th>
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Data Chegada</th>
                  
                  {/* Cabeçalhos variáveis conforme modalidade do relatório */}
                  {(viewType === "geral" || viewType === "corridos") && (
                    <th className="px-4 py-3 text-center bg-amber-50 text-amber-900 border-l border-[#141414]/15">Dias Corridos</th>
                  )}
                  {(viewType === "geral" || viewType === "uteis") && (
                    <th className="px-4 py-3 text-center bg-indigo-50 text-indigo-900 border-l border-[#141414]/15">Dias Úteis</th>
                  )}

                  <th className="px-5 py-3 border-l border-[#141414]/15 min-w-[200px]">Treinamento Introdutório Aura</th>
                  <th className="px-5 py-3 border-l border-[#141414]/15">Data Liberação Crachá</th>
                  <th className="px-5 py-3 border-l border-[#141414]/15 bg-red-100/35 text-red-950 font-bold min-w-[185px]">Bloqueio Cliente</th>
                  {isAdmin && <th className="px-4 py-3 text-center print:hidden">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15 bg-white">
                {filteredEmployees.map((col) => {
                  const hasAuraRestriction = getHasAuraRestriction(col);
                  const start = col.dataInicioProjeto || "";
                  const release = hasAuraRestriction ? "" : (getColValue(col, "dataLiberacaoCracha") || "");
                  const auraTraining = getColValue(col, "dataTreinamentoAura") || "";
                  const matriculaAura = getColValue(col, "matriculaAura") || "";
                  
                  // Cálculos
                  const calendarDays = getCalendarDays(start, release);
                  const workingDays = getWorkingDays(start, release);

                  const isModifiedButUnsaved = isRowModified(col);

                  return (
                    <tr key={col.matricula} className="hover:bg-[#141414]/2 transition-colors">
                      {/* Matrícula */}
                      <td className="px-4 py-3 font-bold text-neutral-700 bg-neutral-50/50">
                        {col.matricula}
                        {col.status === "Inativo" && (
                          <span className="ml-1 text-[8px] bg-red-100 text-red-700 px-1 py-0.5 font-bold rounded uppercase">Inat</span>
                        )}
                      </td>
                      
                      {/* Mat. Aura */}
                      <td className="px-4 py-3 border-l border-[#141414]/15 bg-neutral-50/20">
                        {isAdmin ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={matriculaAura}
                              onChange={(e) => {
                                setTempChanges(prev => ({
                                  ...prev,
                                  [col.matricula]: {
                                    ...(prev[col.matricula] || {}),
                                    matriculaAura: e.target.value
                                  }
                                }));
                              }}
                              placeholder="Preencher Aura"
                              className={`bg-white border rounded text-[11px] px-2 py-1 focus:outline-none focus:border-indigo-600 font-mono w-full transition-colors ${
                                isModifiedButUnsaved && tempChanges[col.matricula]?.matriculaAura !== undefined
                                  ? "border-amber-500 bg-amber-50/30 focus:border-amber-600" 
                                  : "border-neutral-300"
                              }`}
                            />
                            {matriculaAura && (
                              <button
                                onClick={() => {
                                  setTempChanges(prev => ({
                                    ...prev,
                                    [col.matricula]: {
                                      ...(prev[col.matricula] || {}),
                                      matriculaAura: ""
                                    }
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-tight px-1 font-mono hover:underline cursor-pointer print:hidden"
                                title="Limpar"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-zinc-700 font-bold">
                            {matriculaAura || <span className="text-neutral-400 font-normal italic">Não preenchido</span>}
                          </span>
                        )}
                      </td>
                      
                      {/* Nome e Função */}
                      <td className="px-4 py-3">
                        <span className="font-serif italic font-extrabold text-black block text-[13px]">{col.nomeCompleto}</span>
                        <span className="text-[10px] text-neutral-500 font-sans block mt-0.5">{col.funcao}</span>
                      </td>

                      {/* Data de Chegada */}
                      <td className="px-4 py-3 font-bold">
                        {start ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>{formatBrDate(start)}</span>
                          </div>
                        ) : (
                          <span className="text-red-500 uppercase font-semibold text-[10px]">[ Não Definida ]</span>
                        )}
                      </td>

                      {/* Dias Corridos */}
                      {(viewType === "geral" || viewType === "corridos") && (
                        <td className="px-4 py-3 text-center bg-amber-50/30 border-l border-[#141414]/15">
                          {calendarDays !== null ? (
                            <span className="inline-block px-2 py-1 bg-amber-50 text-amber-900 border border-amber-300 font-extrabold rounded text-xs select-none">
                              {calendarDays} {calendarDays === 1 ? "dia" : "dias"}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Dias Úteis */}
                      {(viewType === "geral" || viewType === "uteis") && (
                        <td className="px-4 py-3 text-center bg-indigo-50/30 border-l border-[#141414]/15 font-bold">
                          {workingDays !== null ? (
                            <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-950 border border-indigo-200 font-extrabold rounded text-xs select-none">
                              {workingDays} {workingDays === 1 ? "d. útil" : "d. úteis"}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[10px]">-</span>
                          )}
                        </td>
                      )}

                      {/* Treinamento Introdutório Aura */}
                      <td className="px-5 py-3 border-l border-[#141414]/15 font-bold">
                        {isAdmin ? (
                          <div className="flex flex-col gap-1.5 font-mono">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={auraTraining}
                                onChange={(e) => {
                                  setTempChanges(prev => ({
                                    ...prev,
                                    [col.matricula]: {
                                      ...(prev[col.matricula] || {}),
                                      dataTreinamentoAura: e.target.value
                                    }
                                  }));
                                }}
                                className={`bg-white border rounded text-[11px] p-1 focus:outline-none focus:border-indigo-600 font-mono disabled:opacity-60 transition-colors ${
                                  isModifiedButUnsaved && tempChanges[col.matricula]?.dataTreinamentoAura !== undefined
                                    ? "border-amber-500 bg-amber-50/30 focus:border-amber-600" 
                                    : "border-neutral-300"
                                }`}
                                title={isModifiedButUnsaved ? "Data modificada mas não salva ainda" : "Data de início do treinamento"}
                              />
                              {auraTraining && (
                                <button
                                  onClick={() => {
                                    setTempChanges(prev => ({
                                      ...prev,
                                      [col.matricula]: {
                                        ...(prev[col.matricula] || {}),
                                        dataTreinamentoAura: ""
                                      }
                                    }));
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-tight px-1 font-mono hover:underline cursor-pointer print:hidden"
                                  title="Limpar data"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>
                            {auraTraining && (
                              <span className="text-[10px] text-zinc-700 font-semibold bg-amber-50/70 border border-amber-200 px-1.5 py-0.5 rounded w-fit select-none shrink-0">
                                {formatBrDate(auraTraining)} - {formatBrDate(addDays(auraTraining, 1))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="text-zinc-700">
                              {auraTraining ? (
                                `${formatBrDate(auraTraining)} - ${formatBrDate(addDays(auraTraining, 1))}`
                              ) : (
                                <span className="text-neutral-400 font-normal">Pendente</span>
                              )}
                            </span>
                          </div>
                        )}
                      </td>

                       {/* Data de Liberação do Crachá (DatePicker na tabela) */}
                      <td className="px-5 py-3 border-l border-[#141414]/15 font-bold">
                        {hasAuraRestriction ? (
                          <div className="flex flex-col gap-1 select-none">
                            <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-1 text-[10px] font-extrabold uppercase tracking-tight rounded inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Restrição
                            </span>
                            {isAdmin && (
                              <span className="text-[8px] text-[#141414]/50 font-normal font-mono uppercase leading-tight">
                                *(Remova a Restrição Aura em Cadastro para liberar)
                              </span>
                            )}
                          </div>
                        ) : isAdmin ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={release}
                              onChange={(e) => {
                                setTempChanges(prev => ({
                                  ...prev,
                                  [col.matricula]: {
                                    ...(prev[col.matricula] || {}),
                                    dataLiberacaoCracha: e.target.value
                                  }
                                }));
                              }}
                              className={`bg-white border rounded text-xs p-1 focus:outline-none focus:border-indigo-600 font-mono disabled:opacity-60 transition-colors ${
                                isModifiedButUnsaved && tempChanges[col.matricula]?.dataLiberacaoCracha !== undefined
                                  ? "border-amber-500 bg-amber-50/30 focus:border-amber-600" 
                                  : "border-neutral-300"
                              }`}
                              title={isModifiedButUnsaved ? "Data modificada mas não salva ainda" : "Data de liberação do crachá"}
                            />
                            {release && (
                              <button
                                onClick={() => {
                                  setTempChanges(prev => ({
                                    ...prev,
                                    [col.matricula]: {
                                      ...(prev[col.matricula] || {}),
                                      dataLiberacaoCracha: ""
                                    }
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700 text-[10px] uppercase font-bold tracking-tight px-1 font-mono hover:underline cursor-pointer print:hidden"
                                title="Limpar data"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>{release ? formatBrDate(release) : <span className="text-amber-600 font-bold uppercase tracking-tight text-[10px]">Aguardando Liberação</span>}</span>
                          </div>
                        )}
                      </td>

                      {/* Bloqueio Cliente */}
                      <td className="px-5 py-3 border-l border-[#141414]/15 font-bold font-mono">
                        {isAdmin ? (
                          <div className="flex flex-col gap-1.5 min-w-[200px]">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] uppercase font-bold text-neutral-700">
                              <input
                                type="checkbox"
                                checked={!!getColValue(col, "bloqueioCliente")}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setTempChanges(prev => ({
                                    ...prev,
                                    [col.matricula]: {
                                      ...(prev[col.matricula] || {}),
                                      bloqueioCliente: checked,
                                      // Se está ativando o bloqueio, desativa o desbloqueio
                                      desbloqueioCliente: false,
                                      dataBloqueioCliente: checked 
                                        ? (getColValue(col, "dataBloqueioCliente") || new Date().toISOString().split('T')[0]) 
                                        : ""
                                    }
                                  }));
                                }}
                                className="rounded border-neutral-300 text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                              />
                              <span className={getColValue(col, "bloqueioCliente") ? "text-red-600 font-extrabold" : "text-neutral-500"}>
                                {getColValue(col, "bloqueioCliente") ? "Bloqueado Cliente" : "Liberado Cliente"}
                              </span>
                            </label>
                            
                            {getColValue(col, "bloqueioCliente") && (
                              <div className="space-y-1.5 mt-1 border-t border-red-100 pt-1.5">
                                <div className="flex flex-col">
                                  <span className="text-[8px] uppercase text-neutral-450 mb-0.5">Data do Bloqueio:</span>
                                  <input
                                    type="date"
                                    value={getColValue(col, "dataBloqueioCliente") || ""}
                                    onChange={(e) => {
                                      setTempChanges(prev => ({
                                        ...prev,
                                        [col.matricula]: {
                                          ...(prev[col.matricula] || {}),
                                          dataBloqueioCliente: e.target.value
                                        }
                                      }));
                                    }}
                                    className="bg-white border border-neutral-300 rounded text-[10px] p-1 focus:outline-none focus:border-red-500 font-mono"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[8px] uppercase text-neutral-450 mb-0.5">Motivo do Bloqueio:</span>
                                  <input
                                    type="text"
                                    value={getColValue(col, "motivoBloqueioCliente") || ""}
                                    placeholder="Digite o motivo..."
                                    onChange={(e) => {
                                      setTempChanges(prev => ({
                                        ...prev,
                                        [col.matricula]: {
                                          ...(prev[col.matricula] || {}),
                                          motivoBloqueioCliente: e.target.value
                                        }
                                      }));
                                    }}
                                    className="bg-white border border-neutral-300 rounded text-[10px] px-1.5 py-1 focus:outline-none focus:border-red-500 font-sans font-normal"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Opção de Desbloqueio de Cliente (Sempre visível se já foi bloqueado ou se está marcado como bloqueado) */}
                            {(col.bloqueioCliente || getColValue(col, "bloqueioCliente")) && (
                              <div className="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[9px] uppercase font-bold text-emerald-800">
                                  <input
                                    type="checkbox"
                                    checked={!!getColValue(col, "desbloqueioCliente")}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setTempChanges(prev => ({
                                        ...prev,
                                        [col.matricula]: {
                                          ...(prev[col.matricula] || {}),
                                          desbloqueioCliente: checked,
                                          // Se estou desbloqueando, desativo o bloqueio
                                          bloqueioCliente: checked ? false : !!col.bloqueioCliente,
                                          dataDesbloqueioCliente: checked ? new Date().toISOString().split('T')[0] : "",
                                          motivoDesbloqueioCliente: checked ? "" : (getColValue(col, "motivoDesbloqueioCliente") || "")
                                        }
                                      }));
                                    }}
                                    className="rounded border-neutral-200 text-emerald-600 focus:ring-emerald-500 w-3 h-3"
                                  />
                                  <span>Desbloquear Cliente</span>
                                </label>

                                {getColValue(col, "desbloqueioCliente") && (
                                  <div className="space-y-1.5 mt-1 border-t border-emerald-100 pt-1">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] uppercase text-emerald-705 mb-0.5">Data Desbloqueio:</span>
                                      <input
                                        type="date"
                                        value={getColValue(col, "dataDesbloqueioCliente") || ""}
                                        onChange={(e) => {
                                          setTempChanges(prev => ({
                                            ...prev,
                                            [col.matricula]: {
                                              ...(prev[col.matricula] || {}),
                                              dataDesbloqueioCliente: e.target.value
                                            }
                                          }));
                                        }}
                                        className="bg-white border border-neutral-200 rounded text-[9px] p-0.5 font-mono"
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] uppercase text-emerald-705 mb-0.5">Motivo Desbloqueio:</span>
                                      <input
                                        type="text"
                                        placeholder="Digite o motivo..."
                                        value={getColValue(col, "motivoDesbloqueioCliente") || ""}
                                        onChange={(e) => {
                                          setTempChanges(prev => ({
                                            ...prev,
                                            [col.matricula]: {
                                              ...(prev[col.matricula] || {}),
                                              motivoDesbloqueioCliente: e.target.value
                                            }
                                          }));
                                        }}
                                        className="bg-white border border-neutral-200 rounded text-[9px] px-1 py-0.5 font-sans font-normal"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            {col.bloqueioCliente ? (
                              <div className="flex flex-col gap-0.5 text-red-700 bg-red-50/50 border border-red-200 rounded p-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase select-none font-bold">
                                  <Lock className="w-3.5 h-3.5 shrink-0" /> Bloqueado Cliente
                                </span>
                                {col.dataBloqueioCliente && (
                                  <span className="text-[9px] text-red-650 block mt-0.5 font-mono font-bold">
                                    Em: {formatBrDate(col.dataBloqueioCliente)}
                                  </span>
                                )}
                                {col.motivoBloqueioCliente && (
                                  <p className="text-[10px] italic text-[#141414]/90 leading-tight font-sans font-normal break-words mt-0.5">
                                    "{col.motivoBloqueioCliente}"
                                  </p>
                                )}
                              </div>
                            ) : col.desbloqueioCliente ? (
                              <div className="flex flex-col gap-0.5 text-emerald-700 bg-emerald-50/50 border border-emerald-200 rounded p-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase select-none font-bold text-emerald-800">
                                  <Unlock className="w-3.5 h-3.5 shrink-0" /> Desbloqueado Cliente
                                </span>
                                {col.dataDesbloqueioCliente && (
                                  <span className="text-[9px] text-emerald-650 block mt-0.5 font-mono font-bold">
                                    Em: {formatBrDate(col.dataDesbloqueioCliente)}
                                  </span>
                                )}
                                {col.motivoDesbloqueioCliente && (
                                  <p className="text-[10px] italic text-[#141414]/90 leading-tight font-sans font-normal break-words mt-0.5">
                                    "{col.motivoDesbloqueioCliente}"
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase py-0.5 px-1.5 bg-emerald-50 rounded">
                                <Unlock className="w-3" /> Liberado Cliente
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Ações (Apenas Administrador) */}
                      {isAdmin && (
                        <td className="px-4 py-3 text-center print:hidden">
                          {isModifiedButUnsaved ? (
                            <button
                              onClick={() => handleSaveDate(col)}
                              disabled={savingMatriculas[col.matricula]}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black text-[9px] font-bold uppercase tracking-wider font-mono border-2 border-[#141414] shadow-[1px_1px_0px_#141414] hover:shadow-none transition-all cursor-pointer disabled:opacity-50"
                              title="Salvar alterações de data"
                            >
                              <Save className="w-3 h-3" />
                              <span>{savingMatriculas[col.matricula] ? "..." : "Salvar"}</span>
                            </button>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5 font-black" />
                              <span>Salvo</span>
                            </span>
                          )}
                        </td>
                      )}

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
}
