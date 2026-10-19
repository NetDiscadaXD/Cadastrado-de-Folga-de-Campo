/**
 * Shared Type Definitions for the ERP Gestão de RH e Operações de Campo
 */

export interface Colaborador {
  matricula: string; // Chave Primária
  nomeCompleto: string;
  funcao: string;
  dataAdmissao: string; // YYYY-MM-DD
  cpf: string;
  tipoMaoDeObra: 'MOI' | 'MOD';
  cidade: string;
  estado: string;
  regimeTrabalho: 'Alojado' | 'Local';
  dataInicioProjeto: string; // YYYY-MM-DD
  transferido: boolean;
  projetoAtual: string; // "Nome do Projeto Atual" se transferido === true, caso contrário valor padrão
  fotoUrl?: string; // Foto opcional do colaborador
  status?: 'Ativo' | 'Inativo'; // Status ocupacional
  dataInativacao?: string; // Data de inativação YYYY-MM-DD
  dataLiberacaoCracha?: string; // Data de liberação de crachá YYYY-MM-DD
  bloqueioCliente?: boolean; // Se está bloqueado pelo cliente
  dataBloqueioCliente?: string; // Data de bloqueio de cliente YYYY-MM-DD
  motivoBloqueioCliente?: string; // Motivo do bloqueio de cliente
  observacao?: string; // Observações / Restrições do colaborador (ex: "Restrição Aura")
  desbloqueioCliente?: boolean; // Se foi desbloqueado pelo cliente
  dataDesbloqueioCliente?: string; // Data de desbloqueio do cliente YYYY-MM-DD
  motivoDesbloqueioCliente?: string; // Motivo de desbloqueio do cliente
  dataTreinamentoAura?: string; // Data de início do treinamento introdutório Aura YYYY-MM-DD
  matriculaAura?: string; // Matrícula Aura (campo preenchido pelo usuário)
}

export interface ASO {
  id?: string;
  matricula: string;
  tipoExame: string;
  dataRealizacao: string; // YYYY-MM-DD
  validadeMeses: number; // e.g. 6, 12, 24
}

export interface Treinamento {
  id: string;
  matricula: string;
  nomeTreinamento: string; // Ex: NR-10, NR-35, Integração
  dataRealizacao: string; // YYYY-MM-DD
  periodicidade: '1 ANO' | '2 ANOS' | '5 ANOS';
}

export interface Viagem {
  id: string;
  matricula: string;
  dataRealInicio: string; // YYYY-MM-DD
  dataRealRetorno: string; // YYYY-MM-DD
  tipoTransporte: 'Aéreo' | 'Terrestre';
  valorPassagem: number;
  adiantamento: number;
  dataDeposito?: string; // YYYY-MM-DD
  anexoPassagemUrl?: string; // Data URL or storage link
  anexoPassagemNome?: string;
  anexoAdiantamentoUrl?: string; // Data URL or storage link
  anexoAdiantamentoNome?: string;
  vendeuFolga?: boolean;
  dataVendaFolga?: string; // YYYY-MM-DD
  valorVendaFolga?: number;
  anexoVendaFolgaUrl?: string; // Data URL or storage link
  anexoVendaFolgaNome?: string;
}

export interface BloqueioCracha {
  id: string;
  matricula: string;
  origem: 'ASO' | 'Treinamento';
  dataBloqueio: string; // YYYY-MM-DD
  motivoDetalhado: string;
  tipoTreinamentoPendente?: string;
  dataLiberacao?: string; // Se preenchido, indica crachá desbloqueado
  dataRealizacao?: string; // Data real de realização do exame/treinamento correspondente
  tipoExame?: string; // Exame associado ao bloqueio
  validadeMeses?: number; // Validade associada ao ASO bloqueado
}

export interface Memorando {
  id: string;
  matricula: string;
  nomeColaborador: string;
  tipoMemorando: "Folga de campo" | "Venda de Folga";
  passagemOk: boolean;
  passagemOkAt?: string; // Data e hora do checkin
  adiantamentoOk: boolean;
  adiantamentoOkAt?: string; // Data e hora do checkin
  envioSedeOk: boolean;
  envioSedeOkAt?: string; // Data e hora do checkin
  finalizada: boolean;
  finalizadaAt?: string; // Data e hora do checkin

  // Para Venda de Folga de Campo
  arquivoGeradoOk?: boolean;
  arquivoGeradoAt?: string; // Data e hora do checkin
  anexadoFolhaOk?: boolean;
  anexadoFolhaAt?: string; // Data e hora do checkin

  // Informações para Folga de Campo
  dataSaida?: string;
  dataRetorno?: string;
  retornoTrabalho?: string;
  destino?: string;
  tipoPassagem?: "Terrestre" | "Aérea" | "Carro";

  // Anexo de Documento
  anexoNome?: string;
  anexoConteudo?: string; // Base64 data URI

  dataCriacao: string; // YYYY-MM-DD
  observacao?: string;
}

export interface Espelho {
  id: string;
  matricula: string;
  mes: string; // Ex: "Janeiro", "Fevereiro", ..., "Dezembro"
  ano: number; // Ex: 2026
  fileName: string;
  fileUrl?: string; // drive URL or proxy link
  driveFileId?: string;
  driveFolderId?: string;
  dataUpload: string; // YYYY-MM-DD
  tipoIsencao?: 'nao_bate_ponto' | 'admitido_no_mes';
}

export interface Holerite {
  id: string;
  matricula: string;
  mes: string; // Ex: "Janeiro", "Fevereiro", ..., "Dezembro"
  ano: number; // Ex: 2026
  fileName: string;
  fileUrl?: string; // drive URL or proxy link
  driveFileId?: string;
  driveFolderId?: string;
  dataUpload: string; // YYYY-MM-DD
  tipoIsencao?: 'nao_recebe_holerite' | 'admitido_no_mes' | string;
}

export interface Sindicato {
  id: string;
  matricula: string;
  fileName: string;
  fileUrl?: string; // drive URL or proxy link
  driveFileId?: string;
  driveFolderId?: string;
  dataUpload: string; // YYYY-MM-DD
}

// Resumos / Métricas Calculadas
export interface DashboardStats {
  totalAtivos: number;
  totalMOI: number;
  totalMOD: number;
  totalASOVencido: number;
  totalTreinamentoPendente: number; // Vencidos ou a vencer em menos de 30 dias
  totalCrachasBloqueados: number;
}
