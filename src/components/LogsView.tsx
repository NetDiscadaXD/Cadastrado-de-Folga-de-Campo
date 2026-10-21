import React, { useState, useMemo } from "react";
import { AuditLog, ModuloSistema, TipoAcaoLog } from "../types";
import { formatBrDate } from "../utils/date";
import { exportToExcel } from "../utils/excel";
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Clock,
  FileText,
  FileCheck,
  MessageSquare,
  CalendarDays,
  UserPlus,
  HeartPulse,
  Award,
  Plane,
  ShieldAlert,
  ArrowRightLeft,
  Settings,
  CheckCircle,
  FolderOpen,
  Trash2,
  Edit,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface LogsViewProps {
  logs: AuditLog[];
  onRefresh?: () => Promise<void>;
  isAdmin?: boolean;
}

const MODULOS: ModuloSistema[] = [
  "Espelhos",
  "Memorandos",
  "Observações",
  "Férias",
  "Colaboradores",
  "ASO",
  "Treinamentos",
  "Folgas e Viagens",
  "Bloqueios de Crachá",
  "Holerites",
  "Sindicatos",
  "Disponibilidade",
  "Configurações",
  "Sistema"
];

const TIPOS_ACAO: TipoAcaoLog[] = [
  "Inclusão",
  "Edição",
  "Exclusão",
  "Upload de Documento",
  "Liberação / Desbloqueio",
  "Transferência",
  "Importação"
];

