import React, { useState, useMemo } from "react";
import { Colaborador, Treinamento, BloqueioCracha } from "../types";
import { formatBrDate, isVencido, isAvisoTrintaDias } from "../utils/date";
import { 
  GraduationCap, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  AlertCircle, 
  ShieldAlert, 
  CheckCircle,
  Clock,
  CheckCircle2,
  Trash2,
  Download,
  Upload,
  Info,
  Edit
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportToExcel, downloadTemplate, parseExcelDate } from "../utils/excel";

interface TreinamentoViewProps {
  colaboradores: Colaborador[];
  treinamentos: Treinamento[];
  bloqueios: BloqueioCracha[];
  onAddTreinamento: (treinamento: Treinamento) => Promise<void>;
  onDeleteTreinamento: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function TreinamentoView({ colaboradores, treinamentos, bloqueios, onAddTreinamento, onDeleteTreinamento, isAdmin = true }: TreinamentoViewProps) {
  
  // Estados para as barras e formulários
  const [activeSubTab, setActiveSubTab] = useState<"certificados" | "nomenclaturas">("certificados");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [importLog, setImportLog] = useState<string[]>([]);
  
  // Sistema de dicionário dinâmico de tipos de treinamento autocadastrável
  const [tiposTreinamento, setTiposTreinamento] = useState<string[]>(() => {
    const saved = localStorage.getItem("erp_tipos_treinamento_list");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [
      "Integração de Segurança de Campo",
      "NR-10 Segurança em Instalações e Serviços de Eletricidade",
      "NR-10 SEP Sistema Elétrico de Potência",
      "NR-35 Trabalho em Altura",
      "NR-18 Segurança e Saúde no Trabalho na Indústria da Construção",
      "NR-12 Segurança no Trabalho em Máquinas e Equipamentos"
    ];
  });

  const [nomeTreinamento, setNomeTreinamento] = useState(tiposTreinamento[0] || "Integração de Segurança de Campo");
  const [novoCursoNome, setNovoCursoNome] = useState("");
  const [showDicionario, setShowDicionario] = useState(false);

  const [dataRealizacao, setDataRealizacao] = useState("");
  const [periodicidade, setPeriodicidade] = useState<"1 ANO" | "2 ANOS" | "5 ANOS">("1 ANO");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirmCurso, setDeleteConfirmCurso] = useState<string | null>(null);
  const [deleteConfirmCertificado, setDeleteConfirmCertificado] = useState<{ id: string, name: string, cursoName: string } | null>(null);

