import React, { useState, useMemo } from "react";
import { 
  DisponibilidadeColaborador, 
  Colaborador, 
  StatusDisponibilidade, 
  ConfiguracaoCustos,
  HistoricoMovimentacao
} from "../types";
import { 
  obterStatusVigente, 
  calcularDiasADisposicao, 
  calcularCustoEstimado,
  CONFIG_CUSTOS_PADRAO
} from "../utils/disponibilidade";
import { formatBrDate } from "../utils/date";
import { exportToExcel } from "../utils/excel";
import { 
  UserCheck, 
  CalendarClock, 
  ArrowRightLeft, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  Search, 
  History, 
  Building2, 
  DollarSign, 
  Clock, 
  Filter, 
  HelpCircle,
  X,
  MessageSquarePlus,
  Trash2,
  Edit3
} from "lucide-react";

interface DisponibilidadeViewProps {
  disponibilidades: DisponibilidadeColaborador[];
  colaboradores: Colaborador[];
  configCustos: ConfiguracaoCustos;
  onSaveDisponibilidade: (d: DisponibilidadeColaborador) => Promise<void>;
  onUpdateDisponibilidade: (id: string, d: Partial<DisponibilidadeColaborador>) => Promise<void>;
  onTransferir: (id: string, payload: { projetoDestino: string; dataTransferencia: string; responsavel: string; observacao?: string }) => Promise<void>;
  onDeleteDisponibilidade: (id: string) => Promise<void>;
  onSaveConfigCustos: (cfg: ConfiguracaoCustos) => Promise<void>;
  onOpenNovaObservacao?: (matricula: string) => void;
  currentUser: { username: string; role: "admin" | "viewer" } | null;
}

