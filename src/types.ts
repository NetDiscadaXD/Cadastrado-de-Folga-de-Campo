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
  status?: 'Ativo' | 'Inativo' | 'Demitido' | 'Desmobilizado'; // Status ocupacional
  dataDemissao?: string; // Data da demissão YYYY-MM-DD (rescisão contratual)
  motivoDemissao?: string; // Motivo da demissão (ex: Sem justa causa, Com justa causa, Pedido de demissão)
  dataInativacao?: string; // Data de inativação YYYY-MM-DD
  dataDesmobilizacao?: string; // Data de desmobilização do canteiro/obra YYYY-MM-DD
  motivoDesmobilizacao?: string; // Motivo / Observação da desmobilização (obrigatório ao preencher data)
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
  projetoOrigem?: string; // Projeto de onde o colaborador foi transferido (usado no rateio de férias)
  salarioBase?: number; // Valor bruto mensal (R$) já com encargos inclusos, usado no cálculo de férias
  situacao?: 'Ativo' | 'Férias' | 'À disposição' | 'Afastado' | 'Licença-maternidade' | 'Desmobilizado' | 'Demitido';
  motivoAfastamento?: string; // Ex: INSS / Auxílio Doença, Acidente de Trabalho, Licença Maternidade, etc.
  dataInicioAfastamento?: string; // YYYY-MM-DD
  dataPrevisaoRetorno?: string; // YYYY-MM-DD
  creditoFeriasAcumulado?: number; // Saldo de dias de crédito de férias a que o colaborador tem direito
  projetoDevidoCredito?: string; // Projeto que é devido desse crédito de férias (responsável pelo custo)
}

/**
 * Férias do colaborador. Guarda apenas os dados informados; o rateio de custo entre
 * projeto de origem e projeto atual é sempre calculado por src/utils/ferias.ts.
 */