  const handleConfirmDeleteCurso = () => {
    if (!deleteConfirmCurso) return;
    const curso = deleteConfirmCurso;
    const updated = tiposTreinamento.filter(item => item !== curso);
    setTiposTreinamento(updated);
    localStorage.setItem("erp_tipos_treinamento_list", JSON.stringify(updated));
    if (nomeTreinamento === curso) {
      setNomeTreinamento(updated[0] || "");
    }
    setSuccessMsg(`A nomenclatura "${curso}" foi removida com sucesso!`);
    setDeleteConfirmCurso(null);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleConfirmDeleteCertificado = async () => {
    if (!deleteConfirmCertificado) return;
    try {
      await onDeleteTreinamento(deleteConfirmCertificado.id);
      setSuccessMsg(`O certificado de "${deleteConfirmCertificado.cursoName}" de "${deleteConfirmCertificado.name}" foi excluído com sucesso!`);
      setDeleteConfirmCertificado(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir certificado.");
      setDeleteConfirmCertificado(null);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  const handleEditTreinamento = (row: any) => {
    setSelectedMatricula(row.matricula);
    setEmployeeSearchText(row.nomeCompleto);
    setNomeTreinamento(row.nomeTreinamento);
    setDataRealizacao(row.dataRealizacao);
    setPeriodicidade(row.periodicidade as any);
    setIsFormOpen(true);
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  // Pesquisar colaboradores ativos para cadastrar treinamento
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
      .slice(0, 10);
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

  // Cálculo de vencimento provisório para formulário
  const previewVencimento = useMemo(() => {
    if (!dataRealizacao || !periodicidade) return "";
    const anos = parseInt(periodicidade.split(" ")[0]) || 1;
    const date = new Date(dataRealizacao + "T12:00:00");
    date.setFullYear(date.getFullYear() + anos);
    return date.toISOString().split("T")[0];
  }, [dataRealizacao, periodicidade]);

  // Status provisório preliminar do treinamento
  const previewStatus = useMemo(() => {
    if (!previewVencimento) return { status: "Pendente", estilo: "bg-slate-100 text-slate-700" };
    
    if (isVencido(previewVencimento)) {
      return { status: "Vencido (Bloqueio)", estilo: "bg-red-100 text-red-800" };
    }
    if (isAvisoTrintaDias(previewVencimento)) {
      return { status: "Alerta (< 30 Dias)", estilo: "bg-amber-100 text-amber-800 font-semibold border border-amber-300 animate-pulse" };
    }
    return { status: "Regular", estilo: "bg-emerald-100 text-emerald-800" };
  }, [previewVencimento]);

  // Grava Treinamento
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedMatricula) {
      return setErrorMsg("Selecione um colaborador da lista.");
    }
    if (!nomeTreinamento.trim()) {
      return setErrorMsg("O nome ou norma do treinamento é obrigatório.");
    }
    if (!dataRealizacao) {
      return setErrorMsg("A data de realização do treinamento é obrigatória.");
    }
    if (!periodicidade) {
      return setErrorMsg("Selecione a periodicidade regulamentar.");
    }

    const payload: Treinamento = {
      id: "T-" + Date.now(),
      matricula: selectedMatricula,
      nomeTreinamento: nomeTreinamento.trim(),
      dataRealizacao,
      periodicidade
    };

    try {
      await onAddTreinamento(payload);
      setSuccessMsg("Treinamento registrado com sucesso nos arquivos!");
      
      // Limpar campos
      setSelectedMatricula("");
      setEmployeeSearchText("");
      setDataRealizacao("");
      
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao gravar Treinamento.");
    }
  };

  // Processa listagem final dos treinamentos para os colaboradores
  const processedTreinamentosList = useMemo(() => {
    const list: any[] = [];
    
    treinamentos.forEach(t => {
      const emp = colaboradores.find(c => c.matricula === t.matricula);
      if (!emp) return; // Se funcionário não existe ou foi excluído

      // Calcula Data de Vencimento somando anos da periodicidade
      const anos = parseInt(t.periodicidade.split(" ")[0]) || 1;
      const vDate = new Date(t.dataRealizacao + "T12:00:00");
      vDate.setFullYear(vDate.getFullYear() + anos);
      const vencStr = vDate.toISOString().split("T")[0];
      
      // Determina status
      let status: "Regular" | "Alerta" | "Vencido" = "Regular";
      if (isVencido(vencStr)) {
        status = "Vencido";
      } else if (isAvisoTrintaDias(vencStr)) {
        status = "Alerta";
      }

      // Verifica se existe um crachá bloqueado atualmente com origem igual a "Treinamento" para esta matrícula
      const activeLock = activeLocksMap[t.matricula];
      const checkBlocked = activeLock && activeLock.origem === "Treinamento";

      list.push({
        ...t,
        nomeCompleto: emp.nomeCompleto,
        funcao: emp.funcao,
        dataVencimento: vencStr,
        status,
        bloqueadoTreinamento: !!checkBlocked,
        bloqueioInfo: checkBlocked ? activeLock : null
      });
    });

    // Ordena por data de vencimento (vencidos primeiro)
    return list.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime());
  }, [treinamentos, colaboradores, activeLocksMap]);

  // Filtra listagem com base em busca textual
  const filteredTreinamentosList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return processedTreinamentosList;
    return processedTreinamentosList.filter(
      row => 
        row.matricula.toLowerCase().includes(term) || 
        row.nomeCompleto.toLowerCase().includes(term) ||
        row.nomeTreinamento.toLowerCase().includes(term) ||
        row.funcao.toLowerCase().includes(term)
    );
  }, [processedTreinamentosList, searchTerm]);

