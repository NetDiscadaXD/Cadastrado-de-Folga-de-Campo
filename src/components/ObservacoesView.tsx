import React, { useState, useMemo } from "react";
import { 
  ObservacaoColaborador, 
  Colaborador, 
  CategoriaObservacao 
} from "../types";
import { 
  sugerirCategoria, 
  TODAS_CATEGORIAS_OBSERVACAO 
} from "../utils/observacoesClassifier";
import { formatBrDate } from "../utils/date";
import { 
  Search, 
  Plus, 
  Filter, 
  Sparkles, 
  MessageSquareText, 
  User, 
  Calendar, 
  History, 
  X, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  ChevronRight, 
  Building2,
  FileText,
  AlertCircle
} from "lucide-react";

interface ObservacoesViewProps {
  observacoes: ObservacaoColaborador[];
  colaboradores: Colaborador[];
  onSaveObservacao: (obs: ObservacaoColaborador) => Promise<void>;
  onUpdateObservacao: (id: string, obs: Partial<ObservacaoColaborador>) => Promise<void>;
  onDeleteObservacao: (id: string) => Promise<void>;
  currentUser: { username: string; role: "admin" | "viewer" } | null;
  matriculaPreSelecionada?: string;
}

export default function ObservacoesView({
  observacoes,
  colaboradores,
  onSaveObservacao,
  onUpdateObservacao,
  onDeleteObservacao,
  currentUser,
  matriculaPreSelecionada
}: ObservacoesViewProps) {
  const isAdmin = currentUser?.role === "admin";

  // Filtros de pesquisa global
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroAutor, setFiltroAutor] = useState<string>("todos");
  const [filtroMatricula, setFiltroMatricula] = useState<string>(matriculaPreSelecionada || "todas");
  const [dataInicioFiltro, setDataInicioFiltro] = useState("");
  const [dataFimFiltro, setDataFimFiltro] = useState("");
  const [ordemData, setOrdemData] = useState<"desc" | "asc">("desc");

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 12;

  // Modais
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [modalEditarAberto, setModalEditarAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [colaboradorHistorico, setColaboradorHistorico] = useState<Colaborador | null>(null);

  // Estados do formulário de nova observação
  const [formMatricula, setFormMatricula] = useState(matriculaPreSelecionada || "");
  const [formConteudo, setFormConteudo] = useState("");
  const [formCategoriaConfirmada, setFormCategoriaConfirmada] = useState<CategoriaObservacao>("Outros");
  const [formCategoriaSugerida, setFormCategoriaSugerida] = useState<CategoriaObservacao>("Outros");
  const [confiancaSugestao, setConfiancaSugestao] = useState(0);
  const [termoMatch, setTermoMatch] = useState<string | undefined>();
  const [erroForm, setErroForm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de edição
  const [obsEmEdicao, setObsEmEdicao] = useState<ObservacaoColaborador | null>(null);
  const [editConteudo, setEditConteudo] = useState("");
  const [editCategoria, setEditCategoria] = useState<CategoriaObservacao>("Outros");
  const [editMotivo, setEditMotivo] = useState("");
  const [erroEdit, setErroEdit] = useState("");

  // Estado de confirmação de exclusão (sem usar window.confirm)
  const [obsParaExcluir, setObsParaExcluir] = useState<ObservacaoColaborador | null>(null);

  // Mensagens de Feedback em tela (sem usar window.alert)
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const exibirFeedback = (tipo: "sucesso" | "erro", texto: string) => {
    setFeedbackMsg({ tipo, texto });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4000);
  };

  // Mapa de colaboradores
  const colaboradoresMap = useMemo(() => {
    const map = new Map<string, Colaborador>();
    colaboradores.forEach((c) => map.set(c.matricula, c));
    return map;
  }, [colaboradores]);

  // Lista de autores únicos para filtro
  const listaAutores = useMemo(() => {
    const set = new Set<string>();
    observacoes.forEach((o) => {
      if (o.autor) set.add(o.autor);
    });
    return Array.from(set).sort();
  }, [observacoes]);

  // Atualização em tempo real da sugestão de categoria conforme usuário digita
  const handleConteudoChange = (texto: string) => {
    setFormConteudo(texto);
    const sugestao = sugerirCategoria(texto);
    setFormCategoriaSugerida(sugestao.categoria);
    setConfiancaSugestao(sugestao.confianca);
    setTermoMatch(sugestao.termoEncontrado);

    // Gera e atribui automaticamente a categoria detectada de acordo com o que foi escrito
    if (sugestao.isAutomatica || sugestao.categoria !== "Outros") {
      setFormCategoriaConfirmada(sugestao.categoria);
    }
  };

  const abrirModalNovo = (matriculaInicial?: string) => {
    setFormMatricula(matriculaInicial || matriculaPreSelecionada || "");
    setFormConteudo("");
    setFormCategoriaSugerida("Outros");
    setFormCategoriaConfirmada("Outros");
    setConfiancaSugestao(0);
    setTermoMatch(undefined);
    setErroForm("");
    setModalNovaAberto(true);
  };

  const handleSubmitNova = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm("");

    if (!formMatricula) {
      setErroForm("Selecione um colaborador.");
      return;
    }

    if (!formConteudo.trim()) {
      setErroForm("Digite o conteúdo da observação.");
      return;
    }

    const col = colaboradoresMap.get(formMatricula);
    const nova: ObservacaoColaborador = {
      id: "OBS-" + Date.now(),
      matricula: formMatricula,
      nomeColaborador: col?.nomeCompleto || formMatricula,
      funcao: col?.funcao || "-",
      projeto: col?.projetoAtual || "-",
      conteudo: formConteudo.trim(),
      categoriaSugerida: formCategoriaSugerida,
      categoriaConfirmada: formCategoriaConfirmada,
      autor: currentUser?.username || "Sistema",
      dataHora: new Date().toISOString(),
      dataHoraAtualizacao: new Date().toISOString(),
      historicoAlteracoes: [
        {
          dataHora: new Date().toISOString(),
          autor: currentUser?.username || "Sistema",
          alteracao: "Registro inicial da observação",
          categoriaNova: formCategoriaConfirmada
        }
      ]
    };

    setIsSubmitting(true);
    try {
      await onSaveObservacao(nova);
      setModalNovaAberto(false);
    } catch (err: any) {
      setErroForm(err?.message || "Erro ao salvar observação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir edição
  const abrirEdicao = (obs: ObservacaoColaborador) => {
    setObsEmEdicao(obs);
    setEditConteudo(obs.conteudo);
    setEditCategoria(obs.categoriaConfirmada);
    setEditMotivo("");
    setErroEdit("");
    setModalEditarAberto(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEdit("");
    if (!obsEmEdicao) return;

    if (!editConteudo.trim()) {
      setErroEdit("O conteúdo da observação não pode estar em branco.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdateObservacao(obsEmEdicao.id, {
        conteudo: editConteudo.trim(),
        categoriaConfirmada: editCategoria,
        autor: currentUser?.username || "Sistema",
        dataHoraAtualizacao: new Date().toISOString(),
        descricaoAlteracao: editMotivo.trim() || "Atualização de conteúdo ou categoria"
      } as any);
      setModalEditarAberto(false);
      setObsEmEdicao(null);
      exibirFeedback("sucesso", "Observação atualizada com sucesso no banco de dados!");
    } catch (err: any) {
      setErroEdit(err?.message || "Erro ao salvar atualização da observação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Solicitar exclusão (abre modal nativo da aplicação)
  const handleExcluir = (obs: ObservacaoColaborador) => {
    setObsParaExcluir(obs);
  };

  // Confirmação efetiva da exclusão
  const handleConfirmarExclusao = async () => {
    if (!obsParaExcluir) return;
    setIsSubmitting(true);
    try {
      await onDeleteObservacao(obsParaExcluir.id);
      exibirFeedback("sucesso", "Observação excluída com sucesso!");
      setObsParaExcluir(null);
    } catch (err: any) {
      exibirFeedback("erro", err?.message || "Erro ao excluir observação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir histórico completo do colaborador
  const abrirHistoricoColaborador = (matricula: string) => {
    const col = colaboradoresMap.get(matricula);
    if (col) {
      setColaboradorHistorico(col);
      setModalHistoricoAberto(true);
    }
  };

  // Filtragem completa e pesquisa no conteúdo integral
  const filtrados = useMemo(() => {
    return observacoes.filter((obs) => {
      const col = colaboradoresMap.get(obs.matricula);
      const nome = (col?.nomeCompleto || obs.nomeColaborador || "").toLowerCase();
      const mat = obs.matricula.toLowerCase();
      const conteudo = obs.conteudo.toLowerCase();
      const autor = (obs.autor || "").toLowerCase();
      const termo = buscaTexto.toLowerCase().trim();

      // Busca global por texto completo no conteúdo integral, nome ou matrícula
      if (termo && !conteudo.includes(termo) && !nome.includes(termo) && !mat.includes(termo)) {
        return false;
      }

      if (filtroCategoria !== "todas" && obs.categoriaConfirmada !== filtroCategoria) {
        return false;
      }

      if (filtroAutor !== "todos" && obs.autor !== filtroAutor) {
        return false;
      }

      if (filtroMatricula !== "todas" && obs.matricula !== filtroMatricula) {
        return false;
      }

      if (dataInicioFiltro && obs.dataHora.slice(0, 10) < dataInicioFiltro) {
        return false;
      }

      if (dataFimFiltro && obs.dataHora.slice(0, 10) > dataFimFiltro) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const tA = new Date(a.dataHora).getTime();
      const tB = new Date(b.dataHora).getTime();
      return ordemData === "desc" ? tB - tA : tA - tB;
    });
  }, [observacoes, colaboradoresMap, buscaTexto, filtroCategoria, filtroAutor, filtroMatricula, dataInicioFiltro, dataFimFiltro, ordemData]);

  // Paginação
  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA) || 1;
  const observacoesPaginadas = useMemo(() => {
    const start = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return filtrados.slice(start, start + ITENS_POR_PAGINA);
  }, [filtrados, paginaAtual]);

  // Estilo visual por categoria
  const badgeCategoria = (cat: CategoriaObservacao) => {
    switch (cat) {
      case "Férias e descanso":
        return "bg-teal-50 text-teal-800 border-teal-300 font-bold";
      case "Segurança e portaria":
        return "bg-red-50 text-red-800 border-red-300 font-bold";
      case "À disposição e transferência":
        return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "Mobilização e documentação":
        return "bg-blue-50 text-blue-700 border-blue-300";
      case "Folga de campo":
        return "bg-cyan-50 text-cyan-700 border-cyan-300";
      case "Saúde ocupacional e exames":
        return "bg-rose-50 text-rose-700 border-rose-300";
      case "Desempenho e conduta":
        return "bg-amber-50 text-amber-700 border-amber-300";
      case "Custos e benefícios":
        return "bg-purple-50 text-purple-700 border-purple-300";
      case "Transporte e hospedagem":
        return "bg-orange-50 text-orange-700 border-orange-300";
      case "Administrativo":
        return "bg-indigo-50 text-indigo-700 border-indigo-300";
      default:
        return "bg-slate-50 text-slate-700 border-slate-300";
    }
  };

  // Contagem por categoria
  const contagemCategorias = useMemo(() => {
    const map = new Map<string, number>();
    observacoes.forEach((o) => {
      map.set(o.categoriaConfirmada, (map.get(o.categoriaConfirmada) || 0) + 1);
    });
    return map;
  }, [observacoes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-16">
      {/* Toast Feedback de Operação */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all ${
          feedbackMsg.tipo === "sucesso"
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-red-50 border-red-300 text-red-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.tipo === "sucesso" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
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

      {/* CABEÇALHO DO MÓDULO */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse inline-block"></span>
            <span className="text-[11px] font-mono uppercase font-bold tracking-widest text-indigo-600">
              Gestão de Informações & Auditoria
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
            Observações Inteligentes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registro estruturado de ocorrências com classificação automática, busca no texto integral e histórico por colaborador.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <button
              onClick={() => abrirModalNovo()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Observação</span>
            </button>
          )}
        </div>
      </div>

      {/* CHIPS DE RESUMO POR CATEGORIA */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full text-xs">
        <button
          onClick={() => { setFiltroCategoria("todas"); setPaginaAtual(1); }}
          className={`px-3 py-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            filtroCategoria === "todas"
              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Todas ({observacoes.length})
        </button>

        {TODAS_CATEGORIAS_OBSERVACAO.map((cat) => {
          const qtd = contagemCategorias.get(cat) || 0;
          return (
            <button
              key={cat}
              onClick={() => { setFiltroCategoria(cat); setPaginaAtual(1); }}
              className={`px-3 py-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors cursor-pointer text-xs flex items-center gap-1.5 ${
                filtroCategoria === cat
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{cat}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filtroCategoria === cat ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {qtd}
              </span>
            </button>
          );
        })}
      </div>

      {/* BARRA DE PESQUISA E FILTROS COMBINADOS */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* PESQUISA NO TEXTO INTEGRAL */}
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={buscaTexto}
              onChange={(e) => { setBuscaTexto(e.target.value); setPaginaAtual(1); }}
              placeholder="Pesquisar termo em todo o conteúdo, colaborador ou matrícula..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
            />
          </div>

          {/* FILTRO AUTOR */}
          <div>
            <select
              value={filtroAutor}
              onChange={(e) => { setFiltroAutor(e.target.value); setPaginaAtual(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="todos">Todos os Autores</option>
              {listaAutores.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* FILTRO COLABORADOR */}
          <div>
            <select
              value={filtroMatricula}
              onChange={(e) => { setFiltroMatricula(e.target.value); setPaginaAtual(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="todas">Todos os Colaboradores</option>
              {colaboradores
                .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
                .map((c) => (
                  <option key={c.matricula} value={c.matricula}>
                    {c.nomeCompleto} ({c.matricula})
                  </option>
                ))}
            </select>
          </div>

          {/* ORDEM DATA */}
          <div>
            <select
              value={ordemData}
              onChange={(e) => setOrdemData(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans text-slate-700 focus:outline-none focus:border-indigo-500 focus:bg-white"
            >
              <option value="desc">Mais recentes primeiro</option>
              <option value="asc">Mais antigas primeiro</option>
            </select>
          </div>
        </div>

        {/* INTERVALO DE DATAS E TOTALIZADOR */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Data De:</span>
            <input
              type="date"
              value={dataInicioFiltro}
              onChange={(e) => { setDataInicioFiltro(e.target.value); setPaginaAtual(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
            <span className="font-mono text-[10px] uppercase font-bold text-slate-400">Até:</span>
            <input
              type="date"
              value={dataFimFiltro}
              onChange={(e) => { setDataFimFiltro(e.target.value); setPaginaAtual(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700"
            />
          </div>

          <div className="flex items-center gap-3">
            <span>Exibindo <b>{filtrados.length}</b> de <b>{observacoes.length}</b> observações</span>
            {(buscaTexto || filtroCategoria !== "todas" || filtroAutor !== "todos" || filtroMatricula !== "todas" || dataInicioFiltro || dataFimFiltro) && (
              <button
                onClick={() => {
                  setBuscaTexto("");
                  setFiltroCategoria("todas");
                  setFiltroAutor("todos");
                  setFiltroMatricula("todas");
                  setDataInicioFiltro("");
                  setDataFimFiltro("");
                  setPaginaAtual(1);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer text-xs"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LISTAGEM DE OBSERVAÇÕES EM CARDS ESTRUTURADOS */}
      {observacoesPaginadas.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center text-slate-400">
          <MessageSquareText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhuma observação encontrada</h3>
          <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca ou cadastre a primeira anotação.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono px-1">
            <span>Observações encontradas: <strong className="text-slate-800">{filtrados.length}</strong></span>
            <span className="text-[11px] text-slate-400">Área rolável (máx. 580px)</span>
          </div>
          <div className="max-h-[580px] overflow-y-auto pr-1.5 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
          {observacoesPaginadas.map((obs) => {
            const col = colaboradoresMap.get(obs.matricula);

            return (
              <div
                key={obs.id}
                className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
              >
                {/* TOPO: COLABORADOR E CATEGORIA */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <button
                        onClick={() => abrirHistoricoColaborador(obs.matricula)}
                        className="text-left font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors flex items-center gap-1 group cursor-pointer"
                        title="Clique para ver o histórico completo deste colaborador"
                      >
                        <span>{col?.nomeCompleto || obs.nomeColaborador}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                      </button>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        <span>MAT: {obs.matricula}</span>
                        <span>•</span>
                        <span>{col?.funcao || obs.funcao || "-"}</span>
                        <span>•</span>
                        <span>{col?.projetoAtual || obs.projeto || "-"}</span>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border whitespace-nowrap ${badgeCategoria(obs.categoriaConfirmada)}`}>
                      {obs.categoriaConfirmada}
                    </span>
                  </div>

                  {/* CONTEÚDO INTEGRAL */}
                  <div className="mt-3 p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                    {obs.conteudo}
                  </div>
                </div>

                {/* RODAPÉ: AUTOR, DATA E AÇÕES */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="font-semibold text-slate-700">{obs.autor}</span>
                    <span>•</span>
                    <span>{new Date(obs.dataHora).toLocaleString("pt-BR")}</span>
                    {obs.historicoAlteracoes && obs.historicoAlteracoes.length > 1 && (
                      <span className="text-amber-600 text-[9px] font-sans font-medium" title="Observação editada">
                        (editada)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => abrirEdicao(obs)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          title="Editar observação"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExcluir(obs)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                          title="Excluir observação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            </div>
          </div>
        </div>
      )}

      {/* PAGINAÇÃO */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-xl px-4 py-3 text-xs">
          <span className="text-slate-500">
            Página <b>{paginaAtual}</b> de <b>{totalPaginas}</b>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded text-slate-700 font-semibold cursor-pointer"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded text-slate-700 font-semibold cursor-pointer"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* MODAL: NOVA OBSERVAÇÃO */}
      {modalNovaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Nova Observação Inteligente</h3>
                <p className="text-[11px] text-slate-500">Classificação contextual em tempo real e preservação de histórico.</p>
              </div>
              <button
                onClick={() => setModalNovaAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNova} className="p-4 space-y-4 text-xs font-sans">
              {erroForm && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{erroForm}</span>
                </div>
              )}

              {/* COLABORADOR */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Colaborador*
                </label>
                <select
                  required
                  value={formMatricula}
                  onChange={(e) => setFormMatricula(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Selecione o colaborador...</option>
                  {colaboradores
                    .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto))
                    .map((c) => (
                      <option key={c.matricula} value={c.matricula}>
                        {c.nomeCompleto} ({c.matricula}) — {c.funcao}
                      </option>
                    ))}
                </select>
              </div>

              {/* CONTEÚDO INTEGRAL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-700">
                    Conteúdo da Observação*
                  </label>
                  <span className="text-[10px] text-slate-400">{formConteudo.length} caracteres</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formConteudo}
                  onChange={(e) => handleConteudoChange(e.target.value)}
                  placeholder="Escreva a observação completa. O sistema sugere a categoria automaticamente à medida que você digita..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* CATEGORIA GERADA AUTOMATICAMENTE */}
              <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    <span>Categoria Gerada Automaticamente:</span>
                  </div>
                  {termoMatch && (
                    <span className="text-[10px] text-indigo-700 font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                      termo: "{termoMatch}"
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${badgeCategoria(formCategoriaConfirmada)}`}>
                    {formCategoriaConfirmada}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    (definida em tempo real pelo que você escreveu)
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase font-bold text-slate-700 mb-1">
                    Caso deseje, altere a categoria manualmente:
                  </label>
                  <select
                    value={formCategoriaConfirmada}
                    onChange={(e) => setFormCategoriaConfirmada(e.target.value as CategoriaObservacao)}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-indigo-600"
                  >
                    {TODAS_CATEGORIAS_OBSERVACAO.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* AUTOR */}
              <div className="text-[11px] text-slate-500 font-mono">
                Registrado por: <b>{currentUser?.username || "Sistema"}</b> • Fuso: America/Sao_Paulo (UTC-3)
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovaAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Observação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR OBSERVAÇÃO */}
      {modalEditarAberto && obsEmEdicao && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Editar Observação</h3>
                <p className="text-[11px] text-slate-500">
                  {obsEmEdicao.nomeColaborador} • Matrícula: {obsEmEdicao.matricula}
                </p>
              </div>
              <button
                onClick={() => setModalEditarAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicao} className="p-4 space-y-4 text-xs font-sans">
              {erroEdit && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{erroEdit}</span>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Conteúdo da Observação*
                </label>
                <textarea
                  required
                  rows={4}
                  value={editConteudo}
                  onChange={(e) => setEditConteudo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Categoria Confirmada*
                </label>
                <select
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value as CategoriaObservacao)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  {TODAS_CATEGORIAS_OBSERVACAO.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono font-bold uppercase text-slate-700 mb-1">
                  Motivo da Alteração (para auditoria)
                </label>
                <input
                  type="text"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  placeholder="Ex: Correção de informação ou atualização de status..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarAberto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs disabled:opacity-50"
                >
                  {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO COMPLETO DO COLABORADOR */}
      {modalHistoricoAberto && colaboradorHistorico && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Linha do Tempo de Observações
                </h3>
                <p className="text-[11px] text-slate-500">
                  {colaboradorHistorico.nomeCompleto} • Matrícula: {colaboradorHistorico.matricula} • {colaboradorHistorico.funcao}
                </p>
              </div>
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 space-y-4 overflow-y-auto max-h-[65vh] custom-scrollbar">
              {observacoes
                .filter((o) => o.matricula === colaboradorHistorico.matricula)
                .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
                .map((obs) => (
                  <div key={obs.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeCategoria(obs.categoriaConfirmada)}`}>
                        {obs.categoriaConfirmada}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(obs.dataHora).toLocaleString("pt-BR")} • por {obs.autor}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => abrirEdicao(obs)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              title="Editar observação"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleExcluir(obs)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Excluir observação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                      {obs.conteudo}
                    </p>

                    {obs.historicoAlteracoes && obs.historicoAlteracoes.length > 1 && (
                      <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 font-mono space-y-1">
                        <span className="font-bold uppercase text-[9px] text-slate-400">Trilha de Auditoria:</span>
                        {obs.historicoAlteracoes.map((h, i) => (
                          <div key={i} className="text-[9px]">
                            • {new Date(h.dataHora).toLocaleString("pt-BR")} ({h.autor}): {h.alteracao}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

              {observacoes.filter((o) => o.matricula === colaboradorHistorico.matricula).length === 0 && (
                <p className="text-center text-slate-400 py-8 text-xs">
                  Nenhuma observação registrada para este colaborador.
                </p>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {isAdmin && (
                <button
                  onClick={() => {
                    setModalHistoricoAberto(false);
                    abrirModalNovo(colaboradorHistorico.matricula);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar Observação</span>
                </button>
              )}
              <button
                onClick={() => setModalHistoricoAberto(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded text-xs cursor-pointer ml-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR EXCLUSÃO DE OBSERVAÇÃO */}
      {obsParaExcluir && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Excluir Observação</h4>
                <p className="text-xs text-slate-500">
                  Tem certeza que deseja remover esta observação de <b>{obsParaExcluir.nomeColaborador}</b>?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 italic max-h-32 overflow-y-auto leading-relaxed">
              "{obsParaExcluir.conteudo}"
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setObsParaExcluir(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
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
