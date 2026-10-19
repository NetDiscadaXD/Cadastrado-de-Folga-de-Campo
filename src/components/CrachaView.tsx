import { useState, useEffect, useMemo, useRef, ChangeEvent } from "react";
import { 
  Printer, 
  User, 
  Upload, 
  Check, 
  Plus, 
  Trash2, 
  Image as ImageIcon, 
  RefreshCw,
  Award,
  Calendar,
  FileCheck
} from "lucide-react";
import { Colaborador, ASO, Treinamento } from "../types";
import { formatBrDate } from "../utils/date";
import { getDirectDriveImageURL } from "../utils/drive";

interface CrachaViewProps {
  colaboradores: Colaborador[];
  asos: ASO[];
  treinamentos: Treinamento[];
  onPrint?: () => void;
  isAdmin?: boolean;
}

// Exemplos de fotos de perfil de trabalhadores de campo
const PRESET_PHOTOS = [
  {
    name: "Silhouette",
    url: "placeholder"
  },
  {
    name: "Operador 1",
    url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=200&fit=crop&q=80"
  },
  {
    name: "Engenheira",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&q=80"
  },
  {
    name: "Técnico",
    url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&q=80"
  },
  {
    name: "Operador 2",
    url: "https://images.unsplash.com/photo-1621252179027-94459d278660?w=200&h=200&fit=crop&q=80"
  }
];

