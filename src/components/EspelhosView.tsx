import React, { useState, useMemo } from "react";
import { 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Folder, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  User, 
  Calendar, 
  CheckSquare, 
  Square, 
  FileDown, 
  X,
  RefreshCw,
  Eye,
  Info,
  Sparkles
} from "lucide-react";
import { Colaborador, Espelho } from "../types";
import { getOrCreateFolderHierarchy, uploadFileToDrive } from "../lib/googleAuth";
import { verificarElegibilidadeDocumentoMes } from "../utils/colaboradorStatus";
import JSZip from "jszip";

interface EspelhosViewProps {
  colaboradores: Colaborador[];
  espelhos: Espelho[];
  onAddEspelho: (novo: Espelho) => Promise<void>;
  onDeleteEspelho: (id: string) => Promise<void>;
  googleToken: string | null;
  isAdmin: boolean;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

export default function EspelhosView({
  colaboradores,
  espelhos,
  onAddEspelho,
  onDeleteEspelho,
  googleToken,
  isAdmin
}: EspelhosViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const currentMonthIndex = new Date().getMonth();
    return MONTHS[currentMonthIndex];
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  // State variables for pre-upload preview modal
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewColaborador, setPreviewColaborador] = useState<Colaborador | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ esp: Espelho; nomeCol: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  // Upload status and loading feedbacks per employee
  const [uploadingMatricula, setUploadingMatricula] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Checkbox Selection for Batch Download
  const [selectedMatriculas, setSelectedMatriculas] = useState<Set<string>>(new Set());

  // Index espelhos for high-speed map lookups
  const espelhoMap = useMemo(() => {
    const map: Record<string, Espelho> = {};
    espelhos.forEach(esp => {
      if (esp.mes === selectedMonth && esp.ano === selectedYear) {
        map[esp.matricula] = esp;
      }
    });
    return map;
  }, [espelhos, selectedMonth, selectedYear]);

