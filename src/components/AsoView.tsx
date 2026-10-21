import React, { useState, useMemo } from "react";
import { Colaborador, ASO, BloqueioCracha } from "../types";
import { formatBrDate, isVencido } from "../utils/date";
import { 
  HeartPulse, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  AlertCircle, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  Trash2,
  Download,
  Upload,
  Info,
  Edit
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportToExcel, downloadTemplate, parseExcelDate } from "../utils/excel";

interface AsoViewProps {
  colaboradores: Colaborador[];
  asos: ASO[];
  bloqueios: BloqueioCracha[];
  onAddASO: (aso: ASO) => Promise<void>;
  onDeleteASO: (idOrMatricula: string, tipoExame?: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function AsoView({ colaboradores, asos, bloqueios, onAddASO, onDeleteASO, isAdmin = true }: AsoViewProps) {
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [tipoExame, setTipoExame] = useState("Admissional");
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [validadeMeses, setValidadeMeses] = useState<number>(12);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: string, matricula?: string, tipoExame?: string, nome: string } | null>(null);
  const [importLog, setImportLog] = useState<string[]>([]);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.id) {
        await onDeleteASO(deleteConfirm.id);
      } else if (deleteConfirm.matricula && deleteConfirm.tipoExame) {
        await onDeleteASO(deleteConfirm.matricula, deleteConfirm.tipoExame);
      }
      setSuccessMsg(`O ASO de "${deleteConfirm.nome}" foi excluído com sucesso!`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir ASO.");
      setDeleteConfirm(null);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  const handleEditASO = (row: any) => {
    setSelectedMatricula(row.matricula);
    setEmployeeSearchText(row.nome);
    setTipoExame(row.tipoExame !== "-" ? row.tipoExame : "Periódico");
    setDataRealizacao(row.dataRealizacao !== "-" ? row.dataRealizacao : "");
    setValidadeMeses(row.validadeMeses > 0 ? row.validadeMeses : 12);
    setIsFormOpen(true);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  // Pesquisar colaboradores ativos para vincular ASO
  const [employeeSearchText, setEmployeeSearchText] = useState("");
  const lookupEmployeeText = employeeSearchText.trim().toLowerCase();

  const matchingEmployeesInDropdown = useMemo(() => {
    if (!lookupEmployeeText) return [];
    return colaboradores
      .filter(
        c => 
          c.matricula.toLowerCase().includes(lookupEmployeeText) || 
          c.nomeCompleto.toLowerCase().includes(lookupEmployeeText)
      )
      .slice(0, 10); // Limit dropdown display to 10
  }, [colaboradores, lookupEmployeeText]);

  // Encontra funcionário selecionado
  const selectedEmployee = useMemo(() => {
    return colaboradores.find(c => c.matricula === selectedMatricula);
  }, [colaboradores, selectedMatricula]);

  // Mapeia bloqueios ativos atuais por matrícula
  const activeLocksMap = useMemo(() => {
    const map: Record<string, BloqueioCracha> = {};
    bloqueios.forEach(b => {
      // É ativo se não possui data de liberação
      if (!b.dataLiberacao) {
        map[b.matricula] = b;
      }
    });
    return map;
  }, [bloqueios]);

  // Previsão automática da data de vencimento da ASO ao preencher
  const previewVencimento = useMemo(() => {
    if (!dataRealizacao || !validadeMeses) return "";
    const date = new Date(dataRealizacao + "T12:00:00");
    date.setMonth(date.getMonth() + validadeMeses);
    return date.toISOString().split("T")[0];
  }, [dataRealizacao, validadeMeses]);

  // Calcula se o preview está vencido
  const previewStatus = useMemo(() => {
    if (!previewVencimento) return "Pendente";
    return isVencido(previewVencimento) ? "Vencido" : "Regular";
  }, [previewVencimento]);

  // Submissão do novo ASO
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedMatricula) {
      return setErrorMsg("Selecione um colaborador da lista.");
    }
    if (!tipoExame) {
      return setErrorMsg("Selecione o tipo de exame.");
    }
    if (!dataRealizacao) {
      return setErrorMsg("Informe a data de realização do exame.");
    }
    if (!validadeMeses || validadeMeses <= 0) {
      return setErrorMsg("A validade em meses deve ser maior que zero.");
    }

    const payload: ASO = {
      matricula: selectedMatricula,
      tipoExame,
      dataRealizacao,
      validadeMeses: Number(validadeMeses)
    };

    try {
      await onAddASO(payload);
      setSuccessMsg("ASO registrado com sucesso no banco de dados!");
      
      // Limpa formulário
      setSelectedMatricula("");
      setEmployeeSearchText("");
      setDataRealizacao("");
      
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao gravar ASO.");
    }
  };

