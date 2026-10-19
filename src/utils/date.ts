/**
 * Date helpers for ERP Gestão de RH e Operações de Campo
 */

// Adiciona dias a uma data (formato YYYY-MM-DD) de forma segura contra fusos horários
export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

// Adiciona meses a uma data (formato YYYY-MM-DD) de forma segura contra fusos horários
export function addMonths(dateStr: string, months: number): string {
  if (!dateStr) return "";
  const date = new Date(dateStr + "T12:00:00");
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split("T")[0];
}

// Retorna a quantidade de dias entre duas datas (YYYY-MM-DD)
export function diffDays(dateStrStart: string, dateStrEnd: string): number {
  if (!dateStrStart || !dateStrEnd) return 0;
  const d1 = new Date(dateStrStart + "T12:00:00");
  const d2 = new Date(dateStrEnd + "T12:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  const diffDaysFloat = diffTime / (1000 * 60 * 60 * 24);
  return Math.round(diffDaysFloat);
}

// Verifica se uma data de vencimento (YYYY-MM-DD) já expirou baseado no dia atual
export function isVencido(dateVencimentoStr: string): boolean {
  if (!dateVencimentoStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const venc = new Date(dateVencimentoStr + "T00:00:00");
  return venc < today;
}

// Verifica se uma data de vencimento (YYYY-MM-DD) está a menos de 30 dias de expirar
// (E que não está vencido ainda, ou opcionalmente inclui já vencidos)
export function isAvisoTrintaDias(dateVencimentoStr: string): boolean {
  if (!dateVencimentoStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const venc = new Date(dateVencimentoStr + "T00:00:00");
  const diffTime = venc.getTime() - today.getTime();
  const diffDaysVal = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDaysVal >= 0 && diffDaysVal < 30;
}

// Formata data brasileira (DD/MM/AAAA)
export function formatBrDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Formata valor de moeda brasileira (R$)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}
