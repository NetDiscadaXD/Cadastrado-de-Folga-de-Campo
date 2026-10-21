import React, { useState, useMemo } from "react";
import { Colaborador, BloqueioCracha } from "../types";
import { formatBrDate } from "../utils/date";
import { 
  ShieldAlert, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle,
  Lock,
  Unlock,
  UserCheck,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { exportToExcel } from "../utils/excel";

interface BloqueioViewProps {
  colaboradores: Colaborador[];
  bloqueios: BloqueioCracha[];
  onAddBloqueio: (bloqueio: BloqueioCracha) => Promise<void>;
  onLiberarBloqueio: (id: string, dataLiberacao: string, dataRealizacao: string) => Promise<void>;
  onDeleteBloqueio: (id: string) => Promise<void>;
  isAdmin?: boolean;
}

export default function BloqueioView({ colaboradores, bloqueios, onAddBloqueio, onLiberarBloqueio, onDeleteBloqueio, isAdmin = true }: BloqueioViewProps) {
  
  // Estados para busca e controle de formulários
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMatricula, setSelectedMatricula] = useState("");
  const [origem, setOrigem] = useState<"ASO" | "Treinamento">("ASO");
  const [dataBloqueio, setDataBloqueio] = useState("");
  const [motivoDetalhado, setMotivoDetalhado] = useState("");
  const [tipoTreinamentoPendente, setTipoTreinamentoPendente] = useState("");
  
  // Novos campos para registrar realizações específicas no momento do bloqueio
  const [dataRealizacaoBloqueio, setDataRealizacaoBloqueio] = useState("");
  const [tipoExameBloqueio, setTipoExameBloqueio] = useState("Pendente (Portaria)");
  const [validadeMesesBloqueio, setValidadeMesesBloqueio] = useState(12);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [releaseId, setReleaseId] = useState<string | null>(null);
  const [dataLiberacaoValue, setDataLiberacaoValue] = useState("");
  const [dataRealizacaoValue, setDataRealizacaoValue] = useState("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string } | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await onDeleteBloqueio(deleteConfirm.id);
      setSuccessMsg(`O histórico de bloqueio de "${deleteConfirm.name}" foi excluído com sucesso!`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao excluir bloqueio.");
      setDeleteConfirm(null);
      setTimeout(() => setErrorMsg(""), 3000);
    }
  };

  // Pesquisar colaboradores ativos por Matrícula
  const [employeeSearchText, setEmployeeSearchText] = useState("");
  const lookupEmployeeText = employeeSearchText.trim().toLowerCase();

  const matchingEmployeesInDropdown = useMemo(() => {
    if (!lookupEmployeeText) return [];
    return colaboradores
      .filter(
        c => 
          c.status !== "Inativo" && (
            c.matricula.toLowerCase().includes(lookupEmployeeText) || 
            c.nomeCompleto.toLowerCase().includes(lookupEmployeeText)
          )
      )
      .slice(0, 10);
  }, [colaboradores, lookupEmployeeText]);

  // Colaborador atualmente selecionado para bloqueio
  const selectedEmployee = useMemo(() => {
    return colaboradores.find(c => c.matricula === selectedMatricula);
  }, [colaboradores, selectedMatricula]);

  // Envia registro de bloqueio
  const handleSubmitBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedMatricula) {
      return setErrorMsg("Selecione um funcionário pela Matrícula.");
    }
    if (!dataBloqueio) {
      return setErrorMsg("Informe a data do bloqueio de acesso.");
    }
    if (!motivoDetalhado.trim()) {
      return setErrorMsg("Digite um motivo detalhado para justificar o bloqueio.");
    }
    if (origem === "Treinamento" && !tipoTreinamentoPendente.trim()) {
      return setErrorMsg("Ao bloquear por motivo de treinamento, informe qual treinamento está pendente.");
    }

    // Verifica se já existe um bloqueio ativo (não liberado) para este funcionário
    const activeLockExists = bloqueios.some(b => b.matricula === selectedMatricula && !b.dataLiberacao);
    if (activeLockExists) {
      return setErrorMsg("Este funcionário já possui um bloqueio ativo na portaria.");
    }

    const payload: BloqueioCracha = {
      id: "B-" + Date.now(),
      matricula: selectedMatricula,
      origem,
      dataBloqueio,
      motivoDetalhado: motivoDetalhado.trim(),
      tipoTreinamentoPendente: origem === "Treinamento" ? tipoTreinamentoPendente.trim() : "",
      dataLiberacao: "",
      dataRealizacao: dataRealizacaoBloqueio || undefined,
      tipoExame: origem === "ASO" ? tipoExameBloqueio : undefined,
      validadeMeses: origem === "ASO" ? Number(validadeMesesBloqueio) : undefined,
    };

    try {
      await onAddBloqueio(payload);
      setSuccessMsg("Bloqueio de crachá registrado com sucesso na portaria!");
      
      // Reseta form
      setSelectedMatricula("");
      setEmployeeSearchText("");
      setMotivoDetalhado("");
      setTipoTreinamentoPendente("");
      setDataBloqueio("");
      setDataRealizacaoBloqueio("");
      setTipoExameBloqueio("Pendente (Portaria)");
      setValidadeMesesBloqueio(12);
      
      setTimeout(() => {
        setIsFormOpen(false);
        setSuccessMsg("");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao registrar bloqueio de crachá.");
    }
  };

  // Envia liberação/desbloqueio
  const handleSubmitRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!releaseId) return;
    if (!dataLiberacaoValue) {
      return setErrorMsg("Selecione a data de liberação do crachá.");
    }

    // Valida que a data de liberação não é anterior à data de bloqueio
    const lockRecord = bloqueios.find(b => b.id === releaseId);
    if (lockRecord && new Date(dataLiberacaoValue) < new Date(lockRecord.dataBloqueio)) {
      return setErrorMsg("A data de liberação não pode ser anterior à data em que o crachá foi de fato bloqueado.");
    }

    try {
      await onLiberarBloqueio(releaseId, dataLiberacaoValue, dataRealizacaoValue);
      setSuccessMsg("Crachá liberado com sucesso! Acesso reabilitado na portaria.");
      
      setReleaseId(null);
      setDataLiberacaoValue("");
      setDataRealizacaoValue("");
      
      setTimeout(() => {
        setSuccessMsg("");
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao efetuar debloqueio.");
    }
  };

  // Processa listagem agregada para o painel de Crachás
  const processedBloqueiosTable = useMemo(() => {
    return bloqueios.map(b => {
      const emp = colaboradores.find(c => c.matricula === b.matricula);
      return {
        ...b,
        nomeEmployee: emp ? emp.nomeCompleto : "Desconhecido/Excluído",
        funcaoEmployee: emp ? emp.funcao : "-",
        empStatus: emp ? emp.status : "Ativo"
      };
    }).sort((a, b) => {
      // Ordena de forma que crachás ativamente bloqueados fiquem no topo
      if (!a.dataLiberacao && b.dataLiberacao) return -1;
      if (a.dataLiberacao && !b.dataLiberacao) return 1;
      return new Date(b.dataBloqueio).getTime() - new Date(a.dataBloqueio).getTime();
    });
  }, [bloqueios, colaboradores]);

  // Filtra listagem de bloqueios
  const filteredBloqueiosList = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return processedBloqueiosTable;
    return processedBloqueiosTable.filter(
      row => 
        row.matricula.toLowerCase().includes(term) || 
        row.nomeEmployee.toLowerCase().includes(term) ||
        row.origem.toLowerCase().includes(term) ||
        row.motivoDetalhado.toLowerCase().includes(term)
    );
  }, [processedBloqueiosTable, searchTerm]);

  // Exportar para Excel
  const handleExport = () => {
    const formatRows = filteredBloqueiosList.map(row => ({
      "ID Registro": row.id,
      "Matrícula": row.matricula,
      "Nome Completo": row.nomeEmployee,
      "Função": row.funcaoEmployee,
      "Origem do Bloqueio": row.origem,
      "Data do Bloqueio": formatBrDate(row.dataBloqueio),
      "Motivo Detalhado": row.motivoDetalhado,
      "Treinamento Pendente": row.tipoTreinamentoPendente || "Não aplicável",
      "Data de Liberação": row.dataLiberacao ? formatBrDate(row.dataLiberacao) : "BLOQUEIO ATIVO",
      "Status Portaria": row.dataLiberacao ? "Liberado" : "Bloqueado"
    }));
    exportToExcel(formatRows, "Historico_Bloqueios_Crachas_SMS", "Bloqueios de Acesso");
  };

  return (
    <div id="section-bloqueio" className="space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 border border-[#141414]">
        <div>
          <h2 className="text-xl font-serif italic font-bold text-[#141414] tracking-tight">
            Módulo de Segurança: Controle de Bloqueio de Portaria
          </h2>
          <p className="text-[10px] text-[#141414]/75 font-mono uppercase tracking-tight mt-1">
            Gestão unificada de bloqueios operacionais no canteiro. Impede a entrada física de trabalhadores com pendências críticas de exames médicos (ASO) ou segurança (NRs).
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              id="btn-export-bloqueios"
              onClick={handleExport}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-white hover:bg-[#141414] hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
            
            <button
              id="btn-open-bloqueio-form"
              onClick={() => {
                setIsFormOpen(!isFormOpen);
                setReleaseId(null);
              }}
              className="flex items-center justify-center gap-2 border border-[#141414] bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 hover:text-white text-xs font-mono font-bold uppercase tracking-wider px-4 py-2.5 transition-colors cursor-pointer flex-1 sm:flex-none"
            >
              <Lock className="w-4 h-4" />
              Bloquear Novo Crachá
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-4 border border-emerald-600 bg-emerald-50 text-emerald-950 font-mono text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-650" />
          {successMsg}
        </div>
      )}

      {/* Formulário de Lançamento de Bloqueio */}
      {isFormOpen && (
        <div className="bg-white p-6 border border-[#141414] space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
            <h3 className="text-xs font-serif italic font-bold text-[#141414] flex items-center gap-2 uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-red-650" />
              Restringir Entrada / Emitir Bloqueio de Crachá
            </h3>
            <button
              onClick={() => setIsFormOpen(false)}
              className="border border-[#141414]/30 hover:border-[#141414] hover:bg-[#141414]/5 text-[10px] font-mono px-2 py-1 transition-colors cursor-pointer"
            >
              [ CANCELAR ]
            </button>
          </div>

          <form onSubmit={handleSubmitBlock} className="space-y-4">
            {errorMsg && (
              <div className="p-3 border border-red-650 bg-red-50 text-red-950 font-mono text-xs flex gap-2 items-center font-bold uppercase">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Pesquisar colaborador para bloquear */}
              <div className="md:col-span-4 relative">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Qual o Colaborador?*</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Matrícula para bloquear..."
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
                  <div className="mt-2 text-[10px] text-red-700 font-mono font-bold uppercase tracking-tight flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    Funcionário a Bloquear: {selectedEmployee.nomeCompleto}
                  </div>
                )}
              </div>

              {/* Origem do Bloqueio */}
              <div className="md:col-span-3">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Origem do Bloqueio*</label>
                <select
                  value={origem}
                  onChange={(e) => {
                    const selected = e.target.value as "ASO" | "Treinamento";
                    setOrigem(selected);
                    // Reset or default values for dates when toggled
                    const todayStr = new Date().toISOString().split("T")[0];
                    if (!dataRealizacaoBloqueio) {
                      setDataRealizacaoBloqueio(todayStr);
                    }
                  }}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                >
                  <option value="ASO">ASO (Atestado Médico / Saúde Vencido)</option>
                  <option value="Treinamento">Treinamento (Normas do Trabalho / NRs Pendentes)</option>
                </select>
                <span className="text-[9px] text-[#141414]/60 mt-1 block font-mono uppercase tracking-tight">A escolha gera alerta nas respectivas páginas.</span>
              </div>
 
              {/* Data do Bloqueio */}
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data do Bloqueio*</label>
                <input
                  type="date"
                  required
                  value={dataBloqueio}
                  onChange={(e) => setDataBloqueio(e.target.value)}
                  className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                />
              </div>

              {/* Parâmetros Dinâmicos se for TREINAMENTO */}
              {origem === "Treinamento" && (
                <>
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Tipo de Treinamento Pendente*</label>
                    <select
                      required={origem === "Treinamento"}
                      value={tipoTreinamentoPendente}
                      onChange={(e) => setTipoTreinamentoPendente(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                    >
                      <option value="">[ Selecione o Treinamento ]</option>
                      <option value="Integração de Segurança de Campo">Integração SMS de Entrada</option>
                      <option value="NR-10 Segurança em Instalações e Serviços de Eletricidade">NR-10 Básico (Eletricidade)</option>
                      <option value="NR-10 SEP Sistema Elétrico de Potência">NR-10 Complementar SEP (Alta Tensão)</option>
                      <option value="NR-35 Trabalho em Altura">NR-35 Trabalho em Altura</option>
                      <option value="NR-18 Segurança e Saúde no Trabalho na Indústria da Construção">NR-18 Integração Construção Civil</option>
                      <option value="NR-12 Segurança no Trabalho em Máquinas e Equipamentos">NR-12 Operação de Equipamentos/Máquinas</option>
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data Realização (Treinamento)*</label>
                    <input
                      type="date"
                      required
                      value={dataRealizacaoBloqueio}
                      onChange={(e) => setDataRealizacaoBloqueio(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                    />
                    <span className="text-[9px] text-[#141414]/60 mt-1 block font-mono">Será lançada na aba Treinamentos</span>
                  </div>
                </>
              )}

              {/* Parâmetros Dinâmicos se for ASO */}
              {origem === "ASO" && (
                <>
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Tipo de Exame ASO*</label>
                    <select
                      value={tipoExameBloqueio}
                      onChange={(e) => setTipoExameBloqueio(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                    >
                      <option value="Pendente (Portaria)">Pendente (Portaria)</option>
                      <option value="Periódico">Periódico</option>
                      <option value="Admissional">Admissional</option>
                      <option value="Demissional">Demissional</option>
                      <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                      <option value="Mudança de Função">Mudança de Função</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Validade (Meses)*</label>
                    <select
                      value={validadeMesesBloqueio}
                      onChange={(e) => setValidadeMesesBloqueio(Number(e.target.value))}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none"
                    >
                      <option value={3}>3 meses</option>
                      <option value={6}>6 meses</option>
                      <option value={12}>12 meses</option>
                      <option value={24}>24 meses</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data Realização*</label>
                    <input
                      type="date"
                      required
                      value={dataRealizacaoBloqueio}
                      onChange={(e) => setDataRealizacaoBloqueio(e.target.value)}
                      className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                    />
                  </div>
                </>
              )}

            </div>

            {/* Motivo detalhado */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Motivo Detalhado / Parecer da Segurança do Trabalho*</label>
              <textarea
                required
                rows={3}
                placeholder="Insira detalhes completos e evidências do impedimento do crachá na portaria do projeto..."
                value={motivoDetalhado}
                onChange={(e) => setMotivoDetalhado(e.target.value)}
                className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-2 text-xs font-mono outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
              >
                Confirmar Bloqueio de Acesso
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

      {/* Formulário Retrátil para Realizar Desbloqueio (Desbloquear Crachá) */}
      {releaseId && (
        <div className="bg-white p-6 border border-[#141414] max-w-lg space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-[#141414]/15">
            <h3 className="text-xs font-serif italic font-bold text-black flex items-center gap-2 uppercase tracking-wide">
              <Unlock className="w-4 h-4 text-emerald-600" />
              Liberar Crachá (Autorizar Entrada)
            </h3>
            <button
              onClick={() => setReleaseId(null)}
              className="border border-[#141414]/30 hover:border-[#141414] text-[10px] font-mono px-2 py-1 transition-colors cursor-pointer"
            >
              [ CANCELAR ]
            </button>
          </div>

          <form onSubmit={handleSubmitRelease} className="space-y-4">
            {errorMsg && (
              <div className="p-3 border border-red-650 bg-red-50 text-red-950 font-mono text-xs font-bold uppercase">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-[10px] text-[#141414]/75 leading-relaxed mb-1 font-mono uppercase tracking-tight">
                Você está liberando os direitos de passagem física do funcionário. Por favor, especifique a data em que as pendências de ASO ou treinamentos foram regularizadas e o acesso foi restabelecido.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data de Liberação / Desbloqueio*</label>
                  <input
                    type="date"
                    required
                    value={dataLiberacaoValue}
                    onChange={(e) => setDataLiberacaoValue(e.target.value)}
                    className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                  />
                  <span className="text-[9px] text-gray-505 font-mono italic mt-1 block">Liberado na portaria.</span>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight">Data Realização (ASO / NR)*</label>
                  <input
                    type="date"
                    required
                    value={dataRealizacaoValue}
                    onChange={(e) => setDataRealizacaoValue(e.target.value)}
                    className="w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs font-mono outline-none"
                  />
                  <span className="text-[9px] text-gray-505 font-mono italic mt-1 block">Gravada nos módulos ASO/NR.</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-[#141414] text-[#E4E3E0] hover:bg-neutral-800 text-xs font-mono font-bold uppercase tracking-widest px-5 py-2.5 transition-colors cursor-pointer border border-[#141414]"
              >
                Efetuar Desbloqueio
              </button>
              <button
                type="button"
                onClick={() => setReleaseId(null)}
                className="border border-[#141414]/30 hover:border-[#141414] text-xs font-mono font-bold uppercase tracking-widest px-4 py-2.5 transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista Historica de Bloqueios e Ativos */}
      <div className="bg-white border border-[#141414] overflow-hidden">
        
        <div className="p-4 border-b border-[#141414]/15 bg-[#E4E3E0]/30 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#141414]/60">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por Código, Nome, Motivo ou Origem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-[#141414] pl-9 pr-4 py-2 text-xs border border-[#141414] rounded-none focus:ring-1 focus:ring-[#141414] outline-none font-mono"
            />
          </div>
          <div className="text-[10px] text-[#141414] font-mono font-bold uppercase tracking-tight">
            REGISTROS HISTÓRICOS ENCONTRADOS: {filteredBloqueiosList.length}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[580px] custom-scrollbar">
          {filteredBloqueiosList.length === 0 ? (
            <div className="p-12 text-center text-[#141414] space-y-2 uppercase tracking-tight font-mono">
              <CheckCircle className="w-8 h-8 mx-auto text-emerald-650" />
              <p className="text-xs font-bold text-black font-serif italic">[ NENHUM REGISTRO DE BLOQUEIO PENDENTE ]</p>
              <p className="text-[9px] text-[#141414]/65">O canteiro está operando com total liberdade de movimento.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs min-w-[1200px]">
              <thead className="sticky top-0 z-10 shadow-xs bg-[#141414]">
                <tr className="bg-[#141414] text-[#E4E3E0] text-[9px] font-mono uppercase tracking-wider border-b border-[#141414]">
                  <th className="px-5 py-3">Matrícula</th>
                  <th className="px-5 py-3">Nome do Colaborador</th>
                  <th className="px-5 py-3">Função</th>
                  <th className="px-5 py-3">Origem Restritiva</th>
                  <th className="px-5 py-3">Data Bloqueio</th>
                  <th className="px-5 py-3">Motivo Detalhado / Parecer Técnico</th>
                  <th className="px-5 py-3">Norma/Treinamento</th>
                  <th className="px-5 py-3">Histórico Liberação</th>
                  {isAdmin && <th className="px-5 py-3 text-center">SMS Controle</th>}
                  {isAdmin && <th className="px-5 py-3 text-center">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/15">
                {filteredBloqueiosList.map((row) => (
                  <tr key={row.id} className={`hover:bg-[#141414]/5 transition-colors text-[#141414] ${!row.dataLiberacao ? "bg-red-50/20" : ""}`}>
                    
                    {/* Matricula */}
                    <td className="px-5 py-3.5 font-mono font-extrabold select-all uppercase tracking-tight text-red-700">{row.matricula}</td>
                    
                    {/* Nome */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <strong className="font-serif font-extrabold italic select-all text-black">{row.nomeEmployee}</strong>
                        {row.empStatus === "Inativo" && (
                          <span className="text-[9px] font-mono text-neutral-500 font-bold uppercase mt-0.5">[Colaborador Inativo]</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Funcao */}
                    <td className="px-5 py-3.5 font-serif font-medium">{row.funcaoEmployee}</td>
                    
                    {/* Origem */}
                    <td className="px-5 py-3.5 font-mono">
                      <span className="border border-[#141414] bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-red-800">
                        PENDÊNCIA {row.origem}
                      </span>
                    </td>
 
                    {/* Data Bloqueio */}
                    <td className="px-5 py-3.5 font-mono text-[11px] opacity-80">
                      {formatBrDate(row.dataBloqueio)}
                    </td>
 
                    {/* Motivo detalhado */}
                    <td className="px-5 py-3.5 max-w-xs break-words text-[11px] opacity-90 select-all font-mono uppercase tracking-tight">
                      {row.motivoDetalhado}
                    </td>
 
                    {/* Treinamento Pendente */}
                    <td className="px-5 py-3.5 font-mono select-all text-[11px]">
                      {row.tipoTreinamentoPendente || <span className="opacity-55 italic text-[10px]">Não se aplica</span>}
                    </td>

                    {/* Estado de liberacao */}
                    <td className="px-5 py-3.5">
                      {row.dataLiberacao ? (
                        <div className="flex flex-col text-emerald-800 font-bold uppercase tracking-tight space-y-0.5">
                          <span className="flex items-center gap-1 text-[11px]">
                            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                            Liberado
                          </span>
                          <div className="text-[8px] opacity-75 font-mono flex flex-col">
                            <span>Liberação: {formatBrDate(row.dataLiberacao)}</span>
                            {row.dataRealizacao && (
                              <span className="text-[9px] text-zinc-900 font-semibold">[Realiz.: {formatBrDate(row.dataRealizacao)}]</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col text-red-700 font-extrabold uppercase tracking-tight">
                          <span className="flex items-center gap-1 text-[11px] animate-pulse">
                            <Lock className="w-3.5 h-3.5" />
                            Bloqueado
                          </span>
                          <span className="text-[8px] opacity-70 font-mono">Acesso Impedido</span>
                        </div>
                      )}
                    </td>

                    {/* Ação SMS de liberação */}
                    {isAdmin && (
                      <td className="px-5 py-3 text-center">
                        {!row.dataLiberacao ? (
                          <button
                            onClick={() => {
                              setReleaseId(row.id);
                              const todayStr = new Date().toISOString().split("T")[0];
                              setDataLiberacaoValue(todayStr); // Atalho para data atual
                              setDataRealizacaoValue(todayStr); // Atalho para data de realização atual
                              setIsFormOpen(false);
                              setErrorMsg("");
                            }}
                            className="flex items-center gap-1.5 border border-[#141414] bg-white text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] text-[9px] font-mono font-bold uppercase px-2.5 py-1.5 transition-colors cursor-pointer shadow-sm mx-auto"
                          >
                            <Unlock className="w-3 h-3" />
                            Desbloquear
                          </button>
                        ) : (
                          <span className="border border-[#141414]/30 bg-[#E4E3E0]/30 text-[#141414] text-[9px] font-mono font-bold uppercase px-2.5 py-1 inline-flex items-center gap-1 gap-x-1">
                            <UserCheck className="w-3 h-3 text-emerald-700" />
                            Regularizado
                          </span>
                        )}
                      </td>
                    )}

                    {/* Exclusão do Bloqueio */}
                    {isAdmin && (
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => {
                            setDeleteConfirm({ id: row.id, name: row.nomeEmployee });
                          }}
                          className="border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] text-[9px] font-mono font-bold uppercase px-2 py-1 cursor-pointer transition-colors"
                        >
                          Excluir
                        </button>
                      </td>
                    )}
 
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal Customizado de Confirmação de Deleção de Bloqueio (Compatível com Iframe) */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-[#141414]/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border text-left border-[#141414] p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 border border-red-600 rounded-none text-red-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-mono font-bold text-red-700 uppercase tracking-wide">CONFIRMAR EXCLUSÃO DE BLOQUEIO</h4>
                <p className="text-xs text-[#141414]/80 leading-relaxed font-mono uppercase tracking-tight">
                  Atenção! Você está prestes a excluir o histórico ou registro ativo de restrição de movimentação de <strong className="text-black font-semibold font-serif italic">{deleteConfirm.name}</strong>.
                </p>
                <p className="text-[10px] text-red-650 font-mono font-bold uppercase tracking-tight">
                  ⚠️ ESTA AÇÃO IRÁ EXCLUIR O REGISTRO DO CONTROLE DE ACESSO PORTARIA DEFINITIVAMENTE.
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-bold uppercase tracking-wider py-2 transition-colors cursor-pointer border border-red-800 font-extrabold"
              >
                Sim, Excluir
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