  // Processamento e listagem final calculada de ASOs
  const processedAsosTable = useMemo(() => {
    // Para cada colaborador, buscamos as informações de ASO correspondente.
    // Criamos uma lista consolidada relacionando dados.
    return colaboradores.map(col => {
      const colAsos = asos.filter(a => a.matricula === col.matricula);
      
      // Encontra se há bloqueio ativo originado de ASO
      const activeLock = activeLocksMap[col.matricula];
      const checkAsoBlocked = activeLock && activeLock.origem === "ASO";

      if (colAsos.length === 0) {
        return {
          matricula: col.matricula,
          nome: col.nomeCompleto,
          funcao: col.funcao,
          tipoExame: "Não Cadastrado",
          dataRealizacao: "-",
          validadeMeses: 0,
          dataVencimento: "-",
          status: "Vencido" as "Regular" | "Vencido",
          bloqueadoAso: !!checkAsoBlocked,
          bloqueioInfo: checkAsoBlocked ? activeLock : null,
          hasAsoRecord: false
        };
      }

      // Último ASO do colaborador
      const latestAso = colAsos.reduce((prev, curr) => {
        return new Date(prev.dataRealizacao) > new Date(curr.dataRealizacao) ? prev : curr;
      });

      const dateV = new Date(latestAso.dataRealizacao + "T12:00:00");
      dateV.setMonth(dateV.getMonth() + latestAso.validadeMeses);
      const vencStr = dateV.toISOString().split("T")[0];
      const statusAso = isVencido(vencStr) ? "Vencido" : "Regular";

      return {
        asoId: latestAso.id,
        matricula: col.matricula,
        nome: col.nomeCompleto,
        funcao: col.funcao,
        tipoExame: latestAso.tipoExame,
        dataRealizacao: latestAso.dataRealizacao,
        validadeMeses: latestAso.validadeMeses,
        dataVencimento: vencStr,
        status: statusAso as "Regular" | "Vencido",
        bloqueadoAso: !!checkAsoBlocked,
        bloqueioInfo: checkAsoBlocked ? activeLock : null,
        hasAsoRecord: true
      };
    });
  }, [colaboradores, asos, activeLocksMap]);