export default function LogsView({ logs, onRefresh, isAdmin = true }: LogsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [moduloFiltro, setModuloFiltro] = useState<string>("todos");
  const [acaoFiltro, setAcaoFiltro] = useState<string>("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState<"todos" | "hoje" | "7dias" | "30dias">("todos");
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);
  const [paginaAtual, setPaginaAtual] = useState<number>(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Formatação de data e hora detalhada
  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return isoString;
      const dataStr = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      const horaStr = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      return `${dataStr} às ${horaStr}`;
    } catch {
      return isoString;
    }
  };

  // Tempo relativo amigável
  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime();
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 60) return "Agora mesmo";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Há ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Ontem";
      if (diffDays < 30) return `Há ${diffDays} dias`;
      return formatBrDate(isoString.split("T")[0]);
    } catch {
      return "";
    }
  };

  // Cores e Ícones por Módulo
  const getModuloBadge = (modulo: ModuloSistema) => {
    switch (modulo) {
      case "Espelhos":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200",
          icon: <FolderOpen className="w-3.5 h-3.5" />
        };
      case "Memorandos":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <FileCheck className="w-3.5 h-3.5" />
        };
      case "Observações":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          icon: <MessageSquare className="w-3.5 h-3.5" />
        };
      case "Férias":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          icon: <CalendarDays className="w-3.5 h-3.5" />
        };
      case "Colaboradores":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
          icon: <User className="w-3.5 h-3.5" />
        };
      case "ASO":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          icon: <HeartPulse className="w-3.5 h-3.5" />
        };
      case "Treinamentos":
        return {
          bg: "bg-cyan-50 text-cyan-800 border-cyan-200",
          icon: <Award className="w-3.5 h-3.5" />
        };
      case "Folgas e Viagens":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200",
          icon: <Plane className="w-3.5 h-3.5" />
        };
      case "Bloqueios de Crachá":
        return {
          bg: "bg-red-50 text-red-700 border-red-200",
          icon: <ShieldAlert className="w-3.5 h-3.5" />
        };
      case "Holerites":
        return {
          bg: "bg-teal-50 text-teal-700 border-teal-200",
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case "Sindicatos":
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-300",
          icon: <FileText className="w-3.5 h-3.5" />
        };
      case "Disponibilidade":
        return {
          bg: "bg-sky-50 text-sky-700 border-sky-200",
          icon: <ArrowRightLeft className="w-3.5 h-3.5" />
        };
      case "Configurações":
        return {
          bg: "bg-zinc-100 text-zinc-800 border-zinc-300",
          icon: <Settings className="w-3.5 h-3.5" />
        };
      default:
        return {
          bg: "bg-slate-50 text-slate-700 border-slate-200",
          icon: <ClipboardList className="w-3.5 h-3.5" />
        };
    }
  };

  // Cores e Ícones por Tipo de Ação
  const getAcaoBadge = (acao: TipoAcaoLog) => {
    switch (acao) {
      case "Inclusão":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold";
      case "Edição":
        return "bg-blue-100 text-blue-800 border-blue-300 font-bold";
      case "Exclusão":
        return "bg-red-100 text-red-800 border-red-300 font-bold";
      case "Upload de Documento":
        return "bg-purple-100 text-purple-800 border-purple-300 font-bold";
      case "Liberação / Desbloqueio":
        return "bg-teal-100 text-teal-800 border-teal-300 font-bold";
      case "Transferência":
        return "bg-indigo-100 text-indigo-800 border-indigo-300 font-bold";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300 font-semibold";
    }
  };

  // Filtros aplicados
  const logsFiltrados = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const now = new Date();
    const hojeStr = now.toISOString().split("T")[0];

    return logs.filter((log) => {
      // 1. Busca por texto livre
      if (term) {
        const matchesDesc = log.descricao?.toLowerCase().includes(term);
        const matchesColab = log.nomeColaborador?.toLowerCase().includes(term);
        const matchesMat = log.matricula?.toLowerCase().includes(term);
        const matchesUser = log.usuario?.toLowerCase().includes(term);
        const matchesMod = log.modulo?.toLowerCase().includes(term);
        if (!matchesDesc && !matchesColab && !matchesMat && !matchesUser && !matchesMod) {
          return false;
        }
      }

      // 2. Filtro de Módulo
      if (moduloFiltro !== "todos" && log.modulo !== moduloFiltro) {
        return false;
      }

      // 3. Filtro de Tipo de Ação
      if (acaoFiltro !== "todos" && log.acao !== acaoFiltro) {
        return false;
      }

      // 4. Filtro de Período
      if (periodoFiltro === "hoje") {
        if (!log.dataHora?.startsWith(hojeStr)) return false;
      } else if (periodoFiltro === "7dias") {
        const diffDays = (now.getTime() - new Date(log.dataHora).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (periodoFiltro === "30dias") {
        const diffDays = (now.getTime() - new Date(log.dataHora).getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) return false;
      }

      return true;
    });
  }, [logs, searchTerm, moduloFiltro, acaoFiltro, periodoFiltro]);

  // Métricas do Topo
  const stats = useMemo(() => {
    const hojeStr = new Date().toISOString().split("T")[0];
    const total = logs.length;
    const hoje = logs.filter((l) => l.dataHora?.startsWith(hojeStr)).length;
    const inclusao = logs.filter((l) => l.acao === "Inclusão").length;
    const edicao = logs.filter((l) => l.acao === "Edição").length;
    const exclusao = logs.filter((l) => l.acao === "Exclusão").length;
    const uploads = logs.filter((l) => l.acao === "Upload de Documento").length;

    return { total, hoje, inclusao, edicao, exclusao, uploads };
  }, [logs]);

  // Paginação
  const totalPaginas = Math.ceil(logsFiltrados.length / itensPorPagina) || 1;
  const logsPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return logsFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [logsFiltrados, paginaAtual, itensPorPagina]);

  const handleMudarPagina = (novaPagina: number) => {
    setPaginaAtual(Math.max(1, Math.min(totalPaginas, novaPagina)));
  };

  // Exportar histórico completo para Excel
  const handleExportarExcel = () => {
    if (logsFiltrados.length === 0) {
      alert("Não há registros de logs para exportar com os filtros atuais.");
      return;
    }

    const rows = logsFiltrados.map((log) => ({
      "Data e Hora": formatDateTime(log.dataHora),
      "Usuário Responsável": log.usuario || "Sistema",
      "Módulo do Sistema": log.modulo,
      "Tipo de Ação": log.acao,
      "Matrícula": log.matricula || "-",
      "Colaborador": log.nomeColaborador || "-",
      "Descrição da Ação": log.descricao
    }));

    exportToExcel(rows, `Trilha_Auditoria_Logs_ERP_${new Date().toISOString().split("T")[0]}`);
  };

  const handleReload = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-600 shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Trilha de Auditoria & Registro de Ações</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold rounded-full">
                {logs.length} logs
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Registro auditável com data, horário exato, usuário e detalhes de cada operação realizada no sistema (inclusão de espelho de ponto, memorando, observação, férias, colaboradores, treinamentos e controle de folgas).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRefresh && (
            <button
              onClick={handleReload}
              disabled={isRefreshing}
              className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Recarregar logs em tempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          )}

          <button
            onClick={handleExportarExcel}
            className="px-3.5 py-2 bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Exportar listagem filtrada para planilha Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMO OPERACIONAL */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-slate-500">Total de Registros</span>
          <div className="text-xl font-bold font-mono text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-indigo-600 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" /> Ações Hoje
          </span>
          <div className="text-xl font-bold font-mono text-indigo-700">{stats.hoje}</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-emerald-600 flex items-center justify-center gap-1">
            <CheckCircle className="w-3 h-3" /> Inclusões
          </span>
          <div className="text-xl font-bold font-mono text-emerald-700">{stats.inclusao}</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-blue-600 flex items-center justify-center gap-1">
            <Edit className="w-3 h-3" /> Edições
          </span>
          <div className="text-xl font-bold font-mono text-blue-700">{stats.edicao}</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-purple-600 flex items-center justify-center gap-1">
            <Upload className="w-3 h-3" /> Uploads / Anexos
          </span>
          <div className="text-xl font-bold font-mono text-purple-700">{stats.uploads}</div>
        </div>

        <div className="bg-white border border-slate-200 p-3.5 rounded-xl text-center space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase text-red-600 flex items-center justify-center gap-1">
            <Trash2 className="w-3 h-3" /> Exclusões
          </span>
          <div className="text-xl font-bold font-mono text-red-700">{stats.exclusao}</div>
        </div>
      </div>

      {/* BARRA DE FILTROS E PESQUISA */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Campo de Busca Livre */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPaginaAtual(1);
              }}
              placeholder="Pesquisar por colaborador, matrícula, usuário ou texto da ação..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-sans"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Filtro Módulo */}
          <div className="w-full md:w-52">
            <select
              value={moduloFiltro}
              onChange={(e) => {
                setModuloFiltro(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-sans text-slate-700"
            >
              <option value="todos">Todos os Módulos ({logs.length})</option>
              {MODULOS.map((mod) => {
                const count = logs.filter((l) => l.modulo === mod).length;
                return (
                  <option key={mod} value={mod}>
                    {mod} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filtro Ação */}
          <div className="w-full md:w-48">
            <select
              value={acaoFiltro}
              onChange={(e) => {
                setAcaoFiltro(e.target.value);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-sans text-slate-700"
            >
              <option value="todos">Todas as Ações</option>
              {TIPOS_ACAO.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Período */}
          <div className="w-full md:w-44">
            <select
              value={periodoFiltro}
              onChange={(e) => {
                setPeriodoFiltro(e.target.value as any);
                setPaginaAtual(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-sans text-slate-700"
            >
              <option value="todos">Qualquer Data</option>
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
            </select>
          </div>
        </div>

        {/* Indicador de Filtros Ativos */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <div>
            Exibindo <b>{logsFiltrados.length}</b> de <b>{logs.length}</b> registros de auditoria
          </div>
          {(searchTerm || moduloFiltro !== "todos" || acaoFiltro !== "todos" || periodoFiltro !== "todos") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setModuloFiltro("todos");
                setAcaoFiltro("todos");
                setPeriodoFiltro("todos");
                setPaginaAtual(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline text-[11px]"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* LISTA DE REGISTROS DE LOG */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {logsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <ClipboardList className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="font-semibold text-slate-700 text-sm">Nenhum log encontrado</p>
            <p className="text-xs text-slate-400">
              Não foram localizados registros com os critérios de pesquisa e filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto custom-scrollbar">
            {logsPaginados.map((log) => {
              const modBadge = getModuloBadge(log.modulo);
              const acaoBadgeClass = getAcaoBadge(log.acao);

              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  {/* LADO ESQUERDO: MÓDULO, DATA/HORA E DETALHES */}
                  <div className="flex-1 space-y-1.5">
                    
                    {/* Linha superior: Módulo, Ação e Horário */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 ${modBadge.bg}`}>
                        {modBadge.icon}
                        <span>{log.modulo}</span>
                      </span>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] border ${acaoBadgeClass}`}>
                        {log.acao}
                      </span>

                      <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatDateTime(log.dataHora)}</span>
                        <span className="text-[10px] font-sans text-slate-400">
                          ({formatRelativeTime(log.dataHora)})
                        </span>
                      </span>
                    </div>

                    {/* Descrição Principal da Ação */}
                    <div className="text-slate-900 font-medium leading-relaxed font-sans text-[13px]">
                      {log.descricao}
                    </div>

                    {/* Colaborador Vinculado (se houver) */}
                    {(log.nomeColaborador || log.matricula) && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                        <span className="font-bold text-slate-700">Colaborador:</span>
                        <span>{log.nomeColaborador || "-"}</span>
                        {log.matricula && (
                          <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700 font-bold border border-slate-200">
                            MAT: {log.matricula}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LADO DIREITO: USUÁRIO E IDENTIFICADOR */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-1 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700 font-mono text-[11px] border border-slate-200">
                      <User className="w-3 h-3 text-indigo-600" />
                      <span className="font-bold">{log.usuario || "Sistema"}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      ID: {log.id}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <span>Página <b>{paginaAtual}</b> de <b>{totalPaginas}</b></span>
              <span>•</span>
              <span className="text-slate-500">Exibir:</span>
              <select
                value={itensPorPagina}
                onChange={(e) => {
                  setItensPorPagina(Number(e.target.value));
                  setPaginaAtual(1);
                }}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 font-mono"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMudarPagina(paginaAtual - 1)}
                disabled={paginaAtual === 1}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded text-slate-700 font-semibold cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                  let p = i + 1;
                  if (totalPaginas > 5 && paginaAtual > 3) {
                    p = paginaAtual - 3 + i + 1;
                    if (p > totalPaginas) p = totalPaginas - (4 - i);
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => handleMudarPagina(p)}
                      className={`w-7 h-7 rounded text-xs font-semibold cursor-pointer ${
                        paginaAtual === p
                          ? "bg-indigo-600 text-white font-bold"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handleMudarPagina(paginaAtual + 1)}
                disabled={paginaAtual === totalPaginas}
                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 rounded text-slate-700 font-semibold cursor-pointer flex items-center gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
