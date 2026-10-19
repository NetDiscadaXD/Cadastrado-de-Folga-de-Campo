import * as XLSX from "xlsx";

/**
 * Utility function to export JSON arrays to beautifully formatted Excel sheets
 */
export function exportToExcel(data: any[], fileName: string, sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Normalizes an Excel date serial or string input into YYYY-MM-DD
 */
export function parseExcelDate(value: any): string {
  if (value === undefined || value === null || value === "") return "";
  
  // 1. If it's a number (Excel internal date representation)
  if (typeof value === "number") {
    // 1900-01-01 is epoch, but Excel has a bug treating 1900 as leap year.
    // 30 Dec 1899 is the standard base for corrected epoch math
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const msInDay = 24 * 60 * 60 * 1000;
    const targetDate = new Date(excelEpoch.getTime() + value * msInDay);
    
    const yyyy = targetDate.getUTCFullYear();
    const mm = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 2. If it's a direct Date instance
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // 3. If it's a string
  if (typeof value === "string") {
    const clean = value.trim();
    
    // DD/MM/AAAA or DD-MM-AAAA
    const dmyMatch = clean.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // AAAA-MM-DD or AAAA/MM/DD
    const isoMatch = clean.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  return String(value);
}

/**
 * Formats dirty values into correct CPF string representation 000.000.000-00
 */
export function formatCPF(raw: any): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length !== 11) return String(raw);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Downloads a pre-formatted Excel template for importing records
 */
export function downloadTemplate(type: "cadastro" | "aso" | "treinamento" | "viagem") {
  let headers: string[] = [];
  let sampleRows: any[] = [];
  let fileName = "";
  let sheetName = "";

  if (type === "cadastro") {
    fileName = "Modelo_Importacao_Colaboradores";
    sheetName = "Colaboradores";
    headers = [
      "Matricula",
      "Nome Completo",
      "CPF",
      "Funcao",
      "Data de Admissao",
      "Mao de Obra (MOI/MOD)",
      "Regime de Trabalho (Local/Alojado)",
      "Cidade",
      "Estado (UF)",
      "Inicio do Projeto",
      "Transferido (Sim/Nao)",
      "Projeto Atual"
    ];
    sampleRows = [
      {
        "Matricula": "COL-2001",
        "Nome Completo": "Reginaldo de Souza Lira",
        "CPF": "123.456.789-10",
        "Funcao": "Ajudante de Campo",
        "Data de Admissao": "10/05/2025",
        "Mao de Obra (MOI/MOD)": "MOD",
        "Regime de Trabalho (Local/Alojado)": "Alojado",
        "Cidade": "Petrolina",
        "Estado (UF)": "PE",
        "Inicio do Projeto": "12/05/2025",
        "Transferido (Sim/Nao)": "Nao",
        "Projeto Atual": "Projeto Aura Borborema Filtragem - Currais Novos"
      },
      {
        "Matricula": "COL-2002",
        "Nome Completo": "Geraldo Ferreira Neto",
        "CPF": "987.654.321-20",
        "Funcao": "Eletricista de Força",
        "Data de Admissao": "15/05/2025",
        "Mao de Obra (MOI/MOD)": "MOD",
        "Regime de Trabalho (Local/Alojado)": "Local",
        "Cidade": "Juazeiro",
        "Estado (UF)": "BA",
        "Inicio do Projeto": "18/05/2025",
        "Transferido (Sim/Nao)": "Sim",
        "Projeto Atual": "Projeto Aura Borborema Filtragem - Currais Novos"
      }
    ];
  } else if (type === "aso") {
    fileName = "Modelo_Importacao_ASO";
    sheetName = "ASOs";
    headers = [
      "Matricula",
      "Tipo de Exame",
      "Data de Realizacao",
      "Validade em Meses"
    ];
    sampleRows = [
      {
        "Matricula": "COL-1001",
        "Tipo de Exame": "Periódico",
        "Data de Realizacao": "15/12/2025",
        "Validade em Meses": 12
      },
      {
        "Matricula": "COL-1002",
        "Tipo de Exame": "Admissional",
        "Data de Realizacao": "20/03/2026",
        "Validade em Meses": 12
      }
    ];
  } else if (type === "treinamento") {
    fileName = "Modelo_Importacao_Treinamentos";
    sheetName = "Treinamentos";
    headers = [
      "Matricula",
      "Nome do Treinamento",
      "Data de Realizacao",
      "Periodicidade (1 ANO / 2 ANOS / 5 ANOS)"
    ];
    sampleRows = [
      {
        "Matricula": "COL-1001",
        "Nome do Treinamento": "NR-35 Trabalho em Altura",
        "Data de Realizacao": "15/06/2025",
        "Periodicidade (1 ANO / 2 ANOS / 5 ANOS)": "2 ANOS"
      },
      {
        "Matricula": "COL-1002",
        "Nome do Treinamento": "Integração de Segurança de Campo",
        "Data de Realizacao": "01/05/2026",
        "Periodicidade (1 ANO / 2 ANOS / 5 ANOS)": "1 ANO"
      }
    ];
  } else if (type === "viagem") {
    fileName = "Modelo_Importacao_Viagens";
    sheetName = "Viagens";
    headers = [
      "Matricula",
      "Data Real de Inicio",
      "Data Real de Retorno",
      "Tipo de Transporte (Aereo/Terrestre)",
      "Valor da Passagem",
      "Adiantamento",
      "Data de Deposito"
    ];
    sampleRows = [
      {
        "Matricula": "COL-1001",
        "Data Real de Inicio": "20/03/2026",
        "Data Real de Retorno": "27/03/2026",
        "Tipo de Transporte (Aereo/Terrestre)": "Aéreo",
        "Valor da Passagem": 1250.50,
        "Adiantamento": 500.00,
        "Data de Deposito": "22/03/2026"
      },
      {
        "Matricula": "COL-1002",
        "Data Real de Inicio": "01/05/2026",
        "Data Real de Retorno": "12/05/2026",
        "Tipo de Transporte (Aereo/Terrestre)": "Terrestre",
        "Valor da Passagem": 450.00,
        "Adiantamento": 300.00,
        "Data de Deposito": ""
      }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
