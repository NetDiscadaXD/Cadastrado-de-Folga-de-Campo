import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Users, 
  HeartPulse, 
  GraduationCap, 
  Plane, 
  ShieldAlert, 
  LayoutDashboard,
  ShieldCheck,
  User,
  Clock,
  ExternalLink,
  IdCard,
  Printer,
  FileText,
  X,
  Cloud,
  FolderOpen,
  LogOut,
  RefreshCw
} from "lucide-react";

// Componentes das Abas
import Dashboard from "./components/Dashboard";
import Cadastro from "./components/Cadastro";
import AsoView from "./components/AsoView";
import TreinamentoView from "./components/TreinamentoView";
import FolgaView from "./components/FolgaView";
import BloqueioView from "./components/BloqueioView";
import CrachaView from "./components/CrachaView";
import MemorandoView from "./components/MemorandoView";
import RelatorioCrachaView from "./components/RelatorioCrachaView";
import EspelhosView from "./components/EspelhosView";
import HoleritesView from "./components/HoleritesView";
import SindicatosView from "./components/SindicatosView";

// Tipos de dados
import { Colaborador, ASO, Treinamento, Viagem, BloqueioCracha, Memorando, Espelho, Holerite, Sindicato } from "./types";

// Camada de API
import { 
  fetchColaboradores, saveColaborador, updateColaborador, deleteColaborador,
  fetchASOs, saveASO, deleteASO,
  fetchTreinamentos, saveTreinamento, deleteTreinamento,
  fetchViagens, saveViagem,
  fetchBloqueios, saveBloqueio, liberarBloqueio, deleteBloqueio,
  fetchMemorandos, saveMemorando, updateMemorando, deleteMemorando,
  fetchEspelhos, saveEspelho, deleteEspelho,
  fetchHolerites, saveHolerite, deleteHolerite,
  fetchSindicatos, saveSindicato, deleteSindicato,
  syncLocalStorage
} from "./api";

import { formatBrDate } from "./utils/date";
import { initAuth, googleSignIn, logoutGoogle, getOrCreateFolderHierarchy, setSharedAccessTokenInAuth } from "./lib/googleAuth";

