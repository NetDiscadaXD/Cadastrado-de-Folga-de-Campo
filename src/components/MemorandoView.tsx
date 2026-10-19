import React, { useState, useMemo, useEffect } from "react";
import { 
  FileText, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  X, 
  FileSpreadsheet, 
  Printer, 
  Clock, 
  UserPlus,
  AlertCircle,
  FileCheck2,
  ListFilter,
  CheckSquare,
  Square,
  Paperclip,
  Download,
  MapPin,
  Calendar,
  Navigation,
  Edit,
  Cloud
} from "lucide-react";
import { Colaborador, Memorando } from "../types";
import { formatBrDate } from "../utils/date";
import * as XLSX from "xlsx";
import { getOrCreateFolderHierarchy, uploadExcelToGDriveAsSheets, uploadFileToDrive } from "../lib/googleAuth";
import { getDirectDriveImageURL } from "../utils/drive";

interface MemorandoViewProps {
  colaboradores: Colaborador[];
  memorandos: Memorando[];
  onAddMemorando: (novo: Memorando) => Promise<void>;
  onUpdateMemorando: (id: string, updates: Partial<Memorando>) => Promise<void>;
  onDeleteMemorando: (id: string) => Promise<void>;
  onPrint?: () => void;
  googleToken?: string | null;
  isAdmin?: boolean;
}