export default function DisponibilidadeView({
  disponibilidades,
  colaboradores,
  configCustos,
  onSaveDisponibilidade,
  onUpdateDisponibilidade,
  onTransferir,
  onDeleteDisponibilidade,
  onSaveConfigCustos,
  onOpenNovaObservacao,
  currentUser
}: DisponibilidadeViewProps) {
  const isAdmin = currentUser?.role === "admin";
  const hojeStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtros de busca
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroProjeto, setFiltroProjeto] = useState<string>("todos");
  const [filtroFuncao, setFiltroFuncao] = useState<string>("todos");
  const [dataInicioFiltro, setDataInicioFiltro] = useState("");
  const [dataFimFiltro, setDataFimFiltro] = useState("");
  const [filtroAlertaDias, setFiltroAlertaDias] = useState<"todos" | "alerta15" | "alerta30">("todos");

  // Modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalTransferirAberto, setModalTransferirAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalCustosAberto, setModalCustosAberto] = useState(false);
  const [registroSelecionado, setRegistroSelecionado] = useState<DisponibilidadeColaborador | null>(null);

  // Estados de Edição de Disponibilidade
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [dispEmEdicao, setDispEmEdicao] = useState<DisponibilidadeColaborador | null>(null);
  const [editDataLiberacao, setEditDataLiberacao] = useState("");
  const [editDataDisponibilidade, setEditDataDisponibilidade] = useState("");
  const [editMotivoLiberacao, setEditMotivoLiberacao] = useState("");
  const [editProjetoDestino, setEditProjetoDestino] = useState("");
  const [editStatus, setEditStatus] = useState<StatusDisponibilidade>("À disposição");
  const [editObservacoes, setEditObservacoes] = useState("");
  const [erroEdicao, setErroEdicao] = useState("");

  // Modais de Negociação, Encerramento e Exclusão (sem window.prompt ou window.confirm)
  const [negociacaoItem, setNegociacaoItem] = useState<DisponibilidadeColaborador | null>(null);
  const [negociacaoDestino, setNegociacaoDestino] = useState("");
  const [encerramentoItem, setEncerramentoItem] = useState<DisponibilidadeColaborador | null>(null);
  const [encerramentoMotivo, setEncerramentoMotivo] = useState("Desmobilização definitiva ou retorno à base");
  const [dispParaExcluir, setDispParaExcluir] = useState<DisponibilidadeColaborador | null>(null);

  // Mensagens de Feedback em tela (sem usar window.alert)
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const exibirFeedback = (tipo: "sucesso" | "erro", texto: string) => {
    setFeedbackMsg({ tipo, texto });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Estados do formulário de novo registro
  const [formMatricula, setFormMatricula] = useState("");
  const [formDataLiberacao, setFormDataLiberacao] = useState(hojeStr);
  const [formDataDisponibilidade, setFormDataDisponibilidade] = useState(hojeStr);
  const [formMotivo, setFormMotivo] = useState("Fim de fase de obra");
  const [formMotivoOutro, setFormMotivoOutro] = useState("");
  const [formProjetoDestino, setFormProjetoDestino] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados do formulário de transferência
  const [transfDestino, setTransfDestino] = useState("");
  const [transfData, setTransfData] = useState(hojeStr);
  const [transfObs, setTransfObs] = useState("");
  const [erroTransf, setErroTransf] = useState("");

  // Estados do formulário de configuração de custos
  const [custoEncargos, setCustoEncargos] = useState(String(configCustos.encargosAdicionaisPct ?? 0));
  const [custoBeneficios, setCustoBeneficios] = useState(String(configCustos.beneficiosMensalPadrao ?? 800));
  const [custoOutros, setCustoOutros] = useState(String(configCustos.outrosCustosMensalPadrao ?? 400));
  const [custoSalarioFallback, setCustoSalarioFallback] = useState(String(configCustos.salarioBasePadraoFallback ?? 0));

  // Mapa de colaboradores para consulta instantânea
  const colaboradoresMap = useMemo(() => {
    const map = new Map<string, Colaborador>();
    colaboradores.forEach((c) => map.set(c.matricula, c));
    return map;
  }, [colaboradores]);

  // Lista enriquecida com status vigente calculado e custo
  const disponibilidadesEnriquecidas = useMemo(() => {
    return disponibilidades.map((d) => {
      const col = colaboradoresMap.get(d.matricula);
      const statusVigente = obterStatusVigente(d, hojeStr);
      const dias = calcularDiasADisposicao(d, hojeStr);
      const custo = calcularCustoEstimado(col, dias, configCustos);

      return {
        ...d,
        statusVigente,
        diasADisposicao: dias,
        colaborador: col,
        custo
      };
    });
  }, [disponibilidades, colaboradoresMap, hojeStr, configCustos]);

  // Indicadores
  const indicadores = useMemo(() => {
    let dispHoje = 0;
    let programadas = 0;
    let emNegociacao = 0;
    let transferidos = 0;
    let cancelados = 0;
    let custoTotalAcumulado = 0;
    let alerta15Dias = 0;
    let alerta30Dias = 0;

    disponibilidadesEnriquecidas.forEach((item) => {
      if (item.statusVigente === "À disposição") {
        dispHoje++;
        custoTotalAcumulado += item.custo.custoAcumulado;
        if (item.diasADisposicao >= 30) alerta30Dias++;
        else if (item.diasADisposicao >= 15) alerta15Dias++;
      } else if (item.statusVigente === "Disponibilidade programada") {
        programadas++;
      } else if (item.statusVigente === "Em negociação") {
        emNegociacao++;
        custoTotalAcumulado += item.custo.custoAcumulado;
      } else if (item.statusVigente === "Transferido") {
        transferidos++;
      } else if (item.statusVigente === "Encerrado/cancelado") {
        cancelados++;
      }
    });

    return {
      dispHoje,
      programadas,
      emNegociacao,
      transferidos,
      cancelados,
      custoTotalAcumulado,
      alerta15Dias,
      alerta30Dias
    };
  }, [disponibilidadesEnriquecidas]);

  // Opções de projetos e funções para filtro
  const listaProjetosOrigem = useMemo(() => {
    const set = new Set<string>();
    disponibilidades.forEach((d) => {
      if (d.projetoOrigem) set.add(d.projetoOrigem);
    });
    return Array.from(set).sort();
  }, [disponibilidades]);

  const listaFuncoes = useMemo(() => {
    const set = new Set<string>();
    disponibilidades.forEach((d) => {
      const col = colaboradoresMap.get(d.matricula);
      if (col?.funcao) set.add(col.funcao);
      else if (d.funcao) set.add(d.funcao);
    });
    return Array.from(set).sort();
  }, [disponibilidades, colaboradoresMap]);

  // Lista filtrada
  const filtrados = useMemo(() => {
    return disponibilidadesEnriquecidas.filter((item) => {
      const col = item.colaborador;
      const nome = (col?.nomeCompleto || item.nomeColaborador || "").toLowerCase();
      const mat = item.matricula.toLowerCase();
      const func = (col?.funcao || item.funcao || "").toLowerCase();
      const projOrigem = (item.projetoOrigem || "").toLowerCase();
      const projDestino = (item.projetoDestino || "").toLowerCase();
      const b = busca.toLowerCase().trim();

      if (b && !nome.includes(b) && !mat.includes(b) && !func.includes(b) && !projOrigem.includes(b) && !projDestino.includes(b)) {
        return false;
      }

      if (filtroStatus !== "todos" && item.statusVigente !== filtroStatus) {
        return false;
      }

      if (filtroProjeto !== "todos" && item.projetoOrigem !== filtroProjeto) {
        return false;
      }

      if (filtroFuncao !== "todos" && (col?.funcao !== filtroFuncao && item.funcao !== filtroFuncao)) {
        return false;
      }

      if (dataInicioFiltro && item.dataDisponibilidade < dataInicioFiltro) {
        return false;
      }

      if (dataFimFiltro && item.dataDisponibilidade > dataFimFiltro) {
        return false;
      }

      if (filtroAlertaDias === "alerta15" && (item.diasADisposicao < 15 || item.statusVigente !== "À disposição")) {
        return false;
      }

      if (filtroAlertaDias === "alerta30" && (item.diasADisposicao < 30 || item.statusVigente !== "À disposição")) {
        return false;
      }

      return true;
    });
  }, [disponibilidadesEnriquecidas, busca, filtroStatus, filtroProjeto, filtroFuncao, dataInicioFiltro, dataFimFiltro, filtroAlertaDias]);

  // Reset do formulário de novo registro
  const abrirModalNovo = () => {
    setFormMatricula("");
    setFormDataLiberacao(hojeStr);
    setFormDataDisponibilidade(hojeStr);
    setFormMotivo("Fim de fase de obra");
    setFormMotivoOutro("");
    setFormProjetoDestino("");
    setFormObservacoes("");
    setErroForm("");
    setModalNovoAberto(true);
  };

  const handleSubmitNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm("");

    if (!formMatricula) {
      setErroForm("Selecione um colaborador.");
      return;
    }

    if (!formDataLiberacao || !formDataDisponibilidade) {
      setErroForm("Informe a data de liberação e a data efetiva de disponibilidade.");
      return;
    }

    const col = colaboradoresMap.get(formMatricula);
    if (!col) {
      setErroForm("Colaborador não encontrado.");
      return;
    }

    // Prevenção de duplicidade ativa no front-end
    const duplicado = disponibilidades.find(
      (d) =>
        d.matricula === formMatricula &&
        (d.status === "Disponibilidade programada" || d.status === "À disposição" || d.status === "Em negociação")
    );

    if (duplicado) {
      setErroForm(
        `Este colaborador já possui um registro ativo (ID: ${duplicado.id}, Status: ${duplicado.status}). Conclua a transferência ou encerre o registro anterior primeiro.`
      );
      return;
    }

    const motivoFinal = formMotivo === "Outro" ? (formMotivoOutro.trim() || "Outro") : formMotivo;

    const novoItem: DisponibilidadeColaborador = {
      id: "DISP-" + Date.now(),
      matricula: formMatricula,
      nomeColaborador: col.nomeCompleto,
      funcao: col.funcao,
      projetoOrigem: col.projetoAtual || "Sem Projeto",
      dataLiberacao: formDataLiberacao,
      dataDisponibilidade: formDataDisponibilidade,
      motivoLiberacao: motivoFinal,
      projetoDestino: formProjetoDestino.trim() || undefined,
      responsavel: currentUser?.username || "Sistema",
      status: formDataDisponibilidade > hojeStr ? "Disponibilidade programada" : "À disposição",
      observacoes: formObservacoes.trim() || undefined,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      historico: [
        {
          id: "HIST-" + Date.now(),
          dataHora: new Date().toISOString(),
          autor: currentUser?.username || "Sistema",
          acao: "Cadastro de disponibilidade",
          detalhe: `Liberação comunicada em ${formDataLiberacao}. Disponibilidade efetiva a partir de ${formDataDisponibilidade}. Motivo: ${motivoFinal}`,
          projetoOrigem: col.projetoAtual
        }
      ]
    };

    setIsSubmitting(true);
    try {
      await onSaveDisponibilidade(novoItem);
      setModalNovoAberto(false);
    } catch (err: any) {
      setErroForm(err?.message || "Erro ao salvar disponibilidade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir transferência
  const abrirTransferencia = (item: DisponibilidadeColaborador) => {
    setRegistroSelecionado(item);
    setTransfDestino(item.projetoDestino || "");
    setTransfData(hojeStr);
    setTransfObs("");
    setErroTransf("");
    setModalTransferirAberto(true);
  };

  const handleConfirmarTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registroSelecionado) return;
    if (!transfDestino.trim()) {
      setErroTransf("Informe o projeto de destino.");
      return;
    }
    if (!transfData) {
      setErroTransf("Informe a data efetiva da transferência.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onTransferir(registroSelecionado.id, {
        projetoDestino: transfDestino.trim(),
        dataTransferencia: transfData,
        responsavel: currentUser?.username || "Sistema",
        observacao: transfObs.trim() || undefined
      });
      setModalTransferirAberto(false);
      setRegistroSelecionado(null);
    } catch (err: any) {
      setErroTransf(err?.message || "Erro ao efetivar transferência.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir Edição Completa da Disponibilidade
  const abrirEdicao = (item: DisponibilidadeColaborador) => {
    setDispEmEdicao(item);
    setEditDataLiberacao(item.dataLiberacao || hojeStr);
    setEditDataDisponibilidade(item.dataDisponibilidade || hojeStr);
    setEditMotivoLiberacao(item.motivoLiberacao || "");
    setEditProjetoDestino(item.projetoDestino || "");
    setEditStatus(item.status);
    setEditObservacoes(item.observacoes || "");
    setErroEdicao("");
    setModalEditarAberto(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEdicao("");
    if (!dispEmEdicao) return;

    if (!editDataLiberacao || !editDataDisponibilidade) {
      setErroEdicao("As datas de liberação e disponibilidade são obrigatórias.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateDisponibilidade(dispEmEdicao.id, {
        dataLiberacao: editDataLiberacao,
        dataDisponibilidade: editDataDisponibilidade,
        motivoLiberacao: editMotivoLiberacao.trim() || dispEmEdicao.motivoLiberacao,
        projetoDestino: editProjetoDestino.trim() || undefined,
        status: editStatus,
        observacoes: editObservacoes.trim() || undefined,
        responsavel: currentUser?.username || "Sistema"
      });
      setModalEditarAberto(false);
      setDispEmEdicao(null);
      exibirFeedback("sucesso", "Registro de disponibilidade editado com sucesso!");
    } catch (err: any) {
      setErroEdicao(err?.message || "Erro ao salvar alterações da disponibilidade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mudar para negociação (modal nativo em tela)
  const handleIniciarNegociacao = (item: DisponibilidadeColaborador) => {
    setNegociacaoItem(item);
    setNegociacaoDestino(item.projetoDestino || "");
  };

  const confirmarNegociacao = async () => {
    if (!negociacaoItem) return;
    setIsSubmitting(true);
    try {
      await onUpdateDisponibilidade(negociacaoItem.id, {
        status: "Em negociação",
        projetoDestino: negociacaoDestino.trim() || undefined,
        responsavel: currentUser?.username || "Sistema"
      });
      setNegociacaoItem(null);
      exibirFeedback("sucesso", "Colaborador marcado em negociação com sucesso!");
    } catch (err: any) {
      exibirFeedback("erro", err?.message || "Erro ao atualizar status para Em negociação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Encerrar / Cancelar (modal nativo em tela)
  const handleEncerrar = (item: DisponibilidadeColaborador) => {
    setEncerramentoItem(item);
    setEncerramentoMotivo("Desmobilização definitiva ou retorno à base");
  };

  const confirmarEncerramento = async () => {
    if (!encerramentoItem) return;
    setIsSubmitting(true);
    try {
      await onUpdateDisponibilidade(encerramentoItem.id, {
        status: "Encerrado/cancelado",
        observacoes: encerramentoItem.observacoes
          ? `${encerramentoItem.observacoes}\n[Encerrado: ${encerramentoMotivo}]`
          : `[Encerrado: ${encerramentoMotivo}]`,
        responsavel: currentUser?.username || "Sistema"
      });
      setEncerramentoItem(null);
      exibirFeedback("sucesso", "Disponibilidade encerrada/cancelada com sucesso!");
    } catch (err: any) {
      exibirFeedback("erro", err?.message || "Erro ao encerrar disponibilidade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Solicitar exclusão (abre modal nativo em tela)
  const handleExcluir = (item: DisponibilidadeColaborador) => {
    setDispParaExcluir(item);
  };

  const confirmarExclusao = async () => {
    if (!dispParaExcluir) return;
    setIsSubmitting(true);
    try {
      await onDeleteDisponibilidade(dispParaExcluir.id);
      setDispParaExcluir(null);
      exibirFeedback("sucesso", "Registro de disponibilidade excluído com sucesso!");
    } catch (err: any) {
      exibirFeedback("erro", err?.message || "Erro ao excluir disponibilidade.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Salvar Parâmetros de Custo
  const handleSalvarCustos = async (e: React.FormEvent) => {
    e.preventDefault();
    const novoCfg: ConfiguracaoCustos = {
      id: "default",
      encargosAdicionaisPct: parseFloat(custoEncargos.replace(",", ".")) || 0,
      beneficiosMensalPadrao: parseFloat(custoBeneficios.replace(",", ".")) || 0,
      outrosCustosMensalPadrao: parseFloat(custoOutros.replace(",", ".")) || 0,
      salarioBasePadraoFallback: parseFloat(custoSalarioFallback.replace(",", ".")) || 0,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: currentUser?.username || "Sistema"
    };

    try {
      await onSaveConfigCustos(novoCfg);
      setModalCustosAberto(false);
    } catch (err) {
      alert("Erro ao salvar parâmetros de custo.");
    }
  };

  // Exportar Excel
  const handleExportarExcel = () => {
    const dadosExport = filtrados.map((item) => ({
      Matrícula: item.matricula,
      Nome: item.colaborador?.nomeCompleto || item.nomeColaborador,
      Função: item.colaborador?.funcao || item.funcao,
      "Tipo M.O.": item.colaborador?.tipoMaoDeObra || "-",
      "Projeto Origem": item.projetoOrigem,
      "Projeto Destino": item.projetoDestino || "-",
      "Data Comunicação Liberação": formatBrDate(item.dataLiberacao),
      "Data Disponibilidade Efetiva": formatBrDate(item.dataDisponibilidade),
      "Data Transferência": item.dataTransferencia ? formatBrDate(item.dataTransferencia) : "-",
      Status: item.statusVigente,
      "Dias à Disposição": item.diasADisposicao,
      "Motivo da Liberação": item.motivoLiberacao,
      Responsável: item.responsavel,
      "Salário/Custo Base (R$)": item.custo.salarioBaseMensal ? item.custo.salarioBaseMensal.toFixed(2) : "Não cadastrado",
      "Custo Diário Estimado (R$)": item.custo.custoDiario.toFixed(2),
      "Custo Acumulado Estimado (R$)": item.custo.custoAcumulado.toFixed(2),
      Observações: item.observacoes || "-"
    }));

    exportToExcel(dadosExport, "Gestao_Disponibilidade_Colaboradores");
  };

  // Cor do badge de status
  const badgeStatus = (status: StatusDisponibilidade) => {
    switch (status) {
      case "À disposição":
        return "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold";
      case "Disponibilidade programada":
        return "bg-sky-50 text-sky-700 border-sky-300 font-semibold";
      case "Em negociação":
        return "bg-amber-50 text-amber-700 border-amber-300 font-semibold";
      case "Transferido":
        return "bg-indigo-50 text-indigo-700 border-indigo-300 font-semibold";
      case "Encerrado/cancelado":
        return "bg-slate-100 text-slate-600 border-slate-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-16">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            <span className="text-[11px] font-mono uppercase font-bold tracking-widest text-indigo-600">
              Gestão de Mobilização de Equipes
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Colaboradores À Disposição
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Controle de desmobilização antecipada, remanejamento entre canteiros e cálculo de custos de ociosidade.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setModalCustosAberto(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            title="Configurar encargos, benefícios e custos diários"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>Parâmetros de Custo</span>
          </button>

          <button
            onClick={handleExportarExcel}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Excel</span>
          </button>

          {isAdmin && (
            <button
              onClick={abrirModalNovo}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Liberação</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback de Operação */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all ${
          feedbackMsg.tipo === "sucesso"
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-red-50 border-red-300 text-red-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.tipo === "sucesso" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMsg.texto}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-slate-700 font-bold text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* CARDS DE INDICADORES */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* DISPONÍVEIS AGORA */}
        <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">À Disposição</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{indicadores.dispHoje}</div>
          <span className="text-[10px] text-slate-500 font-medium">aptos para remanejamento</span>
        </div>

        {/* PROGRAMADAS */}
        <div className="bg-white border border-sky-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-700">Programadas</span>
            <CalendarClock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{indicadores.programadas}</div>
          <span className="text-[10px] text-slate-500 font-medium">liberação em data futura</span>
        </div>

        {/* EM NEGOCIAÇÃO */}
        <div className="bg-white border border-amber-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700">Em Negociação</span>
            <ArrowRightLeft className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{indicadores.emNegociacao}</div>
          <span className="text-[10px] text-slate-500 font-medium">tratativas em andamento</span>
        </div>

        {/* TRANSFERIDOS */}
        <div className="bg-white border border-indigo-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-700">Transferidos</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{indicadores.transferidos}</div>
          <span className="text-[10px] text-slate-500 font-medium">alocados com sucesso</span>
        </div>

        {/* ALERTAS DE TEMPO */}
        <div className="bg-white border border-red-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-700">Atenção &gt;15d</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600">
            {indicadores.alerta15Dias + indicadores.alerta30Dias}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{indicadores.alerta30Dias} há mais de 30 dias</span>
        </div>

        {/* CUSTO TOTAL SEM ALOCAÇÃO */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">Custo Acumulado</span>
            <DollarSign className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-lg font-black text-slate-900 truncate" title={`R$ ${indicadores.custoTotalAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}>
            R$ {indicadores.custoTotalAcumulado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">estimativa s/ alocação</span>
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* BUSCA TEXTUAL */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por colaborador, matrícula, função..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          {/* FILTRO STATUS */}
          <div>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="todos">Todos os Status</option>
              <option value="À disposição">À disposição (Ativos)</option>
              <option value="Disponibilidade programada">Programadas (Futuras)</option>
              <option value="Em negociação">Em negociação</option>
              <option value="Transferido">Transferidos</option>
              <option value="Encerrado/cancelado">Encerrados / Cancelados</option>
            </select>
          </div>

          {/* FILTRO PROJETO ORIGEM */}
          <div>
            <select
              value={filtroProjeto}
              onChange={(e) => setFiltroProjeto(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="todos">Todos os Projetos</option>
              {listaProjetosOrigem.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* FILTRO FUNÇÃO */}
          <div>
            <select
              value={filtroFuncao}
              onChange={(e) => setFiltroFuncao(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="todos">Todas as Funções</option>
              {listaFuncoes.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* FILTRO ALERTAS DIAS */}
          <div>
            <select
              value={filtroAlertaDias}
              onChange={(e) => setFiltroAlertaDias(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white font-semibold text-red-600"
            >
              <option value="todos">Sem filtro de dias</option>
              <option value="alerta15">Atenção (&ge; 15 dias)</option>
              <option value="alerta30">Crítico (&ge; 30 dias)</option>
            </select>
          </div>
        </div>

        {/* SEGUNDA LINHA: DATAS E LIMPAR */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Data Disp. De:</span>
            <input
              type="date"
              value={dataInicioFiltro}
              onChange={(e) => setDataInicioFiltro(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
            <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Até:</span>
            <input
              type="date"
              value={dataFimFiltro}
              onChange={(e) => setDataFimFiltro(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <span>Exibindo <b>{filtrados.length}</b> de <b>{disponibilidades.length}</b> registros</span>
            {(busca || filtroStatus !== "todos" || filtroProjeto !== "todos" || filtroFuncao !== "todos" || dataInicioFiltro || dataFimFiltro || filtroAlertaDias !== "todos") && (
              <button
                onClick={() => {
                  setBusca("");
                  setFiltroStatus("todos");
                  setFiltroProjeto("todos");
                  setFiltroFuncao("todos");
                  setDataInicioFiltro("");
                  setDataFimFiltro("");
                  setFiltroAlertaDias("todos");
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-xs"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABELA DE DISPONIBILIDADES */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden flex flex-col">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Registros encontrados: <strong className="text-slate-800">{filtrados.length}</strong></span>
          <span className="text-[11px] text-slate-400">Barra de rolagem ativa (máx. 580px) • Cabeçalho fixo</span>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar max-w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 shadow-xs">
              <tr className="bg-slate-900 text-slate-200 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Função & M.O.</th>
                <th className="py-3 px-3">Origem & Destino</th>
                <th className="py-3 px-3">Liberação & Efetiva</th>
                <th className="py-3 px-3 text-center">Dias à Disp.</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Custo Estimado</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                    <p className="font-semibold text-slate-600">Nenhum registro encontrado</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tente ajustar os filtros ou cadastre uma nova liberação.</p>
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => {
                  const col = item.colaborador;
                  const isAlertaCritico = item.statusVigente === "À disposição" && item.diasADisposicao >= 30;
                  const isAlertaMedio = item.statusVigente === "À disposição" && item.diasADisposicao >= 15 && item.diasADisposicao < 30;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isAlertaCritico ? "bg-red-50/20" : isAlertaMedio ? "bg-amber-50/20" : ""
                      }`}
                    >
                      {/* COLABORADOR */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {col?.nomeCompleto || item.nomeColaborador}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>MAT: {item.matricula}</span>
                          {col?.cpf && <span>• CPF: {col.cpf}</span>}
                        </div>
                      </td>

                      {/* FUNÇÃO & TIPO MO */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{col?.funcao || item.funcao || "-"}</div>
                        <div className="text-[10px] text-slate-500">
                          {col?.tipoMaoDeObra ? `Tipo: ${col.tipoMaoDeObra}` : ""} • {col?.regimeTrabalho || "Regime -"}
                        </div>
                      </td>

                      {/* PROJETOS */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 text-slate-800">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium truncate max-w-[140px]" title={item.projetoOrigem}>
                            {item.projetoOrigem || "Origem"}
                          </span>
                        </div>
                        {item.projetoDestino ? (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold mt-0.5">
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[140px]" title={item.projetoDestino}>
                              {item.projetoDestino}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Destino não definido</span>
                        )}
                      </td>

                      {/* DATAS */}
                      <td className="py-3 px-3">
                        <div className="text-slate-800 font-medium">
                          Efetiva: {formatBrDate(item.dataDisponibilidade)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Comunicação: {formatBrDate(item.dataLiberacao)}
                        </div>
                      </td>

                      {/* DIAS À DISPOSIÇÃO */}
                      <td className="py-3 px-3 text-center">
                        {item.statusVigente === "Disponibilidade programada" ? (
                          <span className="text-[10px] font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            Futura
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                              isAlertaCritico
                                ? "bg-red-100 text-red-700 border-red-300"
                                : isAlertaMedio
                                ? "bg-amber-100 text-amber-700 border-amber-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                            title={isAlertaCritico ? "Alerta Crítico: mais de 30 dias à disposição" : isAlertaMedio ? "Atenção: mais de 15 dias à disposição" : "Prazo normal"}
                          >
                            {item.diasADisposicao}d
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] border uppercase tracking-wider ${badgeStatus(item.statusVigente)}`}>
                          {item.statusVigente}
                        </span>
                        {item.motivoLiberacao && (
                          <div className="text-[9px] text-slate-500 truncate max-w-[130px] mt-0.5" title={item.motivoLiberacao}>
                            {item.motivoLiberacao}
                          </div>
                        )}
                      </td>

                      {/* CUSTO ESTIMADO */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="font-bold text-slate-900">
                          R$ {item.custo.custoAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          R$ {item.custo.custoDiario.toFixed(2)}/dia
                        </div>
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Histórico */}
                          <button
                            onClick={() => {
                              setRegistroSelecionado(item);
                              setModalHistoricoAberto(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                            title="Ver histórico de movimentações"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Adicionar Observação */}
                          {onOpenNovaObservacao && (
                            <button
                              onClick={() => onOpenNovaObservacao(item.matricula)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Registrar observação para este colaborador"
                            >
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Transferir (se não estiver transferido) */}
                          {isAdmin && item.statusVigente !== "Transferido" && item.statusVigente !== "Encerrado/cancelado" && (
                            <button
                              onClick={() => abrirTransferencia(item)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[10px] rounded border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                              title="Efetivar transferência para novo projeto"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>Transferir</span>
                            </button>
                          )}

                          {/* Iniciar Negociação (se à disposição) */}
                          {isAdmin && item.statusVigente === "À disposição" && (
                            <button
                              onClick={() => handleIniciarNegociacao(item)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[10px] rounded border border-amber-200 transition-colors cursor-pointer"
                              title="Marcar em negociação para alocação"
                            >
                              Negociar
                            </button>
                          )}

                          {/* Encerrar */}
                          {isAdmin && item.statusVigente !== "Transferido" && item.statusVigente !== "Encerrado/cancelado" && (
                            <button
                              onClick={() => handleEncerrar(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Encerrar disponibilidade"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Editar Registro */}
                          {isAdmin && (
                            <button
                              onClick={() => abrirEdicao(item)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Editar dados desta disponibilidade"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                            </button>
                          )}

                          {/* Excluir (somente admin) */}
                          {isAdmin && (
                            <button
                              onClick={() => handleExcluir(item)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Excluir registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: REGISTRAR NOVA DISPONIBILIDADE */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Registrar Colaborador À Disposição</h3>
                <p className="text-[11px] text-slate-500">Comunique liberação programada ou disponibilidade imediata para outros projetos.</p>
              </div>
              <button
                onClick={() => setModalNovoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovo} className="p-4 space-y-4 text-xs font-sans">
              {erroForm && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{erroForm}</span>
                </div>
              )}

              {/* SELEÇÃO DO COLABORADOR */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Colaborador (Matrícula / Nome)*
                </label>
                <select
                  required
                  value={formMatricula}
                  onChange={(e) => setFormMatricula(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Selecione um colaborador ativo...</option>
                  {colaboradores
                    .filter((c) => c.status !== "Inativo")
                    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
                    .map((c) => (
                      <option key={c.matricula} value={c.matricula}>
                        {c.nomeCompleto} ({c.matricula}) — {c.funcao} [{c.projetoAtual || "Sem Projeto"}]
                      </option>
                    ))}
                </select>
              </div>

              {/* DATAS DE LIBERAÇÃO E DISPONIBILIDADE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Data da Liberação (Comunicação)*
                  </label>
                  <input
                    type="date"
                    required
                    value={formDataLiberacao}
                    onChange={(e) => setFormDataLiberacao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Quando a obra informou a saída</span>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Data Efetiva de Disponibilidade*
                  </label>
                  <input
                    type="date"
                    required
                    value={formDataDisponibilidade}
                    onChange={(e) => setFormDataDisponibilidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {formDataDisponibilidade > hojeStr ? (
                      <b className="text-sky-600 font-normal">Ficará como Disponibilidade Programada até {formatBrDate(formDataDisponibilidade)}</b>
                    ) : (
                      <b className="text-emerald-600 font-normal">Ficará À Disposição Imediatamente</b>
                    )}
                  </span>
                </div>
              </div>

              {/* MOTIVO DA LIBERAÇÃO */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Motivo da Liberação*
                </label>
                <select
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none mb-2"
                >
                  <option value="Fim de fase de obra">Fim de fase de obra</option>
                  <option value="Conclusão de escopo">Conclusão de escopo</option>
                  <option value="Desmobilização parcial">Desmobilização parcial</option>
                  <option value="Otimização de equipe">Otimização de equipe</option>
                  <option value="Substituição solicitada pelo cliente">Substituição solicitada pelo cliente</option>
                  <option value="Outro">Outro motivo (especificar abaixo)</option>
                </select>

                {formMotivo === "Outro" && (
                  <input
                    type="text"
                    required
                    value={formMotivoOutro}
                    onChange={(e) => setFormMotivoOutro(e.target.value)}
                    placeholder="Especifique o motivo detalhado..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                )}
              </div>

              {/* PROJETO DE DESTINO (OPCIONAL) */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Projeto de Destino Pretendido (Opcional)
                </label>
                <input
                  type="text"
                  value={formProjetoDestino}
                  onChange={(e) => setFormProjetoDestino(e.target.value)}
                  placeholder="Ex: Parque Eólico Ventos do Sul (ou deixe em branco se aberto)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* OBSERVAÇÕES */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Observações Adicionais
                </label>
                <textarea
                  rows={2}
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  placeholder="Informações sobre qualificação, restrições ou tratativas..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Confirmar Liberação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFERIR COLABORADOR */}
      {modalTransferirAberto && registroSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Transferir Colaborador</h3>
                <p className="text-[11px] text-slate-500">
                  {registroSelecionado.nomeColaborador} (Matrícula: {registroSelecionado.matricula})
                </p>
              </div>
              <button
                onClick={() => setModalTransferirAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarTransferencia} className="p-4 space-y-4 text-xs font-sans">
              {erroTransf && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{erroTransf}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                <div><b>Projeto de Origem:</b> {registroSelecionado.projetoOrigem}</div>
                <div><b>Disponível desde:</b> {formatBrDate(registroSelecionado.dataDisponibilidade)}</div>
                <div><b>Dias sem alocação:</b> {calcularDiasADisposicao(registroSelecionado, hojeStr)} dias</div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Projeto de Destino*
                </label>
                <input
                  type="text"
                  required
                  value={transfDestino}
                  onChange={(e) => setTransfDestino(e.target.value)}
                  placeholder="Nome do novo projeto / canteiro..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Data Efetiva da Transferência*
                </label>
                <input
                  type="date"
                  required
                  value={transfData}
                  onChange={(e) => setTransfData(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Observações da Transferência
                </label>
                <textarea
                  rows={2}
                  value={transfObs}
                  onChange={(e) => setTransfObs(e.target.value)}
                  placeholder="Detalhes sobre a mobilização, transporte ou alinhamento com a nova liderança..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalTransferirAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Transferindo..." : "Concluir Transferência"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: HISTÓRICO DE MOVIMENTAÇÕES */}
      {modalHistoricoAberto && registroSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Histórico de Movimentações</h3>
                <p className="text-[11px] text-slate-500">
                  {registroSelecionado.nomeColaborador} • Matrícula: {registroSelecionado.matricula}
                </p>
              </div>
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[60vh] custom-scrollbar">
              {(!registroSelecionado.historico || registroSelecionado.historico.length === 0) ? (
                <p className="text-center text-slate-400 py-6 text-xs">Nenhum evento registrado no histórico.</p>
              ) : (
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {registroSelecionado.historico.map((h, i) => (
                    <div key={h.id || i} className="relative text-xs">
                      <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white"></span>
                      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                        <span>{new Date(h.dataHora).toLocaleString("pt-BR")}</span>
                        <span className="font-semibold text-slate-600">Por: {h.autor}</span>
                      </div>
                      <div className="font-bold text-slate-800 text-xs mt-0.5">{h.acao}</div>
                      {h.detalhe && (
                        <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                          {h.detalhe}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PARÂMETROS DE CUSTO */}
      {modalCustosAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Parâmetros de Custo de Ociosidade</h3>
                <p className="text-[11px] text-slate-500">Metodologia transparente para estimar custo de colaboradores sem alocação.</p>
              </div>
              <button
                onClick={() => setModalCustosAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarCustos} className="p-4 space-y-4 text-xs font-sans">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-[11px] text-indigo-900 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Metodologia Transparente:</span>
                </div>
                <p>
                  <b>Custo Diário Estimado</b> = (Valor Bruto + Encargos Extras + Benefícios + Outros Custos) / 30.
                </p>
                <p>
                  <b>Custo Acumulado</b> = Custo Diário × Dias de Permanência à Disposição.
                </p>
                <p className="text-[10px] text-indigo-700">
                  * O valor bruto de cada colaborador é buscado diretamente do seu cadastro. Não duplicamos encargos já inclusos.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Encargos Adicionais (% sobre Salário)
                </label>
                <input
                  type="text"
                  value={custoEncargos}
                  onChange={(e) => setCustoEncargos(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Padrão 0% (pois o salário bruto cadastrado já inclui encargos regulares)
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Benefícios Mensais Padrão (R$/mês)
                </label>
                <input
                  type="text"
                  value={custoBeneficios}
                  onChange={(e) => setCustoBeneficios(e.target.value)}
                  placeholder="800"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Estimativa de VR, VA, Seguro de Vida e Plano de Saúde
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Outros Custos Recorrentes Padrão (R$/mês)
                </label>
                <input
                  type="text"
                  value={custoOutros}
                  onChange={(e) => setCustoOutros(e.target.value)}
                  placeholder="400"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Alojamento de transição, gestão de RH e mobilização
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Salário Base Fallback (R$/mês caso não preenchido)
                </label>
                <input
                  type="text"
                  value={custoSalarioFallback}
                  onChange={(e) => setCustoSalarioFallback(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Deixe 0 para exibir aviso "Salário não cadastrado" quando faltar
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCustosAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Salvar Parâmetros
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDITAR DISPONIBILIDADE */}
      {modalEditarAberto && dispEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Editar Registro de Disponibilidade</h3>
                <p className="text-[11px] text-slate-500">
                  {dispEmEdicao.nomeColaborador} • Matrícula: {dispEmEdicao.matricula}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="p-4 space-y-4 text-xs font-sans">
              {erroEdicao && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{erroEdicao}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Data de Comunicação da Liberação*
                  </label>
                  <input
                    type="date"
                    required
                    value={editDataLiberacao}
                    onChange={(e) => setEditDataLiberacao(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Data Efetiva de Disponibilidade*
                  </label>
                  <input
                    type="date"
                    required
                    value={editDataDisponibilidade}
                    onChange={(e) => setEditDataDisponibilidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Status da Disponibilidade*
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as StatusDisponibilidade)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none font-medium"
                  >
                    <option value="À disposição">À disposição</option>
                    <option value="Disponibilidade programada">Disponibilidade programada</option>
                    <option value="Em negociação">Em negociação</option>
                    <option value="Transferido">Transferido</option>
                    <option value="Encerrado/cancelado">Encerrado/cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                    Projeto de Destino / Negociação
                  </label>
                  <input
                    type="text"
                    value={editProjetoDestino}
                    onChange={(e) => setEditProjetoDestino(e.target.value)}
                    placeholder="Ex: Complexo Eólico WindFort"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Motivo da Liberação
                </label>
                <input
                  type="text"
                  value={editMotivoLiberacao}
                  onChange={(e) => setEditMotivoLiberacao(e.target.value)}
                  placeholder="Ex: Fim de fase de obra, readequação de equipe..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Observações Complementares
                </label>
                <textarea
                  rows={3}
                  value={editObservacoes}
                  onChange={(e) => setEditObservacoes(e.target.value)}
                  placeholder="Anotações de perfil, restrições ou alinhamentos de remanejamento..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarAberto(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: INICIAR NEGOCIAÇÃO */}
      {negociacaoItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Iniciar Negociação de Alocação</h4>
                <p className="text-xs text-slate-500">
                  {negociacaoItem.nomeColaborador} ({negociacaoItem.matricula})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                Projeto Interessado / Sugerido
              </label>
              <input
                type="text"
                autoFocus
                value={negociacaoDestino}
                onChange={(e) => setNegociacaoDestino(e.target.value)}
                placeholder="Ex: Complexo Eólico WindFort ou Obra 02..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNegociacaoItem(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarNegociacao}
                disabled={isSubmitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Salvando..." : "Confirmar Negociação"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: ENCERRAR / CANCELAR DISPONIBILIDADE */}
      {encerramentoItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Encerrar Disponibilidade</h4>
                <p className="text-xs text-slate-500">
                  {encerramentoItem.nomeColaborador} ({encerramentoItem.matricula})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                Motivo do Encerramento ou Desmobilização
              </label>
              <input
                type="text"
                autoFocus
                value={encerramentoMotivo}
                onChange={(e) => setEncerramentoMotivo(e.target.value)}
                placeholder="Ex: Desmobilização definitiva, retorno à base..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEncerramentoItem(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarEncerramento}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Encerrando..." : "Confirmar Encerramento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: CONFIRMAR EXCLUSÃO DE DISPONIBILIDADE */}
      {dispParaExcluir && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Excluir Registro de Disponibilidade</h4>
                <p className="text-xs text-slate-500">
                  Tem certeza que deseja remover o registro de disponibilidade de <b>{dispParaExcluir.nomeColaborador}</b> ({dispParaExcluir.matricula})?
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              Status atual: <b>{dispParaExcluir.status}</b> • Projeto: <b>{dispParaExcluir.projetoOrigem}</b>
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDispParaExcluir(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarExclusao}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