export default function App() {
  // Controle de Acesso / Perfis de Usuário
  const [currentUser, setCurrentUser] = useState<{ username: string; role: "admin" | "viewer" } | null>(() => {
    const saved = localStorage.getItem("current_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    const uNormalized = loginUsername.trim();
    const pNormalized = loginPassword;

    if (uNormalized === "Alexsandro" && pNormalized === "Alex@Lino") {
      const user = { username: "Alexsandro", role: "admin" as const };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
    } else if (uNormalized === "Parex" && pNormalized === "Parex@2026") {
      const user = { username: "Parex", role: "viewer" as const };
      setCurrentUser(user);
      localStorage.setItem("current_user", JSON.stringify(user));
    } else {
      setLoginError("Usuário ou senha incorretos.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("current_user");
    setCurrentUser(null);
    setLoginUsername("");
    setLoginPassword("");
  };

  // Controle de Abas Ativas
  const [activeTab, setActiveTab] = useState<"dashboard" | "cadastro" | "aso" | "treinamento" | "folga" | "bloqueio" | "cracha" | "memorando" | "relatoriocracha" | "espelhos" | "holerites" | "sindicatos">("dashboard");

  // Estados dos Dados Unificados
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [asos, setAsos] = useState<ASO[]>([]);
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [viagens, setViagens] = useState<Viagem[]>([]);
  const [bloqueios, setBloqueios] = useState<BloqueioCracha[]>([]);
  const [memorandos, setMemorandos] = useState<Memorando[]>([]);
  const [espelhos, setEspelhos] = useState<Espelho[]>([]);
  const [holerites, setHolerites] = useState<Holerite[]>([]);
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);

  // Estados do Google Drive
  const [googleUser, setGoogleUser] = useState<any>(() => {
    try {
      const cached = localStorage.getItem("gdrive_user");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [googleToken, setGoogleToken] = useState<string | null>(() => localStorage.getItem("gdrive_access_token"));
  const [gdriveError, setGdriveError] = useState<string | null>(() => sessionStorage.getItem("gdrive_last_error"));
  const [isVerifyingFolders, setIsVerifyingFolders] = useState(false);

  // Estados de Controle Auxiliar
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("syncing");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Monitorar Autenticação do Google e carregar credenciais compartilhadas do backend
  useEffect(() => {
    const loadSharedCredentials = async () => {
      try {
        const res = await fetch("/api/gdrive-credentials");
        if (res.ok) {
          const creds = await res.json();
          if (creds && creds.accessToken) {
            setGoogleToken(creds.accessToken);
            setSharedAccessTokenInAuth(creds.accessToken);
            if (creds.user) {
              setGoogleUser(creds.user);
              localStorage.setItem("gdrive_user", JSON.stringify(creds.user));
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar credenciais compartilhadas do GDrive:", err);
      }
    };

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setSharedAccessTokenInAuth(token);
        const u = {
          email: user.email,
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL
        };
        localStorage.setItem("gdrive_user", JSON.stringify(u));
        // Sincroniza logo após autenticação interativa
        fetch("/api/gdrive-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token, user: u })
        }).catch((err) => console.error("Erro ao sincronizar login com o Firestore:", err));
      },
      async () => {
        // Se a gente já tem dados no localStorage, inicializa primeiro
        const cachedUser = localStorage.getItem("gdrive_user");
        const cachedToken = localStorage.getItem("gdrive_access_token");
        if (cachedUser && cachedToken) {
          try {
            setGoogleUser(JSON.parse(cachedUser));
            setGoogleToken(cachedToken);
            setSharedAccessTokenInAuth(cachedToken);
          } catch {
            await loadSharedCredentials();
          }
        } else {
          await loadSharedCredentials();
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setSharedAccessTokenInAuth(result.accessToken);
        // Sincroniza credenciais no Firestore para outros navegadores/usuários
        await fetch("/api/gdrive-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: result.accessToken,
            user: {
              email: result.user.email,
              uid: result.user.uid,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL
            }
          })
        }).catch((err) => console.error("Erro ao persistir credenciais no GDrive:", err));
      }
    } catch (err) {
      console.error("Erro de login no Google:", err);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setGoogleToken(null);
    setSharedAccessTokenInAuth(null);
    setGdriveError(null);
    sessionStorage.removeItem("gdrive_last_error");
    // Desconecta e remove credenciais em nuvem também
    await fetch("/api/gdrive-credentials", {
      method: "DELETE"
    }).catch((err) => console.error("Erro ao desconectar GDrive em nuvem:", err));
  };

  const handleVerifyFolders = async () => {
    if (!googleToken) {
      alert("Por favor, conecte a sua conta do Google Drive primeiro.");
      return;
    }
    setIsVerifyingFolders(true);
    setGdriveError(null);
    try {
      const cacheKey = `gdrive_hierarchy_v2_${googleUser?.uid || "global"}`;
      sessionStorage.removeItem(cacheKey);
      sessionStorage.removeItem("gdrive_last_error");
      
      const folders = await getOrCreateFolderHierarchy(googleToken);
      if (folders && folders.rootId) {
        alert("Sucesso! A estrutura de pastas ('Gestão de Folga' e subpastas) foi criada ou verificada com sucesso no seu Google Drive.");
      }
    } catch (err: any) {
      console.error("Erro ao verificar pastas:", err);
      const lastError = sessionStorage.getItem("gdrive_last_error") || err.message || "Erro desconhecido";
      setGdriveError(lastError);
      alert(`Atenção: ${lastError}\n\nDica: Se for erro 403, desconecte a conta do Google clicando em 'Desconectar' e conecte novamente marcando as permissões do Google Drive na janela de consentimento.`);
    } finally {
      setIsVerifyingFolders(false);
    }
  };

  // Verificador e disparador seguro de impressão/salvar PDF para ambientes com iframe
  const handlePrint = () => {
    const isIframe = (() => {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    })();

    if (isIframe) {
      setShowPrintModal(true);
    } else {
      try {
        window.print();
      } catch (e) {
        console.error("Erro ao imprimir:", e);
        setShowPrintModal(true);
      }
    }
  };

  // Loop de atualização do relógio local no topo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar todos os dados da API ao inicializar
  const loadAllDataFromAPI = async () => {
    setIsLoading(true);
    setSyncStatus("syncing");
    try {
      const [colsRes, asosRes, treisRes, viagsRes, bloqsRes, memosRes, espelhosRes, holeritesRes, sindicatosRes] = await Promise.all([
        fetchColaboradores(),
        fetchASOs(),
        fetchTreinamentos(),
        fetchViagens(),
        fetchBloqueios(),
        fetchMemorandos(),
        fetchEspelhos(),
        fetchHolerites(),
        fetchSindicatos(),
      ]);

      setColaboradores(colsRes);
      setAsos(asosRes);
      setTreinamentos(treisRes);
      setViagens(viagsRes);
      setBloqueios(bloqsRes);
      setMemorandos(memosRes);
      setEspelhos(espelhosRes || []);
      setHolerites(holeritesRes || []);
      setSindicatos(sindicatosRes || []);
      
      // Sincroniza em cache local para persistência offline / contingente
      syncLocalStorage(
        colsRes, 
        asosRes, 
        treisRes, 
        viagsRes, 
        bloqsRes, 
        memosRes, 
        espelhosRes || [],
        holeritesRes || [],
        sindicatosRes || []
      );
      setSyncStatus("synced");
    } catch (err) {
      console.error("Erro geral na sincronização, utilizando redundância de cache local:", err);
      setSyncStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllDataFromAPI();
  }, []);

  const guardAdmin = () => {
    if (currentUser?.role !== "admin") {
      console.warn("Acesso Negado: Esta operação é restrita a administradores.");
      return false;
    }
    return true;
  };

  // Handlers CRUD - Colaboradores
  const handleAddColaborador = async (novo: Colaborador) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveColaborador(novo);
    setColaboradores((prev) => {
      const updated = [...prev, result];
      localStorage.setItem("erp_colaboradores", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleUpdateColaborador = async (matricula: string, dadosAtualizados: Partial<Colaborador>) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await updateColaborador(matricula, dadosAtualizados);
    setColaboradores((prev) => {
      const updated = prev.map((c) => (c.matricula === matricula ? result : c));
      localStorage.setItem("erp_colaboradores", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteColaborador = async (matricula: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    await deleteColaborador(matricula);
    
    // Deleta local em cascata também para reatividade perfeita na UI instantânea
    setColaboradores((p) => p.filter((c) => c.matricula !== matricula));
    setAsos((p) => p.filter((a) => a.matricula !== matricula));
    setTreinamentos((p) => p.filter((t) => t.matricula !== matricula));
    setViagens((p) => p.filter((v) => v.matricula !== matricula));
    setBloqueios((p) => p.filter((b) => b.matricula !== matricula));
    setMemorandos((p) => p.filter((m) => m.matricula !== matricula));
    
    // Atualiza cache local
    localStorage.setItem("erp_colaboradores", JSON.stringify(colaboradores.filter(c => c.matricula !== matricula)));
    localStorage.setItem("erp_asos", JSON.stringify(asos.filter(a => a.matricula !== matricula)));
    localStorage.setItem("erp_treinamentos", JSON.stringify(treinamentos.filter(t => t.matricula !== matricula)));
    localStorage.setItem("erp_viagens", JSON.stringify(viagens.filter(v => v.matricula !== matricula)));
    localStorage.setItem("erp_bloqueios", JSON.stringify(bloqueios.filter(b => b.matricula !== matricula)));
    localStorage.setItem("erp_memorandos", JSON.stringify(memorandos.filter(m => m.matricula !== matricula)));

    setSyncStatus("synced");
  };

  // Handlers - ASO
  const handleAddASO = async (novo: ASO) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveASO(novo);
    setAsos((prev) => {
      // Substitui se já houver um ASO de mesmo tipo para essa matrícula
      const filtrado = prev.filter(a => !(a.matricula === result.matricula && a.tipoExame === result.tipoExame));
      const updated = [...filtrado, result];
      localStorage.setItem("erp_asos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Treinamento
  const handleAddTreinamento = async (novo: Treinamento) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveTreinamento(novo);
    setTreinamentos((prev) => {
      const updated = [...prev, result];
      localStorage.setItem("erp_treinamentos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Viagens
  const handleAddViagem = async (novo: Viagem) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveViagem(novo);
    setViagens((prev) => {
      const idx = prev.findIndex(v => v.id === result.id);
      let updated;
      if (idx !== -1) {
        updated = [...prev];
        updated[idx] = result;
      } else {
        updated = [...prev, result];
      }
      localStorage.setItem("erp_viagens", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers de Exclusão Individual (Tabs 03 a 06)
  const handleDeleteASO = async (idOrMatricula: string, tipoExame?: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    try {
      await deleteASO(idOrMatricula, tipoExame);
    } catch (err) {
      console.error("Erro ao deletar ASO:", err);
    }
    setAsos((prev) => {
      let updated;
      if (tipoExame) {
        const normTipo = tipoExame.normalize("NFC").trim().toLowerCase();
        updated = prev.filter(a => {
          const normAsoTipo = a.tipoExame.normalize("NFC").trim().toLowerCase();
          return !(a.matricula === idOrMatricula && normAsoTipo === normTipo);
        });
      } else {
        updated = prev.filter(a => a.id !== idOrMatricula);
      }
      localStorage.setItem("erp_asos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteTreinamento = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    try {
      await deleteTreinamento(id);
    } catch (err) {
      console.error("Erro ao deletar Treinamento:", err);
    }
    setTreinamentos((prev) => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem("erp_treinamentos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteViagem = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    try {
      await fetch(`/api/viagens/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Erro ao deletar Viagem:", err);
    }
    setViagens((prev) => {
      const updated = prev.filter(v => v.id !== id);
      localStorage.setItem("erp_viagens", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteBloqueio = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    try {
      await deleteBloqueio(id);
    } catch (err) {
      console.error("Erro ao deletar Bloqueio:", err);
    }
    setBloqueios((prev) => {
      const updated = prev.filter(b => b.id !== id);
      localStorage.setItem("erp_bloqueios", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Memorandos
  const handleAddMemorando = async (novo: Memorando) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveMemorando(novo);
    setMemorandos((prev) => {
      const updated = [...prev, result];
      localStorage.setItem("erp_memorandos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleUpdateMemorando = async (id: string, updates: Partial<Memorando>) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await updateMemorando(id, updates);
    setMemorandos((prev) => {
      const updated = prev.map((m) => (m.id === id ? result : m));
      localStorage.setItem("erp_memorandos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteMemorando = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    await deleteMemorando(id);
    setMemorandos((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      localStorage.setItem("erp_memorandos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Espelhos de Ponto
  const handleAddEspelho = async (novo: Espelho) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveEspelho(novo);
    setEspelhos((prev) => {
      const filtrado = prev.filter(e => !(e.matricula === result.matricula && e.mes === result.mes && e.ano === result.ano));
      const updated = [...filtrado, result];
      localStorage.setItem("erp_espelhos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteEspelho = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    await deleteEspelho(id);
    setEspelhos((prev) => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem("erp_espelhos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Holerites
  const handleAddHolerite = async (novo: Holerite) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveHolerite(novo);
    setHolerites((prev) => {
      const filtrado = prev.filter(e => !(e.matricula === result.matricula && e.mes === result.mes && e.ano === result.ano));
      const updated = [...filtrado, result];
      localStorage.setItem("erp_holerites", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteHolerite = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    await deleteHolerite(id);
    setHolerites((prev) => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem("erp_holerites", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Sindicato (Membros permanentes)
  const handleAddSindicato = async (novo: Sindicato) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveSindicato(novo);
    setSindicatos((prev) => {
      const filtrado = prev.filter(e => e.matricula !== result.matricula);
      const updated = [...filtrado, result];
      localStorage.setItem("erp_sindicatos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  const handleDeleteSindicato = async (id: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    await deleteSindicato(id);
    setSindicatos((prev) => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem("erp_sindicatos", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  // Handlers - Bloqueios de Crachá (Módulo de Segurança)
  const handleAddBloqueio = async (novo: BloqueioCracha) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await saveBloqueio(novo);
    setBloqueios((prev) => {
      const updated = [...prev, result];
      localStorage.setItem("erp_bloqueios", JSON.stringify(updated));
      return updated;
    });

    // Auto-inclusão nas abas correspondentes:
    if (result.origem === "ASO") {
      try {
        const asoPayload: ASO = {
          matricula: result.matricula,
          tipoExame: result.tipoExame || "Pendente (Portaria)",
          dataRealizacao: result.dataRealizacao || "2020-01-01", 
          validadeMeses: result.validadeMeses || 12
        };
        const asoResult = await saveASO(asoPayload);
        setAsos((prev) => {
          // Substitui se já houver um ASO de mesmo tipo
          const filtrado = prev.filter(a => !(a.matricula === asoResult.matricula && a.tipoExame === asoResult.tipoExame));
          const updated = [...filtrado, asoResult];
          localStorage.setItem("erp_asos", JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error("Erro ao auto-salvar ASO do bloqueio:", err);
      }
    } else if (result.origem === "Treinamento" && result.tipoTreinamentoPendente) {
      try {
        const trPayload: Treinamento = {
          id: "T-AUTO-" + Date.now(),
          matricula: result.matricula,
          nomeTreinamento: result.tipoTreinamentoPendente,
          dataRealizacao: result.dataRealizacao || "2020-01-01", 
          periodicidade: "1 ANO"
        };
        const trResult = await saveTreinamento(trPayload);
        setTreinamentos((prev) => {
          const updated = [...prev, trResult];
          localStorage.setItem("erp_treinamentos", JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error("Erro ao auto-salvar Treinamento do bloqueio:", err);
      }
    }

    setSyncStatus("synced");
  };

  const handleLiberarBloqueio = async (id: string, dataLiberacao: string, dataRealizacao?: string) => {
    if (!guardAdmin()) return;
    setSyncStatus("syncing");
    const result = await liberarBloqueio(id, dataLiberacao, dataRealizacao);
    
    // Define a de realização efetiva (se houver, senão assume liberação)
    const targetRealizacaoDate = dataRealizacao || dataLiberacao;

    // Encontra o bloqueio original para identificar colaborador, origem e treinamento pendente
    const blockRecord = bloqueios.find((b) => b.id === id);
    if (blockRecord) {
      if (blockRecord.origem === "ASO") {
        setAsos((prev) => {
          let hasUpdated = false;
          const updated = prev.map((aso) => {
            if (aso.matricula === blockRecord.matricula) {
              const dateV = new Date(aso.dataRealizacao + "T12:00:00");
              dateV.setMonth(dateV.getMonth() + aso.validadeMeses);
              const vencStr = dateV.toISOString().split("T")[0];
              const isAsoVencido = new Date(vencStr) < new Date();

              if (aso.tipoExame === "Pendente (Portaria)" || isAsoVencido) {
                hasUpdated = true;
                return {
                  ...aso,
                  dataRealizacao: targetRealizacaoDate,
                  tipoExame: aso.tipoExame === "Pendente (Portaria)" ? "Periódico" : aso.tipoExame,
                };
              }
            }
            return aso;
          });

          if (!hasUpdated) {
            const asoAdicionado: ASO = {
              matricula: blockRecord.matricula,
              tipoExame: "Periódico",
              dataRealizacao: targetRealizacaoDate,
              validadeMeses: 12
            };
            const withNew = [...updated, asoAdicionado];
            localStorage.setItem("erp_asos", JSON.stringify(withNew));
            return withNew;
          }

          localStorage.setItem("erp_asos", JSON.stringify(updated));
          return updated;
        });
      } else if (blockRecord.origem === "Treinamento" && blockRecord.tipoTreinamentoPendente) {
        setTreinamentos((prev) => {
          let hasUpdated = false;
          const updated = prev.map((tr) => {
            if (tr.matricula === blockRecord.matricula && tr.nomeTreinamento === blockRecord.tipoTreinamentoPendente) {
              hasUpdated = true;
              return {
                ...tr,
                dataRealizacao: targetRealizacaoDate
              };
            }
            return tr;
          });

          if (!hasUpdated) {
            const trAdicionado: Treinamento = {
              id: "T-AUTO-" + Date.now(),
              matricula: blockRecord.matricula,
              nomeTreinamento: blockRecord.tipoTreinamentoPendente,
              dataRealizacao: targetRealizacaoDate,
              periodicidade: "1 ANO"
            };
            const withNew = [...updated, trAdicionado];
            localStorage.setItem("erp_treinamentos", JSON.stringify(withNew));
            return withNew;
          }

          localStorage.setItem("erp_treinamentos", JSON.stringify(updated));
          return updated;
        });
      }
    }

    setBloqueios((prev) => {
      const updated = prev.map((b) => (b.id === id ? result : b));
      localStorage.setItem("erp_bloqueios", JSON.stringify(updated));
      return updated;
    });
    setSyncStatus("synced");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-200 select-none antialiased">
        <div className="w-full max-w-md bg-slate-950 border-2 border-slate-800 p-8 shadow-2xl relative">
          <div className="text-center mb-8">
            <h1 className="text-xl font-black uppercase tracking-tight leading-snug text-white">
              Projeto Borborema <span className="text-indigo-400 block text-xs tracking-widest mt-1 font-bold">Filtragem Portal</span>
            </h1>
            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-1.5 block">
              Acesso Restrito ao Sistema
            </span>
          </div>

          {loginError && (
            <div className="mb-6 p-4 border border-red-500/50 bg-red-950/30 text-red-300 text-xs font-mono rounded-lg flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-100 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400 mb-1.5">
                Usuário (Username)
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Digite o usuário"
                className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-slate-100 text-sm font-sans focus:outline-none focus:border-indigo-500 font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-mono font-bold text-slate-400 mb-1.5">
                Senha (Password)
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-800 px-4 py-3 text-slate-100 text-sm font-sans focus:outline-none focus:border-indigo-500 font-medium transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              Acessar Sistema ↗
            </button>
          </form>

          <div className="mt-8 border-t border-slate-900 pt-4 text-center">
            <p className="text-[9px] font-mono text-slate-500 leading-normal uppercase">
              GRUPO BORBOREMA • SEGURANÇA E OPERAÇÕES
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 select-none antialiased">
      
      {/* SIDEBAR OPERACIONAL */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200/60 flex flex-col bg-slate-900 text-slate-200 shrink-0 print:hidden">
        
        {/* Header da Sidebar */}
        <div className="p-6 border-b border-slate-800 flex md:block justify-between items-center bg-slate-950/40">
          <div>
            <h1 className="font-sans antialiased text-base font-black tracking-tight leading-snug text-white uppercase break-words">
              Projeto Borborema <br />
              <span className="text-indigo-400 text-xs tracking-widest block mt-1 font-bold">Filtragem</span>
            </h1>
            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest mt-1 block">
              SISTEMA DE RH E OPERAÇÕES
            </span>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full inline-block ${
              syncStatus === "synced" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-400 animate-pulse"
            }`}></span>
            <span className="text-[9px] font-mono text-slate-300 uppercase tracking-tight font-bold">SQLite OK</span>
          </div>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 py-4 uppercase text-[10px] font-mono font-bold tracking-wider flex flex-col gap-0.5 px-3">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab("dashboard")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>01. Dashboard</span>
            <LayoutDashboard className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-cadastro"
            onClick={() => setActiveTab("cadastro")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "cadastro"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>02. Cadastro Colab.</span>
            <Users className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-folga"
            onClick={() => setActiveTab("folga")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "folga"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>03. Folga de Campo</span>
            <Plane className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-memorando"
            onClick={() => setActiveTab("memorando")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "memorando"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>04. Memorando</span>
            <FileText className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-relatoriocracha"
            onClick={() => setActiveTab("relatoriocracha")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "relatoriocracha"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>05. Relat. Crachá</span>
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-espelhos"
            onClick={() => setActiveTab("espelhos")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "espelhos"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>06. Espelhos</span>
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-holerites"
            onClick={() => setActiveTab("holerites")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "holerites"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>07. Holerite</span>
            <FileText className="w-3.5 h-3.5" />
          </button>

          <button
            id="tab-sindicatos"
            onClick={() => setActiveTab("sindicatos")}
            className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-between ${
              activeTab === "sindicatos"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>08. Sindicato</span>
            <ShieldAlert className="w-3.5 h-3.5" />
          </button>
        </nav>

        {/* Informações do Usuário Ativo */}
        <div className="p-4 border-t border-slate-800 text-[10px] font-mono text-slate-300 leading-relaxed bg-slate-950/40 space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="font-bold uppercase tracking-wide">USUÁRIO: {currentUser?.username}</span>
          </div>
          <div className="text-[9px] text-slate-400">
            PERMISSÃO: {currentUser?.role === "admin" ? "ADMINISTRADOR (TOTAL)" : "VISUALIZADOR (LEITURA)"}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[9px] uppercase tracking-wider font-mono font-bold bg-red-950/20 hover:bg-red-950/70 hover:text-red-200 text-red-300 border border-red-900/40 rounded-md transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sair do Sistema
          </button>
        </div>

        {/* Metadados / Estado SQLite */}
        <div className="p-4 border-t border-slate-800 text-[10px] font-mono text-slate-400 leading-relaxed bg-slate-950/20 space-y-3">
          <div>
            <div>NÚCLEO: SQLITE_PROD_READY + CLOUD</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span>SINCRO:</span>
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                syncStatus === "synced" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-amber-400 animate-pulse"
              }`}></span>
              <span>{syncStatus === "synced" ? "NUVEM CONECTADA" : "PROCESSANDO"}</span>
            </div>
          </div>

          {currentUser?.role === "admin" ? (
            <div className="border-t border-slate-800/80 pt-2.5 space-y-2">
              <div className="flex items-center gap-1 text-[9px] font-sans font-bold uppercase tracking-widest text-[#a5b4fc]">
                <Cloud className="w-3 h-3 text-indigo-400" />
                <span>Google Drive</span>
              </div>
              {googleUser ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${gdriveError ? "bg-red-500 shadow-[0_0_6px_#ef4444]" : "bg-emerald-500 shadow-[0_0_6px_#10b981] animate-pulse"} inline-block`}></span>
                    <span className={`text-[10px] font-mono ${gdriveError ? "text-red-400" : "text-emerald-400"} font-bold tracking-tight uppercase`}>
                      {gdriveError ? "ERRO NO DRIVE" : "SERVIÇO ATIVO"}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-200 font-mono truncate" title={googleUser.email}>
                    CONECTADO: {googleUser.email}
                  </div>

                  {gdriveError && (
                    <div className="bg-amber-950/50 border border-amber-800/80 p-1.5 rounded text-[8px] text-amber-300 font-sans leading-normal whitespace-pre-line">
                      ⚠️ {gdriveError}
                    </div>
                  )}

                  <button
                    onClick={handleVerifyFolders}
                    disabled={isVerifyingFolders}
                    className="w-full flex items-center justify-center gap-1 px-2.5 py-1 text-[9px] uppercase tracking-wider font-mono font-bold bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/40 rounded transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isVerifyingFolders ? "animate-spin" : ""}`} />
                    {isVerifyingFolders ? "Sincronizando..." : "Verificar / Criar Pastas"}
                  </button>

                  <button
                    onClick={handleGoogleLogout}
                    className="w-full flex items-center justify-center gap-1 px-2.5 py-1 text-[9px] uppercase tracking-wider font-mono font-bold bg-slate-800 hover:bg-red-950/80 hover:text-red-300 text-slate-400 border border-slate-700/50 rounded transition-colors cursor-pointer"
                  >
                    <LogOut className="w-2.5 h-2.5" />
                    Desconectar
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-slate-400 leading-normal font-sans">
                    Conecte seu Google Drive para salvar comprovantes e fotos direto na sua nuvem.
                  </p>
                  <button
                    onClick={handleGoogleLogin}
                    className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-[10px] font-bold tracking-wider uppercase rounded-md shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer border border-indigo-500"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.35 11.1H12v3.8h5.38a4.6 4.6 0 0 1-2 3.01l3.09 2.4c1.8-1.66 2.88-4.11 2.88-7.01c0-.73-.07-1.43-.2-2.1z" fill="#4285F4"/>
                      <path d="M12 20.6c2.43 0 4.47-.8 5.96-2.2l-3.09-2.4c-.86.58-1.96.92-2.87.92c-2.22 0-4.11-1.5-4.78-3.52L4.1 15.82a8.6 8.6 0 0 0 7.9 4.78z" fill="#34A853"/>
                      <path d="M7.22 13.4a5.15 5.15 0 0 1 0-3.3l-3.13-2.42a8.6 8.6 0 0 0 0 8.13l3.13-2.41z" fill="#FBBC05"/>
                      <path d="M12 7.4c1.32 0 2.51.45 3.44 1.34l2.58-2.58a8.6 8.6 0 0 0-6.02-2.36C8.25 3.8 4.96 5.8 4.1 9.18l3.12 2.42c.67-2.02 2.56-3.52 4.78-3.52z" fill="#EA4335"/>
                    </svg>
                    Conectar GDrive
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="border-t border-slate-800/80 pt-2.5 space-y-1">
              <div className="flex items-center gap-1 text-[9px] font-sans font-bold uppercase tracking-widest text-amber-500">
                <Cloud className="w-3 h-3 text-amber-550" />
                <span>Google Drive</span>
              </div>
              <p className="text-[9px] text-slate-400 leading-normal font-sans">
                Acesso e upload para o Google Drive restritos a administradores.
              </p>
            </div>
          )}
        </div>

      </aside>

      {/* CONTEÚDO PRINCIPAL HEADER + VIEW */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Header Superior */}
        <header className="h-16 border-b border-slate-200 bg-white/70 backdrop-blur-md flex items-center justify-between px-8 shrink-0 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-sm sm:text-base md:text-lg text-slate-800 font-sans font-bold tracking-tight truncate max-w-[150px] min-[380px]:max-w-[210px] sm:max-w-none">
              {activeTab === "dashboard" && "Painel de Controle Operacional"}
              {activeTab === "cadastro" && "Ficha Cadastral de Colaboradores"}
              {activeTab === "aso" && "Controle Ocupacional de Saúde / ASO"}
              {activeTab === "treinamento" && "Segurança do Trabalho e Normas Regulamentadoras"}
              {activeTab === "folga" && "Roteiro de Campo: Viagens e Logística de Folga"}
              {activeTab === "bloqueio" && "Acesso Portaria - Restrição de Crachás"}
              {activeTab === "cracha" && "Mapeador e Emissor de Crachás de Campo"}
              {activeTab === "memorando" && "Controle Operacional e Check-in de Memorandos"}
              {activeTab === "relatoriocracha" && "Relatório de Liberação de Crachás: Corridos e Úteis"}
            </span>
            {currentUser?.role === "admin" ? (
              <span className="hidden sm:inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[9px] uppercase tracking-wider font-mono font-semibold border border-indigo-100">
                Modo Administrador
              </span>
            ) : (
              <span className="hidden sm:inline-block px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[9px] uppercase tracking-wider font-mono font-semibold border border-amber-200">
                Modo Leitura / Visualizador
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono font-semibold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200/60">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{currentTime.toLocaleTimeString("pt-BR")}</span>
            </div>
            
            <div className="w-11 h-9 px-2 rounded-lg border border-indigo-200/80 flex items-center justify-center bg-indigo-50 font-sans text-xs font-bold text-indigo-700 shadow-xs">
              {currentUser?.username.substring(0, 5).toUpperCase()}
            </div>
          </div>
        </header>

        {/* CORPO DA VIEW CORRESPONDENTE */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 print:p-0 print:overflow-visible">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#141414] gap-4">
              <span className="w-8 h-8 border-2 border-[#141414] border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs font-mono uppercase tracking-widest font-bold opacity-75">
                Carregando tabelas do Banco SQLite...
              </span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.12 }}
                className="space-y-6"
              >
                {activeTab === "dashboard" && (
                  <Dashboard 
                    colaboradores={colaboradores} 
                    viagens={viagens}
                    onNavigate={(tab) => {
                      if (tab === "dashboard" || tab === "cadastro" || tab === "folga") {
                        setActiveTab(tab);
                      }
                    }}
                    onPrint={handlePrint}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}
                
                {activeTab === "cadastro" && (
                  <Cadastro
                    colaboradores={colaboradores}
                    onAddColaborador={handleAddColaborador}
                    onUpdateColaborador={handleUpdateColaborador}
                    onDeleteColaborador={handleDeleteColaborador}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "aso" && (
                  <AsoView
                    colaboradores={colaboradores}
                    asos={asos}
                    bloqueios={bloqueios}
                    onAddASO={handleAddASO}
                    onDeleteASO={handleDeleteASO}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "treinamento" && (
                  <TreinamentoView
                    colaboradores={colaboradores}
                    treinamentos={treinamentos}
                    bloqueios={bloqueios}
                    onAddTreinamento={handleAddTreinamento}
                    onDeleteTreinamento={handleDeleteTreinamento}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "folga" && (
                  <FolgaView
                    colaboradores={colaboradores}
                    viagens={viagens}
                    onAddViagem={handleAddViagem}
                    onDeleteViagem={handleDeleteViagem}
                    onPrint={handlePrint}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "bloqueio" && (
                  <BloqueioView
                    colaboradores={colaboradores}
                    bloqueios={bloqueios}
                    onAddBloqueio={handleAddBloqueio}
                    onLiberarBloqueio={handleLiberarBloqueio}
                    onDeleteBloqueio={handleDeleteBloqueio}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "cracha" && (
                  <CrachaView
                    colaboradores={colaboradores}
                    asos={asos}
                    treinamentos={treinamentos}
                    onPrint={handlePrint}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "memorando" && (
                  <MemorandoView
                    colaboradores={colaboradores}
                    memorandos={memorandos}
                    onAddMemorando={handleAddMemorando}
                    onUpdateMemorando={handleUpdateMemorando}
                    onDeleteMemorando={handleDeleteMemorando}
                    onPrint={handlePrint}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "relatoriocracha" && (
                  <RelatorioCrachaView
                    colaboradores={colaboradores}
                    onUpdateColaborador={handleUpdateColaborador}
                    onPrint={handlePrint}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "espelhos" && (
                  <EspelhosView
                    colaboradores={colaboradores}
                    espelhos={espelhos}
                    onAddEspelho={handleAddEspelho}
                    onDeleteEspelho={handleDeleteEspelho}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "holerites" && (
                  <HoleritesView
                    colaboradores={colaboradores}
                    holerites={holerites}
                    onAddHolerite={handleAddHolerite}
                    onDeleteHolerite={handleDeleteHolerite}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}

                {activeTab === "sindicatos" && (
                  <SindicatosView
                    colaboradores={colaboradores}
                    sindicatos={sindicatos}
                    onAddSindicato={handleAddSindicato}
                    onDeleteSindicato={handleDeleteSindicato}
                    googleToken={googleToken}
                    isAdmin={currentUser?.role === "admin"}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Modal de Instrução de Geração de PDF (Iframe Fallback) */}
        <AnimatePresence>
          {showPrintModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#E4E3E0] border-4 border-[#141414] p-6 max-w-lg w-full shadow-[8px_8px_0px_0px_#141414] relative font-sans text-[#141414]"
              >
                {/* Botão de Fechar */}
                <button 
                  onClick={() => setShowPrintModal(false)}
                  className="absolute right-4 top-4 border-2 border-[#141414] bg-white hover:bg-neutral-900 hover:text-white p-1 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 border-b-2 border-[#141414] pb-4 mb-4">
                  <Printer className="w-8 h-8 text-indigo-750" />
                  <div>
                    <h3 className="font-serif italic font-bold text-lg leading-tight">Instruções para Salvar / Imprimir PDF</h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/65">Restrição de Segurança do Navegador</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs font-mono">
                  <p className="text-[#141414]/85 leading-relaxed">
                    Você está acessando a aplicação no painel com iframe do editor. Por questões de segurança, os navegadores de internet bloqueiam telas de impressão nativas (<code className="bg-white/60 px-1 border border-[#141414]/20 py-0.5 rounded">window.print()</code>) dentro de caixas incorporadas.
                  </p>

                  <div className="bg-white border border-[#141414] p-3 text-[11px] leading-relaxed">
                    <strong className="text-indigo-800 uppercase block mb-1">Como resolver facilmente:</strong>
                    1. Clique no botão azul abaixo para <strong className="underline">Abrir o App em uma Nova Aba</strong>.<br />
                    2. Na nova aba aberta, clique no botão <strong className="underline font-bold">Salvar PDF</strong> novamente.<br />
                    3. No visualizador que abrir, escolha a opção <strong className="underline font-bold">"Salvar como PDF"</strong> como Destino de impressão.
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <a 
                      href={window.location.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-indigo-650 hover:bg-indigo-700 text-white hover:shadow-[4px_4px_0px_0px_#141414] px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all text-center"
                    >
                      Abrir App em Nova Aba ↗
                    </a>
                    
                    <button 
                      onClick={() => setShowPrintModal(false)}
                      className="flex items-center justify-center border-2 border-[#141414] bg-white hover:bg-[#141414] hover:text-white px-4 py-2 text-xs uppercase tracking-wider transition-all cursor-pointer text-center"
                    >
                      Fechar Janela
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Rodapé da Área Principal */}
        <footer className="border-t border-[#141414]/15 py-4 px-8 text-[10px] font-mono text-[#141414]/60 flex flex-col sm:flex-row justify-between items-center gap-2 bg-white/10">
          <div>
            <strong>PROJETO BORBOREMA - FILTRAGEM • RH E FIELD OPERATIONS</strong> — TODOS OS DIREITOS RESERVADOS.
          </div>
          <div className="flex gap-4">
            <span>SGBD: SQLite (Prod)</span>
            <span>DATA DE HOJE: {formatBrDate(new Date().toISOString().split("T")[0])}</span>
          </div>
        </footer>

      </main>

    </div>
  );
}