  // Mapeamento de elegibilidade e regras de cobrança (mobilização e desmobilização)
  const elegibilidadeMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof verificarElegibilidadeDocumentoMes>> = {};
    colaboradores.forEach(c => {
      map[c.matricula] = verificarElegibilidadeDocumentoMes(c, selectedMonth, selectedYear);
    });
    return map;
  }, [colaboradores, selectedMonth, selectedYear]);

  // Métricas analíticas do período
  const metricasCobranca = useMemo(() => {
    let aCobrar = 0;
    let pendentes = 0;
    let anexados = 0;
    let naoMobilizados = 0;
    let desmobilizados = 0;
    let isentos = 0;

    colaboradores.forEach(c => {
      const eleg = elegibilidadeMap[c.matricula];
      const esp = espelhoMap[c.matricula];

      if (esp && !esp.tipoIsencao) {
        anexados++;
      } else if (esp && esp.tipoIsencao) {
        isentos++;
      }

      if (eleg?.statusCobranca === 'nao_mobilizado') {
        naoMobilizados++;
      } else if (eleg?.statusCobranca === 'desmobilizado') {
        desmobilizados++;
      } else if (eleg?.cobrar) {
        aCobrar++;
        if (!esp) {
          pendentes++;
        }
      }
    });

    return { aCobrar, pendentes, anexados, naoMobilizados, desmobilizados, isentos };
  }, [colaboradores, elegibilidadeMap, espelhoMap]);

  // Check active filter list of employees
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    // Exibe colaboradores que estiveram ativos no período ou que possuem espelho anexado
    let list = colaboradores.filter(c => {
      const eleg = elegibilidadeMap[c.matricula];
      const esp = espelhoMap[c.matricula];
      // Se não tem espelho e foi desmobilizado antes do período, só exibe se o filtro específico for solicitado
      if (!esp && eleg.statusCobranca === 'desmobilizado' && statusFilter !== 'desmobilizado' && statusFilter !== 'todos') {
        return false;
      }
      return true;
    });

    if (statusFilter !== "todos") {
      list = list.filter(c => {
        const esp = espelhoMap[c.matricula];
        const eleg = elegibilidadeMap[c.matricula];

        if (statusFilter === "a_cobrar") return eleg.cobrar;
        if (statusFilter === "pendente") return eleg.cobrar && !esp;
        if (statusFilter === "anexado") return esp && !esp.tipoIsencao;
        if (statusFilter === "nao_mobilizado") return eleg.statusCobranca === 'nao_mobilizado';
        if (statusFilter === "desmobilizado") return eleg.statusCobranca === 'desmobilizado';
        if (statusFilter === "nao_bate_ponto") return esp && esp.tipoIsencao === "nao_bate_ponto";
        if (statusFilter === "admitido_no_mes") return esp && esp.tipoIsencao === "admitido_no_mes";
        if (statusFilter === "isento") return (esp && !!esp.tipoIsencao) || !eleg.cobrar;
        return true;
      });
    }

    const matched = !term ? list : list.filter(
      c => 
        c.matricula.toLowerCase().includes(term) || 
        c.nomeCompleto.toLowerCase().includes(term) ||
        c.funcao.toLowerCase().includes(term)
    );
    // Sort alphabetically by full name
    return [...matched].sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"));
  }, [colaboradores, searchTerm, statusFilter, espelhoMap, elegibilidadeMap]);

  // Batch Selection utilities
  const handleToggleSelectRow = (matricula: string) => {
    const esp = espelhoMap[matricula];
    if (!esp || esp.tipoIsencao) return; // Only selectable if physical file has been uploaded
    setSelectedMatriculas((prev) => {
      const next = new Set(prev);
      if (next.has(matricula)) {
        next.delete(matricula);
      } else {
        next.add(matricula);
      }
      return next;
    });
  };

  const handleSelectPageAll = () => {
    const activeWithFiles = filteredEmployees.filter(c => {
      const esp = espelhoMap[c.matricula];
      return esp && !esp.tipoIsencao;
    });
    const allSelectedOnPage = activeWithFiles.length > 0 && activeWithFiles.every(c => selectedMatriculas.has(c.matricula));

    setSelectedMatriculas((prev) => {
      const next = new Set(prev);
      activeWithFiles.forEach(c => {
        if (allSelectedOnPage) {
          next.delete(c.matricula);
        } else {
          next.add(c.matricula);
        }
      });
      return next;
    });
  };

  // State for automatic Google Drive scanning and restoration
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  const handleSyncFromDrive = async () => {
    if (!googleToken) {
      setActionError("Atenção: Por favor, conecte a sua conta do Google Drive no menu lateral primeiro.");
      return;
    }

    setIsSyncingDrive(true);
    setActionError(null);
    setActionSuccess("Iniciando varredura no Google Drive para localizar e restaurar espelhos de ponto...");

    try {
      // 1. Obter hierarquia de pastas
      const hierarchy = await getOrCreateFolderHierarchy(googleToken);
      if (!hierarchy || !hierarchy.espelhosId) {
        throw new Error("Não foi possível localizar o diretório '06. Espelhos de Ponto' no seu Google Drive.");
      }

      // 2. Localizar subpasta correspondente ao período selecionado
      const folderName = `${selectedMonth} - ${selectedYear}`;
      let targetUserFolderId = "";

      const query = `name='${folderName.replace(/'/g, "\\'")}' and '${hierarchy.espelhosId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          targetUserFolderId = searchData.files[0].id;
        }
      }

      if (!targetUserFolderId) {
        setActionSuccess(`Nenhuma pasta de upload encontrada no Google Drive para o período ${selectedMonth} - ${selectedYear}.`);
        setIsSyncingDrive(false);
        return;
      }

      // 3. Listar arquivos nesta pasta
      const listQuery = `'${targetUserFolderId}' in parents and trashed=false`;
      const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(listQuery)}&fields=files(id,name,webViewLink)&pageSize=1000`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (!listRes.ok) {
        throw new Error(`Erro ao listar arquivos do Google Drive (${listRes.status})`);
      }

      const listData = await listRes.json();
      const files = listData.files || [];

      if (files.length === 0) {
        setActionSuccess(`Nenhum arquivo de espelho de ponto encontrado fisicamente na pasta do Drive para ${selectedMonth} - ${selectedYear}.`);
        setIsSyncingDrive(false);
        return;
      }

      // 4. Mapear para colaboradores e recriar metadados perdidos
      let addedCount = 0;
      let alreadyExistsCount = 0;

      for (const col of filteredEmployees) {
        const hasLocalMetadata = espelhos.some(e => e.matricula === col.matricula && e.mes === selectedMonth && e.ano === selectedYear);
        if (hasLocalMetadata) {
          alreadyExistsCount++;
          continue;
        }

        const matchedFile = files.find((f: any) => {
          const lowerFileName = f.name.toLowerCase();
          const lowerEmployeeName = col.nomeCompleto.toLowerCase();
          return lowerFileName.includes(lowerEmployeeName);
        });

        if (matchedFile) {
          const localPayload: Espelho = {
            id: `ESP-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            matricula: col.matricula,
            mes: selectedMonth,
            ano: selectedYear,
            fileName: matchedFile.name,
            fileUrl: matchedFile.webViewLink,
            driveFileId: matchedFile.id,
            driveFolderId: targetUserFolderId,
            dataUpload: new Date().toISOString().split("T")[0]
          };

          await onAddEspelho(localPayload);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        setActionSuccess(`Varredura concluída! Foram recuperados e vinculados ${addedCount} espelhos de ponto diretamente do Google Drive.`);
      } else {
        setActionSuccess(`Varredura concluída. Todos os espelhos de ponto físicos encontrados já estão vinculados nesta tela (${alreadyExistsCount} itens conferidos).`);
      }
    } catch (err: any) {
      console.error(err);
      setActionError(`Erro ao sincronizar com Google Drive: ${err.message || err}`);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // File Selection and Pre-upload Preview logic
  const handleFileSelection = (col: Colaborador, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setPreviewFile(file);
    setPreviewColaborador(col);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = ""; // clear input
  };

  const handleCancelUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewColaborador(null);
    setPreviewUrl(null);
  };

  const handleConfirmUpload = async () => {
    if (!previewFile || !previewColaborador) return;

    const col = previewColaborador;
    const file = previewFile;
    const currentUrl = previewUrl;

    // Reset preview state to close modal
    setPreviewFile(null);
    setPreviewColaborador(null);
    setPreviewUrl(null);

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }

    if (!googleToken) {
      setActionError("Atenção: Por favor, conecte a sua conta do Google Drive no menu lateral primeiro.");
      return;
    }

    setUploadingMatricula(col.matricula);
    setActionError(null);
    setActionSuccess(null);

    try {
      // 1. Check parent hierarchy folders in GDrive ("Gestão de Folga" -> "06. Espelhos de Ponto")
      const hierarchy = await getOrCreateFolderHierarchy(googleToken);
      if (!hierarchy || !hierarchy.espelhosId) {
        throw new Error("Não foi possível localizar o diretório '06. Espelhos de Ponto' no seu Google Drive.");
      }

      // 2. Query/Create subdirectory specifically for this month-year: "Mes - Ano" (not for each employee)
      const folderName = `${selectedMonth} - ${selectedYear}`;
      let targetUserFolderId = "";

      // Try searching inside 06. Espelhos de Ponto first
      const query = `name='${folderName.replace(/'/g, "\\'")}' and '${hierarchy.espelhosId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          targetUserFolderId = searchData.files[0].id;
        }
      }

      // If subdirectory doesn't exist, create it
      if (!targetUserFolderId) {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [hierarchy.espelhosId]
          })
         });

        if (!createRes.ok) {
          throw new Error("Erro ao criar o diretório específico do mês no Drive.");
        }
        const createdFolder = await createRes.json();
        targetUserFolderId = createdFolder.id;

        // Concede permissão de leitura
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${targetUserFolderId}/permissions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ role: "reader", type: "anyone" })
          });
        } catch {
          // ignore permission errors gracefully
        }
      }

      // 3. Rename file exactly as: "Mês - Nome do Funcionário.ext"
      const fileExt = file.name.split(".").pop() || "pdf";
      const customFileName = `${selectedMonth} - ${col.nomeCompleto}.${fileExt}`;
      const renamedFile = new File([file], customFileName, { type: file.type });

      // 4. Upload rewritten file directly to Google Drive
      const uploadResult = await uploadFileToDrive(googleToken, renamedFile, targetUserFolderId);
      if (!uploadResult || !uploadResult.id) {
        throw new Error("Falha no upload do arquivo renomado.");
      }

      // 5. Save the newly resolved metadata in SQLite / Firestore base
      const localPayload: Espelho = {
        id: `ESP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        matricula: col.matricula,
        mes: selectedMonth,
        ano: selectedYear,
        fileName: customFileName,
        fileUrl: uploadResult.webViewLink,
        driveFileId: uploadResult.id,
        driveFolderId: targetUserFolderId,
        dataUpload: new Date().toISOString().split("T")[0]
      };

      await onAddEspelho(localPayload);
      setActionSuccess(`Espelho de ponto de ${col.nomeCompleto} anexado e sincronizado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      setActionError(`Falha ao realizar operação: ${err.message || "Erro de conexão"}`);
    } finally {
      setUploadingMatricula(null);
    }
  };

  // Safe delete both metadata and Google Drive file if possible
  const handleDeleteFile = (esp: Espelho, nomeCol: string) => {
    if (!isAdmin) return;
    setDeleteConfirm({ esp, nomeCol });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { esp, nomeCol } = deleteConfirm;
    setDeleteConfirm(null);

    setUploadingMatricula(esp.matricula);
    setActionError(null);
    setActionSuccess(null);

    try {
      // 1. Delete on Google Drive first
      if (esp.driveFileId && googleToken) {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${esp.driveFileId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${googleToken}` }
          });
          console.log("[GDrive] Arquivo excluído com sucesso do Drive.");
        } catch (driveErr) {
          console.warn("[GDrive Warning] Erro deletando arquivo físico, talvez já apagado:", driveErr);
        }
      }
    } catch (err) {
      console.warn("[GDrive Warning] Falha na rede ao tentar deletar do GDrive:", err);
    }

    // 2. Delete database metadata (This must always run, ensuring deletion option is operational!)
    try {
      await onDeleteEspelho(esp.id);
      
      // Clean selected box if active
      setSelectedMatriculas((prev) => {
        const next = new Set(prev);
        next.delete(esp.matricula);
        return next;
      });

      setActionSuccess(`Espelho de ponto de ${nomeCol} excluído com sucesso.`);
    } catch (err: any) {
      console.error(err);
      setActionError(`Erro de remoção: ${err.message || err}`);
    } finally {
      setUploadingMatricula(null);
    }
  };

  const handleSelectIsencao = async (col: Colaborador, value: string) => {
    if (!value) return;
    if (!isAdmin) return;

    setUploadingMatricula(col.matricula);
    setActionError(null);
    setActionSuccess(null);

    try {
      const isencaoName = value === "nao_bate_ponto" ? "Não bate ponto" : "Admitido no mês";
      
      const localPayload: Espelho = {
        id: `ESP-${Date.now()}-${Math.floor(Math.random() * 1005)}`,
        matricula: col.matricula,
        mes: selectedMonth,
        ano: selectedYear,
        fileName: isencaoName,
        dataUpload: new Date().toISOString().split("T")[0],
        tipoIsencao: value as 'nao_bate_ponto' | 'admitido_no_mes'
      };

      await onAddEspelho(localPayload);
      setActionSuccess(`Isenção (${isencaoName}) gravada com sucesso para ${col.nomeCompleto}.`);
    } catch (err: any) {
      console.error(err);
      setActionError(`Falha ao gravar isenção: ${err.message || "Erro de conexão"}`);
    } finally {
      setUploadingMatricula(null);
    }
  };

  // Fast Download selected items compressed in one single ZIP folder recursively
  const handleDownloadSelected = async () => {
    const toDownload = filteredEmployees.filter(col => selectedMatriculas.has(col.matricula) && espelhoMap[col.matricula]);
    if (toDownload.length === 0) {
      alert("Nenhum espelho de ponto selecionado ou disponível para download.");
      return;
    }

    setActionSuccess(`Analisando e baixando ${toDownload.length} arquivos para compactação (0%)...`);
    setActionError(null);

    try {
      const zip = new JSZip();
      let successCount = 0;
      let currentIndex = 0;

      for (const col of toDownload) {
        currentIndex++;
        const percent = Math.round(((currentIndex - 1) / toDownload.length) * 100);
        setActionSuccess(`Baixando arquivos para compactação: ${percent}% (${currentIndex - 1}/${toDownload.length})...`);
        const esp = espelhoMap[col.matricula];
        if (!esp.driveFileId) continue;

        try {
          const headers: HeadersInit = googleToken ? { Authorization: `Bearer ${googleToken}` } : {};
          const response = await fetch(`/api/gdrive-proxy?fileId=${esp.driveFileId}`, { headers });
          if (!response.ok) throw new Error("Erro de streaming no proxy.");

          const blob = await response.blob();
          const fileName = esp.fileName || `${selectedMonth}_${selectedYear}_${col.nomeCompleto}.pdf`;
          zip.file(fileName, blob);
          successCount++;
        } catch (err) {
          console.error(`Erro ao carregar arquivo de ${col.nomeCompleto} do Drive:`, err);
        }
      }

      if (successCount === 0) {
        throw new Error("Não foi possível carregar nenhum dos arquivos selecionados do Google Drive.");
      }

      setActionSuccess("Compactando e gerando o ZIP: 0%...");
      const zipContent = await zip.generateAsync({ type: "blob" }, (metadata) => {
        setActionSuccess(`Compactando e gerando o ZIP: ${Math.round(metadata.percent)}%...`);
      });

      const downloadUrl = window.URL.createObjectURL(zipContent);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Espelhos_${selectedMonth}_${selectedYear}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setActionSuccess(`Pacote zipado criado com sucesso! Baixados ${successCount} registros em 'Espelhos_${selectedMonth}_${selectedYear}.zip'.`);
    } catch (err: any) {
      console.error("Erro na compactação ZIP:", err);
      setActionError(`Falha durante compactação ZIP: ${err.message || err}`);
    }
  };

  // Derived calculations
  const totalEmployeesCount = filteredEmployees.length;
  const totalUploadedOnlyCount = filteredEmployees.filter(c => {
    const esp = espelhoMap[c.matricula];
    return esp && !esp.tipoIsencao;
  }).length;
  const totalExemptCount = filteredEmployees.filter(c => {
    const esp = espelhoMap[c.matricula];
    return esp && esp.tipoIsencao;
  }).length;
  const totalUploadedOrExemptCount = filteredEmployees.filter(c => espelhoMap[c.matricula]).length;
  const totalPendingCount = totalEmployeesCount - totalUploadedOrExemptCount;

  return (
    <div className="bg-white border border-[#141414]/15 shadow-xs p-6" id="view-espelhos">
      
      {/* Top Section / Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#141414]/10 pb-6 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-800 tracking-tight flex items-center gap-2">
            <Folder className="w-6 h-6 text-indigo-600" />
            06. Espelhos de Ponto
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Módulo de controle, upload e download em lote de espelhos de ponto mensais vinculados ao Google Drive.
          </p>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="flex items-center gap-3 self-stretch md:self-auto">
          <div className="flex-1 md:flex-none border border-[#141414]/10 px-4 py-2 font-mono text-center md:text-left">
            <span className="block text-[10px] text-neutral-400 font-bold uppercase">Cadastrados</span>
            <span className="text-base font-extrabold text-slate-700">{totalEmployeesCount}</span>
          </div>
          <div className="flex-1 md:flex-none border border-emerald-200 bg-emerald-50/20 px-4 py-2 font-mono text-center md:text-left">
            <span className="block text-[10px] text-emerald-600 font-bold uppercase">Concluídos/Isentos</span>
            <div className="flex items-baseline gap-1.5 justify-center md:justify-start">
              <span className="text-base font-extrabold text-emerald-600">{totalUploadedOrExemptCount}</span>
              <span className="text-[10px] text-emerald-500 font-semibold select-none">({totalUploadedOnlyCount}a • {totalExemptCount}i)</span>
            </div>
          </div>
          <div className="flex-1 md:flex-none border border-amber-200 bg-amber-50/10 px-4 py-2 font-mono text-center md:text-left">
            <span className="block text-[10px] text-amber-600 font-bold uppercase">Pendentes</span>
            <span className="text-base font-extrabold text-[#78350f]">{totalPendingCount}</span>
          </div>
        </div>
      </div>

      {/* Action / Logs Area */}
      {actionError && (
        <div className="mb-4 p-4 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="hover:text-red-950 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4 p-4 border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="hover:text-emerald-950 font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Warning GDrive Token status */}
      {!googleToken && (
        <div className="mb-6 p-4 border-2 border-amber-400 bg-amber-50/60 rounded-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Google Drive Desconectado</h4>
              <p className="text-xs text-amber-800 leading-snug mt-1">
                Você deve conectar o Google Drive clicando no botão <strong>"Conectar GDrive"</strong> no menu lateral antes de anexar arquivos aos colaboradores.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 border border-[#141414]/10 p-4 mb-6">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 border border-[#141414]/15 bg-white text-xs font-sans focus:outline-none focus:border-indigo-600 rounded-lg placeholder-neutral-450"
            placeholder="Pesquisar matrícula, nome ou função..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Month, Year Dropdowns and Action Buttons */}
        <div className="flex items-center flex-wrap gap-3 w-full md:w-auto justify-end">
          
          <select
            className="px-3 py-2 border border-[#141414]/15 bg-white text-xs font-semibold leading-tight rounded-md focus:outline-none focus:border-indigo-600 cursor-pointer text-slate-700"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedMatriculas(new Set()); // refresh select set
            }}
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="anexado">Anexado</option>
            <option value="nao_bate_ponto">Não bate ponto</option>
            <option value="admitido_no_mes">Admitido no mês</option>
            <option value="isento">Isento</option>
          </select>

          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-neutral-450 pr-0.5 shrink-0" />
            <select
              className="px-3 py-2 border border-[#141414]/15 bg-white text-xs font-semibold leading-tight rounded-md focus:outline-none focus:border-indigo-600"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedMatriculas(new Set()); // refresh select set
              }}
            >
              {MONTHS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <select
            className="px-3 py-2 border border-[#141414]/15 bg-white text-xs font-semibold leading-tight rounded-md focus:outline-none focus:border-indigo-600"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setSelectedMatriculas(new Set()); // refresh select set
            }}
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Batch action button */}
          <button
            onClick={handleDownloadSelected}
            disabled={selectedMatriculas.size === 0}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase font-sans tracking-wide rounded-md border border-indigo-700 select-none cursor-pointer transition-all ${
              selectedMatriculas.size > 0 
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
                : "bg-slate-100 text-neutral-400 border-neutral-300 opacity-60 cursor-not-allowed"
            }`}
          >
            <FileDown className="w-4 h-4" />
            Baixar Selecionados ({selectedMatriculas.size})
          </button>

          {/* Sync GDrive button */}
          {googleToken && (
            <button
              onClick={handleSyncFromDrive}
              disabled={isSyncingDrive}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase font-sans tracking-wide rounded-md border border-emerald-700 select-none cursor-pointer transition-all ${
                isSyncingDrive
                  ? "bg-slate-100 text-neutral-400 border-neutral-300 opacity-60 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
              }`}
              title="Varre a pasta correspondente no Google Drive e vincula os arquivos encontrados aos colaboradores"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingDrive ? "animate-spin" : ""}`} />
              {isSyncingDrive ? "Sincronizando..." : "Sincronizar Drive"}
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar border border-[#141414]/15 rounded-lg">
        <table className="w-full text-left font-sans border-collapse">
          <thead className="sticky top-0 z-10 shadow-xs bg-slate-100">
            <tr className="bg-slate-100 border-b border-[#141414]/15 text-[10px] font-mono uppercase text-neutral-500 font-bold tracking-wider">
              <th className="px-5 py-3 w-12 text-center">
                <button
                  onClick={handleSelectPageAll}
                  className="p-1 rounded-sm text-neutral-400 hover:text-indigo-600 transition-colors focus:outline-none"
                  title="Selecionar todos os anexados da lista"
                >
                  {filteredEmployees.filter(c => { const e = espelhoMap[c.matricula]; return e && !e.tipoIsencao; }).length > 0 && 
                   filteredEmployees.filter(c => { const e = espelhoMap[c.matricula]; return e && !e.tipoIsencao; }).every(c => selectedMatriculas.has(c.matricula)) ? (
                    <CheckSquare className="w-4.5 h-4.5 text-indigo-650" />
                  ) : (
                    <Square className="w-4.5 h-4.5" />
                  )}
                </button>
              </th>
              <th className="px-5 py-3 w-28">Matrícula</th>
              <th className="px-5 py-3">Nome / Cargo</th>
              <th className="px-5 py-3 w-48">Mês de Referência</th>
              <th className="px-5 py-3 w-40 text-center">Status</th>
              <th className="px-5 py-3 w-64 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#141414]/10 bg-white">
            {filteredEmployees.length === 0 ? (
              <tr className="bg-white">
                <td colSpan={6} className="px-5 py-12 text-center text-xs text-neutral-400 font-mono uppercase">
                  Nenhum colaborador ativo encontrado na pesquisa.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((col) => {
                const esp = espelhoMap[col.matricula];
                const eleg = elegibilidadeMap[col.matricula];
                const isSelected = selectedMatriculas.has(col.matricula);

                return (
                  <tr key={col.matricula} className="hover:bg-slate-50/40 transition-colors">
                    
                    {/* Checkbox selector selection (allowed only if physical espelho has been uploaded) */}
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleToggleSelectRow(col.matricula)}
                        disabled={!esp || !!esp.tipoIsencao}
                        className={`p-1 rounded-sm transition-colors focus:outline-none ${
                          esp && !esp.tipoIsencao ? "text-neutral-500 hover:text-indigo-600 cursor-pointer" : "text-neutral-200 cursor-not-allowed"
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4.5 h-4.5 text-indigo-650" />
                        ) : (
                          <Square className="w-4.5 h-4.5" />
                        )}
                      </button>
                    </td>

                    {/* Employee registration */}
                    <td className="px-5 py-3.5 font-mono text-[11x] font-extrabold text-indigo-950 uppercase selection:bg-indigo-100">
                      {col.matricula}
                    </td>

                    {/* Employee metadata */}
                    <td className="px-5 py-3.5">
                      <div className="font-extrabold text-[13px] text-slate-800">{col.nomeCompleto}</div>
                      <div className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase mt-0.5">{col.funcao}</div>
                    </td>

                    {/* Month period */}
                    <td className="px-5 py-3.5 font-mono text-xs select-none">
                      <div className="flex items-center gap-1.5 text-neutral-600 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        <span>{selectedMonth}/{selectedYear}</span>
                      </div>
                    </td>

                    {/* Upload badge */}
                    <td className="px-5 py-3.5 text-center select-none">
                      {esp ? (
                        esp.tipoIsencao === "nao_bate_ponto" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold uppercase rounded-md">
                            <Info className="w-3 h-3 text-sky-600 animate-pulse" />
                            Não bate ponto
                          </span>
                        ) : esp.tipoIsencao === "admitido_no_mes" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-800 border border-purple-200 text-[10px] font-bold uppercase rounded-md">
                            <Sparkles className="w-3 h-3 text-purple-600" />
                            Admitido no mês
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase rounded-md">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Anexado
                          </span>
                        )
                      ) : eleg?.statusCobranca === "nao_mobilizado" ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold uppercase rounded-md"
                          title={eleg.mensagem}
                        >
                          <Info className="w-3 h-3 text-slate-500" />
                          Não mobilizado
                        </span>
                      ) : eleg?.statusCobranca === "desmobilizado" ? (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase rounded-md"
                          title={eleg.mensagem}
                        >
                          <X className="w-3 h-3 text-rose-500" />
                          Desmobilizado (Não cobrar)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase rounded-md">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          Pendente
                        </span>
                      )}
                    </td>

                    {/* Active CRUD file actions */}
                    <td className="px-5 py-3.5 text-right flex items-center justify-center gap-2">
                      {uploadingMatricula === col.matricula ? (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-600 font-bold uppercase py-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Sincronizando...</span>
                        </div>
                      ) : (
                        <>
                          {/* File present: download or view */}
                          {esp ? (
                            <div className="flex items-center gap-1.5">
                              {esp.tipoIsencao ? (
                                <div className="text-[10px] text-slate-500 font-bold bg-slate-100 rounded-md border border-slate-200 px-2 py-1 flex items-center gap-1 select-none uppercase">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Isento de anexo
                                </div>
                              ) : (
                                <>
                                  {/* Direct view link (Drive viewer) */}
                                  <a
                                    href={esp.fileUrl || `/api/gdrive-proxy?fileId=${esp.driveFileId}&token=${googleToken || ""}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#141414]/15 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                                    title="Visualizar documento no Google Drive"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Ver</span>
                                  </a>

                                  {/* Download trigger (via proxy blob stream) */}
                                  <a
                                    href={`/api/gdrive-proxy?fileId=${esp.driveFileId}&token=${googleToken || ""}`}
                                    download={esp.fileName}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 text-indigo-700 text-xs font-semibold rounded-md transition-colors"
                                    title="Baixar arquivo diretamente para o computador"
                                  >
                                    <Download className="w-3.5 h-3.5 text-indigo-650" />
                                    <span>Baixar</span>
                                  </a>
                                </>
                              )}

                              {/* Admin deletion option */}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteFile(esp, col.nomeCompleto)}
                                  className="p-1.5 text-neutral-450 hover:bg-red-50 hover:text-red-700 transition-colors uppercase border border-transparent hover:border-red-200 rounded-md cursor-pointer"
                                  title={esp.tipoIsencao ? "Remover isenção" : "Remover espelho de ponto"}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ) : (
                            /* File missing: allow admin upload */
                            isAdmin && (
                              <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 hover:border-indigo-800 text-white text-xs font-bold uppercase hover:shadow-xs rounded-md transition-all cursor-pointer">
                                  <Upload className="w-3.5 h-3.5 text-indigo-100" />
                                  <span>Anexar</span>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                                    className="hidden"
                                    onChange={(e) => handleFileSelection(col, e)}
                                  />
                                </label>

                                <select
                                  className="px-2 py-1.5 border border-[#141414]/15 bg-white text-xs font-semibold rounded-md focus:outline-none focus:border-indigo-600 cursor-pointer text-slate-700"
                                  onChange={(e) => {
                                    handleSelectIsencao(col, e.target.value);
                                    e.target.value = ""; // reset selection
                                  }}
                                  defaultValue=""
                                >
                                  <option value="" disabled>Isentar</option>
                                  <option value="nao_bate_ponto">Não bate ponto</option>
                                  <option value="admitido_no_mes">Admitido no mês</option>
                                </select>
                              </div>
                            )
                          )}
                        </>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pre-upload Interactive Visualization Modal */}
      {previewFile && previewColaborador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans">
          <div className="bg-slate-900 border border-slate-705 p-6 max-w-3xl w-full shadow-2xl rounded-xl flex flex-col max-h-[92vh] text-white">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Pré-Visualização do Espelho de Ponto
              </h3>
              <button 
                onClick={handleCancelUpload} 
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-md transition-all cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 mb-4 bg-slate-950 p-4 border border-slate-800 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <p><strong className="text-slate-405">Colaborador:</strong> <span className="font-semibold text-white">{previewColaborador.nomeCompleto}</span></p>
                <p className="mt-1"><strong className="text-slate-405">Matrícula:</strong> <span className="font-semibold font-mono text-white text-[11px]">{previewColaborador.matricula}</span></p>
              </div>
              <div>
                <p><strong className="text-slate-405">Mês de Referência:</strong> <span className="font-semibold text-white">{selectedMonth}/{selectedYear}</span></p>
                <p className="mt-1"><strong className="text-slate-405">Arquivo:</strong> <span className="font-semibold font-sans text-emerald-400">{previewFile.name}</span> <span className="text-slate-400 text-[10px]">({(previewFile.size / 1024).toFixed(1)} KB)</span></p>
              </div>
            </div>

            {/* Preview Box */}
            <div className="flex-1 overflow-auto bg-slate-955 p-2 rounded-lg border border-slate-800 flex items-center justify-center min-h-[350px]">
              {previewFile.type.startsWith("image/") ? (
                <img src={previewUrl || ""} alt="Visualização" className="max-w-full max-h-[450px] object-contain rounded border border-slate-800 shadow" referrerPolicy="no-referrer" />
              ) : previewFile.type === "application/pdf" ? (
                <div className="text-center p-8 bg-slate-950 rounded-lg max-w-md border border-slate-800 w-full flex flex-col items-center justify-center">
                  <FileText className="w-16 h-16 text-indigo-500 mb-3" />
                  <p className="text-sm font-bold text-slate-200 uppercase">Documento PDF Pronto para Envio</p>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed max-w-sm">
                    Para garantir total compatibilidade e contornar restrições de segurança do seu navegador, clique no botão abaixo para abrir o PDF local em tela cheia na guia ao lado para conferência.
                  </p>
                  
                  <a
                    href={previewUrl || ""}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 px-4 py-2 border border-indigo-550/50 hover:border-indigo-400 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white transition-all rounded-md text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/45"
                  >
                    <Eye className="w-4 h-4 text-indigo-400" />
                    Abrir PDF para Conferência
                  </a>
                  
                  <p className="text-[10px] text-slate-500 mt-3 font-mono">
                    (Seguro • Abre em uma nova guia sem fechar o sistema)
                  </p>
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-950 rounded-lg max-w-md border border-slate-800">
                  <FileText className="w-16 h-16 text-indigo-500 mx-auto mb-3 animate-pulse" />
                  <p className="text-xs font-bold text-slate-200">Pré-visualização Indisponível para este Formato de Arquivo</p>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Você selecionou um arquivo <strong className="text-slate-300 font-mono uppercase">{previewFile.name.split(".").pop()}</strong>. 
                    A visualização direta no seu navegador está disponível apenas para PDF e Imagens (PNG, JPG, JPEG).
                  </p>
                  <p className="text-[10px] text-indigo-400 mt-3 font-semibold">
                    Você ainda assim pode confirmar o envio do arquivo para o Google Drive clicando no botão abaixo!
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCancelUpload}
                className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-705 rounded-md transition-all cursor-pointer border border-[#141414]/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="px-4 py-2 text-xs font-extrabold uppercase tracking-wider bg-indigo-650 hover:bg-indigo-600 text-white rounded-md shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:translate-y-px transition-all flex items-center gap-2 cursor-pointer border border-indigo-700"
              >
                <Upload className="w-4 h-4 text-indigo-100" />
                Confirmar Envio para a Nuvem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
          <div className="bg-slate-900 border border-slate-800 p-6 max-w-md w-full shadow-2xl rounded-xl flex flex-col text-white space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-950/80 border border-red-500/30 text-red-400 rounded-lg shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-red-400 tracking-wide uppercase">CONFIRMAR EXCLUSÃO DO ESPELHO</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Você está prestes a excluir o espelho de ponto do colaborador <strong className="text-white font-semibold">{deleteConfirm.nomeCol}</strong> para o período <strong className="text-white font-semibold">{selectedMonth}/{selectedYear}</strong>.
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                  Isso removerá o arquivo físico associado no Google Drive e limpará permanentemente seus respectivos metadados do banco de dados.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-3 border-t border-slate-850">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-md transition-all cursor-pointer border border-slate-700/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2 text-xs font-extrabold uppercase tracking-wider bg-red-650 hover:bg-red-600 text-white rounded-md shadow-lg shadow-red-600/10 hover:shadow-red-600/20 active:translate-y-px transition-all cursor-pointer border border-red-700"
              >
                Excluir Registro
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