export interface Ferias {
  id: string;
  matricula: string;
  paInicio: string; // Início do período aquisitivo YYYY-MM-DD
  paFim: string; // Fim do período aquisitivo YYYY-MM-DD
  feriasInicio: string; // Início do gozo YYYY-MM-DD
  feriasFim: string; // Fim do gozo YYYY-MM-DD
  tipoLancamento?: 'nova' | 'credito'; // 'nova' = Nova Férias (período aquisitivo padrão), 'credito' = Utilizar Crédito de Férias
  creditoFerias?: number; // Crédito de férias (saldo de dias a que a pessoa tinha direito para retirar, padrão 30)
  projetoDevido?: string; // Projeto devido referente ao crédito de férias (devedor do custo)
  saldoRestante?: number; // Saldo restante após a retirada
  diasAbono: number; // Dias vendidos (abono pecuniário), 0 a 10
  salarioBase: number; // Valor bruto mensal (R$) já com encargos inclusos
  encargosPct: number; // Percentual de encargos adicionais/extras (padrão 0%, pois o valor já é bruto com encargos)
  incluirTerco?: boolean; // Se inclui 1/3 constitucional sobre o gozo e abono (padrão true)
  projetoOrigem: string; // Projeto de origem (snapshot no momento do lançamento)
  projetoAtual: string; // Projeto atual (snapshot no momento do lançamento)
  dataInicioCanteiro: string; // Início no canteiro atual YYYY-MM-DD (base do rateio)
  observacao?: string;
  dataCriacao: string; // YYYY-MM-DD
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
  dataInicioFerias?: string; // Data de início das férias vinculada ao memorando de folga de campo (YYYY-MM-DD)
  diasFerias?: number; // Duração prevista das férias em dias (ex: 15, 20, 30)

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

/**
 * Módulo À Disposição (Disponibilidade e Gestão de Mobilização)
 */
export type StatusDisponibilidade =
  | 'Disponibilidade programada'
  | 'À disposição'
  | 'Em negociação'
  | 'Transferido'
  | 'Encerrado/cancelado';

export interface HistoricoMovimentacao {
  id: string;
  dataHora: string; // ISO string
  autor: string;
  acao: string; // ex: "Cadastro de disponibilidade", "Início de negociação", "Transferência efetivada", "Alteração de status"
  detalhe?: string;
  projetoOrigem?: string;
  projetoDestino?: string;
}

export interface DisponibilidadeColaborador {
  id: string;
  matricula: string;
  nomeColaborador?: string;
  funcao?: string;
  projetoOrigem: string;
  dataLiberacao: string; // YYYY-MM-DD
  dataDisponibilidade: string; // YYYY-MM-DD (data efetiva a partir da qual fica disponível)
  motivoLiberacao: string; // Fim de fase de obra, Conclusão de escopo, Desmobilização parcial, Otimização de equipe, Outro
  projetoDestino?: string; // Projeto de destino quando em negociação ou transferido
  dataTransferencia?: string; // YYYY-MM-DD quando transferido
  responsavel: string; // Responsável pelo cadastro / registro
  status: StatusDisponibilidade;
  observacoes?: string;
  dataCriacao: string; // ISO string
  dataAtualizacao: string; // ISO string
  historico?: HistoricoMovimentacao[];
}

/**
 * Módulo Observações Inteligentes
 */
export type CategoriaObservacao =
  | 'À disposição e transferência'
  | 'Mobilização e documentação'
  | 'Folga de campo'
  | 'Férias e descanso'
  | 'Saúde ocupacional e exames'
  | 'Segurança e portaria'
  | 'Desempenho e conduta'
  | 'Custos e benefícios'
  | 'Transporte e hospedagem'
  | 'Administrativo'
  | 'Outros';

export interface HistoricoAlteracaoObservacao {
  dataHora: string; // ISO string
  autor: string;
  alteracao: string;
  categoriaAnterior?: string;
  categoriaNova?: string;
}

export interface ObservacaoColaborador {
  id: string;
  matricula: string;
  nomeColaborador?: string;
  funcao?: string;
  projeto?: string;
  conteudo: string; // Conteúdo integral
  categoriaSugerida: CategoriaObservacao;
  categoriaConfirmada: CategoriaObservacao;
  autor: string; // Autor confiável do registro
  dataHora: string; // ISO string
  dataHoraAtualizacao?: string; // ISO string
  historicoAlteracoes?: HistoricoAlteracaoObservacao[];
}

/**
 * Configuração de Custos para Colaboradores sem alocação
 */
export interface ConfiguracaoCustos {
  id?: string;
  encargosAdicionaisPct: number; // % encargos adicionais (padrão 0%, pois o valor cadastrado já inclui encargos)
  beneficiosMensalPadrao: number; // R$/mês padrão de benefícios (VR, VA, Plano de saúde)
  outrosCustosMensalPadrao: number; // R$/mês padrão de outros custos recorrentes (alojamento, infra)
  salarioBasePadraoFallback: number; // R$/mês caso colaborador não tenha salário informado
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/**
 * Sistema Centralizado de Log de Auditoria de Ações do ERP
 */
export type ModuloSistema =
  | 'Espelhos'
  | 'Memorandos'
  | 'Observações'
  | 'Férias'
  | 'Colaboradores'
  | 'ASO'
  | 'Treinamentos'
  | 'Folgas e Viagens'
  | 'Bloqueios de Crachá'
  | 'Holerites'
  | 'Sindicatos'
  | 'Disponibilidade'
  | 'Configurações'
  | 'Sistema';

export type TipoAcaoLog =
  | 'Inclusão'
  | 'Edição'
  | 'Exclusão'
  | 'Liberação / Desbloqueio'
  | 'Upload de Documento'
  | 'Transferência'
  | 'Importação';

export interface AuditLog {
  id: string;
  dataHora: string; // ISO string e.g. "2026-10-20T09:26:13.000Z"
  usuario: string; // Quem executou a ação
  modulo: ModuloSistema;
  acao: TipoAcaoLog;
  matricula?: string;
  nomeColaborador?: string;
  descricao: string;
  detalhes?: Record<string, any> | string;
}

