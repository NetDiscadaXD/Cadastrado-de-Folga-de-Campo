import { Colaborador, ASO, Treinamento, Viagem, BloqueioCracha, Memorando, Espelho, Holerite, Sindicato, Ferias, DisponibilidadeColaborador, ObservacaoColaborador, ConfiguracaoCustos, AuditLog } from "./types";

// Base API URL is relative since the server hosts both the front-end and back-end
const API_BASE = "";

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  let username = "Alexsandro";
  try {
    const saved = localStorage.getItem("current_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.username) {
        username = parsed.username;
      }
    }
  } catch {}

  return {
    "Content-Type": "application/json",
    "x-user-name": encodeURIComponent(username),
    ...extraHeaders
  };
}

export async function fetchColaboradores(): Promise<Colaborador[]> {
  try {
    const res = await fetch(`${API_BASE}/api/colaboradores`);
    if (!res.ok) throw new Error("Erro ao buscar colaboradores");
    return await res.json();
  } catch (err) {
    console.warn("Utilizando dados do localStorage como fallback:", err);
    const local = localStorage.getItem("erp_colaboradores");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveColaborador(colaborador: Colaborador): Promise<Colaborador> {
  const res = await fetch(`${API_BASE}/api/colaboradores`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(colaborador),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar colaborador");
  }
  return await res.json();
}

export async function updateColaborador(matricula: string, colaborador: Partial<Colaborador>): Promise<Colaborador> {
  const res = await fetch(`${API_BASE}/api/colaboradores/${matricula}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(colaborador),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao atualizar colaborador");
  }
  return await res.json();
}

export async function deleteColaborador(matricula: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/colaboradores/${matricula}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erro ao excluir colaborador");
  return true;
}

export async function fetchASOs(): Promise<ASO[]> {
  try {
    const res = await fetch(`${API_BASE}/api/asos`);
    if (!res.ok) throw new Error("Erro ao buscar ASOs");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_asos");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveASO(aso: ASO): Promise<ASO> {
  const res = await fetch(`${API_BASE}/api/asos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(aso),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar ASO");
  }
  return await res.json();
}

export async function fetchTreinamentos(): Promise<Treinamento[]> {
  try {
    const res = await fetch(`${API_BASE}/api/treinamentos`);
    if (!res.ok) throw new Error("Erro ao buscar treinamentos");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_treinamentos");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveTreinamento(treinamento: Treinamento): Promise<Treinamento> {
  const res = await fetch(`${API_BASE}/api/treinamentos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(treinamento),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar treinamento");
  }
  return await res.json();
}

export async function fetchViagens(): Promise<Viagem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/viagens`);
    if (!res.ok) throw new Error("Erro ao buscar viagens");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_viagens");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveViagem(viagem: Viagem): Promise<Viagem> {
  const res = await fetch(`${API_BASE}/api/viagens`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(viagem),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar viagem");
  }
  return await res.json();
}

export async function fetchBloqueios(): Promise<BloqueioCracha[]> {
  try {
    const res = await fetch(`${API_BASE}/api/bloqueios`);
    if (!res.ok) throw new Error("Erro ao buscar bloqueios de crachá");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_bloqueios");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveBloqueio(bloqueio: BloqueioCracha): Promise<BloqueioCracha> {
  const res = await fetch(`${API_BASE}/api/bloqueios`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(bloqueio),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao registrar bloqueio");
  }
  return await res.json();
}

export async function liberarBloqueio(id: string, dataLiberacao: string, dataRealizacao?: string): Promise<BloqueioCracha> {
  const res = await fetch(`${API_BASE}/api/bloqueios/${id}/liberar`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ dataLiberacao, dataRealizacao }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao liberar crachá");
  }
  return await res.json();
}

export async function deleteASO(idOrMatricula: string, tipoExame?: string): Promise<boolean> {
  const url = tipoExame
    ? `${API_BASE}/api/asos/${idOrMatricula}/${encodeURIComponent(tipoExame)}`
    : `${API_BASE}/api/asos/${idOrMatricula}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir ASO");
  }
  return true;
}

export async function deleteTreinamento(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/treinamentos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir treinamento");
  }
  return true;
}

export async function deleteBloqueio(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/bloqueios/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir bloqueio de crachá");
  }
  return true;
}

export async function fetchMemorandos(): Promise<Memorando[]> {
  try {
    const res = await fetch(`${API_BASE}/api/memorandos`);
    if (!res.ok) throw new Error("Erro ao buscar memorandos");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_memorandos");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveMemorando(memorando: Memorando): Promise<Memorando> {
  const res = await fetch(`${API_BASE}/api/memorandos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(memorando),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar memorando");
  }
  return await res.json();
}

export async function updateMemorando(id: string, updates: Partial<Memorando>): Promise<Memorando> {
  const res = await fetch(`${API_BASE}/api/memorandos/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao atualizar memorando");
  }
  return await res.json();
}

export async function deleteMemorando(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/memorandos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir memorando");
  }
  return true;
}

// Sincroniza dados locais se o servidor falhar, garantindo resiliência total offline/online
export function syncLocalStorage(
  colaboradores: Colaborador[],
  asos: ASO[],
  treinamentos: Treinamento[],
  viagens: Viagem[],
  bloqueios: BloqueioCracha[],
  memorandos: Memorando[] = [],
  espelhos: Espelho[] = [],
  holerites: Holerite[] = [],
  sindicatos: Sindicato[] = [],
  ferias: Ferias[] = []
) {
  localStorage.setItem("erp_colaboradores", JSON.stringify(colaboradores));
  localStorage.setItem("erp_asos", JSON.stringify(asos));
  localStorage.setItem("erp_treinamentos", JSON.stringify(treinamentos));
  localStorage.setItem("erp_viagens", JSON.stringify(viagens));
  localStorage.setItem("erp_bloqueios", JSON.stringify(bloqueios));
  localStorage.setItem("erp_memorandos", JSON.stringify(memorandos));
  localStorage.setItem("erp_espelhos", JSON.stringify(espelhos));
  localStorage.setItem("erp_holerites", JSON.stringify(holerites));
  localStorage.setItem("erp_sindicatos", JSON.stringify(sindicatos));
  localStorage.setItem("erp_ferias", JSON.stringify(ferias));
}

export async function fetchEspelhos(): Promise<Espelho[]> {
  try {
    const res = await fetch(`${API_BASE}/api/espelhos`);
    if (!res.ok) throw new Error("Erro ao buscar espelhos de ponto");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_espelhos");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveEspelho(espelho: Espelho): Promise<Espelho> {
  const res = await fetch(`${API_BASE}/api/espelhos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(espelho),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar espelho de ponto");
  }
  return await res.json();
}

export async function deleteEspelho(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/espelhos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir espelho de ponto");
  }
  return true;
}

export async function fetchHolerites(): Promise<Holerite[]> {
  try {
    const res = await fetch(`${API_BASE}/api/holerites`);
    if (!res.ok) throw new Error("Erro ao buscar holerites");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_holerites");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveHolerite(holerite: Holerite): Promise<Holerite> {
  const res = await fetch(`${API_BASE}/api/holerites`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(holerite),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar holerite");
  }
  return await res.json();
}

export async function deleteHolerite(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/holerites/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir holerite");
  }
  return true;
}

export async function fetchSindicatos(): Promise<Sindicato[]> {
  try {
    const res = await fetch(`${API_BASE}/api/sindicatos`);
    if (!res.ok) throw new Error("Erro ao buscar sindicatos");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_sindicatos");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveSindicato(sindicato: Sindicato): Promise<Sindicato> {
  const res = await fetch(`${API_BASE}/api/sindicatos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(sindicato),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar cadastro do sindicato");
  }
  return await res.json();
}

export async function deleteSindicato(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/sindicatos/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir cadastro do sindicato");
  }
  return true;
}

export async function fetchFerias(): Promise<Ferias[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ferias`);
    if (!res.ok) throw new Error("Erro ao buscar férias");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_ferias");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveFerias(ferias: Ferias): Promise<Ferias> {
  const res = await fetch(`${API_BASE}/api/ferias`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(ferias),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar férias");
  }
  return await res.json();
}

export async function deleteFerias(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/ferias/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir férias");
  }
  return true;
}

// ==========================================
// Módulo À Disposição (Disponibilidade e Gestão de Mobilização)
// ==========================================

export async function fetchDisponibilidades(): Promise<DisponibilidadeColaborador[]> {
  try {
    const res = await fetch(`${API_BASE}/api/disponibilidades`);
    if (!res.ok) throw new Error("Erro ao buscar disponibilidades");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_disponibilidades");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveDisponibilidade(disp: DisponibilidadeColaborador): Promise<DisponibilidadeColaborador> {
  const res = await fetch(`${API_BASE}/api/disponibilidades`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(disp),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao registrar disponibilidade");
  }
  return await res.json();
}

export async function updateDisponibilidade(id: string, disp: Partial<DisponibilidadeColaborador>): Promise<DisponibilidadeColaborador> {
  const res = await fetch(`${API_BASE}/api/disponibilidades/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(disp),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao atualizar disponibilidade");
  }
  return await res.json();
}

export async function transferirDisponibilidade(
  id: string,
  payload: { projetoDestino: string; dataTransferencia: string; responsavel: string; observacao?: string }
): Promise<DisponibilidadeColaborador> {
  const res = await fetch(`${API_BASE}/api/disponibilidades/${id}/transferir`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao efetivar transferência");
  }
  return await res.json();
}

export async function deleteDisponibilidade(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/disponibilidades/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir disponibilidade");
  }
  return true;
}

// ==========================================
// Módulo Observações Inteligentes
// ==========================================

export async function fetchObservacoes(): Promise<ObservacaoColaborador[]> {
  try {
    const res = await fetch(`${API_BASE}/api/observacoes`);
    if (!res.ok) throw new Error("Erro ao buscar observações");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_observacoes");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveObservacao(obs: ObservacaoColaborador): Promise<ObservacaoColaborador> {
  const res = await fetch(`${API_BASE}/api/observacoes`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(obs),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar observação");
  }
  return await res.json();
}

export async function updateObservacao(id: string, obs: Partial<ObservacaoColaborador>): Promise<ObservacaoColaborador> {
  const res = await fetch(`${API_BASE}/api/observacoes/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(obs),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao atualizar observação");
  }
  return await res.json();
}

export async function deleteObservacao(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/observacoes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao excluir observação");
  }
  return true;
}

// ==========================================
// Configuração de Custos (Parâmetros)
// ==========================================

export async function fetchConfigCustos(): Promise<ConfiguracaoCustos> {
  try {
    const res = await fetch(`${API_BASE}/api/config-custos`);
    if (!res.ok) throw new Error("Erro ao buscar parâmetros de custo");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_config_custos");
    return local ? JSON.parse(local) : {
      id: "default",
      encargosAdicionaisPct: 0,
      beneficiosMensalPadrao: 800,
      outrosCustosMensalPadrao: 400,
      salarioBasePadraoFallback: 0,
    };
  }
}

export async function saveConfigCustos(cfg: ConfiguracaoCustos): Promise<ConfiguracaoCustos> {
  const res = await fetch(`${API_BASE}/api/config-custos`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(cfg),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao salvar parâmetros de custo");
  }
  return await res.json();
}

// ==========================================
// Logs e Auditoria do Sistema
// ==========================================

export async function fetchLogs(): Promise<AuditLog[]> {
  try {
    const res = await fetch(`${API_BASE}/api/logs`);
    if (!res.ok) throw new Error("Erro ao buscar logs de auditoria");
    return await res.json();
  } catch (err) {
    const local = localStorage.getItem("erp_logs");
    return local ? JSON.parse(local) : [];
  }
}

export async function saveAuditLog(log: {
  modulo: AuditLog["modulo"];
  acao: AuditLog["acao"];
  descricao: string;
  matricula?: string;
  nomeColaborador?: string;
  detalhes?: any;
}): Promise<AuditLog> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(log),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Erro ao registrar log");
  }
  return await res.json();
}

export async function deleteAuditLog(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/logs/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Erro ao excluir log");
  }
  return true;
}