export default function MemorandoView({
  colaboradores,
  memorandos,
  onAddMemorando,
  onUpdateMemorando,
  onDeleteMemorando,
  onPrint,
  googleToken,
  isAdmin = true
}: MemorandoViewProps) {
  
  // Controle de Abas Locais (Listar vs Criar Novo ou Editar)
  const [localTab, setLocalTab] = useState<"list" | "create">("list");

  // Controle de Edição de Memorando
  const [editingId, setEditingId] = useState<string | null>(null);

  // Memorando selecionado para exibição do modelo oficial profissional
  const [viewingMemo, setViewingMemo] = useState<Memorando | null>(null);

  // Helper de formatação de data por extenso
  const getExtensoDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length < 3) return dateStr;
      const year = parts[0];
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      return `${day} de ${months[monthIndex]} de ${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Filtros e Pesquisas – Por padrão, a página inicial do Histórico mostra os Pendentes
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("pendentes"); // todos, finalizados, pendentes

  // Google Drive Sync States & Effects
  const [gdriveSheetLink, setGdriveSheetLink] = useState<string>(() => sessionStorage.getItem("gdrive_sheet_link_memorando") || "");
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  // Form de Cadastro Principal
  const [selectedMatricula, setSelectedMatricula] = useState<string>("");
  const [manualNome, setManualNome] = useState<string>("");
  const [tipoMemorando, setTipoMemorando] = useState<"Folga de campo" | "Venda de Folga">("Folga de campo");
  
  // Check-ins para Folga de Campo
  const [passagemOk, setPassagemOk] = useState(false);
  const [adiantamentoOk, setAdiantamentoOk] = useState(false);
  const [envioSedeOk, setEnvioSedeOk] = useState(false);
  
  // Check-ins para Venda de Folga
  const [arquivoGeradoOk, setArquivoGeradoOk] = useState(false);
  const [anexadoFolhaOk, setAnexadoFolhaOk] = useState(false);

  // Status Geral
  const [finalizada, setFinalizada] = useState(false);
  
  // Data de Criação e Observação
  const [dataCriacao, setDataCriacao] = useState(() => new Date().toISOString().split("T")[0]);
  const [observacao, setObservacao] = useState("");

  // Informações para Folga de Campo
  const [dataSaida, setDataSaida] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [retornoTrabalho, setRetornoTrabalho] = useState("");
  const [destino, setDestino] = useState("");
  const [tipoPassagem, setTipoPassagem] = useState<"Terrestre" | "Aérea" | "Carro" | "">("");

  // Anexo de Documento
  const [anexoNome, setAnexoNome] = useState("");
  const [anexoConteudo, setAnexoConteudo] = useState("");
  const [isUploadingDrive, setIsUploadingDrive] = useState(false);

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Controle de Confirmação de Deleção de Memorando (Evitar bloqueio iframe sandbox)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; nomeColaborador: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await onDeleteMemorando(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      alert("Erro ao excluir o memorando.");
    }
  };

  // Colaboradores Ativos para listagem
  const colaboradoresAtivos = useMemo(() => {
    return colaboradores.filter(c => c.status !== "Inativo");
  }, [colaboradores]);

  // Preencher nome de colaborador se selecionar matrícula
  const handleSelectColaborador = (matricula: string) => {
    setSelectedMatricula(matricula);
    if (matricula === "manual") {
      setManualNome("");
    } else {
      const col = colaboradores.find(c => c.matricula === matricula);
      if (col) {
        setManualNome(col.nomeCompleto);
      }
    }
  };

  // Convert uploaded file to base64 or upload to Google Drive if active
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (googleToken) {
        setIsUploadingDrive(true);
        try {
          const folders = await getOrCreateFolderHierarchy(googleToken);
          const extension = file.name.split('.').pop() || "pdf";
          const datePart = dataCriacao ? dataCriacao.split('-').reverse().join('-') : new Date().toISOString().split('T')[0].split('-').reverse().join('-');
          const renamedFilename = `${manualNome.trim() || 'Colaborador'} - ${datePart}.${extension}`;
          const renamedFile = new File([file], renamedFilename, { type: file.type });
          const result = await uploadFileToDrive(googleToken, renamedFile, folders.memorandoId);
          setAnexoNome(renamedFilename);
          setAnexoConteudo(result.webViewLink);
        } catch (err: any) {
          console.error("Erro ao enviar para Google Drive, utilizando fallback offline:", err);
          alert("Ocorreu um erro ao salvar no Google Drive: " + (err.message || "") + ". O arquivo será mantido em modo de contingência offline.");
          // Fallback para Base64 local
          const reader = new FileReader();
          reader.onload = (event) => {
            setAnexoNome(file.name);
            setAnexoConteudo(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        } finally {
          setIsUploadingDrive(false);
        }
      } else {
        if (file.size > 8 * 1024 * 1024) { // Limite razoável de 8MB para base64
          alert("O arquivo selecionado é muito grande. Conecte o Google Drive para armazená-lo em nuvem de tamanho irrestrito ou escolha um arquivo offline de até 8MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          setAnexoNome(file.name);
          setAnexoConteudo(event.target?.result as string);
        };
        reader.onerror = () => {
          alert("Erro ao ler o arquivo selecionado.");
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Limpar formulário e estados de edição
  const clearForm = () => {
    setEditingId(null);
    setSelectedMatricula("");
    setManualNome("");
    setTipoMemorando("Folga de campo");
    setPassagemOk(false);
    setAdiantamentoOk(false);
    setEnvioSedeOk(false);
    setArquivoGeradoOk(false);
    setAnexadoFolhaOk(false);
    setFinalizada(false);
    setDataCriacao(new Date().toISOString().split("T")[0]);
    setObservacao("");

    setDataSaida("");
    setDataRetorno("");
    setRetornoTrabalho("");
    setDestino("");
    setTipoPassagem("");

    setAnexoNome("");
    setAnexoConteudo("");
    setFormError("");
  };

  // Carregar dados para edição de memorando
  const handleEditClick = (m: Memorando) => {
    setEditingId(m.id);
    
    // Deixar preenchido
    if (m.matricula.startsWith("MAN-")) {
      setSelectedMatricula("manual");
    } else {
      setSelectedMatricula(m.matricula);
    }
    
    setManualNome(m.nomeColaborador);
    setTipoMemorando(m.tipoMemorando);
    setPassagemOk(m.passagemOk);
    setAdiantamentoOk(m.adiantamentoOk);
    setEnvioSedeOk(m.envioSedeOk);
    setArquivoGeradoOk(m.arquivoGeradoOk || false);
    setAnexadoFolhaOk(m.anexadoFolhaOk || false);
    setFinalizada(m.finalizada);
    setDataCriacao(m.dataCriacao);
    setObservacao(m.observacao || "");

    setDataSaida(m.dataSaida || "");
    setDataRetorno(m.dataRetorno || "");
    setRetornoTrabalho(m.retornoTrabalho || "");
    setDestino(m.destino || "");
    setTipoPassagem(m.tipoPassagem || "");

    setAnexoNome(m.anexoNome || "");
    setAnexoConteudo(m.anexoConteudo || "");

    setFormError("");
    setLocalTab("create");
  };

  // Submit do formulário (Suporta Criar Novo e Alterar de Forma Integrada)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedMatricula) {
      setFormError("Selecione um colaborador ou escolha a inserção manual.");
      return;
    }

    const finalNome = selectedMatricula === "manual" ? manualNome.trim() : manualNome;
    if (!finalNome) {
      setFormError("Informe o nome do colaborador.");
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toLocaleString("pt-BR");
      const originalMemo = editingId ? memorandos.find(m => m.id === editingId) : null;

      const getTimestampValue = (
        fieldActive: boolean, 
        originalActive: boolean | undefined, 
        originalTimestamp: string | undefined
      ) => {
        if (fieldActive) {
          return originalActive ? originalTimestamp || timestamp : timestamp;
        }
        return undefined;
      };

      const finalMatricula = selectedMatricula === "manual"
        ? (editingId && originalMemo?.matricula.startsWith("MAN-") ? originalMemo.matricula : `MAN-${Date.now().toString().slice(-4)}`)
        : selectedMatricula;

      const computedMemo: Memorando = {
        id: editingId ? editingId : "M-" + Date.now(),
        matricula: finalMatricula,
        nomeColaborador: finalNome,
        tipoMemorando,
        
        // Check-ins específicos dependendo do tipo com preservação de datas históricas se já marcadas
        passagemOk: tipoMemorando === "Folga de campo" ? passagemOk : false,
        passagemOkAt: tipoMemorando === "Folga de campo" 
          ? getTimestampValue(passagemOk, originalMemo?.passagemOk, originalMemo?.passagemOkAt) 
          : undefined,
        adiantamentoOk: tipoMemorando === "Folga de campo" ? adiantamentoOk : false,
        adiantamentoOkAt: tipoMemorando === "Folga de campo" 
          ? getTimestampValue(adiantamentoOk, originalMemo?.adiantamentoOk, originalMemo?.adiantamentoOkAt) 
          : undefined,
        envioSedeOk: tipoMemorando === "Folga de campo" ? envioSedeOk : false,
        envioSedeOkAt: tipoMemorando === "Folga de campo" 
          ? getTimestampValue(envioSedeOk, originalMemo?.envioSedeOk, originalMemo?.envioSedeOkAt) 
          : undefined,

        arquivoGeradoOk: tipoMemorando === "Venda de Folga" ? arquivoGeradoOk : false,
        arquivoGeradoAt: tipoMemorando === "Venda de Folga" 
          ? getTimestampValue(arquivoGeradoOk, originalMemo?.arquivoGeradoOk, originalMemo?.arquivoGeradoAt) 
          : undefined,
        anexadoFolhaOk: tipoMemorando === "Venda de Folga" ? anexadoFolhaOk : false,
        anexadoFolhaAt: tipoMemorando === "Venda de Folga" 
          ? getTimestampValue(anexadoFolhaOk, originalMemo?.anexadoFolhaOk, originalMemo?.anexadoFolhaAt) 
          : undefined,

        finalizada,
        finalizadaAt: getTimestampValue(finalizada, originalMemo?.finalizada, originalMemo?.finalizadaAt),
        dataCriacao,
        observacao: observacao.trim(),

        // Extra dados de folga de campo
        dataSaida: tipoMemorando === "Folga de campo" ? dataSaida : undefined,
        dataRetorno: tipoMemorando === "Folga de campo" ? dataRetorno : undefined,
        retornoTrabalho: tipoMemorando === "Folga de campo" ? retornoTrabalho : undefined,
        destino: tipoMemorando === "Folga de campo" ? destino : undefined,
        tipoPassagem: tipoMemorando === "Folga de campo" ? (tipoPassagem || undefined) : undefined,

        // Anexo de documento 
        anexoNome: anexoNome ? anexoNome : undefined,
        anexoConteudo: anexoConteudo ? anexoConteudo : undefined,
      };

      if (editingId) {
        await onUpdateMemorando(editingId, computedMemo);
      } else {
        await onAddMemorando(computedMemo);
      }
      
      // Limpar form e voltar
      clearForm();
      setLocalTab("list");
    } catch (err: any) {
      setFormError(err.message || "Erro ao salvar memorando.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Alterar check-ins rápidos direto na lista/grid com inclusão de data e hora
  const handleToggleCheckin = async (
    id: string, 
    field: "passagemOk" | "adiantamentoOk" | "envioSedeOk" | "finalizada" | "arquivoGeradoOk" | "anexadoFolhaOk", 
    value: boolean
  ) => {
    if (!isAdmin) return;
    try {
      const getTimestampField = (f: string) => {
        switch (f) {
          case "passagemOk": return "passagemOkAt";
          case "adiantamentoOk": return "adiantamentoOkAt";
          case "envioSedeOk": return "envioSedeOkAt";
          case "finalizada": return "finalizadaAt";
          case "arquivoGeradoOk": return "arquivoGeradoAt";
          case "anexadoFolhaOk": return "anexadoFolhaAt";
          default: return "";
        }
      };
      
      const timestampField = getTimestampField(field);
      const updates: any = { [field]: value };
      if (timestampField) {
        updates[timestampField] = value ? new Date().toLocaleString("pt-BR") : "";
      }
      
      await onUpdateMemorando(id, updates);
    } catch (err) {
      console.error("Erro ao atualizar checkin do memorando:", err);
    }
  };

  // Filtros aplicados na listagem de Mémorandos
  const filteredMemorandos = useMemo(() => {
    return memorandos
      .filter(m => {
        // Busca
        const s = searchTerm.toLowerCase();
        const matchesSearch = 
          m.nomeColaborador.toLowerCase().includes(s) || 
          m.matricula.toLowerCase().includes(s) ||
          m.tipoMemorando.toLowerCase().includes(s) ||
          (m.observacao || "").toLowerCase().includes(s) ||
          (m.destino || "").toLowerCase().includes(s);

        // Tipo
        const matchesTipo = 
          filterTipo === "todos" || 
          m.tipoMemorando === filterTipo;

        // Status (finalizado vs pendente)
        let matchesStatus = true;
        if (filterStatus === "finalizados") {
          matchesStatus = m.finalizada === true;
        } else if (filterStatus === "pendentes") {
          matchesStatus = m.finalizada === false;
        }

        return matchesSearch && matchesTipo && matchesStatus;
      })
      .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
  }, [memorandos, searchTerm, filterTipo, filterStatus]);

  const syncMemorandoToDrive = async (token: string, list: any[]) => {
    setIsSyncingDrive(true);
    try {
      const folders = await getOrCreateFolderHierarchy(token);
      const dataToExport = list.map(m => {
        const isFolga = m.tipoMemorando === "Folga de campo";
        return {
          "Matrícula": m.matricula,
          "Colaborador": m.nomeColaborador,
          "Tipo de Memorando": m.tipoMemorando,
          "Data de Lançamento": formatBrDate(m.dataCriacao),
          
          // Dados específicos de folga de campo
          "Data de Saída": m.dataSaida ? formatBrDate(m.dataSaida) : "-",
          "Data de Retorno": m.dataRetorno ? formatBrDate(m.dataRetorno) : "-",
          "Retorno ao Trabalho": m.retornoTrabalho ? formatBrDate(m.retornoTrabalho) : "-",
          "Destino": m.destino || "-",
          "Tipo de Passagem": m.tipoPassagem || "-",

          // Checkins específicos para Folga
          "Passagem OK": isFolga ? (m.passagemOk ? `SIM (${m.passagemOkAt || ""})` : "NÃO") : "N/A",
          "Adiantamento": isFolga ? (m.adiantamentoOk ? `SIM (${m.adiantamentoOkAt || ""})` : "NÃO") : "N/A",
          "Envio Sede": isFolga ? (m.envioSedeOk ? `SIM (${m.envioSedeOkAt || ""})` : "NÃO") : "N/A",

          // Checkins específicos para Venda
          "Gerado o arquivo": !isFolga ? (m.arquivoGeradoOk ? `SIM (${m.arquivoGeradoAt || ""})` : "NÃO") : "N/A",
          "Anexado Folha Pagamento": !isFolga ? (m.anexadoFolhaOk ? `SIM (${m.anexadoFolhaAt || ""})` : "NÃO") : "N/A",

          "Status": m.finalizada ? `FINALIZADA (${m.finalizadaAt || ""})` : "PENDENTE",
          "Documento Anexo": m.anexoNome || "NÃO",
          "Observações": m.observacao || "-"
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Memorandos");
      
      const fileName = "04. Memorando";
      const result = await uploadExcelToGDriveAsSheets(token, folders.memorandoId, fileName, workbook);
      setGdriveSheetLink(result.webViewLink);
      sessionStorage.setItem("gdrive_sheet_link_memorando", result.webViewLink);
    } catch (err) {
      console.error("Erro ao sincronizar Memorando com Google Drive:", err);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  useEffect(() => {
    if (googleToken && filteredMemorandos.length > 0) {
      syncMemorandoToDrive(googleToken, filteredMemorandos);
    }
  }, [googleToken, filteredMemorandos]);

  // Exportar Excel de Memorandos
  const handleExportExcel = () => {
    const dataToExport = filteredMemorandos.map(m => {
      const isFolga = m.tipoMemorando === "Folga de campo";
      return {
        "Matrícula": m.matricula,
        "Colaborador": m.nomeColaborador,
        "Tipo de Memorando": m.tipoMemorando,
        "Data de Lançamento": formatBrDate(m.dataCriacao),
        
        // Dados específicos de folga de campo
        "Data de Saída": m.dataSaida ? formatBrDate(m.dataSaida) : "-",
        "Data de Retorno": m.dataRetorno ? formatBrDate(m.dataRetorno) : "-",
        "Retorno ao Trabalho": m.retornoTrabalho ? formatBrDate(m.retornoTrabalho) : "-",
        "Destino": m.destino || "-",
        "Tipo de Passagem": m.tipoPassagem || "-",

        // Checkins específicos para Folga
        "Passagem OK": isFolga ? (m.passagemOk ? `SIM (${m.passagemOkAt || ""})` : "NÃO") : "N/A",
        "Adiantamento": isFolga ? (m.adiantamentoOk ? `SIM (${m.adiantamentoOkAt || ""})` : "NÃO") : "N/A",
        "Envio Sede": isFolga ? (m.envioSedeOk ? `SIM (${m.envioSedeOkAt || ""})` : "NÃO") : "N/A",

        // Checkins específicos para Venda
        "Gerado o arquivo": !isFolga ? (m.arquivoGeradoOk ? `SIM (${m.arquivoGeradoAt || ""})` : "NÃO") : "N/A",
        "Anexado Folha Pagamento": !isFolga ? (m.anexadoFolhaOk ? `SIM (${m.anexadoFolhaAt || ""})` : "NÃO") : "N/A",

        "Status": m.finalizada ? `FINALIZADA (${m.finalizadaAt || ""})` : "PENDENTE",
        "Documento Anexo": m.anexoNome || "NÃO",
        "Observações": m.observacao || "-"
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Configurar largura de colunas
    ws["!cols"] = [
      { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 18 },
      { wch: 15 }, { wch: 15 }, { wch: 45 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Memorandos");
    XLSX.writeFile(wb, `ERP_Memorandos_Emissao_Borborema_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Estatísticas rápidas de Memorandos
  const stats = useMemo(() => {
    const total = memorandos.length;
    const folgas = memorandos.filter(m => m.tipoMemorando === "Folga de campo").length;
    const vendas = memorandos.filter(m => m.tipoMemorando === "Venda de Folga").length;
    const finalizadasCount = memorandos.filter(m => m.finalizada).length;
    const pendentesCount = total - finalizadasCount;

    return { total, folgas, vendas, finalizadasCount, pendentesCount };
  }, [memorandos]);

  return (
    <div className="space-y-6">
      
      {/* CARD DE RESUMO DE INDICADORES (ESTILO SLATE NEUTRAL) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="bg-white border-2 border-[#141414] p-4 flex flex-col justify-between shadow-[4px_4px_0px_0px_#141414]/10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">Memos Gerais</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-sans font-black text-slate-900">{stats.total}</span>
            <span className="text-[10px] font-mono text-slate-400">registros</span>
          </div>
        </div>

        <div className="bg-white border-2 border-[#141414] p-4 flex flex-col justify-between shadow-[4px_4px_0px_0px_#141414]/10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-700">Folga de Campo</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-sans font-black text-indigo-900">{stats.folgas}</span>
            <span className="text-[10px] font-mono text-slate-400">memos</span>
          </div>
        </div>

        <div className="bg-white border-2 border-[#141414] p-4 flex flex-col justify-between shadow-[4px_4px_0px_0px_#141414]/10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-600">Venda de Folga</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-sans font-black text-amber-900">{stats.vendas}</span>
            <span className="text-[10px] font-mono text-slate-400">memos</span>
          </div>
        </div>

        <div className="bg-emerald-50 border-2 border-[#141414] p-4 flex flex-col justify-between shadow-[4px_4px_0px_0px_#141414]/10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700">Finalizadas</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-sans font-black text-emerald-950">{stats.finalizadasCount}</span>
            <span className="text-[10px] font-mono text-emerald-600">concluídos</span>
          </div>
        </div>

        <div className="bg-red-50 border-2 border-[#141414] p-4 flex flex-col justify-between col-span-2 md:col-span-1 shadow-[4px_4px_0px_0px_#141414]/10">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-red-600">Pendentes</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-sans font-black text-red-950">{stats.pendentesCount}</span>
            <span className="text-[10px] font-mono text-red-500">em aberto</span>
          </div>
        </div>

      </div>

      {/* CABEÇALHO DA ABA DO MEMORANDO */}
      <div className="bg-[#E4E3E0] border-4 border-[#141414] p-6 shadow-[6px_6px_0px_0px_#141414]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#141414] text-white p-2.5">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif italic font-bold text-xl leading-tight text-[#141414]">Emissão e Controle de Memorandos</h2>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/65 mt-0.5">Roteiro rápido de assinaturas, check-ins logísticos e fechamento administrativo com controle de anexo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => {
                clearForm();
                setLocalTab("list");
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase border-2 border-[#141414] transition-all cursor-pointer ${
                localTab === "list"
                  ? "bg-[#141414] text-[#E4E3E0] shadow-sm"
                  : "bg-white text-[#141414] hover:bg-neutral-100"
              }`}
            >
              Consultar Histórico
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  clearForm();
                  setLocalTab("create");
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold uppercase border-2 border-[#141414] transition-all cursor-pointer ${
                  localTab === "create" && !editingId
                    ? "bg-[#141414] text-[#E4E3E0] shadow-sm"
                    : "bg-white text-[#141414] hover:bg-neutral-100"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Memorando
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VISTA 1: FORMULÁRIO DE CADASTRO */}
      {localTab === "create" && (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-[#141414] p-6 shadow-[6px_6px_0px_0px_#141414]/15 space-y-6">
          <div className="border-b border-dashed border-[#141414]/20 pb-3 flex justify-between items-center">
            <h3 className="font-serif italic text-base font-bold text-slate-805 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-700" />
              {editingId ? "Alterar Memorando Administrativo" : "Preencher Novo Memorando Administrativo"}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">DADOS COMPLETOS</span>
          </div>

          {formError && (
            <div className="bg-red-50 border-l-4 border-red-600 text-red-900 p-3.5 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Seletor Colaborador */}
            <div className="md:col-span-6 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414]">1. Escolher Colaborador *</label>
              <select
                value={selectedMatricula}
                onChange={(e) => handleSelectColaborador(e.target.value)}
                className="w-full border-2 border-[#141414] p-2.5 font-sans text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white cursor-pointer"
              >
                <option value="">-- SELECIONE DO CADASTRO ATIVO --</option>
                {colaboradoresAtivos.map(c => (
                  <option key={c.matricula} value={c.matricula}>
                    {c.nomeCompleto} ({c.matricula}) - {c.funcao}
                  </option>
                ))}
                <option value="manual">-- REGISTRAR NOME MANUAMENTE (NÃO CADASTRADO) --</option>
              </select>
            </div>

            {/* Nome Completo se inserção manual */}
            <div className="md:col-span-6 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414]">Nome do Colaborador *</label>
              <input
                type="text"
                value={manualNome}
                disabled={selectedMatricula !== "manual" && selectedMatricula !== ""}
                onChange={(e) => setManualNome(e.target.value)}
                placeholder="Insira o nome completo do funcionário"
                className="w-full border-2 border-[#141414] p-2.5 font-sans text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:opacity-70"
              />
            </div>

            {/* Tipo de Memorando */}
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414]">2. Tipo de Memorando *</label>
              <select
                value={tipoMemorando}
                onChange={(e) => setTipoMemorando(e.target.value as "Folga de campo" | "Venda de Folga")}
                className="w-full border-2 border-[#141414] p-2.5 font-sans text-xs font-bold text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="Folga de campo">Folga de campo ✈️</option>
                <option value="Venda de Folga">Venda de Folga 💰</option>
              </select>
            </div>

            {/* Data de Emissão */}
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414]">Data de Lançamento</label>
              <input
                type="date"
                value={dataCriacao}
                onChange={(e) => setDataCriacao(e.target.value)}
                className="w-full border-2 border-[#141414] p-2.5 font-sans text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              />
            </div>

            {/* ID Gerado Auto */}
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-slate-400">Código Memorando</label>
              <div className="w-full border border-dashed border-slate-300 p-2.5 bg-slate-50 font-mono text-xs text-slate-500 rounded">
                GERADO AUTOMATICAMENTE
              </div>
            </div>

            {/* DADOS ESPECÍFICOS DE FOLGA DE CAMPO */}
            {tipoMemorando === "Folga de campo" && (
              <div className="md:col-span-12 p-5 bg-indigo-50/50 border-2 border-indigo-200 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="col-span-full border-b border-indigo-200 pb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-700" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-800">
                    Dados Adicionais do Roteiro de Folga de Campo
                  </span>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-600 block">Data de Saída</label>
                  <input
                    type="date"
                    value={dataSaida}
                    onChange={(e) => setDataSaida(e.target.value)}
                    className="w-full border border-[#141414]/30 px-3 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-600 block">Data de Retorno</label>
                  <input
                    type="date"
                    value={dataRetorno}
                    onChange={(e) => setDataRetorno(e.target.value)}
                    className="w-full border border-[#141414]/30 px-3 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-600 block">Retorno ao Trabalho</label>
                  <input
                    type="date"
                    value={retornoTrabalho}
                    onChange={(e) => setRetornoTrabalho(e.target.value)}
                    className="w-full border border-[#141414]/30 px-3 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-600 block">Destino</label>
                  <input
                    type="text"
                    placeholder="Cidade / Sede"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className="w-full border border-[#141414]/30 px-3 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-600 block">Tipo Passagem</label>
                  <select
                    value={tipoPassagem}
                    onChange={(e) => setTipoPassagem(e.target.value as any)}
                    className="w-full border border-[#141414]/30 px-3 py-2 font-sans text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-705 font-medium"
                  >
                    <option value="">Selecione...</option>
                    <option value="Terrestre">🚌 Terrestre</option>
                    <option value="Aérea">✈️ Aérea</option>
                    <option value="Carro">🚗 Carro</option>
                  </select>
                </div>
              </div>
            )}

            {/* BOX DE ANEXAR DOCUMENTO */}
            <div className="md:col-span-12 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414] flex items-center justify-between">
                <span>3. Anexar Documento / Comprovante Oficial</span>
                {googleToken && (
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981] inline-block animate-pulse"></span>
                    Google Drive Conectado
                  </span>
                )}
              </label>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 border-2 border-dashed border-[#141414]/30 p-4 rounded-lg">
                <input
                  type="file"
                  id="memorando-form-attachment"
                  onChange={handleFileChange}
                  disabled={isUploadingDrive}
                  className="hidden"
                />
                
                <label
                  htmlFor={isUploadingDrive ? undefined : "memorando-form-attachment"}
                  className={`px-4 py-2 border-2 border-[#141414] bg-white text-[#141414] ${isUploadingDrive ? "opacity-55 cursor-not-allowed" : "hover:bg-neutral-100 cursor-pointer"} text-xs font-mono font-bold uppercase tracking-wider cursor-pointer transition-colors inline-flex items-center gap-2 justify-center`}
                >
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  Selecionar Documento
                </label>

                {isUploadingDrive ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-indigo-700 animate-pulse">
                    <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>Salvando anexo na sua nuvem Google Drive...</span>
                  </div>
                ) : anexoNome ? (
                  <div className="flex items-center gap-2 text-xs font-mono bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded text-indigo-900">
                    <span className="truncate max-w-[200px]" title={anexoNome}>📄 {anexoNome}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAnexoNome("");
                        setAnexoConteudo("");
                      }}
                      className="text-red-500 hover:text-red-700 font-bold hover:underline transition-colors ml-1"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-mono text-slate-400">
                    {googleToken 
                      ? "Nenhum documento anexado (será salvo automaticamente no Google Drive ao selecionar)" 
                      : "Nenhum comprovante/documento anexado (opcional, salvo offline)"}
                  </span>
                )}
              </div>
            </div>

            {/* BOX DE CHECK-INS REQUISITADOS */}
            <div className="md:col-span-12">
              <div className="bg-slate-50 border-2 border-[#141414]/30 p-4 rounded-lg">
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#141414] mb-3">
                  4. Etapas e Validações (Check-Ins de Status com Data/Hora)
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* SE FOR FOLGA DE CAMPO */}
                  {tipoMemorando === "Folga de campo" && (
                    <>
                      {/* Passagem OK */}
                      <label className="flex items-center gap-3 bg-white border border-[#141414]/20 p-3 rounded hover:border-[#141414] transition-colors cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={passagemOk}
                          onChange={(e) => setPassagemOk(e.target.checked)}
                          className="w-4.5 h-4.5 text-[#141414] border-[#141414] focus:ring-indigo-500 rounded cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold block text-slate-900">Passagem OK</span>
                          <span className="text-[9px] font-mono text-slate-500 block">Bilhete emitido</span>
                        </div>
                      </label>

                      {/* Adiantamento */}
                      <label className="flex items-center gap-3 bg-white border border-[#141414]/20 p-3 rounded hover:border-[#141414] transition-colors cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={adiantamentoOk}
                          onChange={(e) => setAdiantamentoOk(e.target.checked)}
                          className="w-4.5 h-4.5 text-[#141414] border-[#141414] focus:ring-indigo-500 rounded cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold block text-slate-900">Adiantamento</span>
                          <span className="text-[9px] font-mono text-slate-500 block">Depósito em conta</span>
                        </div>
                      </label>

                      {/* Envio Sede */}
                      <label className="flex items-center gap-3 bg-white border border-[#141414]/20 p-3 rounded hover:border-[#141414] transition-colors cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={envioSedeOk}
                          onChange={(e) => setEnvioSedeOk(e.target.checked)}
                          className="w-4.5 h-4.5 text-[#141414] border-[#141414] focus:ring-indigo-500 rounded cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold block text-slate-900">Envio Sede</span>
                          <span className="text-[9px] font-mono text-slate-500 block">Assinatura enviada</span>
                        </div>
                      </label>
                    </>
                  )}

                  {/* SE FOR VENDA DE FOLGA */}
                  {tipoMemorando === "Venda de Folga" && (
                    <>
                      {/* Gerado o arquivo */}
                      <label className="flex items-center gap-3 bg-white border border-[#141414]/20 p-3 rounded hover:border-[#141414] transition-colors cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={arquivoGeradoOk}
                          onChange={(e) => setArquivoGeradoOk(e.target.checked)}
                          className="w-4.5 h-4.5 text-[#141414] border-[#141414] focus:ring-indigo-500 rounded cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold block text-slate-900">Gerado o arquivo</span>
                          <span className="text-[9px] font-mono text-slate-500 block">Arquivo exportado</span>
                        </div>
                      </label>

                      {/* Anexado na folha de pagamento */}
                      <label className="flex items-center gap-3 bg-white border border-[#141414]/20 p-3 rounded hover:border-[#141414] transition-colors cursor-pointer select-none col-span-1 sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={anexadoFolhaOk}
                          onChange={(e) => setAnexadoFolhaOk(e.target.checked)}
                          className="w-4.5 h-4.5 text-[#141414] border-[#141414] focus:ring-indigo-500 rounded cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold block text-slate-900">Anexado na folha de pagamento</span>
                          <span className="text-[9px] font-mono text-slate-500 block">Carga do desconto/reembolso efetuada</span>
                        </div>
                      </label>
                    </>
                  )}

                  {/* Finalizada (comum para ambos) */}
                  <label className="flex items-center gap-3 bg-indigo-50/70 border border-indigo-200 p-3 rounded hover:border-indigo-400 transition-colors cursor-pointer select-none col-span-full">
                    <input
                      type="checkbox"
                      checked={finalizada}
                      onChange={(e) => setFinalizada(e.target.checked)}
                      className="w-4.5 h-4.5 text-indigo-650 border-indigo-400 focus:ring-indigo-550 rounded cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold block text-indigo-900">Finalizar Memorando 🏁</span>
                      <span className="text-[9px] font-mono text-indigo-600 block font-semibold">Garante o fechamento administrativo da etapa operacional</span>
                    </div>
                  </label>

                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="md:col-span-12 space-y-2">
              <label className="text-[10px] font-mono font-bold uppercase tracking-tight text-[#141414]">5. Observações / Anotações Gerais</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Insira detalhes adicionais sobre o roteiro de viagem, voos ou as particularidades da venda de folgas."
                rows={3}
                className="w-full border-2 border-[#141414] p-2.5 font-sans text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#141414]/10">
            <button
              type="button"
              onClick={() => {
                clearForm();
                setLocalTab("list");
              }}
              className="px-5 py-2.5 border-2 border-[#141414] bg-white hover:bg-slate-100 text-[#141414] text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] hover:text-white border-2 border-[#141414] text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:bg-neutral-400 disabled:border-neutral-400"
            >
              {isSubmitting ? "Gravando no SGBD..." : editingId ? "Salvar Alterações" : "Emitir Memorando"}
            </button>
          </div>

        </form>
      )}

      {/* VISTA 2: CONSULTA / LISTAGEM INTERATIVA */}
      {localTab === "list" && (
        <div className="space-y-6">
          
          {/* BARRA DE FILTROS */}
          <div className="bg-white border-2 border-[#141414] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_#141414]/10">
            
            <div className="flex-1 max-w-md relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Buscar por colaborador, matrícula, destino ou observação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-2 border-[#141414] pl-9 pr-3 py-2 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              
              {/* Filtro Tipo */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold uppercase text-[#141414]">Tipo:</span>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="border-2 border-[#141414] px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-neutral-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="todos">Todos Memos</option>
                  <option value="Folga de campo">Folga de campo</option>
                  <option value="Venda de Folga">Venda de Folga</option>
                </select>
              </div>

              {/* Exportar Planilha */}
              {isAdmin && (
                <>
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 border-2 border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] bg-white text-[#141414] text-xs font-mono font-bold uppercase px-3 py-1.5 transition-colors cursor-pointer"
                    title="Exportar Planilha Completa de Memorandos"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Exportar Excel</span>
                  </button>

                  {googleToken && (
                    <a
                      href={gdriveSheetLink || undefined}
                      target="_blank"
                      rel="noreferrer"
                      title={gdriveSheetLink ? "Ver planilha de memorando no Google Drive" : "Sincronizando planilha no Google Drive..."}
                      className={`flex items-center gap-1.5 border-2 border-emerald-700 ${gdriveSheetLink ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer" : "bg-neutral-50 text-neutral-400 cursor-not-allowed"} text-xs font-mono font-bold uppercase px-3 py-1.5 transition-colors`}
                      onClick={(e) => {
                        if (!gdriveSheetLink) e.preventDefault();
                      }}
                    >
                      <Cloud className={`w-4 h-4 text-emerald-600 ${isSyncingDrive ? "animate-pulse" : ""}`} />
                      <span>{isSyncingDrive ? "Sincronizando..." : "Planilha Drive"}</span>
                    </a>
                  )}
                </>
              )}

              {/* Imprimir Tudo */}
              <button
                onClick={onPrint || (() => window.print())}
                className="flex items-center gap-1.5 border-2 border-[#141414] bg-neutral-900 hover:bg-neutral-800 text-[#E4E3E0] text-xs font-mono font-bold uppercase px-3 py-1.5 transition-colors cursor-pointer"
                title="Salvar ou Imprimir Lista de Memorandos em PDF"
              >
                <Printer className="w-4 h-4" />
                <span>Gerar PDF</span>
              </button>

            </div>

          </div>

          {/* SUB-ABAS DE FILTRAGEM (PENDENTES VS FINALIZADOS) */}
          <div className="flex border-b-2 border-neutral-200">
            <button
              onClick={() => setFilterStatus("pendentes")}
              className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider relative -mb-[2px] border-b-4 cursor-pointer transition-all ${
                filterStatus === "pendentes"
                  ? "border-indigo-600 text-indigo-700 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-350"
              }`}
            >
              Pendentes ({stats.pendentesCount})
            </button>
            <button
              onClick={() => setFilterStatus("finalizados")}
              className={`px-5 py-3 text-xs font-mono font-bold uppercase tracking-wider relative -mb-[2px] border-b-4 cursor-pointer transition-all ${
                filterStatus === "finalizados"
                  ? "border-emerald-600 text-emerald-700 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-350"
              }`}
            >
              Finalizados ({stats.finalizadasCount})
            </button>
          </div>

          {/* LISTAGEM PRINCIPAL EM PAINÉIS DE INTERAÇÃO (BENTO STYLE) */}
          {filteredMemorandos.length === 0 ? (
            <div className="bg-white border-2 border-[#141414] border-dashed p-12 text-center rounded">
              <span className="w-12 h-12 rounded-full bg-slate-150 inline-flex items-center justify-center text-slate-500 mb-3">
                <FileText className="w-6 h-6" />
              </span>
              <h3 className="font-serif italic font-bold text-base text-slate-800">Nenhum Memorando Localizado</h3>
              <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mt-1">Refine seus filtros de busca ou crie um novo memorando administrativo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMemorandos.map((m) => {
                const col = colaboradores.find(c => c.matricula === m.matricula);
                return (
                  <div 
                    key={m.id}
                    className={`bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                      m.finalizada ? "border-l-[6px] border-l-emerald-500" : "border-l-[6px] border-l-indigo-600"
                    }`}
                  >
                    
                    {/* Botões de Ação no Canto */}
                    {isAdmin && (
                      <div className="absolute right-4 top-4 flex items-center gap-1 print:hidden">
                        <button
                          onClick={() => handleEditClick(m)}
                          className="text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all p-2 rounded-full cursor-pointer"
                          title="Alterar / Editar Memorando"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: m.id, nomeColaborador: m.nomeColaborador })}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all p-2 rounded-full cursor-pointer"
                          title="Deletar Memorando"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Cabeçalho do Card */}
                    <div className="space-y-4 max-w-[90%]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-wider rounded-lg border ${
                          m.tipoMemorando === "Folga de campo"
                            ? "bg-indigo-55/60 border-indigo-100 text-indigo-700"
                            : "bg-amber-55/60 border-amber-100 text-amber-700"
                        }`}>
                          {m.tipoMemorando === "Folga de campo" ? "✈️ Folga de campo" : "💰 Venda de Folga"}
                        </span>
                        <span className="text-xs text-slate-450 font-sans flex items-center gap-1 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatBrDate(m.dataCriacao)}
                        </span>
                        {m.finalizada && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-sans font-bold uppercase tracking-wider px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Concluído
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3.5 pt-1">
                        {/* Foto do Colaborador se disponível, senão iniciais */}
                        <div className="w-12 h-12 shrink-0 rounded-full border border-slate-200/80 bg-slate-50 flex items-center justify-center overflow-hidden shadow-2xs">
                          {col?.fotoUrl ? (
                            <img 
                              src={getDirectDriveImageURL(col.fotoUrl)} 
                              alt={m.nomeColaborador} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-sm font-sans font-bold text-slate-500 uppercase">
                              {m.nomeColaborador.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <h4 className="font-sans font-bold text-base text-slate-800 tracking-tight leading-snug">{m.nomeColaborador}</h4>
                          <div className="text-[11px] font-sans font-medium text-slate-500 tracking-wide mt-0.5">
                            Matrícula: <strong className="text-slate-700 font-mono font-bold">{m.matricula}</strong> 
                            {col && (
                              <span className="text-slate-400 font-normal">
                                {" • "}{col.funcao} ({col.tipoMaoDeObra})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* DADOS ADICIONAIS EXCLUSIVOS DE FOLGA DE CAMPO */}
                    {m.tipoMemorando === "Folga de campo" && (m.dataSaida || m.dataRetorno || m.retornoTrabalho || m.destino || m.tipoPassagem) && (
                      <div className="bg-indigo-50/30 border border-indigo-100/50 p-3.5 mt-4 rounded-xl text-xs text-slate-800 space-y-2">
                        <div className="font-bold text-[10px] font-sans uppercase tracking-wider text-indigo-800 flex items-center gap-1.5 border-b border-indigo-100/50 pb-1.5 mb-1.5">
                          <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                          Roteiro de Viagem Planejado
                        </div>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] font-sans text-slate-750">
                          {m.destino && (
                            <div className="col-span-2">
                              <span className="text-slate-400 font-sans font-semibold text-[10px] uppercase">Destino:</span>{" "}
                              <strong className="text-slate-800 font-bold">{m.destino}</strong>
                            </div>
                          )}
                          {m.tipoPassagem && (
                            <div className="col-span-2">
                              <span className="text-slate-400 font-sans font-semibold text-[10px] uppercase">Transporte:</span>{" "}
                              <strong className="text-slate-700 font-serif italic text-xs">{m.tipoPassagem}</strong>
                            </div>
                          )}
                          {m.dataSaida && (
                            <div>
                              <span className="text-slate-400 font-sans font-semibold text-[10px] uppercase block">Saída</span>
                              <span className="font-semibold text-slate-700">{formatBrDate(m.dataSaida)}</span>
                            </div>
                          )}
                          {m.dataRetorno && (
                            <div>
                              <span className="text-slate-400 font-sans font-semibold text-[10px] uppercase block">Retorno</span>
                              <span className="font-semibold text-slate-700">{formatBrDate(m.dataRetorno)}</span>
                            </div>
                          )}
                          {m.retornoTrabalho && (
                            <div className="col-span-2 mt-1 pt-1.5 border-t border-dashed border-indigo-100">
                              <span className="text-slate-400 font-sans font-semibold text-[10px] uppercase">Retorno Efetivo ao Trabalho:</span>{" "}
                              <span className="font-bold text-indigo-900">{formatBrDate(m.retornoTrabalho)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* DOWNLOAD DE ANEXO SE HOUVER */}
                    {m.anexoNome && m.anexoConteudo && (
                      <div className="bg-slate-50 border border-slate-200/60 p-3 mt-4 rounded-xl flex items-center justify-between text-xs font-sans">
                        <span className="text-slate-600 truncate max-w-[70%] text-[11px] font-medium" title={m.anexoNome}>
                          📎 Anexo: {m.anexoNome}
                        </span>
                        <a
                          href={m.anexoConteudo}
                          download={m.anexoConteudo.startsWith("http") ? undefined : m.anexoNome}
                          target={m.anexoConteudo.startsWith("http") ? "_blank" : undefined}
                          rel={m.anexoConteudo.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="px-2.5 py-1 bg-white hover:bg-slate-55 text-[#141414] border border-slate-200 text-[10px] font-sans font-bold uppercase rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-3xs"
                        >
                          <Download className="w-3 h-3" />
                          {m.anexoConteudo.startsWith("http") ? "Visualizar" : "Baixar"}
                        </a>
                      </div>
                    )}

                    {/* ÁREA DE INTERAÇÃO DOS CHECK-INS (REQUISITO DA DEMANDA - CONDICIONAL CONFORME TIPO) */}
                    <div className="bg-slate-50/70 border border-slate-200/50 p-4 my-4 rounded-2xl">
                      <span className="text-[10px] font-sans uppercase text-slate-400/90 tracking-wider block mb-3 font-bold">Consolidação e Check-ins Rápidos</span>
                      
                      {m.tipoMemorando === "Folga de campo" ? (
                        /* Checkins para FOLGA DE CAMPO */
                        <div className="grid grid-cols-2 gap-2.5">
                          
                          {/* Checkin: Passagem OK */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "passagemOk", !m.passagemOk)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.passagemOk 
                                ? "bg-emerald-500/[0.08] text-emerald-900 border-emerald-300 shadow-3xs ring-1 ring-emerald-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.passagemOk ? "bg-emerald-100/50" : "bg-slate-100"}`}>
                              {m.passagemOk ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-slate-850">Passagem OK</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.passagemOkAt}>
                                {m.passagemOk && m.passagemOkAt ? m.passagemOkAt.split(" ")[0] || m.passagemOkAt : "Ficha Pendente"}
                              </span>
                            </div>
                          </button>

                          {/* Checkin: Adiantamento */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "adiantamentoOk", !m.adiantamentoOk)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.adiantamentoOk 
                                ? "bg-emerald-500/[0.08] text-emerald-900 border-emerald-300 shadow-3xs ring-1 ring-emerald-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.adiantamentoOk ? "bg-emerald-100/50" : "bg-slate-100"}`}>
                              {m.adiantamentoOk ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-slate-850">Adiantamento</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.adiantamentoOkAt}>
                                {m.adiantamentoOk && m.adiantamentoOkAt ? m.adiantamentoOkAt.split(" ")[0] || m.adiantamentoOkAt : "Pendente Depósito"}
                              </span>
                            </div>
                          </button>

                          {/* Checkin: Envio Sede */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "envioSedeOk", !m.envioSedeOk)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.envioSedeOk 
                                ? "bg-emerald-500/[0.08] text-emerald-900 border-emerald-300 shadow-3xs ring-1 ring-emerald-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.envioSedeOk ? "bg-emerald-100/50" : "bg-slate-100"}`}>
                              {m.envioSedeOk ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-slate-850">Envio Sede</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.envioSedeOkAt}>
                                {m.envioSedeOk && m.envioSedeOkAt ? m.envioSedeOkAt.split(" ")[0] || m.envioSedeOkAt : "Envio Assinatura"}
                              </span>
                            </div>
                          </button>

                          {/* Checkin: Finalizada */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "finalizada", !m.finalizada)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.finalizada 
                                ? "bg-indigo-500/[0.08] text-indigo-950 border-indigo-300 shadow-3xs ring-1 ring-indigo-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.finalizada ? "bg-indigo-100/50" : "bg-slate-100"}`}>
                              {m.finalizada ? (
                                <CheckSquare className="w-4 h-4 text-indigo-700 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-indigo-950">Finalizada 🏁</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.finalizadaAt}>
                                {m.finalizada && m.finalizadaAt ? m.finalizadaAt.split(" ")[0] || m.finalizadaAt : "Processo Aberto"}
                              </span>
                            </div>
                          </button>

                        </div>
                      ) : (
                        /* Checkins para VENDA DE FOLGA */
                        <div className="grid grid-cols-2 gap-2.5">
                          
                          {/* Checkin: Gerado o arquivo */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "arquivoGeradoOk", !m.arquivoGeradoOk)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.arquivoGeradoOk 
                                ? "bg-emerald-500/[0.08] text-emerald-900 border-emerald-300 shadow-3xs ring-1 ring-emerald-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.arquivoGeradoOk ? "bg-emerald-100/50" : "bg-slate-100"}`}>
                              {m.arquivoGeradoOk ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-slate-850">Gerado arquivo</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.arquivoGeradoAt}>
                                {m.arquivoGeradoOk && m.arquivoGeradoAt ? m.arquivoGeradoAt.split(" ")[0] || m.arquivoGeradoAt : "Pendente Carga"}
                              </span>
                            </div>
                          </button>

                          {/* Checkin: Anexado na folha de pagamento */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "anexadoFolhaOk", !m.anexadoFolhaOk)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                              m.anexadoFolhaOk 
                                ? "bg-emerald-500/[0.08] text-emerald-900 border-emerald-300 shadow-3xs ring-1 ring-emerald-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.anexadoFolhaOk ? "bg-emerald-100/50" : "bg-slate-100"}`}>
                              {m.anexadoFolhaOk ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-slate-850">Anexado folha</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.anexadoFolhaAt}>
                                {m.anexadoFolhaOk && m.anexadoFolhaAt ? m.anexadoFolhaAt.split(" ")[0] || m.anexadoFolhaAt : "Pendente Lançar"}
                              </span>
                            </div>
                          </button>

                          {/* Checkin: Finalizada (Venda) */}
                          <button
                            onClick={() => handleToggleCheckin(m.id, "finalizada", !m.finalizada)}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200 col-span-2 cursor-pointer border ${
                              m.finalizada 
                                ? "bg-indigo-500/[0.08] text-indigo-950 border-indigo-300 shadow-3xs ring-1 ring-indigo-100" 
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 shadow-3xs"
                            }`}
                          >
                            <div className={`p-1 rounded-lg transition-colors ${m.finalizada ? "bg-indigo-100/50" : "bg-slate-100"}`}>
                              {m.finalizada ? (
                                <CheckSquare className="w-4 h-4 text-indigo-700 shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <span className="text-xs font-semibold block leading-tight text-indigo-950 font-bold">Finalizada 🏁</span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5" title={m.finalizadaAt}>
                                {m.finalizada && m.finalizadaAt ? m.finalizadaAt.split(" ")[0] || m.finalizadaAt : "Processo Aberto"}
                              </span>
                            </div>
                          </button>

                        </div>
                      )}

                    </div>

                    {/* Observações */}
                    {m.observacao && (
                      <div className="text-[11px] text-slate-550 leading-relaxed bg-slate-50 border-l-2 border-slate-300 p-2.5 rounded-r font-sans italic mb-4">
                        {m.observacao}
                      </div>
                    )}

                    {/* Botão de Emissão de Documento Oficial */}
                    <button
                      type="button"
                      onClick={() => setViewingMemo(m)}
                      className="mb-4 w-full flex items-center justify-center gap-2.5 py-3 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-sans text-xs font-bold uppercase tracking-wider rounded-xl shadow-3xs cursor-pointer transition-all hover:shadow-xs"
                    >
                      <Printer className="w-4 h-4 text-emerald-400" />
                      Visualizar e Imprimir Memorando
                    </button>

                    {/* Rodapé / Barra de Progresso Rápido */}
                    <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans font-semibold text-slate-400">
                      <span>PROGRESSO LOGÍSTICO</span>
                      
                      {/* Cálculo Simples do Progresso dependendo do Tipo */}
                      {(() => {
                        const isFolga = m.tipoMemorando === "Folga de campo";
                        const items = isFolga 
                          ? [m.passagemOk, m.adiantamentoOk, m.envioSedeOk, m.finalizada]
                          : [m.arquivoGeradoOk, m.anexadoFolhaOk, m.finalizada];
                        const done = items.filter(Boolean).length;
                        const pct = Math.round((done / items.length) * 100);
                        return (
                          <div className="flex items-center gap-2.5">
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden relative">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className={`font-mono font-bold ${pct === 100 ? "text-emerald-600" : "text-indigo-600"}`}>{pct}%</span>
                          </div>
                        );
                      })()}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ESTILO DE IMPRESSÃO (ESPECIAL) / CONSOLIDADO */}
      <div className="hidden print:block font-sans p-8 space-y-6 animate-none border-t-8 border-slate-900">
        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4">
          <div>
            <h1 className="text-xl font-serif italic font-black uppercase tracking-tight text-slate-900">PROJETO BORBOREMA - FILTRAGEM</h1>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mt-1">Histórico Consolidado de Memorandos Administrativos</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono text-slate-400 font-bold uppercase">RECURSOS HUMANOS / LOGÍSTICA</p>
            <p className="text-[9px] font-mono text-slate-500">Emitido em: {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
        </div>

        <table className="w-full text-[10px] text-left border-collapse border-2 border-slate-900 font-sans">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-900 uppercase font-mono text-[9px] text-slate-700">
              <th className="p-3 border border-slate-300 font-black">Data Lanç.</th>
              <th className="p-3 border border-slate-300 font-black">Código ID</th>
              <th className="p-3 border border-slate-300 font-black">Colaborador / Beneficiário</th>
              <th className="p-3 border border-slate-300 font-black">Tipo Memorando</th>
              <th className="p-3 border border-slate-300 font-black">Roteiro / Detalhes Logísticos</th>
              <th className="p-3 border border-slate-300 font-black">Protocolo Check-ins</th>
              <th className="p-3 border border-slate-300 text-center font-black">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredMemorandos.map(m => {
              const isFolga = m.tipoMemorando === "Folga de campo";
              return (
                <tr key={m.id} className="border-b border-slate-300 hover:bg-slate-50/50 transition-colors">
                  <td className="p-2.5 border border-slate-300 font-mono text-[9px] text-slate-800 font-semibold">{formatBrDate(m.dataCriacao)}</td>
                  <td className="p-2.5 border border-slate-300 font-mono text-[9px] text-slate-500">{m.id}</td>
                  <td className="p-2.5 border border-slate-300">
                    <div className="font-bold text-slate-900 text-xs">{m.nomeColaborador}</div>
                    <div className="text-slate-400 font-mono text-[8px] uppercase mt-0.5">Matrícula: {m.matricula}</div>
                  </td>
                  <td className="p-2.5 border border-slate-300">
                    <span className={`px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase rounded border ${
                      isFolga ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}>
                      {m.tipoMemorando === "Folga de campo" ? "Folga de Campo" : "Venda de Folga"}
                    </span>
                  </td>
                  <td className="p-2.5 border border-slate-300 text-[10px] text-slate-700">
                    {isFolga ? (
                      <div className="space-y-0.5">
                        {m.destino && <div>Destino: <strong className="text-slate-900">{m.destino}</strong></div>}
                        {m.tipoPassagem && <div>Transporte: <strong>{m.tipoPassagem}</strong></div>}
                        {m.dataSaida && <div>Saída: {formatBrDate(m.dataSaida)}</div>}
                        {m.dataRetorno && <div>Retorno: {formatBrDate(m.dataRetorno)}</div>}
                        {m.retornoTrabalho && <div>Retorno efet.: <strong className="text-indigo-900">{formatBrDate(m.retornoTrabalho)}</strong></div>}
                      </div>
                    ) : (
                      <span className="text-slate-400 font-mono text-[9px] block">Apurado na folha do período de referência</span>
                    )}
                  </td>
                  <td className="p-2.5 border border-slate-300 text-[9px] font-mono whitespace-pre-line text-slate-600">
                    {isFolga ? (
                      `Passagem OK: ${m.passagemOk ? "✓ " + (m.passagemOkAt || "") : "❌"}\n` +
                      `Adiantamento: ${m.adiantamentoOk ? "✓ " + (m.adiantamentoOkAt || "") : "❌"}\n` +
                      `Envio Sede: ${m.envioSedeOk ? "✓ " + (m.envioSedeOkAt || "") : "❌"}`
                    ) : (
                      `Arquivo: ${m.arquivoGeradoOk ? "✓ " + (m.arquivoGeradoAt || "") : "❌"}\n` +
                      `Folha Pgto: ${m.anexadoFolhaOk ? "✓ " + (m.anexadoFolhaAt || "") : "❌"}`
                    )}
                  </td>
                  <td className="p-2.5 border border-slate-300 text-center text-[10px]">
                    {m.finalizada ? (
                      <div className="bg-emerald-50 border border-emerald-300 p-1 text-emerald-800 rounded">
                        <span className="block text-[8px] uppercase font-mono font-black">CONCLUÍDO</span>
                        <span className="text-slate-400 font-mono text-[7px] block font-semibold">{m.finalizadaAt}</span>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-300 p-1 text-amber-800 rounded">
                        <span className="block text-[8px] uppercase font-mono font-black">PENDENTE</span>
                        <span className="text-slate-405 font-mono text-[7px] block font-semibold">TRAMITAÇÃO</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rodapé do Relatório Impresso */}
        <div className="flex justify-between items-center text-[8px] font-mono text-slate-400 border-t border-slate-300 pt-3">
          <span>Relatório gerado automaticamente através da Consorciação de RH Borborema</span>
          <span>Página 1 de 1</span>
        </div>
      </div>

      {/* ESTILO DINÂMICO DE IMPRESÃO PARA MEMORANDO INDIVIDUAL (INJETADO SE ATIVO) */}
      {viewingMemo && (
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body > * {
              display: none !important;
            }
            body #print-modal-container, 
            body #print-modal-container * {
              display: block !important;
            }
            #print-modal-container {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
              color: black !important;
            }
            /* Garantir que fontes e tamanhos fiquem perfeitos para uma folha A4 física */
          }
        ` }} />
      )}

      {/* MODAL DE IMPRESSÃO / VISUALIZAÇÃO DO MEMORANDO INDIVIDUAL */}
      {viewingMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto print:p-0 print:bg-white print:relative print:inset-auto">
          <div 
            id="print-modal-container"
            className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-4xl w-full p-6 md:p-10 relative flex flex-col justify-between overflow-y-auto max-h-[90vh] print:max-h-none print:shadow-none print:border-0 print:p-0 print:rounded-none"
          >
            
            {/* Cabeçalho do Modal no Browser (Invisível na Impressão) */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-650" />
                <span className="font-sans text-xs font-bold uppercase tracking-wider text-slate-500">Visualização de Documento Oficial</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-850 active:bg-slate-999 text-white font-sans text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4 text-emerald-450" />
                  Imprimir / Gerar PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewingMemo(null)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-sans text-xs font-bold uppercase rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  Fechar
                </button>
              </div>
            </div>

            {/* CONTEÚDO DO DOCUMENTO (FORMATO PAPEL TIMBRADO) */}
            <div className="font-serif text-[#1e293b] space-y-6 print:p-4">
              
              {/* TIMBRE DO PROJETO - ESTILO CARTA TIMBRADA PREMIUM */}
              <div className="text-center border-b-[3px] border-slate-800 pb-4 flex flex-col items-center">
                <div className="text-emerald-600 font-semibold tracking-[0.2em] font-sans text-[10px] uppercase mb-1">
                  CONSORCIO CONSTRUTOR BORBOREMA
                </div>
                <h1 className="font-serif font-black text-2xl md:text-3xl tracking-tight text-slate-900 leading-none mb-1">
                  Borborema Logística e Infraestrutura
                </h1>
                <p className="text-[10px] font-sans font-medium tracking-widest text-slate-450 uppercase">
                  REGISTRO OPERACIONAL DE RECURSOS HUMANOS • CANTEIRO CENTRAL DE OBRAS
                </p>
                <div className="w-24 h-1 bg-emerald-500 rounded-full mt-2"></div>
              </div>

              {/* TÍTULO E NUMERAÇÃO */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-slate-200/80 pb-3">
                <div>
                  <h2 className="font-sans font-extrabold text-lg md:text-xl tracking-tight text-slate-900 uppercase leading-tight">
                    MEMORANDO INTERNO Nº {viewingMemo.id}
                  </h2>
                  <p className="text-[10px] font-sans text-indigo-700 uppercase font-bold tracking-widest mt-1">
                    ASSUNTO: REGISTRO DE {viewingMemo.tipoMemorando.toUpperCase()}
                  </p>
                </div>
                <div className="text-right text-xs font-sans text-slate-500 mt-2 sm:mt-0 font-medium whitespace-nowrap">
                  Borborema, {getExtensoDate(viewingMemo.dataCriacao)}
                </div>
              </div>

              {/* QUADRO DE ENDEREÇAMENTO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 p-4 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-sans leading-relaxed">
                <div>
                  <span className="font-sans text-[9px] font-bold text-slate-400 uppercase tracking-wider block">DE:</span>
                  <strong className="text-slate-800 font-bold text-[11px]">Coordenação Operacional de Logística / Canteiro Central</strong>
                </div>
                <div>
                  <span className="font-sans text-[9px] font-bold text-slate-400 uppercase tracking-wider block">PARA:</span>
                  <strong className="text-slate-800 font-bold text-[11px]">Departamento Pessoal / Setor de Pagamento e Financeiro</strong>
                </div>
                <div className="md:col-span-2 border-t border-slate-100 pt-2.5">
                  <span className="font-sans text-[9px] font-bold text-slate-400 uppercase tracking-wider block">COLABORADOR BENEFICIÁRIO:</span>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <strong className="text-slate-900 font-extrabold text-[12px]">{viewingMemo.nomeColaborador}</strong>
                    <span className="font-mono text-[9px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-lg">
                      MATRÍCULA: {viewingMemo.matricula}
                    </span>
                  </div>
                </div>
              </div>

              {/* INFRAESTRUTURA DETALHADA DO COLABORADOR */}
              {(() => {
                const col = colaboradores.find(c => c.matricula === viewingMemo.matricula);
                if (!col) return null;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-slate-200/80 rounded-xl bg-slate-50/30 text-xs font-sans">
                    <div>
                      <span className="text-slate-400 text-[10px] font-sans block">Função:</span>
                      <strong className="text-slate-700 font-bold text-[11px] block mt-0.5">{col.funcao}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-sans block">Mão de Obra:</span>
                      <strong className="text-slate-700 font-bold text-[11px] block mt-0.5">{col.tipoMaoDeObra}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-sans block">Situação:</span>
                      <strong className="text-slate-750 font-bold text-[11px] block mt-0.5">{col.status}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-sans block">Regime de Trabalho:</span>
                      <strong className="text-slate-750 font-bold text-[11px] block mt-0.5">{col.regimeTrabalho || "Não definido"}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* CORPO DE TEXTO OFICIAL */}
              <div className="font-serif text-[13.5px] md:text-sm text-slate-700 space-y-4 leading-relaxed text-justify">
                {viewingMemo.tipoMemorando === "Folga de campo" ? (
                  <p className="indent-8">
                    Vimos pelo presente memorando administrativo solicitar e comunicar os trâmites logísticos
                    e operacionais inerentes ao gozo programado de <strong>Folga de Campo</strong> do colaborador
                    mencionado anteriormente. O roteiro de transporte, passagens adquiridas e cronograma temporal estabelecido pela
                    supervisão encontram-se descritos no anexo técnico a seguir. Solicitamos a provisão e devido
                    registro para os devidos fins de conformação estatutária.
                  </p>
                ) : (
                  <p className="indent-8">
                    Vimos pelo presente memorando homologar e formalizar administrativamente o acordo de
                    <strong> Venda de Folga Regulamentar</strong> correspondente no período de apuração ativo do colaborador.
                    A anuência mútua foi devidamente firmada nos termos das normas internas do Consórcio. Solicitamos
                    o provisionamento e processamento dos haveres indenizatórios correspondentes em folha de pagamento.
                  </p>
                )}
              </div>

              {/* SEÇÃO 2: DETALHES TÉCNICOS / TABELA */}
              <div className="space-y-2">
                <h3 className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                  ANEXO TÉCNICO • QUADRO DETALHADO DA OPERAÇÃO
                </h3>
                
                {viewingMemo.tipoMemorando === "Folga de campo" ? (
                  /* TABELA DE FOLGA DE CAMPO */
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-left font-sans text-xs border-collapse divide-y divide-slate-155">
                      <tbody>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500 w-1/3">LOCAL DE DESTINO DECLARADO</td>
                          <td className="p-3 font-bold text-slate-850 uppercase text-[11px]">{viewingMemo.destino || "MÃO DE OBRA LOCAL / SEM VIAGEM"}</td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">MEIO DE TRANSPORTE SOLICITADO</td>
                          <td className="p-3 font-serif italic font-bold text-indigo-950 text-xs">
                            {viewingMemo.tipoPassagem ? `${viewingMemo.tipoPassagem}` : "NÃO DETERMINADO / PARTICULAR"}
                          </td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">DATA DE SAÍDA DO CANTEIRO</td>
                          <td className="p-3 font-semibold text-slate-700 text-[11px]">
                            {viewingMemo.dataSaida ? formatBrDate(viewingMemo.dataSaida) : "Sem viagem registrada"}
                          </td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">DATA PREVISTA DE RETORNO ALOJAMENTO</td>
                          <td className="p-3 font-semibold text-slate-700 text-[11px]">
                            {viewingMemo.dataRetorno ? formatBrDate(viewingMemo.dataRetorno) : "Sem viagem registrada"}
                          </td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">RETORNO EFETIVO AO TRABALHO</td>
                          <td className="p-3 font-bold text-indigo-900 text-[11px] bg-indigo-50/20">
                            {viewingMemo.retornoTrabalho ? formatBrDate(viewingMemo.retornoTrabalho) : "PENDENTE DE RETORNO / EM VIAGEM"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* TABELA DE VENDA DE FOLGA */
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
                    <table className="w-full text-left font-sans text-xs border-collapse divide-y divide-slate-155">
                      <tbody>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500 w-1/3">MODALIDADE DE APURAÇÃO</td>
                          <td className="p-3 font-bold text-slate-850 uppercase text-[11px]">VENDA COGNITIVA INTEGRAL DE FOLGA REGULAMENTAR</td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">PERÍODO APURADO / LANÇADO</td>
                          <td className="p-3 font-semibold text-slate-700 text-[11px]">{formatBrDate(viewingMemo.dataCriacao)}</td>
                        </tr>
                        <tr className="divide-x divide-slate-155">
                          <td className="p-3 bg-slate-50/80 font-sans font-bold text-[10px] text-slate-500">REGULAMENTO FINANCEIRO INTERNO</td>
                          <td className="p-3 text-slate-600 leading-relaxed text-[11px]">
                            Carga adicional de reembolso efetuada nas cláusulas operacionais vigentes. O pagamento será devidamente efetuado sob a rubrica correspondente aos reflexos remuneratórios regulamentares.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SEÇÃO 3: AUDITORIA DE CHECK-INS E STATUS */}
              <div className="space-y-2.5 p-4 bg-slate-50/80 border border-slate-200 text-xs font-sans rounded-xl leading-relaxed">
                <h4 className="font-sans text-[10px] font-bold text-slate-450 uppercase tracking-wider block border-b border-dashed border-slate-200 pb-2 mb-2">
                  PROTOCOLO INTEGRADO DE ASSINATURAS E FISCALIZAÇÕES INTERNAS
                </h4>
                
                <div className="space-y-2.5 text-[11px]">
                  {viewingMemo.tipoMemorando === "Folga de campo" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">1. Providência e Carga de Bilhetes Terrestres/Aéreos:</span>
                        <span className={`font-mono text-[10px] font-bold ${viewingMemo.passagemOk ? "text-emerald-700" : "text-amber-600"}`}>
                          {viewingMemo.passagemOk ? `✓ CONCLUÍDO EM ${viewingMemo.passagemOkAt}` : "⚠ PENDENTE / NÃO REGISTRADO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">2. Adiantamento Financeiro e Diárias de Campo:</span>
                        <span className={`font-mono text-[10px] font-bold ${viewingMemo.adiantamentoOk ? "text-emerald-700" : "text-amber-600"}`}>
                          {viewingMemo.adiantamentoOk ? `✓ CONCLUÍDO EM ${viewingMemo.adiantamentoOkAt}` : "⚠ PENDENTE / DEPOSITAR"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">3. Envio de Requerimento de Assinatura à Sede:</span>
                        <span className={`font-mono text-[10px] font-bold ${viewingMemo.envioSedeOk ? "text-emerald-700" : "text-amber-600"}`}>
                          {viewingMemo.envioSedeOk ? `✓ ENVIADO EM ${viewingMemo.envioSedeOkAt}` : "⚠ PENDENTE / ENVIAR"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">1. Emissão de Termo Aditivo e Geração de Arquivo:</span>
                        <span className={`font-mono text-[10px] font-bold ${viewingMemo.arquivoGeradoOk ? "text-emerald-700" : "text-amber-600"}`}>
                          {viewingMemo.arquivoGeradoOk ? `✓ EXPORTADO EM ${viewingMemo.arquivoGeradoAt}` : "⚠ PENDENTE / EXPORTAR"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 font-medium">2. Anexação de Lançamento na Folha de Pagamento:</span>
                        <span className={`font-mono text-[10px] font-bold ${viewingMemo.anexadoFolhaOk ? "text-emerald-700" : "text-amber-600"}`}>
                          {viewingMemo.anexadoFolhaOk ? `✓ LANÇADO EM ${viewingMemo.anexadoFolhaAt}` : "⚠ PENDENTE / INTEGRAR"}
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between mt-2">
                    <span className="font-bold text-slate-800">4. Status de Homologação Final das Etapas:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-sans font-bold border uppercase ${
                      viewingMemo.finalizada
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                        : "bg-amber-50 border-amber-100 text-amber-800"
                    }`}>
                      {viewingMemo.finalizada ? `CONCLUÍDO E HOMOLOGADO EM ${viewingMemo.finalizadaAt}` : "PROCESSO EM TRAMITAÇÃO OPERACIONAL"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DECLARAÇÕES / OBSERVAÇÕES */}
              {viewingMemo.observacao && (
                <div className="p-3.5 bg-slate-50/50 border-l-4 border-indigo-600 rounded-r text-[11px] leading-relaxed font-serif italic text-slate-600 text-justify">
                  <span className="font-sans font-semibold text-[9px] text-slate-400 block tracking-widest uppercase mb-1 not-italic">DESPACHO / OBSERVAÇÕES ESPECÍFICAS:</span>
                  "{viewingMemo.observacao}"
                </div>
              )}

              <div className="p-3.5 border border-slate-200/80 bg-neutral-50/40 rounded-xl text-[10px] font-sans text-slate-450 leading-relaxed text-justify">
                <strong>Declaração de Conformidade:</strong> Confirmamos o cumprimento dos cronogramas e dados de assentamentos, resguardando os devidos direitos à segurança do trabalho e às políticas de gestão operacional do canteiro de obras.
              </div>

              {/* RÚBRICA E ASSINATURAS */}
              <div className="grid grid-cols-2 gap-12 pt-14 font-sans text-xs print:pt-20 select-none">
                <div className="text-center space-y-1.5">
                  <div className="border-t border-slate-400 pt-2 max-w-[200px] mx-auto"></div>
                  <strong className="block text-slate-700 font-bold text-[10.5px]">Departamento de Recursos Humanos</strong>
                  <span className="text-[8.5px] font-mono text-slate-400 uppercase block tracking-wider">CONVENTO BORBOREMA DA S/A</span>
                </div>
                
                <div className="text-center space-y-1.5">
                  <div className="border-t border-slate-400 pt-2 max-w-[200px] mx-auto"></div>
                  <strong className="block text-slate-700 font-bold text-[10.5px]">{viewingMemo.nomeColaborador}</strong>
                  <span className="text-[8.5px] font-mono text-slate-400 uppercase block tracking-wider">REQUERENTE / SOLICITANTE</span>
                </div>
              </div>

            </div>

            {/* MARGEM DE SEGURANÇA E PÁGINA */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-sans text-slate-400 print:hidden font-medium">
              <span>CONTROLE DE EMISSÕES BORBOREMA © 2026</span>
              <span>CANTEIRO CENTRAL DE OBRAS • MEMO_ID: {viewingMemo.id}</span>
            </div>

          </div>
        </div>
      )}

      {/* Modal Customizado de Confirmação de Deleção de Memorando */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in print:hidden">
          <div className="bg-white border text-left border-slate-200 p-6 max-w-md w-full rounded-2xl space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-red-650 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-sans font-bold text-red-700 uppercase tracking-wide">Confirmar Remoção</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-sans mt-1">
                  Atenção! Você está prestes a excluir permanentemente o memorando do colaborador <strong className="text-slate-900 font-bold">{deleteConfirm.nomeColaborador}</strong>.
                </p>
                <p className="text-[10px] text-slate-400 font-sans leading-tight mt-1">
                  Esta ação é irreversível e removerá todos os dados armazenados deste documento oficial de viagem ou folga de campo.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-sans font-bold uppercase tracking-wider py-2.5 rounded-xl transition-colors cursor-pointer border border-transparent"
              >
                Sim, Excluir
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-705 text-xs font-sans font-bold uppercase tracking-wider py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