  // Filtra tabela renderizada com base em busca
  const filteredAsosList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return processedAsosTable;
    return processedAsosTable.filter(
      row => 
        row.matricula.toLowerCase().includes(term) || 
        row.nome.toLowerCase().includes(term) ||
        row.funcao.toLowerCase().includes(term)
    );
  }, [processedAsosTable, searchTerm]);

  // Exportar para Excel
  const handleExport = () => {
    const formatRows = filteredAsosList.map(row => ({
      "Matrícula": row.matricula,
      "Nome Completo": row.nome,
      "Função": row.funcao,
      "Tipo de Exame": row.tipoExame,
      "Data de Realização": row.dataRealizacao !== "-" ? formatBrDate(row.dataRealizacao) : "Não Realizado",
      "Validade (Meses)": row.validadeMeses || 0,
      "Data de Vencimento": row.dataVencimento !== "-" ? formatBrDate(row.dataVencimento) : "N/A",
      "Status": row.status,
      "Crachá Bloqueado (Origem ASO)": row.bloqueadoAso ? "Sim" : "Não",
      "Motivo do Bloqueio": row.bloqueioInfo ? row.bloqueioInfo.motivoDetalhado : "Sem restrição"
    }));
    exportToExcel(formatRows, "Status_ASO_Colaboradores", "ASOs");
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
          const tipoExameVal = String(getVal(["Tipo de Exame", "Tipo Exame", "Exame", "Tipo"]) || "Periódico").trim();
          const dataRealizacaoVal = parseExcelDate(getVal(["Data de Realizacao", "Data Realização", "Realização", "Data de Realização"]));
          const rawValidade = getVal(["Validade em Meses", "Validade", "Meses Validade", "Vencimento Meses"]);
          const validadeMesesVal = rawValidade ? parseInt(String(rawValidade).replace(/\D/g, ""), 10) : 12;

          // Validações Essenciais
          if (!matricula) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum}): Coluna de matrícula vazia ou não correspondida.`);
            continue;
          }

          // Verifica se o colaborador existe
          const colaboradorLogado = colaboradores.find(c => c.matricula.trim().toUpperCase() === matricula);
          if (!colaboradorLogado) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Colaborador com esta matrícula não está cadastrado.`);
            continue;
          }

          if (!dataRealizacaoVal) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Data de realização ausente ou inválida.`);
            continue;
          }

          const payload: ASO = {
            id: `ASO-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
            matricula,
            tipoExame: tipoExameVal,
            dataRealizacao: dataRealizacaoVal,
            validadeMeses: isNaN(validadeMesesVal) ? 12 : validadeMesesVal
          };

          try {
            await onAddASO(payload);
            successCount++;
            logs.push(`✅ Importado ASO (Linha ${rowNum}): ${matricula} - ${colaboradorLogado.nomeCompleto} (${tipoExameVal})`);
          } catch (err: any) {
            errorCount++;
            logs.push(`❌ Erro no Banco (Linha ${rowNum} - ${matricula}): ${err.message || "Falha na API ao gravar ASO"}`);
          }
        }

        setSuccessMsg(`Processamento de ASOs Concluído! Importados: ${successCount} | Falhas: ${errorCount}`);
        setImportLog(logs);
        e.target.value = ""; // Limpa input
      } catch (err: any) {
        setErrorMsg("Falha crítica ao ler planilha de ASO: " + (err.message || err));
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div id="section-aso" className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Gestão Integrada de ASO Ocupacional
          </h2>
          <p className="text-[10px] text-[#141414]/75 font-mono uppercase tracking-tight mt-1">
            Gestão inteligente de saúde ocupacional, vencimentos e impedimentos automáticos de acessabilidade ao canteiro.
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {/* Botão Baixar Modelo */}
            <button
              type="button"
              onClick={() => downloadTemplate("aso")}
              className="flex items-center justify-center gap-2 border border-[#141414]/40 bg-white hover:bg-neutral-100 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Download className="w-4 h-4 text-neutral-600" />
              Baixar Modelo
            </button>

            {/* Botão Importar */}
            <label className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-neutral-50 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none select-none">
              <Upload className="w-4 h-4 text-neutral-600" />
              Importar ASOs
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportFile}
              />
            </label>

            <button
              id="btn-export-aso"
              onClick={handleExport}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
            
            <button
              id="btn-open-aso-form"
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" />
              Lançar Novo ASO
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

      {successMsg && (
        <div className="p-4 border border-emerald-600 bg-emerald-50 text-emerald-950 font-mono text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Formulário de Lançamento */}
      {isFormOpen && (
        <div className="bg-white p-6 border border-[#141414] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
            <h3 className="text-xs font-serif italic font-bold text-[#141414] flex items-center gap-2 uppercase tracking-wide">
              <HeartPulse className="w-4 h-4 text-red-600" />
              Lançamento de Exame Clínico (ASO)
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
              <div className="p-3 border border-red-650 bg-red-50 text-red-950 font-mono text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Pesquisar colaborador para vincular */}
              <div className="md:col-span-4 relative">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Buscar por Nome / Matrícula*</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar código ou nome..."
                    value={employeeSearchText}
                    onChange={(e) => {
                      setEmployeeSearchText(e.target.value);
                      if (selectedMatricula) setSelectedMatricula(""); // Reinicia se mudar campo
                    }}
                    className="w-full bg-white text-[#141414] pl-8 pr-4 py-2 border border-[#141414] rounded-none text-xs font-mono outline-none"
                  />
                </div>

                {/* Dropdown dinâmico de sugestões */}
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

                {/* Colaborador selecionado fixado */}
                {selectedEmployee && (
                  <div className="mt-2 text-[10px] text-[#141414] font-mono font-bold uppercase flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-[#141414]" />
                    Ficha Selecionada: <strong className="underline text-black">{selectedEmployee.nomeCompleto}</strong> ({selectedEmployee.funcao})
                  </div>
                )}
              </div>

              {/* Tipo de Exame */}
              <div className="md:col-span-3">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Tipo de Exame Clínico*</label>
                <select
                  value={tipoExame}
                  onChange={(e) => setTipoExame(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                >
                  <option value="Admissional">Admissional</option>
                  <option value="Periódico">Periódico</option>
                  <option value="Demissional">Demissional</option>
                  <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                  <option value="Mudança de Função">Mudança de Função</option>
                </select>
              </div>

              {/* Data de Realização */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data de Realização*</label>
                <input
                  type="date"
                  value={dataRealizacao}
                  onChange={(e) => setDataRealizacao(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>

              {/* Validade */}
              <div className="md:col-span-3">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Validade (Meses)*</label>
                <div className="flex gap-2">
                  <select
                    value={validadeMeses}
                    onChange={(e) => setValidadeMeses(Number(e.target.value))}
                    className="bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none flex-1"
                  >
                    <option value={6}>6 Meses (Insalubridade)</option>
                    <option value={12}>12 Meses (Anual Geral)</option>
                    <option value={24}>24 Meses (Bienal de Segurança)</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    placeholder="Meses"
                    value={validadeMeses}
                    onChange={(e) => setValidadeMeses(Number(e.target.value))}
                    className="w-16 bg-white text-[#141414] border border-[#141414] rounded-none px-2 text-center text-xs outline-none font-mono font-bold"
                    title="Defina valor livre de meses"
                  />
                </div>
              </div>

            </div>

            {/* Painel de Visualização do Cálculo Automático do Vencimento */}
            {dataRealizacao && (
              <div className="p-4 bg-[#E4E3E0]/30 border border-[#141414] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono font-bold uppercase tracking-tight">
                <div>
                  <span className="opacity-60 block">Data Realizada</span>
                  <strong className="text-[#141414] text-xs font-bold">{formatBrDate(dataRealizacao)}</strong>
                </div>
                <div>
                  <span className="opacity-60 block">Vigência</span>
                  <strong className="text-[#141414]">{validadeMeses} meses</strong>
                </div>
                <div>
                  <span className="opacity-60 block">Vencimento Legal</span>
                  <strong className="text-black text-sm font-extrabold">{formatBrDate(previewVencimento)}</strong>
                </div>
                <div>
                  <span className="opacity-60 block">Filtro Regulatório</span>
                  <span className={`px-2 py-0.5 border text-[9px] font-mono font-extrabold block w-fit ${
                    previewStatus === "Regular" ? "border-[#141414] text-[#141414] bg-white" : "border-red-600 text-red-600 bg-red-50"
                  }`}>
                    {previewStatus === "Regular" ? "[ LIBERADO ]" : "[ REPROVADO ]"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
              >
                Gravar Exame Clínico
              </button>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="border border-[#141414]/30 hover:border-[#141414] text-xs font-mono font-bold uppercase tracking-widest px-4 py-2.5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Tabela de Resultados Integrados de ASOs */}
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
            VERIFICANDO {filteredAsosList.length} COLABORADORES NA BASE ATIVA.
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
          <table className="w-full border-collapse text-left text-xs min-w-[1150px]">
            <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
              <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                <th className="px-5 py-3">Matrícula</th>
                <th className="px-5 py-3">Nome do Colaborador</th>
                <th className="px-5 py-3">Função</th>
                <th className="px-5 py-3">Último Exame</th>
                <th className="px-5 py-3">Data Realização</th>
                <th className="px-5 py-3">Validade</th>
                <th className="px-5 py-3">Data de Vencimento</th>
                <th className="px-5 py-3">Status de Segurança</th>
                <th className="px-5 py-3 text-center">Crachá Portaria</th>
                {isAdmin && <th className="px-5 py-3 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/15">
              {filteredAsosList.map((row) => (
                <tr key={row.matricula} className="hover:bg-[#141414]/5 transition-colors text-[#141414]">
                  
                  {/* Matricula */}
                  <td className="px-5 py-3.5 font-mono font-extrabold select-all uppercase tracking-tight">{row.matricula}</td>
                  
                  {/* Nome */}
                  <td className="px-5 py-3.5 font-serif font-extrabold italic select-all">{row.nome}</td>
                  
                  {/* Funcao */}
                  <td className="px-5 py-3.5 font-serif font-medium opacity-85">{row.funcao}</td>
                  
                  {/* Tipo Exame */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[9px] border border-[#141414] px-1.5 py-0.5 uppercase tracking-tighter bg-white font-bold select-none">
                      {row.tipoExame}
                    </span>
                  </td>

                  {/* Data Realização */}
                  <td className="px-5 py-3.5 font-mono text-[11px] opacity-80">
                    {row.dataRealizacao !== "-" ? formatBrDate(row.dataRealizacao) : "Pendente"}
                  </td>

                  {/* Validade */}
                  <td className="px-5 py-3.5 font-mono text-[11px]">
                    {row.validadeMeses > 0 ? `${row.validadeMeses} m` : "N/A"}
                  </td>

                  {/* Data Vencimento */}
                  <td className="px-5 py-3.5 font-mono text-[11px] font-bold">
                    {row.dataVencimento !== "-" ? formatBrDate(row.dataVencimento) : "N/A"}
                  </td>

                  {/* Status do ASO */}
                  <td className="px-5 py-3.5">
                    <span className={`px-2 py-0.5 text-[9px] font-mono font-extrabold uppercase border ${
                      row.status === "Regular" 
                        ? "border-[#141414] text-[#141414] bg-white" 
                        : "border-red-600 text-red-600 bg-red-100"
                    }`}>
                      {row.status === "Regular" ? "APTO REGULAR" : "REPROVADO/VENCIDO"}
                    </span>
                  </td>

                  {/* Integração Automática de Bloqueio - Tarja de Pendência */}
                  <td className="px-5 py-3.5 text-center">
                    {row.bloqueadoAso ? (
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="bg-red-700 text-white font-mono font-black text-[9px] px-2 py-1 flex items-center gap-1 uppercase tracking-tighter shadow-sm">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          BLOQUEADO
                        </span>
                        <span className="text-[8px] font-mono font-bold uppercase text-red-700 hover:underline cursor-help" title={row.bloqueioInfo?.motivoDetalhado}>
                          Ver Motivo
                        </span>
                      </div>
                    ) : (
                      <span className="border border-[#141414] bg-[#141414] text-[#E4E3E0] font-mono font-bold text-[9px] px-2 py-0.5 uppercase">
                        LIBERADO
                      </span>
                    )}
                  </td>

                  {/* Ações */}
                  {isAdmin && (
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditASO(row)}
                          title="Editar / Atualizar dados do ASO"
                          className="border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] text-[9px] font-mono font-bold uppercase px-2 py-1 cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Edit className="w-3 h-3 text-indigo-600" />
                          Editar
                        </button>
                        {row.hasAsoRecord && (
                          <button
                            onClick={() => {
                              setDeleteConfirm({
                                id: row.asoId,
                                matricula: row.matricula,
                                tipoExame: row.tipoExame,
                                nome: row.nome
                              });
                            }}
                            title="Excluir lançamento de ASO"
                            className="border border-red-700 text-red-700 hover:bg-red-700 hover:text-white text-[9px] font-mono font-bold uppercase px-2 py-1 cursor-pointer transition-colors"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  )}

                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modal Customizado de Confirmação de Deleção de ASO (Para contornar iframe sandbox confirm block) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR EXCLUSÃO DE ASO</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Você está prestes a excluir o registro de ASO (<strong className="text-black font-semibold font-serif italic">{deleteConfirm.tipoExame || "Ativo"}</strong>) do colaborador <strong className="text-black font-semibold font-serif italic">{deleteConfirm.nome}</strong>.
                </p>
                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-tight">
                  Esta ação não pode ser desfeita. Se o colaborador possuir apenas esse exame, ele ficará com status "Não Cadastrado".
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

    </div>
  );
}