export default function CrachaView({ colaboradores, asos, treinamentos, onPrint, isAdmin = true }: CrachaViewProps) {
  // 1. Estado para Colaborador Selecionado
  const [selectedMatricula, setSelectedMatricula] = useState<string>("");

  // 2. Metadados Editáveis do Crachá
  const [numeroCracha, setNumeroCracha] = useState<string>("");
  const [classe, setClasse] = useState<string>("Prestador");
  const [nomeCompleto, setNomeCompleto] = useState<string>("");
  const [gerencia, setGerencia] = useState<string>("GERENCIA DE CONSTRUÇÃO");
  const [empresa, setEmpresa] = useState<string>("");
  const [cargo, setCargo] = useState<string>("");
  
  // 3. CNH / Habilitação
  const [cnhNumero, setCnhNumero] = useState<string>("");
  const [cnhCategoria, setCnhCategoria] = useState<string>("");
  const [cnhValidade, setCnhValidade] = useState<string>("");

  // 4. Áreas Autorizadas
  const [autorizadoMina, setAutorizadoMina] = useState<boolean>(true);
  const [autorizadoIndustrial, setAutorizadoIndustrial] = useState<boolean>(true);
  const [autorizadoFora, setAutorizadoFora] = useState<boolean>(true);

  // 5. Foto de Perfil
  const [photoType, setPhotoType] = useState<"preset" | "upload" | "url">("preset");
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>("");
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string>("");

  // 6. Treinamentos e ASO editados ou selecionados
  const [validadeAsoState, setValidadeAsoState] = useState<string>("");
  const [listagemTreinamentos, setListagemTreinamentos] = useState<{ nome: string; validade: string; checked: boolean }[]>([]);

  // Campos para cadastro manual de treinamento temporário no crachá
  const [novoTreinamentoNome, setNovoTreinamentoNome] = useState<string>("");
  const [novoTreinamentoValidade, setNovoTreinamentoValidade] = useState<string>("");

  // Referência para upload de arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Colaborador atual
  const selectedEmployee = useMemo(() => {
    return colaboradores.find(c => c.matricula === selectedMatricula);
  }, [colaboradores, selectedMatricula]);

  // Seletas automáticas ao mudar colaborador
  useEffect(() => {
    if (selectedEmployee) {
      setNomeCompleto(selectedEmployee.nomeCompleto.toUpperCase());
      setCargo(selectedEmployee.funcao.toUpperCase());
      setEmpresa(selectedEmployee.transferido ? selectedEmployee.projetoAtual.toUpperCase() : "PAREX ENGENHARIA S.A.");
      setGerencia("GERENCIA DE CONSTRUÇÃO");
      
      // Número de crachá baseado na matrícula (somente dígitos) ou gerados
      const digitos = selectedEmployee.matricula.replace(/\D/g, "");
      setNumeroCracha(digitos || Math.floor(1000 + Math.random() * 9000).toString());
      setClasse(selectedEmployee.tipoMaoDeObra === "MOI" ? "Próprio" : "Prestador");

      // Buscar validação do ASO
      const colAsos = asos.filter(a => a.matricula === selectedEmployee.matricula);
      if (colAsos.length > 0) {
        // Encontra o mais recente ASO
        const sorted = [...colAsos].sort((a, b) => new Date(b.dataRealizacao).getTime() - new Date(a.dataRealizacao).getTime());
        const latest = sorted[0];
        const dateV = new Date(latest.dataRealizacao + "T12:00:00");
        dateV.setMonth(dateV.getMonth() + latest.validadeMeses);
        setValidadeAsoState(dateV.toISOString().split("T")[0]);
      } else {
        // Default de preenchimento
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        setValidadeAsoState(nextYear.toISOString().split("T")[0]);
      }

      // Buscar treinamentos válidos
      const colTreinamentos = treinamentos.filter(t => t.matricula === selectedEmployee.matricula);
      const parsedTreins = colTreinamentos.map(t => {
        const anos = parseInt(t.periodicidade.split(" ")[0]) || 1;
        const dateV = new Date(t.dataRealizacao + "T12:00:00");
        dateV.setFullYear(dateV.getFullYear() + anos);
        const validadeStr = dateV.toISOString().split("T")[0];
        
        // Verifica se ainda está válido para vir marcado por padrão
        const isValido = new Date(validadeStr) >= new Date();
        return {
          nome: t.nomeTreinamento,
          validade: validadeStr,
          checked: isValido
        };
      });

      setListagemTreinamentos(parsedTreins);

      // Default de CNH ficcional ou mantém anterior
      setCnhNumero("06" + Math.floor(100000000 + Math.random() * 900000000).toString());
      setCnhCategoria("AB");
      const cnhDate = new Date();
      cnhDate.setFullYear(cnhDate.getFullYear() + 6);
      setCnhValidade(cnhDate.toISOString().split("T")[0]);
    } else {
      // Limpeza se deselecionar
      setNomeCompleto("");
      setCargo("");
      setEmpresa("");
      setNumeroCracha("");
      setValidadeAsoState("");
      setListagemTreinamentos([]);
      setCnhNumero("");
      setCnhCategoria("");
      setCnhValidade("");
    }
  }, [selectedEmployee, asos, treinamentos]);

  // Handler para Upload de Imagem de Crachá
  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhotoUrl(reader.result as string);
        setPhotoType("upload");
      };
      reader.readAsDataURL(file);
    }
  };

  // Adicionar treinamento avulso ao crachá
  const handleAddTreinamentoManual = () => {
    if (!novoTreinamentoNome.trim() || !novoTreinamentoValidade) return;
    setListagemTreinamentos(prev => [
      ...prev,
      {
        nome: novoTreinamentoNome.trim(),
        validade: novoTreinamentoValidade,
        checked: true
      }
    ]);
    setNovoTreinamentoNome("");
    setNovoTreinamentoValidade("");
  };

  // Deletar treinamento da listagem local do crachá
  const handleDeleteTreinamentoLocal = (index: number) => {
    setListagemTreinamentos(prev => prev.filter((_, idx) => idx !== index));
  };

  // Alternar seleção de exibição de cada treinamento
  const handleToggleTreinamentoLocal = (index: number) => {
    setListagemTreinamentos(prev => prev.map((item, idx) => 
      idx === index ? { ...item, checked: !item.checked } : item
    ));
  };

  // URL efetiva da foto
  const activePhotoUrl = useMemo(() => {
    if (photoType === "upload" && uploadedPhotoUrl) return uploadedPhotoUrl;
    if (photoType === "url" && customPhotoUrl) return customPhotoUrl;
    if (selectedEmployee?.fotoUrl) return selectedEmployee.fotoUrl;
    return PRESET_PHOTOS[selectedPresetIndex]?.url || "placeholder";
  }, [photoType, uploadedPhotoUrl, customPhotoUrl, selectedPresetIndex, selectedEmployee]);

  // Filtragem de treinamentos marcados para exibição no verso
  const visibleTreinamentos = useMemo(() => {
    return listagemTreinamentos.filter(t => t.checked);
  }, [listagemTreinamentos]);

  // Dispara tela de impressão nativa
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Bloco de Avisos / Cabeçalho da página de Geração */}
      <div className="bg-white border border-[#141414] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif italic text-2xl font-black text-[#141414]">
            Emissor de Crachás de Campo (PVC)
          </h2>
          <p className="text-xs font-mono text-gray-500 mt-1 max-w-2xl leading-relaxed">
            Mapeia automaticamente exames ocupacionais (ASO) e treinamentos de segurança válidos. 
            Permite o upload de fotografias reais ou uso de avatares ilustrativos para posterior impressão física nas dimensões padrão.
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={!selectedMatricula}
          className="flex items-center gap-2 border-2 border-orange-600 bg-orange-600 hover:bg-[#141414] hover:border-[#141414] text-white hover:text-[#E4E3E0] text-xs font-mono font-bold uppercase tracking-widest px-5 py-3 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_#141414]"
        >
          <Printer className="w-4 h-4" />
          Imprimir Crachá
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 print:hidden">
        
        {/* LADO ESQUERDO: PAINEL DE CONFIGURAÇÕES */}
        <section className="lg:col-span-5 bg-white border border-[#141414] p-6 space-y-6">
          <div className="border-b border-[#141414]/15 pb-3">
            <span className="text-[11px] font-mono font-extrabold text-[#141414]/70 uppercase tracking-widest block mb-1">Passo 01</span>
            <h3 className="font-serif italic text-lg font-bold text-[#141414]">Configurar Colaborador</h3>
          </div>

          {/* Seletor do Trabalhador */}
          <div>
            <label className="block text-[10px] font-mono font-bold text-[#141414]/75 mb-1.5 uppercase tracking-tight">Selecionar Trabalhador*</label>
            <select
              value={selectedMatricula}
              onChange={(e) => setSelectedMatricula(e.target.value)}
              className="w-full bg-white text-[#141414] border-2 border-[#141414] rounded-none px-3 py-2 text-xs font-mono font-bold outline-none cursor-pointer"
            >
              <option value="">-- SELECIONE DO CADASTRO GERAL --</option>
              {colaboradores.map(c => (
                <option key={c.matricula} value={c.matricula}>
                  {c.nomeCompleto.toUpperCase()} ({c.matricula}) - {c.funcao}
                </option>
              ))}
            </select>
          </div>

          {selectedMatricula ? (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Informações Básicas do Crachá (Editável para o Badge) */}
              <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10 space-y-4">
                <h4 className="text-[10px] font-mono font-bold uppercase text-[#141414] border-b border-[#141414]/10 pb-1.5">Metadados do Crachá</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Nº Crachá</label>
                    <input
                      type="text"
                      value={numeroCracha}
                      onChange={(e) => setNumeroCracha(e.target.value)}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Classe de Acesso</label>
                    <select
                      value={classe}
                      onChange={(e) => setClasse(e.target.value)}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    >
                      <option value="Prestador">Prestador</option>
                      <option value="Próprio">Próprio</option>
                      <option value="Terceiro">Terceiro</option>
                      <option value="Visitante">Visitante</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Nome Completo (Crachá)</label>
                  <input
                    type="text"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value.toUpperCase())}
                    className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Empresa</label>
                    <input
                      type="text"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value.toUpperCase())}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Gerência</label>
                    <input
                      type="text"
                      value={gerencia}
                      onChange={(e) => setGerencia(e.target.value.toUpperCase())}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Função / Cargo</label>
                  <input
                    type="text"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value.toUpperCase())}
                    className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                  />
                </div>
              </div>

              {/* Foto de Perfil */}
              <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10 space-y-4">
                <h4 className="text-[10px] font-mono font-bold uppercase text-[#141414] border-b border-[#141414]/10 pb-1.5">Fotografia Identificadora</h4>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setPhotoType("preset")}
                    className={`flex-1 text-[10px] font-mono font-bold py-1 border transition-colors ${photoType === "preset" ? "bg-black text-white border-black" : "bg-white text-black border-black/30 hover:bg-black/5"}`}
                  >
                    Trabalhadores Ilustrados
                  </button>
                  <button
                    onClick={() => setPhotoType("upload")}
                    className={`flex-1 text-[10px] font-mono font-bold py-1 border transition-colors ${photoType === "upload" ? "bg-black text-white border-black" : "bg-white text-black border-black/30 hover:bg-black/5"}`}
                  >
                    Enviar Imagem Real
                  </button>
                </div>

                {photoType === "preset" && (
                  <div>
                    <span className="block text-[9px] font-mono font-bold text-gray-500 mb-2">Selecione uma fisionomia representativa:</span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {PRESET_PHOTOS.map((pt, idx) => (
                        <button
                          key={pt.name}
                          onClick={() => {
                            setSelectedPresetIndex(idx);
                          }}
                          className={`w-12 h-12 relative rounded-full overflow-hidden border-2 shrink-0 transition-all ${
                            selectedPresetIndex === idx && photoType === "preset"
                              ? "border-orange-600 scale-105"
                              : "border-black/30 hover:border-black"
                          }`}
                        >
                          {pt.url === "placeholder" ? (
                            <div className="w-full h-full bg-[#E4E3E0] flex items-center justify-center">
                              <User className="w-5 h-5 text-gray-500" />
                            </div>
                          ) : (
                            <img src={pt.url} referrerPolicy="no-referrer" alt={pt.name} className="w-full h-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {photoType === "upload" && (
                  <div className="space-y-3">
                    <span className="block text-[9px] font-mono font-bold text-gray-500">Selecione o arquivo da foto ou arraste aqui:</span>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-dashed border-black/40 hover:border-black py-4 px-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition-colors"
                    >
                      <Upload className="w-5 h-5 text-gray-500" />
                      <span className="text-[10px] font-mono font-bold uppercase text-[#141414]">Selecionar Foto</span>
                      <span className="text-[8px] font-mono text-gray-400">PNG / JPG - Formato Quadrado Recomendado</span>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                    {uploadedPhotoUrl && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-black/20">
                          <img src={uploadedPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[9px] text-[#141414] font-mono font-semibold truncate max-w-[200px]">Foto carregada com sucesso!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Informações da CNH e Habilitação de Direção */}
              <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10 space-y-4">
                <h4 className="text-[10px] font-mono font-bold uppercase text-[#141414] border-b border-[#141414]/10 pb-1.5">Habilitação de Trânsito / Operação</h4>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Nº CNH</label>
                    <input
                      type="text"
                      value={cnhNumero}
                      onChange={(e) => setCnhNumero(e.target.value)}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Cat. CNH</label>
                    <input
                      type="text"
                      placeholder="Ex: AB, D"
                      value={cnhCategoria}
                      onChange={(e) => setCnhCategoria(e.target.value.toUpperCase())}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Vencimento CNH</label>
                    <input
                      type="date"
                      value={cnhValidade}
                      onChange={(e) => setCnhValidade(e.target.value)}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono font-bold text-gray-600 mb-1">Vencimento ASO</label>
                    <input
                      type="date"
                      value={validadeAsoState}
                      onChange={(e) => setValidadeAsoState(e.target.value)}
                      className="w-full bg-white text-xs font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[9px] font-mono font-bold text-gray-500 uppercase">Autorizado a operar em:</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#141414] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autorizadoMina}
                        onChange={(e) => setAutorizadoMina(e.target.checked)}
                        className="rounded-none border-black accent-black text-black"
                      />
                      <span>MINA</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#141414] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autorizadoIndustrial}
                        onChange={(e) => setAutorizadoIndustrial(e.target.checked)}
                        className="rounded-none border-black accent-black"
                      />
                      <span>INDUSTRIAL</span>
                    </label>

                    <label className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#141414] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autorizadoFora}
                        onChange={(e) => setAutorizadoFora(e.target.checked)}
                        className="rounded-none border-black accent-black"
                      />
                      <span>FORA DA EMPRESA</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Treinamentos Válidos para o Verso */}
              <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10 space-y-4">
                <div className="flex justify-between items-center border-b border-[#141414]/10 pb-1.5">
                  <h4 className="text-[10px] font-mono font-bold uppercase text-[#141414]">Treinamentos / NRs Válidos</h4>
                  <span className="text-[9px] font-mono font-bold bg-[#141414]/10 px-1.5 py-0.5">{visibleTreinamentos.length} Impressos</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {listagemTreinamentos.length === 0 ? (
                    <div className="text-[9px] text-gray-400 font-mono italic py-4 text-center">Nenhum treinamento mapeado para esta matrícula.</div>
                  ) : (
                    listagemTreinamentos.map((t, idx) => {
                      const isExpired = new Date(t.validade) < new Date();
                      return (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-mono border-b border-[#141414]/5 py-1">
                          <label className="flex items-center gap-2 cursor-pointer grow select-none pr-2">
                            <input
                              type="checkbox"
                              checked={t.checked}
                              onChange={() => handleToggleTreinamentoLocal(idx)}
                              className="accent-black"
                            />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-[#141414]">{t.nome}</span>
                              <span className={`text-[8px] font-bold ${isExpired ? "text-red-600 font-mono" : "text-emerald-700"}`} title="Validade">
                                Exp: {formatBrDate(t.validade)} {isExpired && "[VENCIDO!]"}
                              </span>
                            </div>
                          </label>
                          <button
                            onClick={() => handleDeleteTreinamentoLocal(idx)}
                            className="text-red-600 hover:text-red-950 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Adicionar Treinamento Manual Temporário no Crachá */}
                <div className="border-t border-[#141414]/10 pt-3 space-y-2">
                  <span className="block text-[9px] font-mono font-bold text-gray-500 uppercase">Adicionar Treinamento Direto no Crachá:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nome / Sigla NR"
                      value={novoTreinamentoNome}
                      onChange={(e) => setNovoTreinamentoNome(e.target.value)}
                      className="w-full bg-white text-[10px] font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                    <input
                      type="date"
                      value={novoTreinamentoValidade}
                      onChange={(e) => setNovoTreinamentoValidade(e.target.value)}
                      className="w-full bg-white text-[10px] font-mono border border-black/30 px-2 py-1 outline-none"
                    />
                  </div>
                  <button
                    onClick={handleAddTreinamentoManual}
                    className="w-full flex items-center justify-center gap-1 bg-[#141414] hover:bg-[#141414]/85 text-white text-[10px] font-mono font-bold uppercase tracking-wider py-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Incluir Treinamento
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="border border-dashed border-[#141414]/30 py-16 px-4 text-center text-gray-400 font-mono text-xs italic">
              Selecione um profissional do cadastro para computar os dados de saúde e licenças válidas.
            </div>
          )}
        </section>

        {/* LADO DIREITO: PREVISUALIZAÇÃO EM TEMPO REAL */}
        <section className="lg:col-span-7 flex flex-col items-center bg-[#E4E3E0]/40 border border-[#141414]/15 p-6 md:p-8 space-y-6 select-all">
          <div className="w-full flex justify-between items-center border-b border-[#141414]/15 pb-3">
            <span className="text-[11px] font-mono font-extrabold text-[#141414]/70 uppercase tracking-widest block">Passo 02</span>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 bg-emerald-700 text-white text-[9px] uppercase tracking-wider font-mono font-bold">PRE-VIEW EM TEMPO REAL</span>
            </div>
          </div>

          {selectedMatricula ? (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4 w-full">
              
              {/* CARTÃO FRENTE */}
              <div id="cracha-frente" className="w-[325px] h-[510px] bg-white border-2 border-black rounded-lg shadow-xl relative overflow-hidden flex flex-col shrink-0 select-none">
                
                {/* Header do Crachá */}
                <div className="pt-4 px-3 flex flex-col items-center relative border-b border-black">
                  {/* Logo SVE/HTML */}
                  <div className="flex flex-col items-center leading-none">
                    <span className="font-serif italic text-3xl font-black text-[#1E3A8A] tracking-tight flex items-center gap-0.5">
                      aura
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block -mt-1 shadow-sm"></span>
                    </span>
                    <span className="text-[8px] font-mono font-black text-[#C2410C] tracking-[0.25em] -mt-1 ml-1 uppercase">
                      BORBOREMA
                    </span>
                  </div>
                  {/* Concentric Circle Logo over right top */}
                  <div className="absolute right-4 top-3 flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-orange-600 relative">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-600 absolute top-0.5 left-0.5"></div>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-[#1E3A8A] mt-2 mb-0.5"></div>
                  <div className="w-full h-0.5 bg-[#C2410C]"></div>
                </div>

                {/* Sub-Header ID */}
                <div className="grid grid-cols-2 px-4 py-2 text-xs border-b border-black/10 bg-slate-50/50">
                  <div className="font-mono text-black font-extrabold select-all">
                    Crachá: <span className="text-sm font-black underline decoration-orange-600 select-all">{numeroCracha}</span>
                  </div>
                  <div className="font-mono text-right text-black font-extrabold">
                    Classe: <span className="text-[#C2410C] font-bold">{classe}</span>
                  </div>
                </div>

                {/* Layout Foto + Dados Principais */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  
                  {/* Foto e Metadados Superiores */}
                  <div className="flex gap-4 items-start">
                    {/* Foto */}
                    <div className="w-24 h-28 border-[2px] border-black bg-slate-100 flex items-center justify-center shrink-0 relative overflow-hidden">
                      {activePhotoUrl === "placeholder" ? (
                        <div className="flex flex-col items-center justify-center h-full text-[#141414]/30">
                          <User className="w-12 h-12" />
                          <span className="text-[7px] font-mono font-bold">SILHOUETTE</span>
                        </div>
                      ) : (
                        <img 
                          src={getDirectDriveImageURL(activePhotoUrl)} 
                          referrerPolicy="no-referrer"
                          alt="Foto Crachá" 
                          className="w-full h-full object-cover select-none" 
                        />
                      )}
                    </div>

                    {/* Direções do Crachá */}
                    <div className="space-y-1.5 text-[10px] leading-snug font-sans w-full">
                      <div>
                        <span className="text-[8px] font-mono block text-gray-400 font-bold uppercase leading-none">Nome Completo</span>
                        <strong className="text-black font-serif italic text-xs font-black select-all tracking-tight block max-h-12 overflow-hidden leading-tight">
                          {nomeCompleto || "CARREGANDO..."}
                        </strong>
                      </div>
                      
                      <div>
                        <span className="text-[8px] font-mono block text-gray-400 font-bold uppercase leading-none">Cargo</span>
                        <strong className="text-black font-mono text-[10px] font-extrabold uppercase truncate block" title={cargo}>
                          {cargo || "CARREGANDO..."}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[8px] font-mono block text-gray-400 font-bold uppercase leading-none">Gerência</span>
                        <strong className="text-black font-mono text-[10px] font-extrabold uppercase truncate block">
                          {gerencia}
                        </strong>
                      </div>

                      <div>
                        <span className="text-[8px] font-mono block text-gray-400 font-bold uppercase leading-none">Empresa</span>
                        <strong className="text-black font-mono text-[10px] font-extrabold uppercase truncate block">
                          {empresa}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Informações Regulatórias da CNH e ASO */}
                  <div className="mt-2 border-t border-b border-black py-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
                    <div>
                      <span className="text-[8px] font-mono font-bold block text-gray-400 uppercase leading-none">CNH Nº</span>
                      <strong className="text-xs font-mono text-black font-black select-all">{cnhNumero || "-"}</strong>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold block text-gray-400 uppercase leading-none">Categoria</span>
                      <strong className="text-xs font-mono text-black font-black select-all">{cnhCategoria || "-"}</strong>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold block text-gray-400 uppercase leading-none">Validade CNH</span>
                      <strong className="text-xs font-mono text-black font-black select-all">{cnhValidade ? formatBrDate(cnhValidade) : "-"}</strong>
                    </div>
                    <div>
                      <span className="text-[8px] font-mono font-bold block text-gray-400 uppercase leading-none">Validade do ASO</span>
                      <strong className="text-xs font-mono text-orange-600 font-black select-all">{validadeAsoState ? formatBrDate(validadeAsoState) : "-"}</strong>
                    </div>
                  </div>

                  {/* Quadros de Operação em Áreas Especiais (Mina, etc) */}
                  <div className="mt-2">
                    <span className="text-[8px] font-mono font-bold text-[#141414] uppercase tracking-wide block mb-1">Autorizado a Dirigir/Operar nas áreas:</span>
                    
                    <div className="space-y-1 bg-slate-50 border border-black/15 p-1.5 font-mono text-[10px] text-black">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[#C2410C] font-mono select-none">{autorizadoMina ? "✓" : "✗"}</span>
                        <span className={autorizadoMina ? "font-black" : "opacity-45 line-through"}>MINA</span>
                        
                        <span className="opacity-30 mx-1">|</span>
                        
                        <span className="font-extrabold text-[#C2410C] font-mono select-none">{autorizadoIndustrial ? "✓" : "✗"}</span>
                        <span className={autorizadoIndustrial ? "font-black" : "opacity-45 line-through"}>INDUSTRIAL</span>
                      </div>
                      <div className="flex items-center gap-1.5 pt-0.5 border-t border-black/5">
                        <span className="font-extrabold text-[#C2410C] font-mono select-none">{autorizadoFora ? "✓" : "✗"}</span>
                        <span className={autorizadoFora ? "font-black" : "opacity-45 line-through"}>FORA DA EMPRESA</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Rodapé Interno */}
                <div className="bg-[#1E3A8A] py-1 px-3 text-center text-[7px] font-mono font-extrabold text-white tracking-widest uppercase">
                  Acesso Restrito - Uso Obrigatório no Peito
                </div>

              </div>

              {/* CARTÃO VERSO */}
              <div id="cracha-verso" className="w-[325px] h-[510px] bg-white border-2 border-black rounded-lg shadow-xl relative overflow-hidden flex flex-col shrink-0 select-none">
                
                {/* Header do Verso */}
                <div className="pt-4 px-3 flex flex-col items-center relative border-b border-black">
                  <div className="flex flex-col items-center leading-none">
                    <span className="font-serif italic text-3xl font-black text-[#1E3A8A] tracking-tight flex items-center gap-0.5">
                      aura
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block -mt-1"></span>
                    </span>
                    <span className="text-[8px] font-mono font-black text-[#C2410C] tracking-[0.25em] -mt-1 ml-1 uppercase">
                      BORBOREMA
                    </span>
                  </div>
                  <div className="absolute right-4 top-3 flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full border-2 border-orange-600 relative">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-600 absolute top-0.5 left-0.5"></div>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-[#1E3A8A] mt-2 mb-0.5"></div>
                  <div className="w-full h-0.5 bg-[#C2410C]"></div>
                </div>

                {/* Tabela de Treinamentos */}
                <div className="p-3.5 flex-1 flex flex-col h-0">
                  <div className="flex-1 overflow-hidden flex flex-col border border-black">
                    {/* Headers */}
                    <div className="grid grid-cols-12 bg-[#1E3A8A] text-white font-mono text-[9px] font-black uppercase py-1 px-2 border-b border-black">
                      <div className="col-span-8">Treinamentos</div>
                      <div className="col-span-4 text-right">Validade</div>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto font-mono text-[9px] leading-normal divide-y divide-black/10">
                      {visibleTreinamentos.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 italic">Nenhum treinamento selecionado.</div>
                      ) : (
                        visibleTreinamentos.map((t, idx) => {
                          const isExpired = new Date(t.validade) < new Date();
                          return (
                            <div key={idx} className="grid grid-cols-12 py-1 px-2 hover:bg-slate-50">
                              <div className="col-span-8 font-extrabold text-black uppercase pr-1 truncate" title={t.nome}>
                                {t.nome}
                              </div>
                              <div className={`col-span-4 text-right font-black ${isExpired ? "text-red-600" : "text-black"}`}>
                                {formatBrDate(t.validade)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Informações de Emissão (Bottom) */}
                  <div className="mt-4 flex justify-between items-end">
                    <div className="text-[7px] font-mono text-gray-400 leading-tight">
                      Sistema Integrado SVE/ERP<br />
                      Mapeado de Registros SQLite
                    </div>

                    <div className="text-right font-mono bg-slate-50 border border-black/15 p-2 min-w-32">
                      <div className="text-[10px] font-black text-black leading-none select-all">{new Date().toLocaleDateString("pt-BR")}</div>
                      <div className="text-[9px] font-bold text-gray-500 leading-snug mt-0.5 select-all">
                        {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                      <div className="text-[8px] font-black text-[#C2410C] uppercase tracking-wider mt-1 block">Emissão</div>
                    </div>
                  </div>

                </div>

                {/* Rodapé Interno Verso */}
                <div className="bg-[#1E3A8A] py-1 px-3 text-center text-[7px] font-mono font-extrabold text-white tracking-widest uppercase">
                  Validação Através de Biometria / Portaria
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center text-gray-400 font-mono py-32 space-y-3">
              <span className="w-12 h-12 rounded-full border border-dashed border-[#141414]/30 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-300" />
              </span>
              <p className="text-xs max-w-sm italic">
                Aguardando seleção do trabalhador no menu esquerdo para prebotação e previsualização dos crachás inteligentes.
              </p>
            </div>
          )}
        </section>

      </div>

      {/* STYLES & LAYOUT SPECIAL EXCLUSIVE FOR PRINTING (WINDOW PRINT ACTION) */}
      <style>{`
        @media print {
          /* Oculta tudo que não for os Crachás */
          body {
            background-color: white !important;
            color: black !important;
          }
          #root {
            background: white !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          aside, header, footer, .print\\:hidden, button, section:first-of-type, h2, p {
            display: none !important;
          }

          /* Organiza ambos crachás perfeitamente alinhados para corte */
          #cracha-frente, #cracha-verso {
            display: flex !important;
            box-shadow: none !important;
            border: 2px solid black !important;
            margin: 15px auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          /* Forçar cores de fundo e imagens ao imprimir */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

    </div>
  );
}
