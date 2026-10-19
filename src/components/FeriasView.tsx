import React, { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2, Edit, Download, Search, AlertTriangle, X } from "lucide-react";
import { Colaborador, Ferias } from "../types";
import { formatBrDate, formatCurrency } from "../utils/date";
import { exportToExcel } from "../utils/excel";
import {
  calcularRateioFerias,
  fimPeriodoAquisitivo,
  sugerirPeriodoAquisitivo,
  validarFerias,
  EntradaRateioFerias,
} from "../utils/ferias";

interface FeriasViewProps {
  colaboradores: Colaborador[];
  ferias: Ferias[];
  onSaveFerias: (f: Ferias) => Promise<void>;
  onDeleteFerias: (id: string) => Promise<void>;
  isAdmin: boolean;
}

const ENCARGOS_KEY = "erp_ferias_encargos_padrao";

const fmtPct = (v: number) => `${(v * 100).toFixed(2).replace(".", ",")}%`;
const toNumber = (s: string) => {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const inputCls =
  "w-full bg-white text-[#141414] border border-[#141414] rounded-none px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#141414] outline-none font-mono";
const labelCls = "block text-[10px] font-mono font-bold text-[#141414]/75 mb-1 uppercase tracking-tight";

function entradaDe(f: Ferias): EntradaRateioFerias {
  return {
    paInicio: f.paInicio,
    paFim: f.paFim,
    feriasInicio: f.feriasInicio,
    feriasFim: f.feriasFim,
    diasAbono: f.diasAbono,
    salarioBase: f.salarioBase,
    encargosPct: f.encargosPct,
    incluirTerco: f.incluirTerco !== false,
    projetoOrigem: f.projetoOrigem,
    projetoAtual: f.projetoAtual,
    dataInicioCanteiro: f.dataInicioCanteiro,
  };
}

export default function FeriasView({ colaboradores, ferias, onSaveFerias, onDeleteFerias, isAdmin }: FeriasViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Ferias | null>(null);
  const [busca, setBusca] = useState("");
  const [anoFiltro, setAnoFiltro] = useState<string>("todos");

  // Campos do formulário
  const [matricula, setMatricula] = useState("");
  const [paInicio, setPaInicio] = useState("");
  const [feriasInicio, setFeriasInicio] = useState("");
  const [feriasFim, setFeriasFim] = useState("");
  const [diasAbono, setDiasAbono] = useState("0");
  const [salario, setSalario] = useState("");
  const [incluirTerco, setIncluirTerco] = useState(true);
  const [encargos, setEncargos] = useState("0");
  const [projetoOrigem, setProjetoOrigem] = useState("");
  const [projetoAtual, setProjetoAtual] = useState("");
  const [dataCanteiro, setDataCanteiro] = useState("");
  const [observacao, setObservacao] = useState("");

  const colMap = useMemo(() => {
    const m: Record<string, Colaborador> = {};
    colaboradores.forEach((c) => (m[c.matricula] = c));
    return m;
  }, [colaboradores]);

  const colaboradoresOrdenados = useMemo(
    () =>
      [...colaboradores]
        .filter((c) => c.status !== "Inativo" || c.matricula === matricula)
        .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)),
    [colaboradores, matricula]
  );

  const paFim = fimPeriodoAquisitivo(paInicio);

  const entradaForm: EntradaRateioFerias = {
    paInicio,
    paFim,
    feriasInicio,
    feriasFim,
    diasAbono: toNumber(diasAbono),
    salarioBase: toNumber(salario),
    encargosPct: toNumber(encargos),
    incluirTerco,
    projetoOrigem,
    projetoAtual,
    dataInicioCanteiro: dataCanteiro,
  };
  const previa = useMemo(
    () => calcularRateioFerias(entradaForm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paInicio, paFim, feriasInicio, feriasFim, diasAbono, salario, encargos, incluirTerco, projetoOrigem, projetoAtual, dataCanteiro]
  );
  const avisos = useMemo(
    () => validarFerias(entradaForm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paInicio, paFim, feriasInicio, feriasFim, diasAbono, salario, encargos, incluirTerco, projetoOrigem, projetoAtual, dataCanteiro]
  );

  const limparFormulario = () => {
    setEditingId(null);
    setMatricula("");
    setPaInicio("");
    setFeriasInicio("");
    setFeriasFim("");
    setDiasAbono("0");
    setSalario("");
    setIncluirTerco(true);
    setEncargos("0");
    setProjetoOrigem("");
    setProjetoAtual("");
    setDataCanteiro("");
    setObservacao("");
    setErrorMsg("");
  };

  const abrirNovo = () => {
    limparFormulario();
    setSuccessMsg("");
    setIsFormOpen(true);
  };

  const abrirEdicao = (f: Ferias) => {
    setEditingId(f.id);
    setMatricula(f.matricula);
    setPaInicio(f.paInicio);
    setFeriasInicio(f.feriasInicio);
    setFeriasFim(f.feriasFim);
    setDiasAbono(String(f.diasAbono));
    setSalario(String(f.salarioBase));
    setIncluirTerco(f.incluirTerco !== false);
    setEncargos(String(f.encargosPct ?? 0));
    setProjetoOrigem(f.projetoOrigem);
    setProjetoAtual(f.projetoAtual);
    setDataCanteiro(f.dataInicioCanteiro);
    setObservacao(f.observacao || "");
    setErrorMsg("");
    setSuccessMsg("");
    setIsFormOpen(true);
  };

  // Ao escolher o colaborador, preenche projetos, início no canteiro, salário e o próximo PA sem férias.
  const aoSelecionarColaborador = (mat: string) => {
    setMatricula(mat);
    const c = colMap[mat];
    if (!c) return;
    setProjetoAtual(c.projetoAtual || "");
    setProjetoOrigem(c.transferido ? c.projetoOrigem || "" : "");
    setDataCanteiro(c.dataInicioProjeto || "");
    setSalario(c.salarioBase ? String(c.salarioBase) : "");
    const usados = ferias.filter((f) => f.matricula === mat).map((f) => f.paInicio);
    setPaInicio(sugerirPeriodoAquisitivo(c.dataAdmissao, usados).paInicio);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!matricula) return setErrorMsg("Selecione o colaborador.");
    if (!paInicio) return setErrorMsg("Informe o início do período aquisitivo.");
    if (!feriasInicio || !feriasFim) return setErrorMsg("Informe o início e o fim das férias.");
    if (feriasFim < feriasInicio) return setErrorMsg("O fim das férias não pode ser anterior ao início.");
    if (!projetoAtual.trim()) return setErrorMsg("Informe o projeto atual.");
    if (!dataCanteiro) return setErrorMsg("Informe a data de início no canteiro.");
    if (toNumber(salario) <= 0) return setErrorMsg("Informe o valor bruto (já com encargos) para calcular o custo.");

    const payload: Ferias = {
      id: editingId || "FER-" + Date.now(),
      matricula,
      paInicio,
      paFim,
      feriasInicio,
      feriasFim,
      diasAbono: Math.max(0, Math.round(toNumber(diasAbono))),
      salarioBase: toNumber(salario),
      encargosPct: toNumber(encargos),
      incluirTerco,
      projetoOrigem: projetoOrigem.trim(),
      projetoAtual: projetoAtual.trim(),
      dataInicioCanteiro: dataCanteiro,
      observacao: observacao.trim() || undefined,
      dataCriacao: editingId ? ferias.find((f) => f.id === editingId)?.dataCriacao || "" : "",
    };

    try {
      await onSaveFerias(payload);
      if (payload.encargosPct > 0) {
        localStorage.setItem(ENCARGOS_KEY, String(payload.encargosPct));
      }
      setSuccessMsg(editingId ? "Férias atualizadas com sucesso." : "Férias lançadas com sucesso.");
      setIsFormOpen(false);
      limparFormulario();
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro ao salvar férias.");
    }
  };

  // Lançamentos com o rateio calculado
  const lancamentos = useMemo(
    () =>
      ferias
        .map((f) => ({ f, r: calcularRateioFerias(entradaDe(f)), col: colMap[f.matricula] }))
        .sort((a, b) => b.f.feriasInicio.localeCompare(a.f.feriasInicio)),
    [ferias, colMap]
  );

  const anos = useMemo(() => {
    const s = new Set<string>();
    ferias.forEach((f) => s.add(f.feriasInicio.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [ferias]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter(({ f, col }) => {
      if (anoFiltro !== "todos" && f.feriasInicio.slice(0, 4) !== anoFiltro) return false;
      if (!termo) return true;
      return (
        f.matricula.toLowerCase().includes(termo) ||
        (col?.nomeCompleto || "").toLowerCase().includes(termo) ||
        f.projetoOrigem.toLowerCase().includes(termo) ||
        f.projetoAtual.toLowerCase().includes(termo)
      );
    });
  }, [lancamentos, busca, anoFiltro]);

  // Custo consolidado por projeto (origem + atual)
  const resumoProjetos = useMemo(() => {
    const m = new Map<string, { projeto: string; custo: number; colaboradores: Set<string>; diasPA: number }>();
    const somar = (projeto: string, custo: number, mat: string, dias: number) => {
      if (!projeto || (custo === 0 && dias === 0)) return;
      const cur = m.get(projeto) || { projeto, custo: 0, colaboradores: new Set<string>(), diasPA: 0 };
      cur.custo += custo;
      cur.diasPA += dias;
      cur.colaboradores.add(mat);
      m.set(projeto, cur);
    };
    filtrados.forEach(({ f, r }) => {
      if (r.rateado) somar(f.projetoOrigem, r.custoOrigem, f.matricula, r.diasOrigem);
      somar(f.projetoAtual, r.custoAtual, f.matricula, r.diasAtual);
    });
    return Array.from(m.values()).sort((a, b) => b.custo - a.custo);
  }, [filtrados]);

  const totalGeral = resumoProjetos.reduce((s, p) => s + p.custo, 0);

  const exportarLancamentos = () => {
    exportToExcel(
      filtrados.map(({ f, r, col }) => ({
        Matrícula: f.matricula,
        Nome: col?.nomeCompleto || "",
        "Período Aquisitivo": `${formatBrDate(f.paInicio)} a ${formatBrDate(f.paFim)}`,
        "Início Férias": formatBrDate(f.feriasInicio),
        "Fim Férias": formatBrDate(f.feriasFim),
        "Dias de Gozo": r.diasGozo,
        "Dias de Abono": f.diasAbono,
        "Valor Bruto Mensal (R$)": r.valorBrutoMensal,
        "1/3 Constitucional (R$)": r.tercoConstitucional,
        "Encargos Extras (R$)": r.encargos,
        "Início no Canteiro": formatBrDate(f.dataInicioCanteiro),
        "Projeto de Origem": f.projetoOrigem || "-",
        "Dias PA Origem": r.diasOrigem,
        "% Origem": fmtPct(r.pctOrigem),
        "Custo Origem (R$)": r.custoOrigem,
        "Projeto Atual": f.projetoAtual,
        "Dias PA Atual": r.diasAtual,
        "% Atual": fmtPct(r.pctAtual),
        "Custo Atual (R$)": r.custoAtual,
        "Custo Total (R$)": r.custoTotal,
      })),
      "Ferias_Rateio_Custo",
      "Férias"
    );
  };

  const exportarResumo = () => {
    exportToExcel(
      resumoProjetos.map((p) => ({
        Projeto: p.projeto,
        Colaboradores: p.colaboradores.size,
        "Dias de PA alocados": p.diasPA,
        "Custo de Férias (R$)": Math.round(p.custo * 100) / 100,
      })),
      "Ferias_Custo_por_Projeto",
      "Custo por Projeto"
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#141414]" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-tight text-[#141414]">Férias e Rateio de Custo</h2>
            <p className="text-[10px] font-mono text-[#141414]/60 uppercase">
              Custo dividido entre projeto de origem e atual pelo período aquisitivo e início no canteiro
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            id="btn-nova-ferias"
            onClick={abrirNovo}
            className="flex items-center gap-2 bg-[#141414] text-white px-4 py-2 text-xs font-bold uppercase tracking-wide hover:bg-black transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Lançar Férias
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-3 border border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-mono flex justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formulário */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="border border-[#141414] bg-white p-5 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#141414]">
              {editingId ? "Editar Férias" : "Nova Programação de Férias"}
            </h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 border border-red-600 bg-red-50 text-red-800 text-xs font-mono">{errorMsg}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className={labelCls}>Colaborador*</label>
              <select
                value={matricula}
                disabled={!!editingId}
                onChange={(e) => aoSelecionarColaborador(e.target.value)}
                className={inputCls + " py-2 disabled:opacity-60"}
              >
                <option value="">Selecione...</option>
                {colaboradoresOrdenados.map((c) => (
                  <option key={c.matricula} value={c.matricula}>
                    {c.matricula} - {c.nomeCompleto}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Início do Período Aquisitivo*</label>
              <input type="date" value={paInicio} onChange={(e) => setPaInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fim do Período Aquisitivo</label>
              <input type="date" value={paFim} readOnly className={inputCls + " bg-neutral-100"} />
            </div>
            <div>
              <label className={labelCls}>Início no Canteiro Atual*</label>
              <input type="date" value={dataCanteiro} onChange={(e) => setDataCanteiro(e.target.value)} className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Início das Férias*</label>
              <input type="date" value={feriasInicio} onChange={(e) => setFeriasInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fim das Férias*</label>
              <input type="date" value={feriasFim} onChange={(e) => setFeriasFim(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dias de Abono (vendidos)</label>
              <input
                type="number"
                min={0}
                max={10}
                value={diasAbono}
                onChange={(e) => setDiasAbono(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Projeto de Origem</label>
              <input
                type="text"
                value={projetoOrigem}
                onChange={(e) => setProjetoOrigem(e.target.value)}
                placeholder="Vazio = sem rateio"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Projeto Atual*</label>
              <input type="text" value={projetoAtual} onChange={(e) => setProjetoAtual(e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border border-[#141414] bg-white">
              <div>
                <label className={labelCls}>Valor Bruto Mensal (R$)*</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="EX: 4500,00"
                  value={salario}
                  onChange={(e) => setSalario(e.target.value)}
                  className={inputCls + " font-bold"}
                />
                <span className="text-[9px] text-[#141414]/70 font-mono block mt-1 uppercase font-semibold">
                  Salário bruto com encargos já inclusos
                </span>
              </div>
              <div className="flex flex-col justify-center pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono font-bold text-[#141414]">
                  <input
                    type="checkbox"
                    checked={incluirTerco}
                    onChange={(e) => setIncluirTerco(e.target.checked)}
                    className="w-4 h-4 rounded-none border-[#141414] text-[#141414] focus:ring-[#141414] checked:bg-[#141414]"
                  />
                  <span>Adicionar 1/3 Constitucional (+33,33%)</span>
                </label>
                <span className="text-[9px] text-[#141414]/60 font-mono block mt-1 uppercase pl-6">
                  {incluirTerco ? "Calculado sobre dias de gozo e abono" : "Valor informado já é o total final das férias"}
                </span>
              </div>
              <div>
                <label className={labelCls}>Encargos Extras / Adicionais (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0 (encargos normais inclusos no bruto)"
                  value={encargos}
                  onChange={(e) => setEncargos(e.target.value)}
                  className={inputCls}
                />
                <span className="text-[9px] text-[#141414]/60 font-mono block mt-1 uppercase">
                  Padrão 0% (já inclusos no valor bruto)
                </span>
              </div>
            </div>

            <div className="md:col-span-3">
              <label className={labelCls}>Observação</label>
              <input type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Prévia do rateio */}
          <div className="border border-[#141414] bg-[#E4E3E0]/40 p-4 space-y-3">
            <span className="block text-[10px] font-mono font-bold uppercase text-[#141414]">Prévia do rateio</span>
            {avisos.map((a) => (
              <div key={a} className="flex items-start gap-2 text-[11px] font-mono text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {a}
              </div>
            ))}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
              <div>
                <span className="block text-[#141414]/60 uppercase">Dias de gozo</span>
                <b>{previa.diasGozo} dias</b>
              </div>
              <div>
                <span className="block text-[#141414]/60 uppercase">Dias do PA</span>
                <b>{previa.diasPA} dias</b>
              </div>
              <div>
                <span className="block text-[#141414]/60 uppercase">Valor Bruto Mensal</span>
                <b>{formatCurrency(previa.valorBrutoMensal)}</b>
              </div>
              <div>
                <span className="block text-[#141414]/60 uppercase">Custo Total Férias</span>
                <b className="text-emerald-800 font-bold text-xs">{formatCurrency(previa.custoTotal)}</b>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-[10px] font-mono text-[#141414]/75 border-t border-[#141414]/15 pt-2">
              <span>Gozo: <b>{formatCurrency(previa.valorGozo)}</b></span>
              {previa.valorAbono > 0 && <span>Abono: <b>{formatCurrency(previa.valorAbono)}</b></span>}
              {previa.tercoConstitucional > 0 && <span>1/3 Constitucional: <b>{formatCurrency(previa.tercoConstitucional)}</b></span>}
              {previa.encargos > 0 && <span>Encargos Extras ({encargos}%): <b>{formatCurrency(previa.encargos)}</b></span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="border border-[#141414] bg-white p-3">
                <span className="block text-[10px] text-[#141414]/60 uppercase">Origem: {projetoOrigem || "-"}</span>
                <b>
                  {formatCurrency(previa.custoOrigem)} ({fmtPct(previa.pctOrigem)} - {previa.diasOrigem} dias)
                </b>
              </div>
              <div className="border border-[#141414] bg-white p-3">
                <span className="block text-[10px] text-[#141414]/60 uppercase">Atual: {projetoAtual || "-"}</span>
                <b>
                  {formatCurrency(previa.custoAtual)} ({fmtPct(previa.pctAtual)} - {previa.diasAtual} dias)
                </b>
              </div>
            </div>
            {!previa.rateado && (
              <p className="text-[10px] font-mono text-[#141414]/60 uppercase">
                Sem projeto de origem diferente do atual: 100% do custo fica no projeto atual.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-bold uppercase border border-[#141414] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold uppercase bg-[#141414] text-white hover:bg-black cursor-pointer"
            >
              {editingId ? "Salvar Alterações" : "Lançar Férias"}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/50" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por matrícula, nome ou projeto..."
            className={inputCls + " pl-9 py-2"}
          />
        </div>
        <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)} className={inputCls + " sm:w-44 py-2"}>
          <option value="todos">Todos os anos</option>
          {anos.map((a) => (
            <option key={a} value={a}>
              Férias iniciadas em {a}
            </option>
          ))}
        </select>
      </div>

      {/* Custo por projeto */}
      <div className="border border-[#141414] bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#141414]">Custo de Férias por Projeto</h3>
          <button
            onClick={exportarResumo}
            disabled={resumoProjetos.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase border border-[#141414] px-3 py-1.5 hover:bg-[#141414] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[#E4E3E0] text-left uppercase text-[10px]">
                <th className="px-4 py-2">Projeto</th>
                <th className="px-4 py-2 text-right">Colaboradores</th>
                <th className="px-4 py-2 text-right">Dias de PA</th>
                <th className="px-4 py-2 text-right">Custo</th>
                <th className="px-4 py-2 text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {resumoProjetos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#141414]/50">
                    Nenhuma férias lançada no filtro atual.
                  </td>
                </tr>
              )}
              {resumoProjetos.map((p) => (
                <tr key={p.projeto} className="border-t border-[#141414]/15">
                  <td className="px-4 py-2 font-bold">{p.projeto}</td>
                  <td className="px-4 py-2 text-right">{p.colaboradores.size}</td>
                  <td className="px-4 py-2 text-right">{p.diasPA}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(p.custo)}</td>
                  <td className="px-4 py-2 text-right">{totalGeral > 0 ? fmtPct(p.custo / totalGeral) : "-"}</td>
                </tr>
              ))}
              {resumoProjetos.length > 0 && (
                <tr className="border-t-2 border-[#141414] bg-neutral-50 font-bold">
                  <td className="px-4 py-2">TOTAL</td>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-right">{formatCurrency(totalGeral)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lançamentos */}
      <div className="border border-[#141414] bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#141414]">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#141414]">
            Lançamentos ({filtrados.length})
          </h3>
          <button
            onClick={exportarLancamentos}
            disabled={filtrados.length === 0}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase border border-[#141414] px-3 py-1.5 hover:bg-[#141414] hover:text-white disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[#E4E3E0] text-left uppercase text-[10px]">
                <th className="px-4 py-2">Colaborador</th>
                <th className="px-4 py-2">Período Aquisitivo</th>
                <th className="px-4 py-2">Férias</th>
                <th className="px-4 py-2">Origem</th>
                <th className="px-4 py-2">Atual</th>
                <th className="px-4 py-2 text-right">Total</th>
                {isAdmin && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[#141414]/50">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              )}
              {filtrados.map(({ f, r, col }) => (
                <tr key={f.id} className="border-t border-[#141414]/15 align-top">
                  <td className="px-4 py-2">
                    <b>{col?.nomeCompleto || f.matricula}</b>
                    <span className="block text-[10px] text-[#141414]/60">Matrícula: {f.matricula}</span>
                    <span className="block text-[10px] text-[#141414]/80 font-bold">
                      Bruto: {formatCurrency(f.salarioBase)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatBrDate(f.paInicio)} a {formatBrDate(f.paFim)}
                    <span className="block text-[10px] text-[#141414]/60">
                      Canteiro desde {formatBrDate(f.dataInicioCanteiro)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {formatBrDate(f.feriasInicio)} a {formatBrDate(f.feriasFim)}
                    <span className="block text-[10px] text-[#141414]/60">
                      {r.diasGozo} dias{f.diasAbono > 0 ? ` + ${f.diasAbono} de abono` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {r.rateado ? (
                      <>
                        {f.projetoOrigem}
                        <span className="block font-bold">{formatCurrency(r.custoOrigem)}</span>
                        <span className="block text-[10px] text-[#141414]/60">
                          {fmtPct(r.pctOrigem)} - {r.diasOrigem} dias
                        </span>
                      </>
                    ) : (
                      <span className="text-[#141414]/40">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {f.projetoAtual}
                    <span className="block font-bold">{formatCurrency(r.custoAtual)}</span>
                    <span className="block text-[10px] text-[#141414]/60">
                      {fmtPct(r.pctAtual)} - {r.diasAtual} dias
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-bold">{formatCurrency(r.custoTotal)}</td>
                  {isAdmin && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => abrirEdicao(f)} title="Editar" className="cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(f)}
                          title="Excluir"
                          className="text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#141414] p-6 max-w-sm w-full space-y-4">
            <h4 className="text-sm font-bold uppercase text-[#141414]">Excluir lançamento de férias?</h4>
            <p className="text-xs font-mono text-[#141414]/70">
              {colMap[deleteConfirm.matricula]?.nomeCompleto || deleteConfirm.matricula} -{" "}
              {formatBrDate(deleteConfirm.feriasInicio)} a {formatBrDate(deleteConfirm.feriasFim)}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-bold uppercase border border-[#141414] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onDeleteFerias(deleteConfirm.id);
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 text-xs font-bold uppercase bg-red-700 text-white cursor-pointer"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