  // Exportar para Excel
  const handleExport = () => {
    const formatRows = filteredTreinamentosList.map(row => ({
      "Matrícula": row.matricula,
      "Nome Completo": row.nomeCompleto,
      "Função": row.funcao,
      "Nome do Treinamento": row.nomeTreinamento,
      "Data de Realização": formatBrDate(row.dataRealizacao),
      "Periodicidade": row.periodicidade,
      "Data de Vencimento": formatBrDate(row.dataVencimento),
      "Status de Validade": row.status,
      "Crachá Bloqueado (Treinamento)": row.bloqueadoTreinamento ? "Sim" : "Não",
      "Motivo do Bloqueio": row.bloqueioInfo ? row.bloqueioInfo.motivoDetalhado : "Sem pendência ativa"
    }));
    exportToExcel(formatRows, "Status_Treinamentos_Gestao_RH", "Treinamentos");
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
        let novosTipos = [...tiposTreinamento];

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
          const nomeTreinamentoVal = String(getVal(["Nome do Treinamento", "Treinamento", "Curso", "Nome Treinamento", "Noma"]) || "").trim();
          const dataRealizacaoVal = parseExcelDate(getVal(["Data de Realizacao", "Data Realização", "Realização", "Data"]));
          const rawPeriodicidade = String(getVal(["Periodicidade (1 ANO / 2 ANOS / 5 ANOS)", "Periodicidade", "Validade", "Tempo de Validade"]) || "").trim().toUpperCase();

          // Validação básica de matrícula
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

          if (!nomeTreinamentoVal) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Nome do curso/treinamento não informado.`);
            continue;
          }

          if (!dataRealizacaoVal) {
            errorCount++;
            logs.push(`⚠️ Falha (Linha ${rowNum} - ${matricula}): Data de realização ausente ou inválida.`);
            continue;
          }

          // Normaliza a periodicidade
          let periodicidadeVal: "1 ANO" | "2 ANOS" | "5 ANOS" = "1 ANO";
          if (rawPeriodicidade.includes("2") || rawPeriodicidade.includes("DOIS")) {
            periodicidadeVal = "2 ANOS";
          } else if (rawPeriodicidade.includes("5") || rawPeriodicidade.includes("CINCO")) {
            periodicidadeVal = "5 ANOS";
          }

          // Adiciona à lista de nomenclaturas se for nova
          if (nomeTreinamentoVal && !novosTipos.includes(nomeTreinamentoVal)) {
            novosTipos.push(nomeTreinamentoVal);
            logs.push(`📁 Nova Nomenclatura Cadastrada Automaticamente: "${nomeTreinamentoVal}"`);
          }

          const payload: Treinamento = {
            id: `T-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`,
            matricula,
            nomeTreinamento: nomeTreinamentoVal,
            dataRealizacao: dataRealizacaoVal,
            periodicidade: periodicidadeVal
          };

          try {
            await onAddTreinamento(payload);
            successCount++;
            logs.push(`✅ Importado Certificado (Linha ${rowNum}): ${matricula} - ${colaboradorLogado.nomeCompleto} (${nomeTreinamentoVal})`);
          } catch (err: any) {
            errorCount++;
            logs.push(`❌ Erro no Banco (Linha ${rowNum} - ${matricula}): ${err.message || "Falha na API ao gravar Certificado"}`);
          }
        }

        // Salva e atualiza o estado de nomenclaturas
        setTiposTreinamento(novosTipos);
        localStorage.setItem("erp_tipos_treinamento_list", JSON.stringify(novosTipos));

        setSuccessMsg(`Processamento de Treinamentos Concluído! Importados: ${successCount} | Falhas: ${errorCount}`);
        setImportLog(logs);
        e.target.value = ""; // Limpa input
      } catch (err: any) {
        setErrorMsg("Falha crítica ao ler planilha de treinamentos: " + (err.message || err));
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div id="section-treinamento" className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Gestão Regulamentar de Capacitação (NRs)
          </h2>
          <p className="text-[10px] text-[#141414]/75 font-mono uppercase tracking-tight mt-1">
            Gestão operacional e acompanhamento de qualificações, reciclagens compulsórias de NR-10, NR-35 e integração de segurança de campo.
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            {activeSubTab === "certificados" && (
              <>
                {/* Botão Baixar Modelo */}
                <button
                  type="button"
                  onClick={() => downloadTemplate("treinamento")}
                  className="flex items-center justify-center gap-2 border border-[#141414]/40 bg-white hover:bg-neutral-100 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
                >
                  <Download className="w-4 h-4 text-neutral-600" />
                  Baixar Modelo
                </button>

                {/* Botão Importar */}
                <label className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-neutral-50 text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none select-none">
                  <Upload className="w-4 h-4 text-neutral-600" />
                  Importar Treinamentos
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>

                <button
                  id="btn-export-treinamento"
                  onClick={handleExport}
                  className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar Excel
                </button>
                
                <button
                  id="btn-open-treinamento-form"
                  onClick={() => setIsFormOpen(!isFormOpen)}
                  className="flex items-center justify-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
                >
                  <Plus className="w-4 h-4" />
                  Lançar Certificado
                </button>
              </>
            )}
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

      {/* Sub-Navegação interna de Treinamentos */}
      {isAdmin && (
        <div className="flex border-b border-[#141414] gap-1 bg-[#141414]/5 p-1">
          <button
            onClick={() => setActiveSubTab("certificados")}
            className={`flex-1 sm:flex-initial text-center px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
              activeSubTab === "certificados"
                ? "bg-white border-[#141414] text-black shadow-sm"
                : "border-transparent text-[#141414]/70 hover:text-black hover:bg-white/50"
            }`}
          >
            📂 Lançamento de Certificados
          </button>
          <button
            onClick={() => setActiveSubTab("nomenclaturas")}
            className={`flex-1 sm:flex-initial text-center px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
              activeSubTab === "nomenclaturas"
                ? "bg-white border-[#141414] text-black shadow-sm"
                : "border-transparent text-[#141414]/70 hover:text-black hover:bg-white/50"
            }`}
          >
            🗂️ Nomenclaturas de Treinamentos
          </button>
        </div>
      )}

      {activeSubTab === "nomenclaturas" ? (
        <div className="bg-white border border-[#141414] p-6 space-y-6">
          <div className="border-b border-[#141414]/15 pb-4">
            <h3 className="text-sm font-serif italic font-bold text-black uppercase tracking-wide">
              Gerência do Dicionário de Cursos e Nomenclaturas
            </h3>
            <p className="text-[10px] text-[#141414]/70 font-mono mt-1">
              Cadastre e gerencie a lista dinâmica de qualificações disponíveis no ERP para os lançamentos de certificados.
            </p>
          </div>

          {/* Form para cadastrar novo Curso */}
          <div className="max-w-md p-4 bg-[#E4E3E0]/30 border border-[#141414] space-y-3">
            <span className="block text-[10px] font-mono uppercase tracking-tight font-extrabold text-[#141414] mb-1">Cadastrar Nova Nomenclatura</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: NR-33 Espaço Confinado..."
                value={novoCursoNome}
                onChange={(e) => setNovoCursoNome(e.target.value)}
                className="flex-1 bg-white border border-[#141414] px-3 py-2 text-xs font-mono outline-none text-[#141414]"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = novoCursoNome.trim();
                  if (!trimmed) return;
                  if (tiposTreinamento.includes(trimmed)) {
                    alert("Esta nomenclatura de curso já está cadastrada.");
                    return;
                  }
                  const updated = [...tiposTreinamento, trimmed];
                  setTiposTreinamento(updated);
                  localStorage.setItem("erp_tipos_treinamento_list", JSON.stringify(updated));
                  setNomeTreinamento(trimmed);
                  setNovoCursoNome("");
                }}
                className="bg-[#141414] text-[#E4E3E0] text-xs font-mono uppercase font-bold px-4 py-2 hover:bg-neutral-805 transition-colors cursor-pointer border border-[#141414]"
              >
                Cadastrar
              </button>
            </div>
          </div>

          {/* Listagem de Nomenclaturas com Exclusão */}
          <div className="space-y-2">
            <span className="block text-[10px] font-mono font-bold uppercase text-[#141414]/75">Nomenclaturas Cadastradas Atualmente ({tiposTreinamento.length})</span>
            <div className="overflow-x-auto overflow-y-auto max-h-[260px] custom-scrollbar border border-[#141414]">
              <table className="w-full border-collapse text-left text-xs font-mono">
                <thead className="sticky top-0 z-10 bg-[#141414]">
                  <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] uppercase tracking-wider">
                    <th className="px-4 py-3">Nome do Curso / Treinamento</th>
                    <th className="px-4 py-3 text-center w-32">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#141414]/15">
                  {tiposTreinamento.map((curso) => (
                    <tr key={curso} className="hover:bg-[#141414]/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-[#141414] select-all">{curso}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteConfirmCurso(curso);
                          }}
                          className="border border-red-700 text-red-750 hover:bg-red-700 hover:text-white text-[9px] font-mono font-bold uppercase px-2.5 py-1 cursor-pointer transition-colors"
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {successMsg && (
            <div className="p-4 border border-emerald-600 bg-emerald-50 text-emerald-950 font-mono text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* Formulário de Registro de Treinamento */}
          {isFormOpen && (
            <div className="bg-white p-6 border border-[#141414] space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
                <h3 className="text-xs font-serif italic font-bold text-[#141414] flex items-center gap-2 uppercase tracking-wide">
                  <GraduationCap className="w-4 h-4 text-violet-600" />
                  Lançamento de Certificação Regulamentar / Normas de Capaticação
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  
                  {/* Pesquisa Colaborador */}
                  <div className="relative">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Qual o Colaborador?*</label>
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

                    {/* Colaborador selecionado fixado */}
                    {selectedEmployee && (
                      <div className="mt-2 text-[10px] text-[#141414] font-mono font-bold uppercase flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#141414]" />
                        Selecionado: <strong className="underline text-black">{selectedEmployee.nomeCompleto}</strong>
                      </div>
                    )}
                  </div>

                  {/* Nome do Treinamento */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Norma Regulamentadora / Assunto*</label>
                    <select
                      value={nomeTreinamento}
                      onChange={(e) => setNomeTreinamento(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none font-semibold"
                    >
                      {tiposTreinamento.map((curso) => (
                        <option key={curso} value={curso}>{curso}</option>
                      ))}
                    </select>
                    
                    <button
                      type="button"
                      onClick={() => setShowDicionario(!showDicionario)}
                      className="mt-1 text-[9px] text-[#141414]/75 font-mono underline hover:text-black block text-left"
                    >
                      {showDicionario ? "[- Fechar Lista de Cursos]" : "[+ Criar / Incluir Novo Treinamento]"}
                    </button>

                    {showDicionario && (
                      <div className="mt-2 p-3 bg-neutral-50 border border-[#141414] space-y-2 absolute z-20 w-80 shadow-md">
                        <span className="block text-[9px] font-mono uppercase tracking-tight font-extrabold text-[#141414]/65">Cadastrar Novo Curso</span>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Ex: NR-33 Espaço Confinado"
                            value={novoCursoNome}
                            onChange={(e) => setNovoCursoNome(e.target.value)}
                            className="flex-1 bg-white border border-[#141414] px-2 py-1 text-[11px] font-mono outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = novoCursoNome.trim();
                              if (!trimmed) return;
                              if (tiposTreinamento.includes(trimmed)) return;
                              const updated = [...tiposTreinamento, trimmed];
                              setTiposTreinamento(updated);
                              localStorage.setItem("erp_tipos_treinamento_list", JSON.stringify(updated));
                              setNomeTreinamento(trimmed);
                              setNovoCursoNome("");
                            }}
                            className="bg-[#141414] text-[#E4E3E0] text-[10px] font-mono uppercase font-bold px-2 py-1 border border-[#141414]"
                          >
                            OK
                          </button>
                        </div>
                        {tiposTreinamento.length > 0 && (
                          <div className="pt-1 select-none">
                            <span className="block text-[8px] font-mono uppercase tracking-tight text-[#141414]/50 mb-1">Cursos (Clique em × para remover)</span>
                            <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto">
                              {tiposTreinamento.map((c) => (
                                <span key={c} className="inline-flex items-center gap-1 bg-white border border-[#141414]/20 text-[9px] font-mono px-1.5 py-0.5">
                                  {c}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = tiposTreinamento.filter(item => item !== c);
                                      setTiposTreinamento(updated);
                                      localStorage.setItem("erp_tipos_treinamento_list", JSON.stringify(updated));
                                      if (nomeTreinamento === c) {
                                        setNomeTreinamento(updated[0] || "");
                                      }
                                    }}
                                    className="text-red-700 hover:text-red-950 font-black pl-1 cursor-pointer text-xs"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Data de Realizacao */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data de Realização*</label>
                    <input
                      type="date"
                      value={dataRealizacao}
                      onChange={(e) => setDataRealizacao(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                    />
                  </div>

                  {/* Periodicidade */}
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Periodicidade da Reciclagem*</label>
                    <select
                      value={periodicidade}
                      onChange={(e) => setPeriodicidade(e.target.value as "1 ANO" | "2 ANOS" | "5 ANOS")}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                    >
                      <option value="1 ANO">1 ANO (Reciclagem Anual)</option>
                      <option value="2 ANOS">2 ANOS (Reciclagem Bienal - Ex: NR10 / NR35)</option>
                      <option value="5 ANOS">5 ANOS (Treinamentos Estratégicos/Integrações)</option>
                    </select>
                  </div>

                </div>

                {/* Quadro de Cálculo Automático do Treinamento */}
                {dataRealizacao && (
                  <div className="p-4 bg-[#E4E3E0]/30 border border-[#141414] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono font-bold uppercase tracking-tight">
                    <div>
                      <span className="opacity-60 block font-medium">Data Conclusão</span>
                      <strong className="text-[#141414] text-xs font-bold">{formatBrDate(dataRealizacao)}</strong>
                    </div>
                    <div>
                      <span className="opacity-60 block font-medium">Ciclo Contratual</span>
                      <strong className="text-[#141414]">{periodicidade}</strong>
                    </div>
                    <div>
                      <span className="opacity-60 block font-medium">Previsão Próximo Treinamento</span>
                      <strong className="text-black text-sm font-extrabold">{formatBrDate(previewVencimento)}</strong>
                    </div>
                    <div>
                      <span className="opacity-60 block font-medium">Status Preliminar</span>
                      <span className={`px-2 py-0.5 border text-[9px] font-mono font-extrabold block w-fit ${
                        previewStatus.status.includes("Regular") ? "border-[#141414] text-[#141414] bg-white" : "border-red-600 text-red-600 bg-red-50"
                      }`}>
                        {previewStatus.status.includes("Regular") ? "[ CAPACITAÇÃO REGULAR ]" : "[ RECLICAGEM OBRIGATÓRIA ]"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
                  >
                    Gravar Certificado Legal
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

          {/* Tabela de Resultados de NRs de Campo */}
          <div className="bg-white border border-[#141414] overflow-hidden">
            
            <div className="p-4 border-b border-[#141414]/15 bg-[#E4E3E0]/30 flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="relative w-full md:w-96">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar por Código, Nome ou Norma de Treinamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white text-[#141414] pl-9 pr-4 py-2 text-xs border border-[#141414] rounded-none focus:ring-1 focus:ring-[#141414] outline-none font-mono"
                />
              </div>
              <div className="text-[10px] text-[#141414] font-mono font-bold uppercase tracking-tight">
                LISTANDO {filteredTreinamentosList.length} QUALIFICAÇÕES ATIVAS.
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
              {filteredTreinamentosList.length === 0 ? (
                <div className="p-12 text-center text-[#141414]">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#141414]/65" />
                  <p className="text-sm font-serif italic font-bold">Nenhum treinamento lançado para busca informada.</p>
                  <p className="text-[10px] font-mono uppercase tracking-tight opacity-60">Registre as capacitações dos profissionais de campo para visualização.</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs min-w-[1150px]">
                  <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
                    <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                      <th className="px-5 py-3">Matrícula</th>
                      <th className="px-5 py-3">Nome Completo</th>
                      <th className="px-5 py-3">Função</th>
                      <th className="px-5 py-3">Treinamento Regulamentar (NR)</th>
                      <th className="px-5 py-3">Realização</th>
                      <th className="px-5 py-3">Periodicidade</th>
                      <th className="px-5 py-3">Vencimento Planejado</th>
                      <th className="px-5 py-3">Status Segurança</th>
                      <th className="px-5 py-3 text-center">Crachá Portaria</th>
                      {isAdmin && <th className="px-5 py-3 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/15">
                    {filteredTreinamentosList.map((row) => (
                      <tr key={row.id} className="hover:bg-[#141414]/5 transition-colors text-[#141414]">
                        
                        {/* Matricula */}
                        <td className="px-5 py-3.5 font-mono font-extrabold select-all uppercase tracking-tight">{row.matricula}</td>
                        
                        {/* Nome */}
                        <td className="px-5 py-3.5 font-serif font-extrabold italic select-all">{row.nomeCompleto}</td>
                        
                        {/* Função */}
                        <td className="px-5 py-3.5 font-serif font-medium opacity-85">{row.funcao}</td>
                        
                        {/* Nome Treinamento */}
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-[10px] font-bold block max-w-xs truncate uppercase tracking-tighter" title={row.nomeTreinamento}>
                            {row.nomeTreinamento}
                          </span>
                        </td>

                        {/* Data realizacao */}
                        <td className="px-5 py-3.5 font-mono text-[11px] opacity-80">
                          {formatBrDate(row.dataRealizacao)}
                        </td>

                        {/* Periodicidade */}
                        <td className="px-5 py-3.5">
                          <span className="border border-[#141414] text-[#141414] bg-white px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase">
                            {row.periodicidade}
                          </span>
                        </td>

                        {/* Data Vencimento */}
                        <td className="px-5 py-3.5 font-mono text-[11px] font-bold">
                          {formatBrDate(row.dataVencimento)}
                        </td>

                        {/* Status de Exame / Validade */}
                        <td className="px-5 py-3.5">
                          {row.status === "Vencido" && (
                            <span className="text-red-600 bg-red-100 border border-red-200 px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase">
                              CAPACITAÇÃO VENCIDA
                            </span>
                          )}
                          {row.status === "Alerta" && (
                            <div className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-950 text-[9px] font-bold font-mono uppercase animate-pulse">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              A VENCER (&lt; 30D)
                            </div>
                          )}
                          {row.status === "Regular" && (
                            <span className="text-[#141414] bg-white border border-[#141414] px-2.5 py-0.5 text-[9px] font-bold font-mono uppercase">
                              CAPACITAÇÃO VÁLIDA
                            </span>
                          )}
                        </td>

                        {/* Integração Automática de Bloqueio de Crachá da Portaria */}
                        <td className="px-5 py-3.5 text-center">
                          {row.bloqueadoTreinamento ? (
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
                                onClick={() => handleEditTreinamento(row)}
                                title="Editar / Renovar Treinamento"
                                className="border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] text-[9px] font-mono font-bold uppercase px-2 py-1 cursor-pointer transition-colors flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3 text-indigo-600" />
                                Editar
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteConfirmCertificado({
                                    id: row.id,
                                    name: row.nomeCompleto,
                                    cursoName: row.nomeTreinamento
                                  });
                                }}
                                title="Excluir certificado"
                                className="border border-red-700 text-red-700 hover:bg-red-700 hover:text-white text-[9px] font-mono font-bold uppercase px-2 py-1 cursor-pointer transition-colors"
                              >
                                Excluir
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
        </>
      )}

      {/* Modal Customizado de Confirmação de Deleção de Nome de Curso */}
      {deleteConfirmCurso && (
        <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR REMOÇÃO DE CURSO</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Atenção! Você está prestes a excluir a nomenclatura de curso: <strong className="text-black font-semibold font-serif italic">"{deleteConfirmCurso}"</strong>.
                </p>
                <p className="text-[10px] text-red-650 font-mono font-bold uppercase tracking-tight">
                  ⚠️ NOVOS LANÇAMENTOS NÃO PODERÃO MAIS SELECIONAR OU USAR ESTE CURSO NA LISTA.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDeleteCurso}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer border border-red-800 font-extrabold"
              >
                Sim, Remover
              </button>
              <button
                onClick={() => setDeleteConfirmCurso(null)}
                className="flex-1 border border-[#141414]/30 hover:border-[#141414] hover:bg-[#141414]/5 text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer text-[#141414]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Confirmação de Deleção de Certificado */}
      {deleteConfirmCertificado && (
        <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR EXCLUSÃO DE CERTIFICADO</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Deseja realmente remover o registro de treinamento <strong className="text-black font-semibold font-serif italic">"{deleteConfirmCertificado.cursoName}"</strong> do colaborador <strong className="text-black font-semibold font-serif italic">{deleteConfirmCertificado.name}</strong>?
                </p>
                <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-tight">
                  Esta ação é definitiva e removerá a certificação de nossos servidores.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDeleteCertificado}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer border border-red-800 font-extrabold"
              >
                Confirmar Exclusão
              </button>
              <button
                onClick={() => setDeleteConfirmCertificado(null)}
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
