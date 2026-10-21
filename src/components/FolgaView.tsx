import React, { useState, useMemo, useEffect } from "react";
import { Colaborador, Viagem } from "../types";
import { formatBrDate, addDays, diffDays, formatCurrency } from "../utils/date";
import { 
  Plane, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  AlertCircle, 
  CalendarDays, 
  DollarSign, 
  Milestone,
  CheckCircle,
  Truck,
  History,
  PlaneTakeoff,
  Trash2,
  Download,
  Upload,
  Info,
  Edit,
  Eye,
  X,
  Printer,
  Cloud,
  ExternalLink
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportToExcel, downloadTemplate, parseExcelDate } from "../utils/excel";
import { getOrCreateFolderHierarchy, uploadExcelToGDriveAsSheets, uploadFileToDrive } from "../lib/googleAuth";
import { getDirectDriveImageURL } from "../utils/drive";

interface FolgaViewProps {
  colaboradores: Colaborador[];
  viagens: Viagem[];
  onAddViagem: (viagem: Viagem) => Promise<void>;
  onDeleteViagem: (id: string) => Promise<void>;
  onPrint?: () => void;
  googleToken?: string | null;
  isAdmin?: boolean;
}

export default function FolgaView({ 
  colaboradores, 
  viagens, 
  onAddViagem, 
  onDeleteViagem, 
  onPrint, 
  googleToken,
  isAdmin = true
}: FolgaViewProps) {
  
  // Estados de upload para o Google Drive
  const [isUploadingPassagem, setIsUploadingPassagem] = useState(false);
  const [isUploadingAdiantamento, setIsUploadingAdiantamento] = useState(false);
  const [isUploadingVenda, setIsUploadingVenda] = useState(false);

  // Estados para busca e form
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [dataRealInicio, setDataRealInicio] = useState("");
  const [dataRealRetorno, setDataRealRetorno] = useState("");
  const [tipoTransporte, setTipoTransporte] = useState<"Aéreo" | "Terrestre">("Aéreo");
  const [valorPassagem, setValorPassagem] = useState<string>("");
  const [adiantamento, setAdiantamento] = useState<string>("");
  const [dataDeposito, setDataDeposito] = useState<string>("");
  const [anexoPassagemUrl, setAnexoPassagemUrl] = useState("");
  const [anexoPassagemNome, setAnexoPassagemNome] = useState("");
  const [anexoAdiantamentoUrl, setAnexoAdiantamentoUrl] = useState("");
  const [anexoAdiantamentoNome, setAnexoAdiantamentoNome] = useState("");

  // Edição e Venda de Folga
  const [editingViagemId, setEditingViagemId] = useState<string | null>(null);
  const [vendeuFolga, setVendeuFolga] = useState<boolean>(false);
  const [dataVendaFolga, setDataVendaFolga] = useState<string>("");
  const [valorVendaFolga, setValorVendaFolga] = useState<string>("");
  const [anexoVendaFolgaUrl, setAnexoVendaFolgaUrl] = useState<string>("");
  const [anexoVendaFolgaNome, setAnexoVendaFolgaNome] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; typeLabel: string } | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [subTab, setSubTab] = useState<"escala" | "financeiro">("escala");
  const [financeSearchTerm, setFinanceSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<Colaborador | null>(null);

  // Google Drive Sync States & Effects
  const [gdriveSheetLink, setGdriveSheetLink] = useState<string>(() => sessionStorage.getItem("gdrive_sheet_link_folga") || "");
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);

  const handleLaunchViagem = (matricula: string, dataPrevista: string) => {
    const emp = colaboradores.find(c => c.matricula === matricula);
    if (!emp) return;

    setSelectedMatricula(emp.matricula);
    setEmployeeSearchText(`${emp.matricula} - ${emp.nomeCompleto}`);
    setDataRealInicio(dataPrevista);
    setDataRealRetorno(addDays(dataPrevista, 5));

    setEditingViagemId(null);
    setValorPassagem("");
    setAdiantamento("");
    setDataDeposito("");
    setAnexoPassagemUrl("");
    setAnexoPassagemNome("");
    setAnexoAdiantamentoUrl("");
    setAnexoAdiantamentoNome("");
    setVendeuFolga(false);
    setDataVendaFolga("");
    setValorVendaFolga("");
    setAnexoVendaFolgaUrl("");
    setAnexoVendaFolgaNome("");

    setSubTab("escala");
    setIsFormOpen(true);
    // Smooth scroll to the form element
    setTimeout(() => {
      const element = document.getElementById("btn-open-folga-form");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await onDeleteViagem(deleteConfirm.id);
      setSuccessMsg(`O lançamento de viagem de "${deleteConfirm.name}" foi excluído com sucesso!`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir viagem.");
      setDeleteConfirm(null);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Pesquisar colaboradores ativos para vincular Viagem
  const [employeeSearchText, setEmployeeSearchText] = useState("");
  const lookupEmployeeText = employeeSearchText.trim().toLowerCase();

  const matchingEmployeesInDropdown = useMemo(() => {
    if (!lookupEmployeeText) return [];
    return colaboradores
      .filter(
        c => 
          c.status !== "Inativo" &&
          c.regimeTrabalho === "Alojado" && (
            c.matricula.toLowerCase().includes(lookupEmployeeText) || 
            c.nomeCompleto.toLowerCase().includes(lookupEmployeeText)
          )
      )
      .slice(0, 10);
  }, [colaboradores, lookupEmployeeText]);

  // Colaborador atualmente selecionado para lançamento
  const selectedEmployee = useMemo(() => {
    return colaboradores.find(c => c.matricula === selectedMatricula);
  }, [colaboradores, selectedMatricula]);

  // Viagens lançadas do colaborador selecionado
  const selectedEmployeeViagens = useMemo(() => {
    if (!selectedMatricula) return [];
    return viagens.filter(v => v.matricula === selectedMatricula);
  }, [viagens, selectedMatricula]);

  // Cálculos Automáticos para o Colaborador Selecionado:
  // 1ª Previsão de Folga = Data de Início + 59 dias (MOI) ou 89 dias (MOD)
  const primeiraPrevisaoFolga = useMemo(() => {
    if (!selectedEmployee) return "";
    const dias = selectedEmployee.tipoMaoDeObra === "MOI" ? 59 : 89;
    return addDays(selectedEmployee.dataInicioProjeto, dias);
  }, [selectedEmployee]);

  // Dias trabalhados calculados no formulário de preenchimento (Retorno - Inicio)
  const previewDiasTrabalhados = useMemo(() => {
    if (!dataRealInicio || !dataRealRetorno) return 0;
    const diff = diffDays(dataRealInicio, dataRealRetorno);
    return diff > 0 ? diff : 0;
  }, [dataRealInicio, dataRealRetorno]);

  // Previsão de Próxima Folga (Calculado com base no Retorno se fornecido, ou Início do Projeto)
  const previewSegundaPrevisaoFolga = useMemo(() => {
    if (!selectedEmployee) return "";
    const dias = selectedEmployee.tipoMaoDeObra === "MOI" ? 59 : 89;
    const baseDate = dataRealRetorno || selectedEmployee.dataInicioProjeto;
    return addDays(baseDate, dias);
  }, [selectedEmployee, dataRealRetorno]);

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingViagemId(null);
    setDataRealInicio("");
    setDataRealRetorno("");
    setValorPassagem("");
    setAdiantamento("");
    setDataDeposito("");
    setAnexoPassagemUrl("");
    setAnexoPassagemNome("");
    setAnexoAdiantamentoUrl("");
    setAnexoAdiantamentoNome("");
    setVendeuFolga(false);
    setDataVendaFolga("");
    setValorVendaFolga("");
    setAnexoVendaFolgaUrl("");
    setAnexoVendaFolgaNome("");
    setSelectedMatricula("");
    setEmployeeSearchText("");
  };

  const handleEditViagemClick = (v: Viagem) => {
    setEditingViagemId(v.id);
    setSelectedMatricula(v.matricula);
    const emp = colaboradores.find(c => c.matricula === v.matricula);
    if (emp) {
      setEmployeeSearchText(`${emp.matricula} - ${emp.nomeCompleto}`);
    } else {
      setEmployeeSearchText(v.matricula);
    }
    setDataRealInicio(v.dataRealInicio);
    setDataRealRetorno(v.dataRealRetorno);
    setTipoTransporte(v.tipoTransporte);
    setValorPassagem(v.valorPassagem ? v.valorPassagem.toString() : "");
    setAdiantamento(v.adiantamento ? v.adiantamento.toString() : "");
    setDataDeposito(v.dataDeposito || "");
    setAnexoPassagemUrl(v.anexoPassagemUrl || "");
    setAnexoPassagemNome(v.anexoPassagemNome || "");
    setAnexoAdiantamentoUrl(v.anexoAdiantamentoUrl || "");
    setAnexoAdiantamentoNome(v.anexoAdiantamentoNome || "");
    setVendeuFolga(!!v.vendeuFolga);
    setDataVendaFolga(v.dataVendaFolga || "");
    setValorVendaFolga(v.valorVendaFolga ? v.valorVendaFolga.toString() : "");
    setAnexoVendaFolgaUrl(v.anexoVendaFolgaUrl || "");
    setAnexoVendaFolgaNome(v.anexoVendaFolgaNome || "");
    
    setSubTab("escala");
    setIsFormOpen(true);
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  // Cadastra Viagem
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedMatricula) {
      return setErrorMsg("Selecione um colaborador da lista.");
    }
    if (selectedEmployee && selectedEmployee.regimeTrabalho !== "Alojado") {
      return setErrorMsg("Apenas colaboradores sob o regime de trabalho 'Alojado' têm direito a folga de campo.");
    }
    if (!dataRealInicio) {
      return setErrorMsg("A data real de início da viagem é obrigatória.");
    }
    if (!dataRealRetorno) {
      return setErrorMsg("A data real de retorno da viagem é obrigatória.");
    }
    
    const diff = diffDays(dataRealInicio, dataRealRetorno);
    if (diff <= 0) {
      return setErrorMsg("A data de retorno deve ser posterior à data de início.");
    }

    if (vendeuFolga) {
      if (!dataVendaFolga) {
        return setErrorMsg("A data de venda da folga é obrigatória quando 'Venda de Folga' está marcada.");
      }
      if (!valorVendaFolga || parseFloat(valorVendaFolga) <= 0) {
        return setErrorMsg("Insira um valor de venda de folga válido maior que zero.");
      }
    }

    const valPassagemNum = parseFloat(valorPassagem) || 0;
    const adiantamentoNum = parseFloat(adiantamento) || 0;
    const valorVendaNum = vendeuFolga ? (parseFloat(valorVendaFolga) || 0) : 0;

    const payload: Viagem = {
      id: editingViagemId || "V-" + Date.now(),
      matricula: selectedMatricula,
      dataRealInicio,
      dataRealRetorno,
      tipoTransporte,
      valorPassagem: valPassagemNum,
      adiantamento: adiantamentoNum,
      dataDeposito: dataDeposito || undefined,
      anexoPassagemUrl: anexoPassagemUrl || undefined,
      anexoPassagemNome: anexoPassagemNome || undefined,
      anexoAdiantamentoUrl: anexoAdiantamentoUrl || undefined,
      anexoAdiantamentoNome: anexoAdiantamentoNome || undefined,
      vendeuFolga: vendeuFolga || undefined,
      dataVendaFolga: vendeuFolga ? dataVendaFolga : undefined,
      valorVendaFolga: vendeuFolga ? valorVendaNum : undefined,
      anexoVendaFolgaUrl: vendeuFolga ? anexoVendaFolgaUrl || undefined : undefined,
      anexoVendaFolgaNome: vendeuFolga ? anexoVendaFolgaNome || undefined : undefined,
    };

    try {
      await onAddViagem(payload);
      setSuccessMsg(
        editingViagemId 
          ? "Lançamento de viagem atualizado com sucesso!" 
          : "Lançamento de viagem cadastrado e folga reprogramada!"
      );
      
      // Limpa formulário
      setDataRealInicio("");
      setDataRealRetorno("");
      setValorPassagem("");
      setAdiantamento("");
      setDataDeposito("");
      setAnexoPassagemUrl("");
      setAnexoPassagemNome("");
      setAnexoAdiantamentoUrl("");
      setAnexoAdiantamentoNome("");
      setVendeuFolga(false);
      setDataVendaFolga("");
      setValorVendaFolga("");
      setAnexoVendaFolgaUrl("");
      setAnexoVendaFolgaNome("");
      setEditingViagemId(null);
      
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao registrar viagem.");
    }
  };

  // Consolidação de Informações de Folga e Viagens de todos os colaboradores para listagem do painel
  const processedFolgasTable = useMemo(() => {
    return colaboradores
      .filter(col => col.regimeTrabalho === "Alojado" && col.status !== "Inativo")
      .map(col => {
      const colViagens = viagens.filter(v => v.matricula === col.matricula);
      
      // Primeira previsão de folga com base na admissão / projeto inicial
      const diasPrimeira = col.tipoMaoDeObra === "MOI" ? 59 : 89;
      const dataPrimeiraPrev = addDays(col.dataInicioProjeto, diasPrimeira);

      if (colViagens.length === 0) {
        return {
          matricula: col.matricula,
          nome: col.nomeCompleto,
          funcao: col.funcao,
          cpf: col.cpf,
          tipoMaoDeObra: col.tipoMaoDeObra,
          cidade: col.cidade,
          estado: col.estado,
          dataInicioProjeto: col.dataInicioProjeto,
          primeiraPrevisao: dataPrimeiraPrev,
          totalViagens: 0,
          ultimaViagemInicio: "-",
          ultimaViagemRetorno: "-",
          diasTrabalhadosUltPeriodo: 0,
          tipoTransporteUlt: "-",
          valorPassagemUlt: 0,
          adiantamentoUlt: 0,
          dataDepositoUlt: "-",
          proximaPrevisaoFolga: dataPrimeiraPrev, // Se nunca viajou, a próxima previsão é a primeira
          legendaPrevisao: "1ª Previsão de Folga"
        };
      }

      // Se já possui viagens, ordenamos para pegar a mais recente
      const sortedViagens = [...colViagens].sort(
        (a, b) => new Date(b.dataRealRetorno).getTime() - new Date(a.dataRealRetorno).getTime()
      );
      
      const ultima = sortedViagens[0];
      const diasProxima = col.tipoMaoDeObra === "MOI" ? 59 : 89;
      const dataSegundaPrev = ultima.dataRealRetorno 
        ? addDays(ultima.dataRealRetorno, diasProxima)
        : addDays(col.dataInicioProjeto, diasProxima);
      const diasTrab = diffDays(ultima.dataRealInicio, ultima.dataRealRetorno);

      return {
        matricula: col.matricula,
        nome: col.nomeCompleto,
        funcao: col.funcao,
        cpf: col.cpf,
        tipoMaoDeObra: col.tipoMaoDeObra,
        cidade: col.cidade,
        estado: col.estado,
        dataInicioProjeto: col.dataInicioProjeto,
        primeiraPrevisao: dataPrimeiraPrev,
        totalViagens: colViagens.length,
        ultimaViagemInicio: ultima.dataRealInicio,
        ultimaViagemRetorno: ultima.dataRealRetorno,
        diasTrabalhadosUltPeriodo: diasTrab,
        tipoTransporteUlt: ultima.tipoTransporte,
        valorPassagemUlt: ultima.valorPassagem,
        adiantamentoUlt: ultima.adiantamento,
        dataDepositoUlt: ultima.dataDeposito || "-",
        proximaPrevisaoFolga: dataSegundaPrev, // 2ª previsão calculada após retorno da 1ª
        legendaPrevisao: "2ª Previsão (Reprogramada)"
      };
    });
  }, [colaboradores, viagens]);

  // Filtra listagem de folgas
  const filteredFolgasList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const list = !term ? processedFolgasTable : processedFolgasTable.filter(
      row => 
        row.matricula.toLowerCase().includes(term) || 
        row.nome.toLowerCase().includes(term) ||
        row.funcao.toLowerCase().includes(term)
    );
    // Sempre ordenar por data de Início do Projeto (cronológica / ascendente)
    return [...list].sort((a, b) => {
      const dateA = a.dataInicioProjeto || "";
      const dateB = b.dataInicioProjeto || "";
      return dateA.localeCompare(dateB);
    });
  }, [processedFolgasTable, searchTerm]);

  const syncFolgaToDrive = async (token: string, list: any[]) => {
    setIsSyncingDrive(true);
    try {
      const folders = await getOrCreateFolderHierarchy(token);
      const formatRows = list.map(row => ({
        "Matrícula": row.matricula,
        "Nome Completo": row.nome,
        "Função": row.funcao,
        "Cidade": row.cidade,
        "Estado (UF)": row.estado,
        "CPF": row.cpf,
        "Tipo Mão de Obra": row.tipoMaoDeObra,
        "Início do Projeto": formatBrDate(row.dataInicioProjeto),
        "1ª Previsão de Folga (Calculada)": formatBrDate(row.primeiraPrevisao),
        "Qtd Viagens Registradas": row.totalViagens,
        "Data Início Última Viagem": row.ultimaViagemInicio !== "-" ? formatBrDate(row.ultimaViagemInicio) : "-",
        "Data Retorno Última Viagem": row.ultimaViagemRetorno !== "-" ? formatBrDate(row.ultimaViagemRetorno) : "-",
        "Dias em Viagem (Descanso)": row.diasTrabalhadosUltPeriodo || 0,
        "Tipo Transporte": row.tipoTransporteUlt,
        "Valor Passagem (R$)": row.valorPassagemUlt,
        "Adiantamento Pago (R$)": row.adiantamentoUlt,
        "Data Depósito Adto": row.dataDepositoUlt !== "-" ? formatBrDate(row.dataDepositoUlt) : "-",
        "Status Atual de Previsão": row.legendaPrevisao,
        "Próxima Previsão de Folga": formatBrDate(row.proximaPrevisaoFolga)
      }));
      const worksheet = XLSX.utils.json_to_sheet(formatRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Folgas de Campo");
      
      const fileName = "03. Folga de Campo";
      const result = await uploadExcelToGDriveAsSheets(token, folders.folgaId, fileName, workbook);
      setGdriveSheetLink(result.webViewLink);
      sessionStorage.setItem("gdrive_sheet_link_folga", result.webViewLink);
    } catch (err) {
      console.error("Erro ao sincronizar Folga de Campo com Google Drive:", err);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  useEffect(() => {
    if (googleToken && filteredFolgasList.length > 0) {
      syncFolgaToDrive(googleToken, filteredFolgasList);
    }
  }, [googleToken, filteredFolgasList]);

  // Lista de meses disponíveis nas viagens cadastradas
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    viagens.forEach(v => {
      if (v.dataRealInicio) {
        const yearMonth = v.dataRealInicio.substring(0, 7); // "YYYY-MM"
        monthsSet.add(yearMonth);
      }
    });
    return Array.from(monthsSet).sort();
  }, [viagens]);

  const formatYearMonth = (ym: string) => {
    const [year, month] = ym.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx]} de ${year}`;
  };

  // Agrupamento e cálculo financeiro para o relatório de gastos com folgas de campo
  const financeReport = useMemo(() => {
    const colMap: Record<string, {
      matricula: string;
      nome: string;
      tipoMaoDeObra: string;
      qtdViagens: number;
      totalPassagem: number;
      totalAdiantamento: number;
      totalGeral: number;
      aereoCount: number;
      terrestreCount: number;
    }> = {};

    colaboradores.filter(col => col.regimeTrabalho === "Alojado").forEach(col => {
      colMap[col.matricula] = {
        matricula: col.matricula,
        nome: col.nomeCompleto,
        tipoMaoDeObra: col.tipoMaoDeObra,
        qtdViagens: 0,
        totalPassagem: 0,
        totalAdiantamento: 0,
        totalGeral: 0,
        aereoCount: 0,
        terrestreCount: 0
      };
    });

    let totalGeralPassagens = 0;
    let totalGeralAdiantamentos = 0;
    let totalViagensCount = 0;

    const filteredViagensForFinance = selectedMonth
      ? viagens.filter(v => v.dataRealInicio && v.dataRealInicio.startsWith(selectedMonth))
      : viagens;

    filteredViagensForFinance.forEach(v => {
      totalGeralPassagens += v.valorPassagem || 0;
      totalGeralAdiantamentos += v.adiantamento || 0;
      totalViagensCount++;

      if (colMap[v.matricula]) {
        const item = colMap[v.matricula];
        item.qtdViagens++;
        item.totalPassagem += v.valorPassagem || 0;
        item.totalAdiantamento += v.adiantamento || 0;
        item.totalGeral += (v.valorPassagem || 0) + (v.adiantamento || 0);
        if (v.tipoTransporte === "Aéreo") {
          item.aereoCount++;
        } else {
          item.terrestreCount++;
        }
      }
    });

    const rows = Object.values(colMap).filter(row => row.qtdViagens > 0).sort((a, b) => b.totalGeral - a.totalGeral);

    return {
      totalGeralPassagens,
      totalGeralAdiantamentos,
      cumulativeGeral: totalGeralPassagens + totalGeralAdiantamentos,
      totalViagensCount,
      rows
    };
  }, [colaboradores, viagens, selectedMonth]);

  // Filtro de busca exclusivo para o relatório de despesas
  const filteredFinanceRows = useMemo(() => {
    const term = financeSearchTerm.toLowerCase().trim();
    if (!term) return financeReport.rows;
    return financeReport.rows.filter(
      row =>
        row.matricula.toLowerCase().includes(term) ||
        row.nome.toLowerCase().includes(term)
    );
  }, [financeReport.rows, financeSearchTerm]);

  // Exportar para Excel
  const handleExport = () => {
    const formatRows = filteredFolgasList.map(row => ({
      "Matrícula": row.matricula,
      "Nome Completo": row.nome,
      "Função": row.funcao,
      "Cidade": row.cidade,
      "Estado (UF)": row.estado,
      "CPF": row.cpf,
      "Tipo Mão de Obra": row.tipoMaoDeObra,
      "Início do Projeto": formatBrDate(row.dataInicioProjeto),
      "1ª Previsão de Folga (Calculada)": formatBrDate(row.primeiraPrevisao),
      "Qtd Viagens Registradas": row.totalViagens,
      "Data Início Última Viagem": row.ultimaViagemInicio !== "-" ? formatBrDate(row.ultimaViagemInicio) : "-",
      "Data Retorno Última Viagem": row.ultimaViagemRetorno !== "-" ? formatBrDate(row.ultimaViagemRetorno) : "-",
      "Dias Trabalhados Período": row.diasTrabalhadosUltPeriodo || 0,
      "Tipo Transporte": row.tipoTransporteUlt,
      "Valor Passagem (R$)": row.valorPassagemUlt,
      "Adiantamento Pago (R$)": row.adiantamentoUlt,
      "Data Depósito Adto": row.dataDepositoUlt !== "-" ? formatBrDate(row.dataDepositoUlt) : "-",
      "Status Atual de Previsão": row.legendaPrevisao,
      "Próxima Previsão de Folga": formatBrDate(row.proximaPrevisaoFolga)
    }));
    exportToExcel(formatRows, "Cronograma_Folgas_Viagens_RH", "Folgas de Campo");
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
          const rowNum = i + 2;

          const getVal = (possibleKeys: string[], fallback = "") => {
            for (const k of possibleKeys) {
              const keyFound = Object.keys(row).find(x => x.trim().toLowerCase() === k.normalize("NFC").trim().toLowerCase());
              if (keyFound) return row[keyFound];
            }
            return fallback;
          };

          const matricula = String(getVal(["Matricula", "Matrícula", "id", "código"]) || "").trim().toUpperCase();
          const dataRealInicioVal = parseExcelDate(getVal(["Data Real de Inicio", "Data Real de Início", "Data Real Inicio", "Data Inicio", "Início"]));
          const dataRealRetornoVal = parseExcelDate(getVal(["Data Real de Retorno", "Data Retorno", "Retorno"]));
          const rawTransporte = String(getVal(["Tipo de Transporte (Aereo/Terrestre)", "Tipo de Transporte", "Transporte", "Tipo Transporte"]) || "").trim().toLowerCase();
          const rawPassagem = getVal(["Valor da Passagem", "Valor Passagem", "Passagem", "Custo Passagem"]);
          const rawAdiantamento = getVal(["Adiantamento", "Adiantamento Pago", "Valor Adiantamento"]);
          const dataDepositoVal = parseExcelDate(getVal(["Data de Deposito", "Data de Depósito", "Deposito", "Depósito", "Data Deposito", "Data do Depósito"]));

          // Validações básicas
          if (!matricula) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum}): Coluna de matrícula vazia.`);
            continue;
          }

          // Validação de colaborador
          const colaboradorLogado = colaboradores.find(c => c.matricula.trim().toUpperCase() === matricula);
          if (!colaboradorLogado) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Colaborador com esta matrícula não está cadastrado.`);
            continue;
          }

          if (!dataRealInicioVal) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Data real de início ausente ou inválida.`);
            continue;
          }

          if (!dataRealRetornoVal) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Data real de retorno ausente ou inválida.`);
            continue;
          }

          const tipoTransporteVal: "Aéreo" | "Terrestre" = rawTransporte.includes("terrestre") ? "Terrestre" : "Aéreo";
          
          let valorPassagemVal = 0;
          if (rawPassagem !== undefined && rawPassagem !== null && rawPassagem !== "") {
            valorPassagemVal = parseFloat(String(rawPassagem).replace(/[^0-9.,]/g, "").replace(",", "."));
          }
          
          let adiantamentoVal = 0;
          if (rawAdiantamento !== undefined && rawAdiantamento !== null && rawAdiantamento !== "") {
            adiantamentoVal = parseFloat(String(rawAdiantamento).replace(/[^0-9.,]/g, "").replace(",", "."));
          }

          const payload: Viagem = {
            id: `V-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
            matricula,
            dataRealInicio: dataRealInicioVal,
            dataRealRetorno: dataRealRetornoVal,
            tipoTransporte: tipoTransporteVal,
            valorPassagem: isNaN(valorPassagemVal) ? 0 : valorPassagemVal,
            adiantamento: isNaN(adiantamentoVal) ? 0 : adiantamentoVal,
            dataDeposito: dataDepositoVal || undefined
          };

          try {
            await onAddViagem(payload);
            successCount++;
            logs.push(`✅ Importado Viagem (Linha ${rowNum}): ${matricula} - ${colaboradorLogado.nomeCompleto} (${tipoTransporteVal})`);
          } catch (err: any) {
            errorCount++;
            logs.push(`❌ Erro no Banco (Linha ${rowNum} - ${matricula}): ${err.message || "Falha na API ao gravar Viagem"}`);
          }
        }

        setSuccessMsg(`Processamento de Viagens Concluído! Importados: ${successCount} | Falhas: ${errorCount}`);
        setImportLog(logs);
        e.target.value = ""; // Limpa input
      } catch (err: any) {
        setErrorMsg("Falha crítica ao ler planilha de viagens: " + (err.message || err));
      }
    };
    reader.readAsBinaryString(file);
  };

  // Exportar planilha de gastos e adiantamentos de folga de campo
  const handleExportFinance = () => {
    const formatRows = filteredFinanceRows.map(row => ({
      "Matrícula": row.matricula,
      "Nome Completo": row.nome,
      "Mão de Obra": row.tipoMaoDeObra,
      "Total de Viagens": row.qtdViagens,
      "01. Custo de Passagem (R$)": row.totalPassagem,
      "02. Adiantamento Ajuda de Custos (R$)": row.totalAdiantamento,
      "Despesa Consolidada Geral (R$)": row.totalGeral,
      "Quantidade de Voos (Aéreo)": row.aereoCount,
      "Quantidade Terrestres": row.terrestreCount
    }));
    exportToExcel(formatRows, "Relatorio_Gastos_Folga_Campo_RH", "Relatório de Custos");
  };

  return (
    <div id="section-folga" className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Folga de Campo e Escalonamento de Viagens
          </h2>
          <p className="text-[10px] text-[#141414]/75 font-mono uppercase tracking-tight mt-1">
            Programação e controle automatizado de viagens, folgas de alojados baseados no ciclo de MOI (59 dias) e MOD (89 dias).
          </p>
        </div>
        
        {subTab === "escala" && isAdmin && (
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {/* Botão Baixar Modelo */}
            <button
              type="button"
              onClick={() => downloadTemplate("viagem")}
              className="flex items-center justify-center gap-2 border border-[#141414]/40 bg-white hover:bg-neutral-100 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4 text-neutral-600" />
              Baixar Modelo
            </button>

            {/* Botão Importar */}
            <label className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-neutral-50 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none select-none">
              <Upload className="w-4 h-4 text-neutral-600" />
              Importar Viagens
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>

            <button
              id="btn-export-folgas"
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
                title={gdriveSheetLink ? "Ver planilha de folga de campo no Google Drive" : "Sincronizando planilha no Google Drive..."}
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
              id="btn-open-folga-form"
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Plane className="w-4 h-4" />
              Lançar Viagem Realizada
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

      {/* Sub-Navegação interna de Folga de Campo */}
      <div className="flex border-b border-[#141414] gap-1 bg-[#141414]/5 p-1">
        <button
          onClick={() => {
            setSubTab("escala");
            setIsFormOpen(false);
          }}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
            subTab === "escala"
              ? "bg-white border-[#141414] text-black shadow-sm"
              : "border-transparent text-[#141414]/70 hover:text-black hover:bg-white/50"
          }`}
        >
          📅 Cronograma de Folgas
        </button>
        <button
          onClick={() => setSubTab("financeiro")}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
            subTab === "financeiro"
              ? "bg-white border-[#141414] text-black shadow-sm"
              : "border-transparent text-[#141414]/70 hover:text-black hover:bg-white/50"
          }`}
        >
          💸 Relatório de Gastos com Folga
        </button>
      </div>

      {subTab === "escala" && successMsg && (
        <div className="p-4 border border-emerald-600 bg-emerald-50 text-emerald-950 font-mono text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {subTab === "escala" && (
        <>
          {/* Formulário de Registro de Viagem */}
          {isFormOpen && (
        <div className="bg-white p-6 border border-[#141414] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
            <h3 className="text-xs font-serif italic font-bold text-[#141414] flex items-center gap-2 uppercase tracking-wide">
              <PlaneTakeoff className="w-4 h-4 text-blue-600" />
              {editingViagemId ? `Alterar Lançamento de Viagem / Folga (${editingViagemId})` : "Lançamento de Bilhete de Viagem / Programação de Folga"}
            </h3>
            <button
              onClick={handleCloseForm}
              className="border border-[#141414]/30 hover:border-[#141414] hover:bg-neutral-100 text-[10px] font-mono px-2 py-1 transition-colors cursor-pointer"
            >
              [ FECHAR ]
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 border border-red-650 bg-red-50 text-red-950 font-mono text-xs flex gap-2 items-center font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Pesquisa Colaborador */}
              <div className="md:col-span-4 relative">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Qual o Colaborador?*</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Matrícula ou Nome do Alojado..."
                    value={employeeSearchText}
                    onChange={(e) => {
                      setEmployeeSearchText(e.target.value);
                      if (selectedMatricula) setSelectedMatricula("");
                    }}
                    className="w-full bg-white text-[#141414] pl-8 pr-4 py-2 border border-[#141414] rounded-none text-xs font-mono outline-none"
                  />
                </div>

                {/* Dropdown de sugestões */}
                {!selectedMatricula && matchingEmployeesInDropdown.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border-x border-b border-[#141414] rounded-none mt-1 shadow-md max-h-48 overflow-y-auto divide-y divide-[#141414]/15">
                    {matchingEmployeesInDropdown.map(emp => (
                      <button
                        key={emp.matricula}
                        type="button"
                        onClick={() => {
                          setSelectedMatricula(emp.matricula);
                          setEmployeeSearchText(`${emp.matricula} - ${emp.nomeCompleto}`);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors flex justify-between items-center text-[#141414]"
                      >
                        <span className="font-serif italic font-bold">{emp.nomeCompleto}</span>
                        <span className="font-mono text-[9px] border border-[#141414] px-1.5 py-0.5 rounded-none">{emp.matricula}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Data Início Viagem */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Início Real da Viagem*</label>
                <input
                  type="date"
                  value={dataRealInicio}
                  onChange={(e) => setDataRealInicio(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>

              {/* Data Retorno Viagem */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Retorno Real da Viagem*</label>
                <input
                  type="date"
                  value={dataRealRetorno}
                  onChange={(e) => setDataRealRetorno(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>

              {/* Tipo Transporte */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Tipo de Transporte*</label>
                <select
                  value={tipoTransporte}
                  onChange={(e) => setTipoTransporte(e.target.value as "Aéreo" | "Terrestre")}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                >
                  <option value="Aéreo">Aéreo (Passagem de Avião)</option>
                  <option value="Terrestre">Terrestre (Ônibus / Carro)</option>
                </select>
              </div>

              {/* Valor Passagem */}
              <div className="md:col-span-1">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Passagem (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={valorPassagem}
                  onChange={(e) => setValorPassagem(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs outline-none font-mono"
                />
              </div>

              {/* Adiantamento */}
              <div className="md:col-span-1">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Adto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={adiantamento}
                  onChange={(e) => setAdiantamento(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs outline-none font-mono"
                />
              </div>

              {/* Data de Depósito do Adiantamento */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data de Depósito</label>
                <input
                  type="date"
                  value={dataDeposito}
                  onChange={(e) => setDataDeposito(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none font-bold"
                />
              </div>

            </div>

            {/* Seção de Anexos Físicos de Viagem */}
            <div className="p-4 border border-[#141414]/20 bg-neutral-50/50 grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Anexo de Passagem */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">
                  Bilhete de Passagem (Anexo)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`flex items-center gap-1.5 border border-[#141414] bg-white ${isUploadingPassagem ? "opacity-55 cursor-not-allowed" : "hover:bg-neutral-100 cursor-pointer"} text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-colors select-none`}>
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    Selecionar Bilhete (PDF/Imagem)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      disabled={isUploadingPassagem}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (googleToken) {
                            setIsUploadingPassagem(true);
                            try {
                              const folders = await getOrCreateFolderHierarchy(googleToken);
                              const extension = file.name.split('.').pop() || "pdf";
                              const datePart = dataRealInicio ? dataRealInicio.split('-').reverse().join('-') : new Date().toISOString().split('T')[0].split('-').reverse().join('-');
                              const renamedFilename = `${selectedEmployee?.nomeCompleto || "Funcionario"} - ${datePart}.${extension}`;
                              const renamedFile = new File([file], renamedFilename, { type: file.type });
                              const result = await uploadFileToDrive(googleToken, renamedFile, folders.passagensId);
                              setAnexoPassagemUrl(result.webViewLink);
                              setAnexoPassagemNome(renamedFilename);
                            } catch (err: any) {
                              console.error("Erro ao enviar para Google Drive:", err);
                              alert("Não foi possível enviar para o Google Drive. Salvando em cópia de redundância local...");
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setAnexoPassagemUrl(reader.result as string);
                                setAnexoPassagemNome(file.name);
                              };
                              reader.readAsDataURL(file);
                            } finally {
                              setIsUploadingPassagem(false);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAnexoPassagemUrl(reader.result as string);
                              setAnexoPassagemNome(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                  {isUploadingPassagem && (
                    <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-indigo-700 animate-pulse">
                      <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      <span>Enviando...</span>
                    </div>
                  )}
                  {anexoPassagemNome && !isUploadingPassagem && (
                    <div className="flex items-center gap-1 bg-white border border-[#141414]/35 px-2 py-1 text-[10px] font-mono shrink">
                      <span className="truncate max-w-[150px]">{anexoPassagemNome}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAnexoPassagemUrl("");
                          setAnexoPassagemNome("");
                        }}
                        className="text-red-600 hover:text-red-800 font-bold ml-1 text-xs"
                        title="Remover anexo"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Anexo de Adiantamento */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">
                  Comprovante de Adiantamento/Depósito (Anexo)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`flex items-center gap-1.5 border border-[#141414] bg-white ${isUploadingAdiantamento ? "opacity-55 cursor-not-allowed" : "hover:bg-neutral-100 cursor-pointer"} text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-colors select-none`}>
                    <Upload className="w-3.5 h-3.5 text-zinc-500" />
                    Selecionar Comprovante (PDF/Imagem)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      disabled={isUploadingAdiantamento}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (googleToken) {
                            setIsUploadingAdiantamento(true);
                            try {
                              const folders = await getOrCreateFolderHierarchy(googleToken);
                              const extension = file.name.split('.').pop() || "pdf";
                              const datePart = dataRealInicio ? dataRealInicio.split('-').reverse().join('-') : new Date().toISOString().split('T')[0].split('-').reverse().join('-');
                              const renamedFilename = `${selectedEmployee?.nomeCompleto || "Funcionario"} - ${datePart}.${extension}`;
                              const renamedFile = new File([file], renamedFilename, { type: file.type });
                              const result = await uploadFileToDrive(googleToken, renamedFile, folders.adiantamentosId);
                              setAnexoAdiantamentoUrl(result.webViewLink);
                              setAnexoAdiantamentoNome(renamedFilename);
                            } catch (err: any) {
                              console.error("Erro ao enviar para Google Drive:", err);
                              alert("Não foi possível enviar para o Google Drive. Salvando em cópia de redundância local...");
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setAnexoAdiantamentoUrl(reader.result as string);
                                setAnexoAdiantamentoNome(file.name);
                              };
                              reader.readAsDataURL(file);
                            } finally {
                              setIsUploadingAdiantamento(false);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setAnexoAdiantamentoUrl(reader.result as string);
                              setAnexoAdiantamentoNome(file.name);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                  {isUploadingAdiantamento && (
                    <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-indigo-700 animate-pulse">
                      <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      <span>Enviando...</span>
                    </div>
                  )}
                  {anexoAdiantamentoNome && !isUploadingAdiantamento && (
                    <div className="flex items-center gap-1 bg-white border border-[#141414]/35 px-2 py-1 text-[10px] font-mono shrink">
                      <span className="truncate max-w-[150px]">{anexoAdiantamentoNome}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAnexoAdiantamentoUrl("");
                          setAnexoAdiantamentoNome("");
                        }}
                        className="text-red-600 hover:text-red-800 font-bold ml-1 text-xs"
                        title="Remover anexo"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Seção de Venda de Folga */}
            <div className="p-4 border border-[#141414]/20 bg-amber-50/20 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vendeuFolgaCheckbox"
                  checked={vendeuFolga}
                  onChange={(e) => setVendeuFolga(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-350 focus:ring-indigo-500 rounded cursor-pointer"
                />
                <label htmlFor="vendeuFolgaCheckbox" className="font-sans font-bold text-xs text-slate-800 uppercase tracking-tight cursor-pointer select-none">
                  O colaborador escolheu vender a folga? (Venda de Folga)
                </label>
              </div>

              {vendeuFolga && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-dashed border-[#141414]/15">
                  {/* Data da Venda */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight flex items-center gap-1">
                      <span>Data da Venda da Folga*</span>
                    </label>
                    <input
                      type="date"
                      value={dataVendaFolga}
                      onChange={(e) => setDataVendaFolga(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none font-bold"
                    />
                  </div>

                  {/* Valor da Venda */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">Valor Pago pela Folga (R$)*</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={valorVendaFolga}
                      onChange={(e) => setValorVendaFolga(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none font-bold"
                    />
                  </div>

                  {/* Anexo de Venda */}
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-mono font-bold text-[#141414]/75 uppercase tracking-tight">
                      Comprovante de Venda/Anexo
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className={`flex items-center gap-1.5 border border-[#141414] bg-white ${isUploadingVenda ? "opacity-55 cursor-not-allowed" : "hover:bg-neutral-100 cursor-pointer"} text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-colors select-none`}>
                        <Upload className="w-3.5 h-3.5 text-zinc-500" />
                        Comprovante (PDF/Imagem)
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          disabled={isUploadingVenda}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (googleToken) {
                                setIsUploadingVenda(true);
                                try {
                                  const folders = await getOrCreateFolderHierarchy(googleToken);
                                  const extension = file.name.split('.').pop() || "pdf";
                                  const datePart = dataVendaFolga ? dataVendaFolga.split('-').reverse().join('-') : new Date().toISOString().split('T')[0].split('-').reverse().join('-');
                                  const renamedFilename = `${selectedEmployee?.nomeCompleto || "Funcionario"} - Venda - ${datePart}.${extension}`;
                                  const renamedFile = new File([file], renamedFilename, { type: file.type });
                                  const result = await uploadFileToDrive(googleToken, renamedFile, folders.folgaId);
                                  setAnexoVendaFolgaUrl(result.webViewLink);
                                  setAnexoVendaFolgaNome(renamedFilename);
                                } catch (err: any) {
                                  console.error("Erro ao enviar para Google Drive:", err);
                                  alert("Não foi possível enviar para o Google Drive. Salvando em cópia de redundância local...");
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setAnexoVendaFolgaUrl(reader.result as string);
                                    setAnexoVendaFolgaNome(file.name);
                                  };
                                  reader.readAsDataURL(file);
                                } finally {
                                  setIsUploadingVenda(false);
                                }
                              } else {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setAnexoVendaFolgaUrl(reader.result as string);
                                  setAnexoVendaFolgaNome(file.name);
                                };
                                reader.readAsDataURL(file);
                              }
                            }
                          }}
                        />
                      </label>
                      {isUploadingVenda && (
                        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-indigo-700 animate-pulse">
                          <span className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                          <span>Enviando...</span>
                        </div>
                      )}
                      {anexoVendaFolgaNome && !isUploadingVenda && (
                        <div className="flex items-center gap-1 bg-white border border-[#141414]/35 px-2 py-1 text-[10px] font-mono shrink">
                          <span className="truncate max-w-[120px]">{anexoVendaFolgaNome}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAnexoVendaFolgaUrl("");
                              setAnexoVendaFolgaNome("");
                            }}
                            className="text-red-600 hover:text-red-800 font-bold ml-1 text-xs"
                            title="Remover anexo"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quadro de Perfil Inteligente preenchido automaticamente ao selecionar funcionário */}
            {selectedEmployee && (
              <div className="p-4 bg-[#E4E3E0]/30 border border-[#141414] space-y-3 font-mono font-bold uppercase tracking-tight text-xs">
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                  <div>
                    <span className="opacity-60 block font-medium">Nome</span>
                    <strong className="text-black font-serif italic text-xs font-bold">{selectedEmployee.nomeCompleto}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">Função</span>
                    <strong className="text-[#141414] font-serif font-extrabold">{selectedEmployee.funcao}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">Cidade / Estado</span>
                    <strong className="text-black font-mono">{selectedEmployee.cidade} - {selectedEmployee.estado}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">Data de Admissão</span>
                    <strong className="text-[#141414] font-mono">{formatBrDate(selectedEmployee.dataAdmissao)}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">CPF</span>
                    <strong className="text-[#141414] font-mono">{selectedEmployee.cpf}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">Tipo de Mão de Obra</span>
                    <strong className="text-black font-mono">{selectedEmployee.tipoMaoDeObra}</strong>
                  </div>
                  <div>
                    <span className="opacity-60 block font-medium">Início no Projeto</span>
                    <strong className="text-[#141414] font-mono">{formatBrDate(selectedEmployee.dataInicioProjeto)}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#141414]/15 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  
                  {/* Primeira Previsão de Folga Automatizada */}
                  <div>
                    <span className="opacity-60 font-bold block flex items-center gap-1">
                      <Milestone className="w-3.5 h-3.5 text-black" />
                      1ª Previsão de Folga
                    </span>
                    <strong className="text-black text-xs font-bold">{formatBrDate(primeiraPrevisaoFolga)}</strong>
                    <span className="text-[10px] opacity-70 block mt-0.5">
                      ({selectedEmployee.tipoMaoDeObra === "MOI" ? "Início + 60 dias" : "Início + 90 dias"})
                    </span>
                  </div>

                  {/* Dias Trabalhados no Período Atual */}
                  {dataRealInicio && dataRealRetorno && (
                    <>
                      <div>
                        <span className="opacity-60 block font-bold flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-black" />
                          Dias em Viagem (Descanso)
                        </span>
                        <strong className="text-[#141414] font-mono">
                          {previewDiasTrabalhados} dias programados
                        </strong>
                        <span className="text-[10px] opacity-75 block mt-0.5">(Retorno - Início)</span>
                      </div>

                      {/* Previsão de Próxima Folga */}
                      <div className="md:col-span-2 bg-white p-3 border border-[#141414] flex flex-col justify-center">
                        <span className="text-black font-extrabold block flex items-center gap-1 text-[11px]">
                          <CalendarDays className="w-4 h-4 text-black" />
                          {dataRealRetorno ? "Próxima Folga Recalculada" : "Próxima Folga Estimada"}
                        </span>
                        <strong className="text-black text-sm font-mono mt-0.5 underline">
                          {formatBrDate(previewSegundaPrevisaoFolga)}
                        </strong>
                        <span className="text-[9px] opacity-80 block mt-0.5">
                          {dataRealRetorno ? (
                            `Retorno da Viagem (${formatBrDate(dataRealRetorno)})`
                          ) : (
                            `Início do Projeto (${formatBrDate(selectedEmployee.dataInicioProjeto)})`
                          )} + {selectedEmployee.tipoMaoDeObra === "MOI" ? "59 dias" : "89 dias"}
                        </span>
                      </div>
                    </>
                  )}

                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
              >
                {editingViagemId ? "Atualizar Lançamento" : "Gravar Lançamento e Reprogramar"}
              </button>
              <button
                type="button"
                onClick={handleCloseForm}
                className="border border-[#141414]/30 hover:border-[#141414] text-xs font-mono font-bold uppercase tracking-widest px-4 py-2.5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Histórico e Agenda de Previsões de Folgas de Campo */}
      <div className="bg-white border border-[#141414] overflow-hidden">
        
        <div className="p-4 border-b border-[#141414]/15 bg-[#E4E3E0]/30 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por Código, Nome ou Função do Colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-[#141414] pl-9 pr-4 py-2 text-xs border border-[#141414] rounded-none focus:ring-1 focus:ring-[#141414] outline-none font-mono"
            />
          </div>
          <div className="text-[10px] text-[#141414] font-mono font-bold uppercase tracking-tight">
            VERIFICANDO {filteredFolgasList.length} COLABORADORES NA ESCALA ATIVA.
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
          <table className="w-full border-collapse text-left text-xs min-w-[1100px]">
            <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
              <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                <th className="px-5 py-3">Matrícula</th>
                <th className="px-5 py-3">Nome do Colaborador</th>
                <th className="px-5 py-3">Mão de Obra</th>
                <th className="px-5 py-3">Início Projeto</th>
                <th className="px-5 py-3">1ª Previsão</th>
                <th className="px-5 py-3">Última Viagem (Início e Retorno)</th>
                <th className="px-5 py-3 text-center">Dias Trab.</th>
                <th className="px-5 py-3">Transporte / Custos</th>
                <th className="px-5 py-3">Tipo de Escopo</th>
                <th className="px-5 py-3">Agenda Próxima Folga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/15">
              {filteredFolgasList.map((row) => (
                <tr key={row.matricula} className="hover:bg-[#141414]/5 transition-colors text-[#141414]">
                  
                  {/* Matricula */}
                  <td className="px-5 py-3.5 font-mono font-extrabold select-all uppercase tracking-tight">{row.matricula}</td>
                  
                  {/* Nome Completo */}
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const emp = colaboradores.find(c => c.matricula === row.matricula);
                          if (emp) setSelectedEmployeeHistory(emp);
                        }}
                        className="text-left group/name hover:text-indigo-650 font-serif font-extrabold italic select-all cursor-pointer underline decoration-dotted underline-offset-2"
                        title="Clique para abrir histórico completo de viagens/folgas"
                      >
                        {row.nome}
                      </button>
                      <span className="text-[9px] font-mono uppercase text-[#141414]/65">{row.funcao} • {row.cidade} - {row.estado}</span>
                    </div>
                  </td>

                  {/* Mao de obra */}
                  <td className="px-5 py-3.5">
                    <span className="border border-[#141414] text-[#141414] bg-white px-2 py-0.5 text-[9px] font-mono font-bold uppercase">
                      {row.tipoMaoDeObra}
                    </span>
                  </td>

                  {/* Inicio Projeto */}
                  <td className="px-5 py-3.5 font-mono text-[11px] opacity-80">
                    {formatBrDate(row.dataInicioProjeto)}
                  </td>

                  {/* 1ª Previsão de Folga */}
                  <td className="px-5 py-3.5 font-mono text-[11px] opacity-85">
                    {formatBrDate(row.primeiraPrevisao)}
                  </td>

                  {/* Última Viagem */}
                  <td className="px-5 py-3.5">
                    {row.totalViagens > 0 ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-[#141414] uppercase tracking-tighter text-[10px] flex items-center gap-1">
                          {row.tipoTransporteUlt === "Aéreo" ? <Plane className="w-3 h-3 text-[#141414]" /> : <Truck className="w-3 h-3 text-[#141414]" />}
                          {formatBrDate(row.ultimaViagemInicio)} A {formatBrDate(row.ultimaViagemRetorno)}
                        </span>
                        <span className="text-[8px] font-mono opacity-60 uppercase">Reprogramado</span>
                      </div>
                    ) : (
                      <span className="text-[#141414]/50 italic text-[10px]">Sem viagens</span>
                    )}
                  </td>

                  {/* Dias Trabalhados no Período */}
                  <td className="px-5 py-3.5 text-center font-mono font-bold text-black">
                    {row.totalViagens > 0 ? `${row.diasTrabalhadosUltPeriodo}D` : "-"}
                  </td>

                  {/* Custos e Adiantamento */}
                  <td className="px-5 py-3.5">
                    {row.totalViagens > 0 ? (
                      <div className="flex flex-col text-[10px] font-mono uppercase text-black font-semibold">
                        <span>Tarifa: {formatCurrency(row.valorPassagemUlt)}</span>
                        <span className="opacity-60">Adto: {formatCurrency(row.adiantamentoUlt)}</span>
                        {row.dataDepositoUlt !== "-" && (
                          <span className="text-[10px] font-bold text-violet-800 font-mono mt-0.5" title="Data do Depósito do Adiantamento">DEP: {formatBrDate(row.dataDepositoUlt)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#141414]/50 font-mono">-</span>
                    )}
                  </td>

                  {/* Tipo de escopo */}
                  <td className="px-5 py-3.5">
                    <span className="border border-[#141414]/30 bg-[#E4E3E0]/30 text-[#141414] text-[9px] font-mono font-bold uppercase py-0.5 px-1.5 whitespace-nowrap">
                      {row.legendaPrevisao}
                    </span>
                  </td>

                  {/* Próxima Folga */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleLaunchViagem(row.matricula, row.proximaPrevisaoFolga)}
                      className="flex items-center gap-1 group/btn text-left hover:opacity-85 transition-opacity cursor-pointer"
                      title="Clique para agendar e abrir lançamento de viagem com data prevista"
                    >
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-650 flex-shrink-0 group-hover/btn:scale-110 transition-transform" />
                      <strong className="text-indigo-650 font-mono text-xs font-bold leading-none underline group-hover/btn:text-indigo-800">
                        {formatBrDate(row.proximaPrevisaoFolga)}
                      </strong>
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
        </>
      )}

      {subTab === "financeiro" && (
        <div id="subtab-finance-report" className="space-y-6">
          {/* KPIs Financeiros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            <div className="border border-[#141414] p-5 bg-white flex flex-col justify-between">
              <div>
                <span className="font-serif italic text-xs opacity-50 text-[#141414]">Gasto Consolidado Total</span>
                <div className="text-2xl font-mono mt-1 text-[#141414] font-bold">
                  {formatCurrency(financeReport.cumulativeGeral)}
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-tight opacity-60 mt-4 font-bold text-slate-700">Passagem + Adiantamento</span>
            </div>

            <div className="border border-[#141414] p-5 bg-white flex flex-col justify-between">
              <div>
                <span className="font-serif italic text-xs opacity-50 text-[#141414]">01. Custo de Passagem</span>
                <div className="text-2xl font-mono mt-1 text-emerald-900 font-bold">
                  {formatCurrency(financeReport.totalGeralPassagens)}
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-tight opacity-60 mt-4 font-bold text-emerald-700">Aéreo e Terrestre</span>
            </div>

            <div className="border border-[#141414] p-5 bg-white flex flex-col justify-between">
              <div>
                <span className="font-serif italic text-xs opacity-50 text-[#141414]">02. Adiantamento Ajuda de Custos</span>
                <div className="text-2xl font-mono mt-1 text-blue-900 font-bold">
                  {formatCurrency(financeReport.totalGeralAdiantamentos)}
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-tight opacity-60 mt-4 font-bold text-blue-700">Custos de Viagem e KM</span>
            </div>

            <div className="border border-[#141414] p-5 bg-white flex flex-col justify-between">
              <div>
                <span className="font-serif italic text-xs opacity-50 text-[#141414]">Custo Médio por Viagem</span>
                <div className="text-2xl font-mono mt-1 text-[#141414] font-bold">
                  {financeReport.totalViagensCount > 0 
                    ? formatCurrency(financeReport.cumulativeGeral / financeReport.totalViagensCount)
                    : "R$ 0,00"}
                </div>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-tight opacity-60 mt-4 font-bold">Com base em {financeReport.totalViagensCount} viagens</span>
            </div>

          </div>

          {/* Lista por Colaborador */}
          <div className="bg-white border border-[#141414] overflow-hidden">
            <div className="p-4 border-b border-[#141414]/15 bg-[#E4E3E0]/30 flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto items-stretch md:items-center">
                {/* Filtro por Mês */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none cursor-pointer"
                >
                  <option value="">📅 [ FILTRAR POR MÊS ]</option>
                  {availableMonths.map(ym => (
                    <option key={ym} value={ym}>
                      {formatYearMonth(ym)}
                    </option>
                  ))}
                </select>

                <div className="relative w-full md:w-72">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Filtrar por Código ou Nome..."
                    value={financeSearchTerm}
                    onChange={(e) => setFinanceSearchTerm(e.target.value)}
                    className="w-full bg-white text-[#141414] pl-9 pr-4 py-2 text-xs border border-[#141414] rounded-none outline-none font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={handleExportFinance}
                  className="flex items-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 transition-colors cursor-pointer w-full md:w-auto justify-center"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel de Custos
                </button>

                <button
                  onClick={() => onPrint ? onPrint() : window.print()}
                  className="flex items-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-3 py-2 transition-colors cursor-pointer w-full md:w-auto justify-center"
                >
                  <Printer className="w-4 h-4" />
                  Salvar PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs min-w-[950px]">
                <thead>
                  <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                    <th className="px-5 py-3">Matrícula</th>
                    <th className="px-5 py-3">Colaborador</th>
                    <th className="px-5 py-3">Mão de Obra</th>
                    <th className="px-5 py-3 text-center">Qtd Viagens</th>
                    <th className="px-5 py-3">01. Custo de Passagem (R$)</th>
                    <th className="px-5 py-3">02. Adiantamento Ajuda de Custos (R$)</th>
                    <th className="px-5 py-3 font-bold text-right pr-6">Custo Consolidado (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/15">
                  {filteredFinanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-[#141414]/50 font-mono">
                        [ NENHUM DETALHE FINANCEIRO REGISTRADO PARA OS CRITÉRIOS SELECIONADOS ]
                      </td>
                    </tr>
                  ) : (
                    filteredFinanceRows.map(row => (
                      <tr key={row.matricula} className="hover:bg-[#141414]/5 transition-colors font-mono">
                        <td className="px-5 py-3 font-bold text-red-700">{row.matricula}</td>
                        <td className="px-5 py-3 font-serif font-extrabold italic text-black">{row.nome}</td>
                        <td className="px-5 py-3">
                          <span className="border border-[#141414] px-1.5 py-0.5 text-[9px] font-bold bg-white">{row.tipoMaoDeObra}</span>
                        </td>
                        <td className="px-5 py-3 text-center">{row.qtdViagens}</td>
                        <td className="px-5 py-3">{formatCurrency(row.totalPassagem)}</td>
                        <td className="px-5 py-3">{formatCurrency(row.totalAdiantamento)}</td>
                        <td className="px-5 py-3 font-bold text-right pr-6 text-black text-[13px]">
                          {formatCurrency(row.totalGeral)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Detalhe de Lançamento por Bilhete de Viagem */}
          <div className="bg-white border border-[#141414] p-5 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider font-extrabold text-[#141414]/80">Livro de Registro de Passagens Individualizado</h4>
            <div className="overflow-x-auto overflow-y-auto max-h-[480px] custom-scrollbar border border-[#141414]/10">
              <table className="w-full text-left text-xs font-mono divide-y divide-[#141414]/15 min-w-[1200px]">
                <thead className="sticky top-0 z-10 bg-neutral-100 shadow-xs">
                  <tr className="text-[9px] uppercase tracking-tight text-[#141414]/70">
                    <th className="px-4 py-2">Id Viagem</th>
                    <th className="px-4 py-2">Matrícula</th>
                    <th className="px-4 py-2">Colaborador</th>
                    <th className="px-4 py-2">Início / Retorno</th>
                    <th className="px-4 py-2">Transporte</th>
                    <th className="px-4 py-2">01. Custo de Passagem</th>
                    <th className="px-4 py-2">02. Adiantamento Ajuda de Custos</th>
                    <th className="px-4 py-2">03. Vendas de Folga de Campo</th>
                    <th className="px-4 py-2 text-right">Acumulado</th>
                    {isAdmin && <th className="px-4 py-2 text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/10">
                  {viagens.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-4 text-center opacity-50 font-serif italic">Nenhuma despesa individual de viagem gravada.</td>
                    </tr>
                  ) : (
                    viagens.map(v => {
                      const col = colaboradores.find(c => c.matricula === v.matricula);
                      return (
                        <tr key={v.id} className="hover:bg-neutral-50 text-neutral-850">
                          <td className="px-4 py-2.5 opacity-60">{v.id}</td>
                          <td className="px-4 py-2.5 text-red-650 font-bold">{v.matricula}</td>
                          <td className="px-4 py-2.5 font-bold">{col ? col.nomeCompleto : "Desconhecido"}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{formatBrDate(v.dataRealInicio)} a {formatBrDate(v.dataRealRetorno)}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] uppercase font-bold text-neutral-700 bg-white border border-neutral-300 px-1.5 py-0.5">
                              {v.tipoTransporte}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold">{formatCurrency(v.valorPassagem || 0)}</span>
                              {v.anexoPassagemUrl && (
                                <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                  <a
                                    href={v.anexoPassagemUrl}
                                    download={v.anexoPassagemNome || `bilhete_${v.id}`}
                                    className="text-[9px] text-neutral-600 underline hover:text-neutral-900 font-bold"
                                    title={v.anexoPassagemNome}
                                  >
                                    📥 Baixar
                                  </a>
                                  <span className="text-neutral-300">•</span>
                                  <button
                                    onClick={() => setPreviewFile({ url: v.anexoPassagemUrl!, name: v.anexoPassagemNome || "bilhete", typeLabel: "Bilhete de Passagem" })}
                                    className="text-[9px] text-blue-700 underline hover:text-blue-900 font-bold cursor-pointer"
                                  >
                                    👁️ Ver
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold">{formatCurrency(v.adiantamento || 0)}</span>
                              {v.anexoAdiantamentoUrl && (
                                <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                  <a
                                    href={v.anexoAdiantamentoUrl}
                                    download={v.anexoAdiantamentoNome || `comprovante_${v.id}`}
                                    className="text-[9px] text-neutral-600 underline hover:text-neutral-900 font-bold"
                                    title={v.anexoAdiantamentoNome}
                                  >
                                    📥 Baixar
                                  </a>
                                  <span className="text-neutral-300">•</span>
                                  <button
                                    onClick={() => setPreviewFile({ url: v.anexoAdiantamentoUrl!, name: v.anexoAdiantamentoNome || "comprovante", typeLabel: "Depósito de Adiantamento" })}
                                    className="text-[9px] text-blue-700 underline hover:text-blue-900 font-bold cursor-pointer"
                                  >
                                    👁️ Ver
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs">
                            {v.vendeuFolga ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[8px] uppercase tracking-wider font-extrabold text-amber-800 bg-amber-50 border border-amber-300 px-1 py-0.5 rounded-sm w-fit font-sans">
                                  Venda Efetuada
                                </span>
                                <span className="text-[10px] font-bold text-neutral-800">{formatBrDate(v.dataVendaFolga || "")}</span>
                                <span className="font-bold text-[#141414]">{formatCurrency(v.valorVendaFolga || 0)}</span>
                                {v.anexoVendaFolgaUrl && (
                                  <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                    <a
                                      href={v.anexoVendaFolgaUrl}
                                      download={v.anexoVendaFolgaNome || `venda_folga_${v.id}`}
                                      className="text-[9px] text-neutral-600 underline hover:text-neutral-900 font-bold"
                                      title={v.anexoVendaFolgaNome}
                                    >
                                      📥 Baixar
                                    </a>
                                    <span className="text-neutral-300">•</span>
                                    <button
                                      onClick={() => setPreviewFile({ url: v.anexoVendaFolgaUrl!, name: v.anexoVendaFolgaNome || "comprovante_venda", typeLabel: "Comprovante de Venda de Folga" })}
                                      className="text-[9px] text-blue-700 underline hover:text-blue-900 font-bold cursor-pointer"
                                    >
                                      👁️ Ver
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-black">{formatCurrency((v.valorPassagem || 0) + (v.adiantamento || 0))}</td>
                          {isAdmin && (
                            <td className="px-4 py-2.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditViagemClick(v)}
                                  className="border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] text-[9px] font-mono font-bold uppercase px-2 py-1.5 cursor-pointer transition-colors flex items-center gap-1"
                                  title="Editar Lançamento"
                                >
                                  <Edit className="w-3 h-3 text-blue-600" />
                                  Editar
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirm({
                                      id: v.id,
                                      name: col ? col.nomeCompleto : v.matricula
                                    });
                                  }}
                                  className="border border-red-650 hover:bg-red-650 hover:text-white text-[9px] font-mono font-bold uppercase px-2 py-1.5 cursor-pointer text-red-650 transition-colors flex items-center gap-1"
                                  title="Excluir Lançamento"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Excluir
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Confirmação de Deleção de Viagem (Iframe Sandbox-friendly) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR EXCLUSÃO DE VIAGEM</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Tem certeza de que deseja excluir o lançamento de passagem/viagem de <strong className="text-black font-semibold font-serif italic">{deleteConfirm.name}</strong>?
                </p>
                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-tight">
                  Os valores financeiros e datas de mobilização/retorno associados serão desvinculados dos relatórios e do fluxo de escala.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer border border-red-800 font-extrabold"
              >
                Confirmar Exclusão
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

      {/* Modal de Visualização de Arquivos Anexos (Suporta Imagens e PDFs) */}
      {previewFile && (
        <div className="fixed inset-0 bg-[#141414]/90 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-[#141414] shadow-2xl max-w-4xl w-full flex flex-col h-[85vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center bg-[#E4E3E0]/45 p-4 border-b border-[#141414]/15">
              <div className="space-y-0.5 text-left">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                  {previewFile.typeLabel}
                </span>
                <h4 className="text-xs font-mono font-extrabold text-[#141414] uppercase tracking-tight truncate max-w-md sm:max-w-xl md:max-w-2xl mt-1.5">
                  📄 {previewFile.name}
                </h4>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 px-2 border border-[#141414]/40 hover:border-[#141414] hover:bg-neutral-100 transition-all cursor-pointer text-[#141414] flex items-center"
                title="Fechar Visualizador"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewer Content Area */}
            <div className="flex-1 bg-neutral-100 p-6 overflow-auto flex items-center justify-center relative">
              {previewFile.url.startsWith("http") ? (
                <div className="bg-white border border-[#141414] p-8 max-w-md text-center space-y-4 shadow-sm w-full mx-auto my-auto">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-600 flex items-center justify-center mx-auto text-indigo-700 rounded-full">
                    <Cloud className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wide text-neutral-805">Arquivo Google Drive Conectado</h5>
                    <p className="text-[11px] text-neutral-500 font-mono mt-2 uppercase leading-relaxed text-left">
                      Este comprovante está arquivado em segurança no seu Google Drive. Qualquer alteração ou visualização em alta definição pode ser feita diretamente pelo portal do Google Workspace.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <a
                      href={previewFile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold uppercase tracking-wider py-3 transition-colors cursor-pointer text-center block w-full flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Visualizar no Google Drive
                    </a>
                  </div>
                </div>
              ) : previewFile.url.startsWith("data:image/") ? (
                <div className="max-h-full max-w-full flex items-center justify-center">
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    referrerPolicy="no-referrer"
                    className="max-h-[58vh] max-w-full border border-neutral-300 object-contain shadow-md bg-white p-2"
                  />
                </div>
              ) : previewFile.url.startsWith("data:application/pdf") ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  {/* PDF Sandbox Fallback & Direct Download option */}
                  <div className="bg-white border border-[#141414] p-8 max-w-md text-left space-y-4 shadow-sm">
                    <div className="w-12 h-12 bg-blue-50 border border-blue-600 flex items-center justify-center mx-auto text-blue-700">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div className="text-center">
                      <h5 className="text-xs font-mono font-bold uppercase tracking-wide text-neutral-805">Visualização de Arquivo PDF</h5>
                      <p className="text-[11px] text-neutral-500 font-mono mt-1 uppercase tracking-tight">
                        Este é um documento PDF anexado como comprovante de viagem ou adiantamento.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      <a
                        href={previewFile.url}
                        download={previewFile.name}
                        className="bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider py-2.5 transition-all cursor-pointer text-center block w-full"
                      >
                        📥 Salvar Documento
                      </a>
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-[#141414] hover:bg-neutral-100 text-[#141414] text-xs font-mono font-bold uppercase tracking-wider py-2.5 transition-all cursor-pointer text-center block w-full"
                      >
                        🔗 Abrir em Nova Aba
                      </a>
                    </div>
                  </div>
                  {/* Direct embed fallback wrapper */}
                  <div className="w-full flex-1 max-h-[30vh] opacity-20">
                    <iframe
                      src={previewFile.url}
                      className="w-full h-full border-t border-neutral-300"
                      title={previewFile.name}
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#141414] p-8 max-w-md text-center space-y-4">
                  <Info className="w-12 h-12 text-zinc-500 mx-auto" />
                  <div>
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wide text-neutral-805">Arquivo Anexado</h5>
                    <p className="text-[11px] text-neutral-500 font-mono mt-1 uppercase tracking-tight text-left">
                      Não é possível visualizar de forma nativa na tela este arquivo devido às configurações locais, mas você poderá baixá-lo ou visualizá-lo com segurança através do botão:
                    </p>
                  </div>
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="inline-block bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-6 py-2.5 transition-all cursor-pointer text-center"
                  >
                    📥 Baixar Anexo Completo
                  </a>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="bg-[#E4E3E0]/20 p-4 border-t border-[#141414]/15 flex justify-between items-center text-xs font-mono">
              <span className="text-[10px] text-neutral-500 font-bold uppercase">
                Garantia de Segurança Digital - AI Studio
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 py-2 px-6 uppercase text-[11px] tracking-wider font-extrabold cursor-pointer border border-[#141414]"
              >
                Voltar ao Painel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Histórico de Viagens/Folgas de um Colaborador */}
      {selectedEmployeeHistory && (() => {
        const empViagens = viagens.filter(v => v.matricula === selectedEmployeeHistory.matricula);
        const diasCiclo = selectedEmployeeHistory.tipoMaoDeObra === "MOI" ? 59 : 89;
        
        let totalGastoPassagens = 0;
        let totalGastoAdiantamentos = 0;
        let totalGastoVendas = 0;
        let totalDiasDeGozo = 0;

        empViagens.forEach(v => {
          totalGastoPassagens += v.valorPassagem || 0;
          totalGastoAdiantamentos += v.adiantamento || 0;
          totalGastoVendas += v.valorVendaFolga || 0;
          if (v.dataRealInicio && v.dataRealRetorno) {
            const diff = diffDays(v.dataRealInicio, v.dataRealRetorno);
            if (diff > 0) totalDiasDeGozo += diff;
          }
        });

        const totalAcumuladoGeral = totalGastoPassagens + totalGastoAdiantamentos + totalGastoVendas;

        return (
          <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border text-left border-[#141414] shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex justify-between items-center bg-[#E4E3E0]/45 p-4 border-b border-[#141414]/15">
                <div className="flex items-center gap-3">
                  {selectedEmployeeHistory.fotoUrl ? (
                    <img 
                      src={getDirectDriveImageURL(selectedEmployeeHistory.fotoUrl)} 
                      alt={selectedEmployeeHistory.nomeCompleto} 
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 object-cover border border-[#141414]"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-serif italic text-lg font-bold">
                      {selectedEmployeeHistory.nomeCompleto.charAt(0)}
                    </div>
                  )}
                  <div className="space-y-0.5" style={{ minWidth: 0 }}>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5">
                      Ficha de Histórico de Viagens
                    </span>
                    <h4 className="text-sm font-serif italic font-bold text-black uppercase mt-1 truncate">
                      {selectedEmployeeHistory.nomeCompleto}
                    </h4>
                    <p className="text-[9px] font-mono uppercase opacity-75 truncate">
                      Matrícula: {selectedEmployeeHistory.matricula} • {selectedEmployeeHistory.funcao} • {selectedEmployeeHistory.tipoMaoDeObra} ({diasCiclo} dias)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeHistory(null)}
                  className="p-1 px-2 border border-[#141414]/40 hover:border-black hover:bg-neutral-100 transition-all cursor-pointer text-[#141414]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                
                {/* Resumo de Indicadores Consolidados */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-neutral-50 p-4 border border-[#141414]/15">
                  <div className="font-mono text-center sm:text-left">
                    <span className="text-[8px] uppercase font-bold text-gray-500">Total de Viagens</span>
                    <span className="text-lg font-bold text-black block mt-0.5">{empViagens.length}</span>
                  </div>
                  <div className="font-mono text-center sm:text-left">
                    <span className="text-[8px] uppercase font-bold text-gray-500">Dias em Gozo</span>
                    <span className="text-lg font-bold text-[#141414] block mt-0.5">{totalDiasDeGozo} Dias</span>
                  </div>
                  <div className="font-mono text-center sm:text-left">
                    <span className="text-[8px] uppercase font-bold text-gray-500">Custo Total de Campo</span>
                    <span className="text-lg font-bold text-emerald-800 block mt-0.5">{formatCurrency(totalAcumuladoGeral)}</span>
                  </div>
                  <div className="font-mono text-center sm:text-left">
                    <span className="text-[8px] uppercase font-bold text-gray-500">Cidade Origem / UF</span>
                    <span className="text-[11px] font-bold text-black block mt-1 truncate" title={`${selectedEmployeeHistory.cidade} - ${selectedEmployeeHistory.estado}`}>
                      {selectedEmployeeHistory.cidade} ({selectedEmployeeHistory.estado})
                    </span>
                  </div>
                </div>

                {/* Lista de Registros */}
                <div className="space-y-3">
                  <h5 className="text-[10px] font-mono font-bold text-black uppercase tracking-wider border-b border-light-400 pb-1.5 flex justify-between items-center">
                    <span>Cronologia de Viagens Efetuadas</span>
                    <span className="text-[9px] font-normal text-gray-500 capitalize">{empViagens.length} lançamentos encontrados</span>
                  </h5>

                  {empViagens.length === 0 ? (
                    <p className="text-xs font-mono text-gray-500 italic uppercase bg-neutral-50 p-6 text-center border border-dashed border-[#141414]/10">
                      [ Nenhuma viagem ou folga de campo registrada para este colaborador até o momento ]
                    </p>
                  ) : (
                    <div className="border border-[#141414]/15 overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono border-collapse min-w-[600px]">
                        <thead>
                          <tr className="bg-neutral-100 text-[#141414] text-[9px] uppercase tracking-wider border-b border-[#141414]/15">
                            <th className="px-3 py-2">Início</th>
                            <th className="px-3 py-2">Retorno</th>
                            <th className="px-3 py-2 text-center">Dias</th>
                            <th className="px-3 py-2">Transporte</th>
                            <th className="px-3 py-2 text-right">01. Passagem</th>
                            <th className="px-3 py-2 text-right">02. Adto. Ajuda Custos</th>
                            <th className="px-3 py-2 text-right">03. Venda Folga Campo</th>
                            <th className="px-3 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#141414]/10 bg-white">
                          {empViagens.map(v => {
                            const custoTotal = (v.valorPassagem || 0) + (v.adiantamento || 0) + (v.valorVendaFolga || 0);
                            const dias = v.dataRealInicio && v.dataRealRetorno ? diffDays(v.dataRealInicio, v.dataRealRetorno) : 0;
                            return (
                              <tr key={v.id} className="hover:bg-neutral-50 text-[11px] text-[#141414]">
                                <td className="px-3 py-2 font-bold">{formatBrDate(v.dataRealInicio)}</td>
                                <td className="px-3 py-2 font-bold">{formatBrDate(v.dataRealRetorno)}</td>
                                <td className="px-3 py-2 text-center text-indigo-700 font-bold">{dias}D</td>
                                <td className="px-3 py-2 font-semibold text-neutral-600">{v.tipoTransporte}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(v.valorPassagem || 0)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(v.adiantamento || 0)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(v.valorVendaFolga || 0)}</td>
                                <td className="px-3 py-2 text-right font-bold text-emerald-800">{formatCurrency(custoTotal)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="bg-neutral-50 p-4 border-t border-[#141414]/15 text-right flex justify-between items-center">
                <span className="text-[9px] font-mono uppercase text-gray-500">
                  Data de Admissão: {formatBrDate(selectedEmployeeHistory.dataAdmissao)} • Início: {formatBrDate(selectedEmployeeHistory.dataInicioProjeto)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeHistory(null)}
                  className="bg-[#141414] hover:bg-neutral-800 text-white font-mono text-xs font-bold uppercase tracking-wider py-2 px-5 transition-colors cursor-pointer border border-[#141414]"
                >
                  Fechar Histórico
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
