import React, { useState, useMemo, useEffect } from "react";
import { Colaborador } from "../types";
import { formatBrDate } from "../utils/date";
import { 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Briefcase, 
  MapPin, 
  UserPlus, 
  FileSpreadsheet, 
  AlertCircle,
  HelpCircle,
  UserCheck,
  Download,
  Upload,
  Info,
  Cloud
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportToExcel, downloadTemplate, parseExcelDate, formatCPF } from "../utils/excel";
import { getOrCreateFolderHierarchy, uploadExcelToGDriveAsSheets, uploadFileToDrive } from "../lib/googleAuth";
import { getDirectDriveImageURL } from "../utils/drive";
import ImageCropperModal from "./ImageCropperModal";

interface CadastroProps {
  colaboradores: Colaborador[];
  onAddColaborador: (col: Colaborador) => Promise<void>;
  onUpdateColaborador: (matricula: string, col: Partial<Colaborador>) => Promise<void>;
  onDeleteColaborador: (matricula: string) => Promise<void>;
  googleToken?: string | null;
  isAdmin?: boolean;
}

export default function Cadastro({ 
  colaboradores, 
  onAddColaborador, 
  onUpdateColaborador, 
  onDeleteColaborador,
  googleToken,
  isAdmin = true
}: CadastroProps) {
  
  // Estados para busca e controle de formulário
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMatricula, setEditingMatricula] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ matricula: string; nomeCompleto: string } | null>(null);
  const [importLog, setImportLog] = useState<string[]>([]);

  // Campos do Formulário
  const [matricula, setMatricula] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [funcao, setFuncao] = useState("");
  const [dataAdmissao, setDataAdmissao] = useState("");
  const [cpf, setCpf] = useState("");
  const [tipoMaoDeObra, setTipoMaoDeObra] = useState<"MOI" | "MOD">("MOD");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [regimeTrabalho, setRegimeTrabalho] = useState<"Alojado" | "Local">("Local");
  const [dataInicioProjeto, setDataInicioProjeto] = useState("");
  const [transferido, setTransferido] = useState(false);
  const [projetoAtual, setProjetoAtual] = useState("Projeto Aura Borborema Filtragem - Currais Novos");
  const [fotoUrl, setFotoUrl] = useState("");
  const [status, setStatus] = useState<"Ativo" | "Inativo">("Ativo");
  const [isUploadingFoto, setIsUploadingFoto] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const [dataInativacao, setDataInativacao] = useState("");
  const [observacao, setObservacao] = useState("");
  const [dataTreinamentoAura, setDataTreinamentoAura] = useState("");
  const [matriculaAura, setMatriculaAura] = useState("");
  const [projetoOrigem, setProjetoOrigem] = useState("");
  const [salarioBase, setSalarioBase] = useState("");

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (googleToken) {
      setIsUploadingFoto(true);
      try {
        const folders = await getOrCreateFolderHierarchy(googleToken);
        const renamedFilename = `${nomeCompleto.trim() || "Sem_Nome"}.jpg`;
        const croppedFile = new File([croppedBlob], renamedFilename, { type: "image/jpeg" });
        const result = await uploadFileToDrive(googleToken, croppedFile, folders.fotosId);
        const timestamp = Date.now();
        const urlWithTimestamp = `${result.webViewLink}${result.webViewLink.includes("?") ? "&" : "?"}t=${timestamp}`;
        setFotoUrl(urlWithTimestamp);
      } catch (err: any) {
        console.error("Erro no upload de foto para Drive após recorte:", err);
        alert("Erro no Google Drive. Salvando foto recortada localmente...");
        const reader = new FileReader();
        reader.onloadend = () => {
          setFotoUrl(reader.result as string);
        };
        reader.readAsDataURL(croppedBlob);
      } finally {
        setIsUploadingFoto(false);
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoUrl(reader.result as string);
      };
      reader.readAsDataURL(croppedBlob);
    }
  };

  // Google Drive Sync States & Effects
  const [gdriveSheetLink, setGdriveSheetLink] = useState<string>(() => sessionStorage.getItem("gdrive_sheet_link_cadastro") || "");
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  const syncCadastroToDrive = async (token: string, list: Colaborador[]) => {
    setIsSyncingDrive(true);
    try {
      const folders = await getOrCreateFolderHierarchy(token);
      const formatRows = list.map(c => ({
        "Matrícula": c.matricula,
        "Nome Completo": c.nomeCompleto,
        "Função": c.funcao,
        "CPF": c.cpf,
        "Data de Admissão": formatBrDate(c.dataAdmissao),
        "Mão de Obra": c.tipoMaoDeObra,
        "Cidade": c.cidade,
        "Estado": c.estado,
        "Regime de Trabalho": c.regimeTrabalho,
        "Início do Projeto": formatBrDate(c.dataInicioProjeto),
        "Transferido": c.transferido ? "Sim" : "Não",
        "Projeto Atual": c.projetoAtual
      }));
      const worksheet = XLSX.utils.json_to_sheet(formatRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Colaboradores");
      
      const fileName = "02 Cadastro de colaboradores";
      const result = await uploadExcelToGDriveAsSheets(token, folders.cadastroId, fileName, workbook);
      setGdriveSheetLink(result.webViewLink);
      sessionStorage.setItem("gdrive_sheet_link_cadastro", result.webViewLink);
    } catch (err) {
      console.error("Erro ao sincronizar Cadastro com Google Drive:", err);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  useEffect(() => {
    if (googleToken && colaboradores.length > 0) {
      syncCadastroToDrive(googleToken, colaboradores);
    }
  }, [googleToken, colaboradores]);

  // Mascarar CPF ao digitar
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove não-números
    if (value.length > 11) value = value.slice(0, 11);
    
    // Aplica a máscara 000.000.000-00
    if (value.length > 9) {
      value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    } else if (value.length > 6) {
      value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
    } else if (value.length > 3) {
      value = value.replace(/(\d{1,3})(\d{1,3})/, "$1.$2");
    }
    setCpf(value);
  };

  // Abrir formulário de cadastro limpo
  const handleOpenNewForm = () => {
    setEditingMatricula(null);
    setMatricula("");
    setNomeCompleto("");
    setFuncao("");
    setDataAdmissao("");
    setCpf("");
    setTipoMaoDeObra("MOD");
    setCidade("");
    setEstado("");
    setRegimeTrabalho("Local");
    setDataInicioProjeto("");
    setTransferido(false);
    setProjetoAtual("Projeto Aura Borborema Filtragem - Currais Novos");
    setFotoUrl("");
    setStatus("Ativo");
    setDataInativacao("");
    setObservacao("");
    setDataTreinamentoAura("");
    setMatriculaAura("");
    setProjetoOrigem("");
    setSalarioBase("");
    setErrorMsg("");
    setSuccessMsg("");
    setIsFormOpen(true);
  };

  // Carregar dados de colaborador para edição
  const handleEditClick = (col: Colaborador) => {
    setEditingMatricula(col.matricula);
    setMatricula(col.matricula);
    setNomeCompleto(col.nomeCompleto);
    setFuncao(col.funcao);
    setDataAdmissao(col.dataAdmissao);
    setCpf(col.cpf);
    setTipoMaoDeObra(col.tipoMaoDeObra);
    setCidade(col.cidade);
    setEstado(col.estado);
    setRegimeTrabalho(col.regimeTrabalho);
    setDataInicioProjeto(col.dataInicioProjeto);
    setTransferido(col.transferido);
    setProjetoAtual(col.projetoAtual);
    setFotoUrl(col.fotoUrl || "");
    setStatus(col.status || "Ativo");
    setDataInativacao(col.dataInativacao || "");
    setObservacao(col.observacao || "");
    setDataTreinamentoAura(col.dataTreinamentoAura || "");
    setMatriculaAura(col.matriculaAura || "");
    setProjetoOrigem(col.projetoOrigem || "");
    setSalarioBase(col.salarioBase ? String(col.salarioBase) : "");
    setErrorMsg("");
    setSuccessMsg("");
    setIsFormOpen(true);
  };

  // Submissão do Formulário (Nova ou Edição)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validações básicas
    if (!matricula.trim()) return setErrorMsg("Matrícula é obrigatória.");
    if (!nomeCompleto.trim()) return setErrorMsg("Nome completo é obrigatório.");
    if (!funcao.trim()) return setErrorMsg("Função é obrigatória.");
    if (!dataAdmissao) return setErrorMsg("Data de Admissão é obrigatória.");
    if (!cpf.trim()) return setErrorMsg("CPF é obrigatório.");
    if (!cidade.trim() || !estado.trim()) return setErrorMsg("Cidade e Estado são obrigatórios.");
    if (!dataInicioProjeto) return setErrorMsg("Data de Início no Projeto é obrigatória.");
    
    if (transferido && !projetoAtual.trim()) {
      return setErrorMsg("Ao marcar 'Transferido?', o nome do projeto atual é obrigatório.");
    }

    const salarioNumero = parseFloat(salarioBase.replace(",", "."));
    if (salarioBase.trim() && (isNaN(salarioNumero) || salarioNumero < 0)) {
      return setErrorMsg("Valor bruto mensal inválido. Use apenas números (ex: 4500,00).");
    }

    if (status === "Inativo" && !dataInativacao) {
      return setErrorMsg("Ao inativar o colaborador, a data de inativação é obrigatória.");
    }

    const payload: Colaborador = {
      matricula: matricula.trim().toUpperCase(),
      nomeCompleto: nomeCompleto.trim(),
      funcao: funcao.trim(),
      dataAdmissao,
      cpf,
      tipoMaoDeObra,
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase().slice(0, 2),
      regimeTrabalho,
      dataInicioProjeto,
      transferido,
      projetoAtual: transferido ? projetoAtual.trim() : "Projeto Aura Borborema Filtragem - Currais Novos", // Projeto padrão se não transferido
      fotoUrl,
      status,
      dataInativacao: status === "Inativo" ? dataInativacao : undefined,
      observacao: observacao.trim(),
      dataTreinamentoAura: dataTreinamentoAura || undefined,
      matriculaAura: matriculaAura.trim() || undefined,
      projetoOrigem: transferido ? projetoOrigem.trim() || undefined : undefined,
      salarioBase: salarioBase.trim() ? salarioNumero : undefined
    };

    try {
      if (editingMatricula) {
        // Editando registro existente
        await onUpdateColaborador(editingMatricula, payload);
        const prefix = payload.regimeTrabalho === "Alojado"
          ? "Colaborador atualizado! Lançado automaticamente na Escala de Folga de Campo!"
          : "Colaborador atualizado com sucesso!";
        setSuccessMsg(prefix);
      } else {
        // Verificação local de duplicidade de matrícula extra
        if (colaboradores.some(c => c.matricula.toUpperCase() === payload.matricula)) {
          return setErrorMsg("Matrícula já se encontra cadastrada no banco de dados.");
        }
        await onAddColaborador(payload);
        const prefix = payload.regimeTrabalho === "Alojado"
          ? "Colaborador cadastrado! Lançado automaticamente na Escala de Folga de Campo!"
          : "Colaborador cadastrado com sucesso!";
        setSuccessMsg(prefix);
      }

      // Fecha formulário após breves instantes
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg("");
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar as informações no banco de dados.");
    }
  };

  // Excluir colaborador - Abre modal de confirmação customizado para evitar bloqueio de sandbox iframe
  const handleDeleteClick = (mat: string, nome: string) => {
    setDeleteConfirm({ matricula: mat, nomeCompleto: nome });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await onDeleteColaborador(deleteConfirm.matricula);
      setSuccessMsg(`Colaborador "${deleteConfirm.nomeCompleto}" removido da base de dados com sucesso!`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir colaborador do banco de dados.");
      setDeleteConfirm(null);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Filtragem dos colaboradores em tempo real
  const filteredColaboradores = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = !term ? colaboradores : colaboradores.filter(
      c => 
        c.matricula.toLowerCase().includes(term) || 
        c.nomeCompleto.toLowerCase().includes(term) ||
        c.funcao.toLowerCase().includes(term) ||
        c.cpf.includes(term)
    );
    // Sempre ordenar em ordem alfabética de nome completo
    return [...list].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
  }, [colaboradores, searchTerm]);

  // Exportar para Excel
  const handleExport = () => {
    const formatRows = filteredColaboradores.map(c => ({
      "Matrícula": c.matricula,
      "Nome Completo": c.nomeCompleto,
      "Função": c.funcao,
      "CPF": c.cpf,
      "Data de Admissão": formatBrDate(c.dataAdmissao),
      "Mão de Obra": c.tipoMaoDeObra,
      "Cidade": c.cidade,
      "Estado": c.estado,
      "Regime de Trabalho": c.regimeTrabalho,
      "Início do Projeto": formatBrDate(c.dataInicioProjeto),
      "Transferido": c.transferido ? "Sim" : "Não",
      "Projeto Atual": c.projetoAtual,
      "Início Treinamento Aura": c.dataTreinamentoAura ? formatBrDate(c.dataTreinamentoAura) : "",
      "Mat. Aura": c.matriculaAura || "",
      "Observações": c.observacao || ""
    }));
    exportToExcel(formatRows, "Listagem_de_Colaboradores", "Colaboradores");
  };

  // Importar de Planilha
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");
    setImportLog([]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        if (rawData.length === 0) {
          setErrorMsg("O arquivo está vazio ou não possui registros.");
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        const logs: string[] = [];

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          const rowNum = i + 2; // Linha correspondente na planilha real (incluindo cabeçalho)

          // Extração tolerante de chaves
          const getVal = (possibleKeys: string[], fallback = "") => {
            for (const k of possibleKeys) {
              const keyFound = Object.keys(row).find(x => x.trim().toLowerCase() === k.normalize("NFC").trim().toLowerCase());
              if (keyFound) return row[keyFound];
            }
            return fallback;
          };

          const matricula = String(getVal(["Matricula", "Matrícula", "id", "código"]) || "").trim().toUpperCase();
          const nomeCompleto = String(getVal(["Nome Completo", "Nome", "Colaborador"]) || "").trim();
          const cpf = formatCPF(getVal(["CPF", "Cpf"]));
          const funcao = String(getVal(["Funcao", "Função", "Cargo"]) || "").trim();
          const dataAdmissao = parseExcelDate(getVal(["Data de Admissao", "Admissão", "Data Admissão", "Data de Admissão"]));
          const rawMao = String(getVal(["Mao de Obra (MOI/MOD)", "Mão de Obra", "Origem de Mo", "Mão de obra"]) || "").trim().toUpperCase();
          const tipoMaoDeObra: "MOI" | "MOD" = rawMao.includes("MOI") ? "MOI" : "MOD";
          const rawRegime = String(getVal(["Regime de Trabalho (Local/Alojado)", "Regime de Trabalho", "Regime", "Alojado", "Alojamento"]) || "").trim().toLowerCase();
          const regimeTrabalho: "Alojado" | "Local" = rawRegime.includes("alojado") ? "Alojado" : "Local";
          const cidade = String(getVal(["Cidade"]) || "Petrolina").trim();
          const estado = String(getVal(["Estado (UF)", "Estado", "UF", "Uf"]) || "PE").trim().toUpperCase().slice(0, 2);
          const dataInicioProjeto = parseExcelDate(getVal(["Inicio do Projeto", "Início do Projeto", "Início", "Projeto Inicio", "Data Inicio Projeto"])) || dataAdmissao;
          const rawTransferido = String(getVal(["Transferido (Sim/Nao)", "Transferido", "Transferido?"]) || "").trim().toLowerCase();
          const transferido = rawTransferido.includes("sim") || rawTransferido === "s" || rawTransferido === "true";
          const projetoAtual = String(getVal(["Projeto Atual", "Projeto", "Localização"]) || "Projeto Aura Borborema Filtragem - Currais Novos").trim();
          const observacao = String(getVal(["observação", "observações", "observacao", "observacoes", "observações/restrições", "observaçao", "observacões"]) || "").trim();
          const dataTreinamentoAura = parseExcelDate(getVal(["Início Treinamento Aura", "Início Treinamento Aura", "Treinamento Aura", "Data Treinamento Aura", "dataTreinamentoAura"]));
          const matriculaAura = String(getVal(["Matrícula Aura", "Matricula Aura", "Mat. Aura", "Mat Aura", "matriculaAura"]) || "").trim();

          // Validações Essenciais
          if (!matricula) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum}): Matrícula ausente na coluna.`);
            continue;
          }
          if (!nomeCompleto) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Nome completo ausente.`);
            continue;
          }
          if (!cpf) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): CPF ausente.`);
            continue;
          }
          if (!funcao) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Função ausente.`);
            continue;
          }
          if (!dataAdmissao) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Data de admissão inválida ou ausente.`);
            continue;
          }

          const payload: Colaborador = {
            matricula,
            nomeCompleto,
            cpf,
            funcao,
            dataAdmissao,
            tipoMaoDeObra,
            regimeTrabalho,
            cidade,
            estado,
            dataInicioProjeto,
            transferido,
            projetoAtual: transferido ? projetoAtual : "Projeto Aura Borborema Filtragem - Currais Novos",
            observacao,
            dataTreinamentoAura: dataTreinamentoAura || undefined,
            matriculaAura: matriculaAura || undefined
          };

          try {
            if (colaboradores.some(c => c.matricula.toUpperCase() === matricula)) {
              await onUpdateColaborador(matricula, payload);
              successCount++;
              logs.push(`✅ Atualizado (Linha ${rowNum}): ${matricula} - ${nomeCompleto}`);
            } else {
              await onAddColaborador(payload);
              successCount++;
              logs.push(`✅ Importado (Linha ${rowNum}): ${matricula} - ${nomeCompleto}`);
            }
          } catch (err: any) {
            errorCount++;
            logs.push(`❌ Erro no Banco (Linha ${rowNum} - ${matricula}): ${err.message || "Erro na API"}`);
          }
        }

        setSuccessMsg(`Processamento de Planilha Concluído! Importados/Atualizados: ${successCount} | Falhas: ${errorCount}`);
        setImportLog(logs);
        e.target.value = ""; // Limpa o input
      } catch (err: any) {
        setErrorMsg("Falha crítica ao ler planilha de Excel: " + (err.message || err));
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div id="section-cadastro" className="space-y-6">
      
      {/* Barra de Ações Rápidas */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Ficha de Cadastro de Pessoal
          </h2>
          <p className="text-[10px] text-[#141414]/75 font-mono uppercase tracking-tight mt-1">
            Painel cadastral unificado de pessoal de campo e mão de obra operacional da obra.
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {/* Botão Baixar Modelo */}
            <button
              type="button"
              onClick={() => downloadTemplate("cadastro")}
              className="flex items-center justify-center gap-2 border border-[#141414]/40 bg-white hover:bg-neutral-100 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4 text-neutral-600" />
              Baixar Modelo
            </button>

            {/* Botão Importar */}
            <label className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-neutral-50 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none select-none">
              <Upload className="w-4 h-4 text-neutral-600" />
              Importar Planilha
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>

            <button
              id="btn-export-cadastro"
              onClick={handleExport}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>

            {googleToken && (
              <a
                href={gdriveSheetLink || undefined}
                target="_blank"
                rel="noreferrer"
                title={gdriveSheetLink ? "Ver planilha no Google Drive" : "Sincronizando planilha no Google Drive..."}
                className={`flex items-center justify-center gap-2 border border-emerald-700 ${gdriveSheetLink ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer" : "bg-neutral-50 text-neutral-400 cursor-not-allowed"} text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors flex-1 sm:flex-none`}
                onClick={(e) => {
                  if (!gdriveSheetLink) e.preventDefault();
                }}
              >
                <Cloud className={`w-4 h-4 text-emerald-600 ${isSyncingDrive ? "animate-pulse" : ""}`} />
                {isSyncingDrive ? "Sincronizando..." : "Planilha Drive (GSheets)"}
              </a>
            )}
            
            <button
              id="btn-open-form-new"
              onClick={handleOpenNewForm}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              Novo Registro
            </button>
          </div>
        )}
      </div>

      {/* Relatório de Importação de Planilha */}
      {importLog.length > 0 && (
        <div className="bg-neutral-50 border border-[#141414] p-4 font-mono text-[11px] space-y-2">
          <div className="flex justify-between items-center border-b border-neutral-300 pb-1.5 mb-2">
            <span className="font-bold flex items-center gap-1 uppercase tracking-tight text-[#141414]">
              <Info className="w-3.5 h-3.5" /> DIAGNÓSTICO DE IMPORTAÇÃO (LOGS):
            </span>
            <button 
              onClick={() => setImportLog([])} 
              className="text-[9px] hover:underline uppercase text-zinc-500 font-bold"
            >
              [ Limpar Logs ]
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-2 scrollbar-thin">
            {importLog.map((log, idx) => (
              <div key={idx} className="leading-tight select-all">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerta de Sucesso Global */}
      {successMsg && (
        <div className="p-4 border border-emerald-600 bg-emerald-50 text-emerald-950 font-mono text-xs flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Formulário Retrátil */}
      {isFormOpen && (
        <div className="bg-white p-6 border border-[#141414] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
            <h3 className="text-xs font-serif italic font-bold text-[#141414] flex items-center gap-2 uppercase tracking-wide">
              <UserPlus className="w-4 h-4" />
              {editingMatricula ? `Editar Ficha: ${editingMatricula}` : "Abrir Nova Ficha de Cadastro de Campo"}
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="border border-[#141414]/30 hover:border-[#141414] hover:bg-red-50 text-[10px] font-mono px-2 py-1 transition-colors cursor-pointer"
            >
              [ FECHAR ]
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {errorMsg && (
              <div className="p-3.5 border border-red-650 bg-red-50 text-red-950 font-mono text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* Matricula */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Matrícula (Código Único)*</label>
                <input
                  type="text"
                  required
                  placeholder="EX: COL-1006"
                  disabled={!!editingMatricula}
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none disabled:bg-[#141414]/5 font-mono"
                />
              </div>

              {/* Nome Completo */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Nome Completo do Colaborador*</label>
                <input
                  type="text"
                  required
                  placeholder="Nome Completo do Colaborador"
                  value={nomeCompleto}
                  onChange={(e) => setNomeCompleto(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-serif italic"
                />
              </div>

              {/* CPF */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">CPF do Colaborador*</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono"
                />
              </div>

              {/* Funçao */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Função Operacional*</label>
                <input
                  type="text"
                  required
                  placeholder="EX: Mecânico, Soldador, Vigia"
                  value={funcao}
                  onChange={(e) => setFuncao(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-serif"
                />
              </div>

              {/* Data de Admissão */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data de Admissão*</label>
                <input
                  type="date"
                  required
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono"
                />
              </div>

              {/* Mão de Obra Selector */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Origem de Mo*</label>
                <select
                  value={tipoMaoDeObra}
                  onChange={(e) => setTipoMaoDeObra(e.target.value as "MOI" | "MOD")}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
                >
                  <option value="MOI">Mão de Obra Indireta (MOI)</option>
                  <option value="MOD">Mão de Obra Direta (MOD)</option>
                </select>
              </div>

              {/* Regime de Trabalho */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Regime de Alojamento*</label>
                <select
                  value={regimeTrabalho}
                  onChange={(e) => setRegimeTrabalho(e.target.value as "Alojado" | "Local")}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
                >
                  <option value="Local">Local (Reside na Região)</option>
                  <option value="Alojado">Alojado (Custeado Pelo Projeto)</option>
                </select>
              </div>

              {/* Cidade */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Cidade de Origem*</label>
                <input
                  type="text"
                  required
                  placeholder="EX: Petrolina"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none"
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Estado de Origem (UF)*</label>
                <input
                  type="text"
                  required
                  placeholder="EX: SE"
                  maxLength={2}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono"
                />
              </div>

              {/* Data Inicio Projeto */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Início no Canteiro*</label>
                <input
                  type="date"
                  required
                  value={dataInicioProjeto}
                  onChange={(e) => setDataInicioProjeto(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono"
                />
              </div>

              {/* Transferido e Projeto */}
              <div className="flex items-center gap-3 md:col-span-1 pt-6 pl-1 select-none">
                <input
                  id="checkbox-transferido"
                  type="checkbox"
                  checked={transferido}
                  onChange={(e) => setTransferido(e.target.checked)}
                  className="w-4 h-4 rounded-none border-[#141414] text-[#141414] focus:ring-[#141414] checked:bg-[#141414]"
                />
                <label htmlFor="checkbox-transferido" className="text-xs font-bold text-[#141414] cursor-pointer">
                  Transferido? (Sim/Não)
                </label>
              </div>

              {/* Status Ocupacional */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Status Ocupacional*</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Ativo" | "Inativo")}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
                >
                  <option value="Ativo">Ativo no Projeto</option>
                  <option value="Inativo">Inativo (Desligado/Desmobilizado)</option>
                </select>
              </div>

              {/* Data de Inativação */}
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">
                  Data de Inativação {status === "Inativo" ? "*" : ""}
                </label>
                <input
                  type="date"
                  disabled={status !== "Inativo"}
                  required={status === "Inativo"}
                  value={dataInativacao}
                  onChange={(e) => setDataInativacao(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono disabled:opacity-50"
                />
              </div>

            </div>

            {/* Projeto Atual se Transferido */}
            {transferido && (
              <div className="p-4 border border-[#141414] bg-[#E4E3E0]/40 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414] mb-1 uppercase">Nome do Projeto Atual*</label>
                  <input
                    type="text"
                    required={transferido}
                    placeholder="EX: Complexo Eólico WindFort"
                    value={projetoAtual}
                    onChange={(e) => setProjetoAtual(e.target.value)}
                    className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
                  />
                  <span className="text-[9px] text-[#141414]/60 font-mono block mt-1 uppercase">Obrigatório para o controle de transferência.</span>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414] mb-1 uppercase">Projeto de Origem</label>
                  <input
                    type="text"
                    placeholder="EX: Parque Solar Sertão"
                    value={projetoOrigem}
                    onChange={(e) => setProjetoOrigem(e.target.value)}
                    className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
                  />
                  <span className="text-[9px] text-[#141414]/60 font-mono block mt-1 uppercase">Usado no rateio do custo de férias.</span>
                </div>
              </div>
            )}

            {/* Valor bruto / Custo com encargos (base de férias) */}
            <div className="max-w-xs">
              <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Valor Bruto Mensal / Custo (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="EX: 4500,00"
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono font-bold"
              />
              <span className="text-[9px] text-[#141414]/65 font-mono block mt-1 uppercase">Valor bruto já com encargos inclusos. Pré-preenche o cálculo de férias.</span>
            </div>

            {/* Foto do Colaborador (Upload / URL) */}
            <div className="p-4 border border-[#141414]/20 bg-neutral-50/50 space-y-3">
              <span className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">Foto de Perfil do Trabalhador</span>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-16 h-16 border-2 border-[#141414] bg-white flex items-center justify-center shrink-0 relative overflow-hidden">
                  {isUploadingFoto ? (
                    <div className="text-indigo-700 flex flex-col items-center justify-center font-mono text-[8px] font-bold animate-pulse">
                      <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin mb-1"></span>
                      Subindo...
                    </div>
                  ) : fotoUrl ? (
                    <img src={getDirectDriveImageURL(fotoUrl)} alt="Preview Foto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="text-[#141414]/30 flex flex-col items-center justify-center font-mono text-[8px] font-bold">
                      Sem Foto
                    </div>
                  )}
                </div>
                <div className="space-y-2 w-full">
                  <div className="flex gap-2">
                    <label className={`flex items-center justify-center gap-1.5 border border-[#141414] bg-white ${isUploadingFoto ? "opacity-55 cursor-not-allowed" : "hover:bg-neutral-100 cursor-pointer"} text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-colors select-none`}>
                      <Plus className="w-3.5 h-3.5" /> {isUploadingFoto ? "Carregando..." : "Carregar Foto (JPEG/PNG)"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingFoto}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setCropImageSrc(reader.result as string);
                              setIsCropModalOpen(true);
                            };
                            reader.readAsDataURL(file);
                            e.target.value = ""; // Reseta o valor do input para permitir o mesmo arquivo
                          }
                        }}
                      />
                    </label>
                    {fotoUrl && !isUploadingFoto && (
                      <button
                        type="button"
                        onClick={() => setFotoUrl("")}
                        className="border border-red-600 text-red-600 hover:bg-red-50 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-colors cursor-pointer"
                      >
                        Remover Foto
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-[9px] font-mono text-zinc-500 uppercase">Ou URL:</span>
                    <input
                      type="text"
                      placeholder="https://exemplo.com/foto.jpg"
                      value={fotoUrl.startsWith("data:") ? "" : fotoUrl}
                      onChange={(e) => setFotoUrl(e.target.value)}
                      className="grow bg-white text-[#141414]/90 border border-[#141414]/30 px-2.5 py-1 text-xs outline-none focus:border-[#141414]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Treinamento Introdutório Aura (Início) */}
            <div className="p-4 border border-[#141414]/20 bg-amber-50/20 space-y-3 max-w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">
                    📅 Início do Treinamento Introdutório Aura
                  </label>
                  <input
                    type="date"
                    value={dataTreinamentoAura}
                    onChange={(e) => setDataTreinamentoAura(e.target.value)}
                    className="w-full bg-white text-[#141414] border border-[#141414] px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-sans"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">
                    🆔 Matrícula Aura (Mat. Aura)
                  </label>
                  <input
                    type="text"
                    value={matriculaAura}
                    onChange={(e) => setMatriculaAura(e.target.value)}
                    placeholder="Código da Matrícula Aura"
                    className="w-full bg-white text-[#141414] border border-[#141414] px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-sans"
                  />
                </div>
              </div>
              <span className="text-[9px] text-[#141414]/65 font-mono block uppercase">
                O treinamento dura 2 dias. Se selecionar uma data (ex: 02/02/2026), será exibido no relatório como "02/02/2026 - 03/02/2026".
              </span>
            </div>

            {/* Observações / Restrições do Trabalhador */}
            <div className="p-4 border border-[#141414]/20 bg-[#E4E3E0]/15 space-y-1.5 max-w-full">
              <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Observações / Restrições do Colaborador</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Exemplo: Restrição Aura, possui restrição médica, etc..."
                className="w-full bg-white text-[#141414] border border-[#141414] px-3 py-2 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-sans h-20 resize-none"
              />
              <span className="text-[9px] text-[#141414]/65 font-mono block uppercase">
                Aviso: Caso digite "Restrição Aura" (ou similar), o crachá ficará bloqueado e o status será "Restrição".
              </span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
              >
                {editingMatricula ? "Salvar Alterações" : "Gravar Ficha"}
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="border border-[#141414]/30 hover:border-[#141414] text-xs font-mono font-bold uppercase tracking-widest px-4 py-2.5 transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Caixa de Busca e Listagem */}
      <div className="bg-white border border-[#141414] overflow-hidden">
        
        <div className="p-4 border-b border-[#141414]/15 bg-[#E4E3E0]/30 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por Código, Nome, Função ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-[#141414] pl-9 pr-4 py-2 text-xs border border-[#141414] rounded-none focus:ring-1 focus:ring-[#141414] outline-none font-mono"
            />
          </div>
          
          <div className="text-[10px] text-[#141414] font-mono font-bold uppercase tracking-tight">
            EXIBINDO {filteredColaboradores.length} DE {colaboradores.length} COLABORADORES DO EXPEDIENTE.
          </div>
        </div>

        {/* Grade de Listagem */}
        <div className="overflow-x-auto">
          {filteredColaboradores.length === 0 ? (
            <div className="p-12 text-center text-[#141414]">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#141414]/60" />
              <p className="text-sm font-serif italic font-bold">Nenhum colaborador localizado nos registros.</p>
              <p className="text-[10px] font-mono uppercase tracking-tight opacity-60">Cadastre um novo funcionário ou revise a busca.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs min-w-[1250px]">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                  <th className="px-5 py-3">Matrícula</th>
                  <th className="px-5 py-3">Nome Completo</th>
                  <th className="px-5 py-3">Função</th>
                  <th className="px-5 py-3">CPF</th>
                  <th className="px-5 py-3">Origem Mo</th>
                  <th className="px-5 py-3">Cidade / UF</th>
                  <th className="px-5 py-3">Data Admissão</th>
                  <th className="px-5 py-3">Regime</th>
                  <th className="px-5 py-3">Início Projeto</th>
                  <th className="px-5 py-3">Status Projeto / Transferência</th>
                  <th className="px-5 py-3">Status Ocupacional</th>
                  {isAdmin && <th className="px-5 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15">
                {filteredColaboradores.map((col) => (
                  <tr key={col.matricula} className="hover:bg-[#141414]/5 transition-colors text-[#141414]">
                    
                    {/* Matricula */}
                    <td className="px-5 py-3.5 font-mono font-extrabold select-all uppercase tracking-tight">{col.matricula}</td>
                    
                    {/* Nome */}
                    <td className="px-5 py-3.5 font-serif font-extrabold italic select-all">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full border border-[#141414]/15 bg-neutral-100 flex items-center justify-center overflow-hidden shrink-0">
                          {col.fotoUrl ? (
                            <img src={getDirectDriveImageURL(col.fotoUrl)} alt={col.nomeCompleto} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-gray-400 select-none">
                              {col.nomeCompleto ? col.nomeCompleto.charAt(0).toUpperCase() : "?"}
                            </span>
                          )}
                        </div>
                        <span>{col.nomeCompleto}</span>
                      </div>
                    </td>
                    
                    {/* Função */}
                    <td className="px-5 py-3.5 font-serif tracking-tight font-medium">{col.funcao}</td>
                    
                    {/* CPF */}
                    <td className="px-5 py-3.5 font-mono opacity-80">{col.cpf}</td>
                    
                    {/* Mão de Obra Badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 border border-[#141414] text-[9px] font-mono font-extrabold uppercase ${
                        col.tipoMaoDeObra === "MOI" 
                          ? "bg-white text-[#141414]" 
                          : "bg-[#141414] text-[#E4E3E0]"
                      }`}>
                        {col.tipoMaoDeObra}
                      </span>
                    </td>

                    {/* Origem */}
                    <td className="px-5 py-3.5 font-serif font-medium opacity-85">
                      {col.cidade}/{col.estado}
                    </td>

                    {/* Admissão */}
                    <td className="px-5 py-3.5 font-mono text-[11px]">
                      {formatBrDate(col.dataAdmissao)}
                    </td>

                    {/* Regime */}
                    <td className="px-5 py-3.5">
                      <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border border-[#141414] ${
                        col.regimeTrabalho === "Alojado" 
                          ? "bg-yellow-100 text-[#141414]" 
                          : "bg-white text-[#141414]"
                      }`}>
                        {col.regimeTrabalho}
                      </span>
                    </td>

                    {/* Data Inicio Projeto */}
                    <td className="px-5 py-3.5 font-mono text-[11px]">
                      {formatBrDate(col.dataInicioProjeto)}
                    </td>

                    {/* Transferido */}
                    <td className="px-5 py-3.5">
                      {col.transferido ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-red-700 font-extrabold font-mono uppercase tracking-tighter">TRANSFERIDO</span>
                          <span className="text-[9px] text-[#141414]/75 font-serif select-all">{col.projetoAtual}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#141414]/65 font-serif font-medium">Projeto Aura Borborema Filtragem - Currais Novos</span>
                      )}
                    </td>

                    {/* Status Ativo/Inativo */}
                    <td className="px-5 py-3.5">
                      {col.status === "Inativo" ? (
                        <div className="flex flex-col">
                          <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border border-red-700 bg-red-50 text-red-700 w-fit">
                            INATIVO
                          </span>
                          {col.dataInativacao && (
                            <span className="text-[9px] font-mono text-neutral-500 mt-0.5">
                              {formatBrDate(col.dataInativacao)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border border-emerald-700 bg-emerald-50 text-emerald-700 w-fit">
                          ATIVO
                        </span>
                      )}
                    </td>

                    {/* Acoes */}
                    {isAdmin && (
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(col)}
                            title="Editar cadastro de colaborador"
                            className="p-1.5 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(col.matricula, col.nomeCompleto)}
                            title="Excluir cadastro da base unificada"
                            className="p-1.5 border border-[#141414] bg-white text-red-700 hover:bg-neutral-950 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}

                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal Customizado de Confirmação de Deleção (Sem bloqueios no iFrame) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#141414]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR REMOÇÃO</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Atenção! Você está prestes a excluir o registro de <strong className="text-black font-semibold font-serif italic">{deleteConfirm.nomeCompleto}</strong> (Matrícula: {deleteConfirm.matricula}).
                </p>
                <p className="text-[10px] text-red-650 font-mono font-bold uppercase tracking-tight">
                  ⚠️ ESTA AÇÃO IRÁ APAGAR EM CASCATA TODOS OS DADOS DE ASO, TREINAMENTOS E VIAGENS DESTE COLABORADOR.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer border border-red-800 font-extrabold"
              >
                Sim, Remover
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-[#141414]/30 hover:border-[#141414] hover:bg-[#141414]/5 text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer text-[#141414]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recorte de Imagem */}
      <ImageCropperModal
        isOpen={isCropModalOpen}
        onClose={() => setIsCropModalOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
      />

    </div>
  );
}
