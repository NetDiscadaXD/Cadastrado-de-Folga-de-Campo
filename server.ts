import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Colaborador, ASO, Treinamento, Viagem, BloqueioCracha, Memorando, Espelho, Holerite, Sindicato, Ferias } from "./src/types";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";

// Inicializa o Firebase / Firestore para persistência em nuvem durável e multiusuário
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const firestoreDbId = firebaseConfig.firestoreDatabaseId || "ai-studio-be3d76e1-adc6-4296-b7a0-159542cfd91b";
console.log(`[Firestore] Inicializando conexão com o banco de dados id: ${firestoreDbId}`);
const dbFirestore = getFirestore(firebaseApp, firestoreDbId);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DB_FILE = path.join(process.cwd(), "database.json");

interface DatabaseSchema {
  colaboradores: Colaborador[];
  asos: ASO[];
  treinamentos: Treinamento[];
  viagens: Viagem[];
  bloqueios: BloqueioCracha[];
  memorandos: Memorando[];
  espelhos: Espelho[];
  holerites: Holerite[];
  sindicatos: Sindicato[];
  ferias: Ferias[];
}

const DEFAULT_DB: DatabaseSchema = {
  colaboradores: [
    {
      matricula: "COL-1001",
      nomeCompleto: "Carlos Henrique Silva",
      funcao: "Encarregado de Linha",
      dataAdmissao: "2025-01-10",
      cpf: "123.456.789-00",
      tipoMaoDeObra: "MOI",
      cidade: "Salvador",
      estado: "BA",
      regimeTrabalho: "Alojado",
      dataInicioProjeto: "2026-01-15",
      transferido: false,
      projetoAtual: "Parque Solar Sertão"
    },
    {
      matricula: "COL-1002",
      nomeCompleto: "Roberto Santos Souza",
      funcao: "Eletricista Montador",
      dataAdmissao: "2025-03-20",
      cpf: "987.654.321-11",
      tipoMaoDeObra: "MOD",
      cidade: "Juazeiro",
      estado: "BA",
      regimeTrabalho: "Alojado",
      dataInicioProjeto: "2026-02-10",
      transferido: true,
      projetoAtual: "Parque Eólico Ventos do Sul"
    },
    {
      matricula: "COL-1003",
      nomeCompleto: "Ana Paula Oliveira",
      funcao: "Engenheira de Planejamento",
      dataAdmissao: "2024-06-15",
      cpf: "456.789.123-22",
      tipoMaoDeObra: "MOI",
      cidade: "Belo Horizonte",
      estado: "MG",
      regimeTrabalho: "Local",
      dataInicioProjeto: "2025-10-01",
      transferido: false,
      projetoAtual: "Parque Solar Sertão"
    },
    {
      matricula: "COL-1004",
      nomeCompleto: "Marcos Antonio Bezerra",
      funcao: "Montador de Estruturas",
      dataAdmissao: "2025-05-01",
      cpf: "321.654.987-44",
      tipoMaoDeObra: "MOD",
      cidade: "Petrolina",
      estado: "PE",
      regimeTrabalho: "Alojado",
      dataInicioProjeto: "2026-03-01",
      transferido: false,
      projetoAtual: "Parque Solar Sertão"
    },
    {
      matricula: "COL-1005",
      nomeCompleto: "Amanda Lima Guedes",
      funcao: "Técnica de Qualidade",
      dataAdmissao: "2025-08-12",
      cpf: "789.123.456-55",
      tipoMaoDeObra: "MOD",
      cidade: "Goiânia",
      estado: "GO",
      regimeTrabalho: "Local",
      dataInicioProjeto: "2026-01-20",
      transferido: false,
      projetoAtual: "Subestação Norte"
    }
  ],
  asos: [
    {
      matricula: "COL-1001",
      tipoExame: "Periódico",
      dataRealizacao: "2025-12-10",
      validadeMeses: 12
    },
    {
      matricula: "COL-1002",
      tipoExame: "Admissional",
      dataRealizacao: "2025-03-20",
      validadeMeses: 12
    },
    {
      matricula: "COL-1004",
      tipoExame: "Periódico",
      dataRealizacao: "2025-05-15",
      validadeMeses: 6
    }
  ],
  treinamentos: [
    {
      id: "T-001",
      matricula: "COL-1001",
      nomeTreinamento: "NR-10 Segurança em Instalações",
      dataRealizacao: "2025-06-15",
      periodicidade: "2 ANOS"
    },
    {
      id: "T-002",
      matricula: "COL-1002",
      nomeTreinamento: "NR-35 Trabalho em Altura",
      dataRealizacao: "2026-05-01",
      periodicidade: "1 ANO"
    },
    {
      id: "T-003",
      matricula: "COL-1003",
      nomeTreinamento: "Integração Geral SMS",
      dataRealizacao: "2025-10-01",
      periodicidade: "5 ANOS"
    }
  ],
  viagens: [
    {
      id: "V-001",
      matricula: "COL-1001",
      dataRealInicio: "2026-03-20",
      dataRealRetorno: "2026-03-27",
      tipoTransporte: "Aéreo",
      valorPassagem: 1250.50,
      adiantamento: 500.00
    },
    {
      id: "V-002",
      matricula: "COL-1002",
      dataRealInicio: "2026-05-01",
      dataRealRetorno: "2026-05-12",
      tipoTransporte: "Terrestre",
      valorPassagem: 450.00,
      adiantamento: 300.00
    }
  ],
  bloqueios: [
    {
      id: "B-001",
      matricula: "COL-1004",
      origem: "ASO",
      dataBloqueio: "2026-06-01",
      motivoDetalhado: "ASO Vencido há mais de 15 dias. Pendente realização de exame de eeg/ecg.",
      tipoTreinamentoPendente: "",
      dataLiberacao: ""
    }
  ],
  memorandos: [],
  espelhos: [],
  holerites: [],
  sindicatos: [],
  ferias: []
};

// Cache em memória para acesso síncrono ultra-rápido nas rotas Express
let cachedDb: DatabaseSchema | null = null;

// Helpers de Persistência no Firestore
async function persistItemToFirestore(collectionName: string, id: string, data: any) {
  try {
    const docRef = doc(dbFirestore, collectionName, id);
    await setDoc(docRef, data);
    console.log(`[Firestore] Documento ${id} salvo com sucesso na coleção "${collectionName}".`);
  } catch (err) {
    console.error(`[Firestore Error] Erro ao persistir ${id} em "${collectionName}":`, err);
  }
}

async function deleteItemFromFirestore(collectionName: string, id: string) {
  try {
    const docRef = doc(dbFirestore, collectionName, id);
    await deleteDoc(docRef);
    console.log(`[Firestore] Documento ${id} removido com sucesso da coleção "${collectionName}".`);
  } catch (err) {
    console.error(`[Firestore Error] Erro ao remover ${id} de "${collectionName}":`, err);
  }
}

// Semeia o Firestore com dados padrão caso esteja zerado
async function seedDefaultData(db: DatabaseSchema) {
  try {
    console.log("[Firestore] Semeando dados padrão iniciais nas coleções...");
    const collections = [
      { name: "colaboradores", items: db.colaboradores, keyField: "matricula" },
      { name: "asos", items: db.asos, keyField: "id" },
      { name: "treinamentos", items: db.treinamentos, keyField: "id" },
      { name: "viagens", items: db.viagens, keyField: "id" },
      { name: "bloqueios", items: db.bloqueios, keyField: "id" },
      { name: "memorandos", items: db.memorandos || [], keyField: "id" },
      { name: "espelhos", items: db.espelhos || [], keyField: "id" },
      { name: "holerites", items: db.holerites || [], keyField: "id" },
      { name: "sindicatos", items: db.sindicatos || [], keyField: "id" },
      { name: "ferias", items: db.ferias || [], keyField: "id" }
    ];

    for (const col of collections) {
      for (const item of col.items) {
        const key = String((item as any)[col.keyField]);
        await persistItemToFirestore(col.name, key, item);
      }
    }
    console.log("[Firestore] Semeamento inicial executado com sucesso!");
  } catch (err) {
    console.error("[Firestore Error] Erro durante o semeamento inicial:", err);
  }
}

// Sincroniza dados do Firestore para inicializar a aplicação
export async function syncFromFirestore(): Promise<DatabaseSchema> {
  console.log("[Firestore] Sincronizando banco de dados na inicialização do servidor...");
  const schema: DatabaseSchema = {
    colaboradores: [],
    asos: [],
    treinamentos: [],
    viagens: [],
    bloqueios: [],
    memorandos: [],
    espelhos: [],
    holerites: [],
    sindicatos: [],
    ferias: []
  };

  let localBackup: any = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      localBackup = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    } catch (e) {
      console.warn("[Firestore Warning] Não foi possível carregar backup local para contingência:", e);
    }
  }

  try {
    const collectionsToSync = [
      { name: "colaboradores", keyField: "matricula" },
      { name: "asos", keyField: "id" },
      { name: "treinamentos", keyField: "id" },
      { name: "viagens", keyField: "id" },
      { name: "bloqueios", keyField: "id" },
      { name: "memorandos", keyField: "id" },
      { name: "espelhos", keyField: "id" },
      { name: "holerites", keyField: "id" },
      { name: "sindicatos", keyField: "id" },
      { name: "ferias", keyField: "id" }
    ];

    let hasAnyData = false;

    await Promise.all(collectionsToSync.map(async (colInfo) => {
      try {
        const colRef = collection(dbFirestore, colInfo.name);
        const snapshot = await getDocs(colRef);
        const items: any[] = [];
        snapshot.forEach((doc) => {
          if (colInfo.name === "colaboradores" && doc.id === "gdrive_credentials_active") {
            return;
          }
          items.push(doc.data());
        });
        
        if (items.length > 0) {
          hasAnyData = true;
          (schema as any)[colInfo.name] = items;
        } else {
          // Firestore collection is empty, check if we have local backup to preserve historical data
          if (localBackup && Array.isArray(localBackup[colInfo.name]) && localBackup[colInfo.name].length > 0) {
            console.log(`[Firestore Redundancy] Coleção em nuvem "${colInfo.name}" vazia. Restaurando ${localBackup[colInfo.name].length} registros do backup local.`);
            (schema as any)[colInfo.name] = localBackup[colInfo.name];
            hasAnyData = true;
            
            // Asynchronously populate Firestore with the restored local records
            for (const item of localBackup[colInfo.name]) {
              const key = String((item as any)[colInfo.keyField] || item.id || item.matricula);
              persistItemToFirestore(colInfo.name, key, item).catch(err => {
                console.error(`[Firestore Auto-Sync Error] Erro ao sincronizar item de "${colInfo.name}":`, err);
              });
            }
          } else {
            (schema as any)[colInfo.name] = [];
          }
        }
      } catch (err: any) {
        console.warn(`[Firestore Warning] Falha ao sincronizar coleção "${colInfo.name}":`, err.message);
        // Contingência híbrida de dados local / cloud
        if (localBackup && Array.isArray(localBackup[colInfo.name])) {
          console.log(`[Firestore Redundancy] Usando dados locais salvos anteriormente para a coleção "${colInfo.name}".`);
          (schema as any)[colInfo.name] = localBackup[colInfo.name];
          if (localBackup[colInfo.name].length > 0) {
            hasAnyData = true;
          }
        } else {
          (schema as any)[colInfo.name] = [];
        }
      }
    }));

    if (!hasAnyData) {
      console.log("[Firestore] O banco de dados em nuvem está vazio. Iniciando semeamento padrão...");
      const dbWithIds = { ...DEFAULT_DB };
      // Garante IDs para todos os ASOs default
      dbWithIds.asos.forEach((aso, index) => {
        if (!aso.id) {
          aso.id = `ASO-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
        }
      });
      await seedDefaultData(dbWithIds);
      return dbWithIds;
    }

    console.log("[Firestore] Sincronização concluída. Registros carregados.");
    return schema;
  } catch (error) {
    console.error("[Firestore Error] Erro crítico ao sincronizar com Firestore, usando fallback local total:", error);
    if (localBackup) {
      return localBackup;
    }
    return DEFAULT_DB;
  }
}

// Sincronização diferencial em segundo plano
async function syncChangesToFirestore(oldDb: DatabaseSchema, newDb: DatabaseSchema) {
  const collectionsToSync = [
    { name: "colaboradores", keyField: "matricula" },
    { name: "asos", keyField: "id" },
    { name: "treinamentos", keyField: "id" },
    { name: "viagens", keyField: "id" },
    { name: "bloqueios", keyField: "id" },
    { name: "memorandos", keyField: "id" },
    { name: "espelhos", keyField: "id" },
    { name: "holerites", keyField: "id" },
    { name: "sindicatos", keyField: "id" },
    { name: "ferias", keyField: "id" }
  ];

  for (const col of collectionsToSync) {
    const oldList = (oldDb as any)[col.name] || [];
    const newList = (newDb as any)[col.name] || [];

    const oldMap = new Map<string, any>(oldList.map((item: any) => [String(item[col.keyField]), item]));
    const newMap = new Map<string, any>(newList.map((item: any) => [String(item[col.keyField]), item]));

    // 1. Grava ou atualiza elementos adicionados / modificados
    for (const [id, newItem] of newMap.entries()) {
      const oldItem = oldMap.get(id);
      if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        await persistItemToFirestore(col.name, id, newItem);
      }
    }

    // 2. Remove elementos deletados
    for (const id of oldMap.keys()) {
      if (!newMap.has(id)) {
        await deleteItemFromFirestore(col.name, id);
      }
    }
  }
}

// Carrega dados do arquivo ou cria um novo com dados padrão
function loadDB(): DatabaseSchema {
  if (cachedDb) {
    return JSON.parse(JSON.stringify(cachedDb));
  }

  // Fallback se chamado antes da sincronização do startServer
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      cachedDb = JSON.parse(data);
      return JSON.parse(JSON.stringify(cachedDb));
    } catch (error) {
      console.error("Erro ao ler fallback database.json:", error);
    }
  }

  const dbWithIds = { ...DEFAULT_DB };
  dbWithIds.asos.forEach((aso, index) => {
    if (!aso.id) {
      aso.id = `ASO-${Date.now()}-${index}-${Math.floor(Math.random() * 10000)}`;
    }
  });
  cachedDb = dbWithIds;
  return JSON.parse(JSON.stringify(cachedDb));
}

function writeDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");

    if (cachedDb) {
      const oldState = cachedDb;
      cachedDb = JSON.parse(JSON.stringify(data)); // Atualiza o cache imediatamente
      syncChangesToFirestore(oldState, data).catch(err => {
        console.error("[Firestore Sync Error] Falha na sincronização diferencial assíncrona:", err);
      });
    } else {
      cachedDb = JSON.parse(JSON.stringify(data));
    }
  } catch (error) {
    console.error("Erro ao escrever no banco de dados local:", error);
  }
}

// ENDPOINTS DA API

// Diagnóstico do Firestore para conferência de dados e segurança
app.get("/api/diagnostico-firestore", async (req, res) => {
  try {
    const collectionsToVerify = [
      "colaboradores", "asos", "treinamentos", "viagens", "bloqueios", "memorandos", "espelhos", "holerites", "sindicatos", "ferias"
    ];
    const resultsCustom: any = {};
    const resultsDefault: any = {};
    
    // Test custom database
    const customErrors: Record<string, string> = {};
    for (const name of collectionsToVerify) {
      try {
        const colRef = collection(dbFirestore, name);
        const snapshot = await getDocs(colRef);
        resultsCustom[name] = {
          success: true,
          count: snapshot.size,
          docs: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };
      } catch (err: any) {
        customErrors[name] = err.message;
        resultsCustom[name] = {
          success: false,
          error: err.message
        };
      }
    }

    // Test default database
    const defaultErrors: Record<string, string> = {};
    try {
      const dbDefault = getFirestore(firebaseApp);
      for (const name of collectionsToVerify) {
        try {
          const colRef = collection(dbDefault, name);
          const snapshot = await getDocs(colRef);
          resultsDefault[name] = {
            success: true,
            count: snapshot.size,
            docs: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          };
        } catch (err: any) {
          defaultErrors[name] = err.message;
          resultsDefault[name] = {
            success: false,
            error: err.message
          };
        }
      }
    } catch (err: any) {
      defaultErrors["general"] = err.message;
    }

    res.json({
      success: true,
      customDb: {
        id: firestoreDbId,
        errors: customErrors,
        data: resultsCustom
      },
      defaultDb: {
        id: "(default)",
        errors: defaultErrors,
        data: resultsDefault
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Colaboradores
app.get("/api/colaboradores", (req, res) => {
  const db = loadDB();
  res.json(db.colaboradores);
});

app.post("/api/colaboradores", (req, res) => {
  const db = loadDB();
  const novo: Colaborador = req.body;

  if (!novo.matricula || !novo.nomeCompleto) {
    return res.status(400).json({ error: "Matrícula e Nome Completo são obrigatórios." });
  }

  const index = db.colaboradores.findIndex(c => c.matricula === novo.matricula);
  if (index !== -1) {
    return res.status(400).json({ error: "Matrícula já cadastrada." });
  }

  db.colaboradores.push(novo);
  writeDB(db);
  res.status(211).json(novo);
});

app.put("/api/colaboradores/:matricula", (req, res) => {
  const db = loadDB();
  const { matricula } = req.params;
  const update: Colaborador = req.body;

  const index = db.colaboradores.findIndex(c => c.matricula === matricula);
  if (index === -1) {
    return res.status(404).json({ error: "Colaborador não encontrado." });
  }

  db.colaboradores[index] = { ...db.colaboradores[index], ...update, matricula }; // Mantém a matrícula correta
  writeDB(db);
  res.json(db.colaboradores[index]);
});

app.delete("/api/colaboradores/:matricula", (req, res) => {
  const db = loadDB();
  const { matricula } = req.params;

  const countBefore = db.colaboradores.length;
  db.colaboradores = db.colaboradores.filter(c => c.matricula !== matricula);
  
  if (db.colaboradores.length === countBefore) {
    return res.status(444).json({ error: "Colaborador não encontrado." });
  }

  // Cascata opcional ou apenas remove das outras tabelas
  db.asos = db.asos.filter(a => a.matricula !== matricula);
  db.treinamentos = db.treinamentos.filter(t => t.matricula !== matricula);
  db.viagens = db.viagens.filter(v => v.matricula !== matricula);
  db.bloqueios = db.bloqueios.filter(b => b.matricula !== matricula);

  writeDB(db);
  res.json({ success: true, message: "Colaborador deletado com sucesso." });
});


// ASO
app.get("/api/asos", (req, res) => {
  const db = loadDB();
  res.json(db.asos);
});

app.post("/api/asos", (req, res) => {
  const db = loadDB();
  const novo: ASO = req.body;

  if (!novo.matricula || !novo.tipoExame || !novo.dataRealizacao || !novo.validadeMeses) {
    return res.status(400).json({ error: "Todos os campos de ASO são obrigatórios." });
  }

  // Verifica se o colaborador existe
  const colIndex = db.colaboradores.findIndex(c => c.matricula === novo.matricula);
  if (colIndex === -1) {
    return res.status(400).json({ error: "Colaborador não encontrado." });
  }

  // Atribui ID único
  novo.id = novo.id || `ASO-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Se já existe um ASO desse tipo para essa pessoa, substitui ou adiciona. Substitui por simplicidade (guarda o mais atual)
  const normTipoNovo = novo.tipoExame.normalize("NFC").trim().toLowerCase();
  db.asos = db.asos.filter(a => {
    const normTipoExistente = a.tipoExame.normalize("NFC").trim().toLowerCase();
    return !(a.matricula === novo.matricula && normTipoExistente === normTipoNovo);
  });
  
  db.asos.push(novo);
  
  writeDB(db);
  res.json(novo);
});

// Treinamento
app.get("/api/treinamentos", (req, res) => {
  const db = loadDB();
  res.json(db.treinamentos);
});

app.post("/api/treinamentos", (req, res) => {
  const db = loadDB();
  const novo: Treinamento = req.body;

  if (!novo.matricula || !novo.nomeTreinamento || !novo.dataRealizacao || !novo.periodicidade) {
    return res.status(400).json({ error: "Todos os campos do Treinamento são obrigatórios." });
  }

  // Verifica colaborador
  const colIndex = db.colaboradores.findIndex(c => c.matricula === novo.matricula);
  if (colIndex === -1) {
    return res.status(400).json({ error: "Colaborador não encontrado." });
  }

  novo.id = novo.id || "T-" + Date.now();
  
  db.treinamentos.push(novo);
  writeDB(db);
  res.json(novo);
});

// Viagens / Folgas
app.get("/api/viagens", (req, res) => {
  const db = loadDB();
  res.json(db.viagens);
});

app.post("/api/viagens", (req, res) => {
  const db = loadDB();
  const novo: Viagem = req.body;

  if (!novo.matricula || !novo.dataRealInicio || !novo.dataRealRetorno || !novo.tipoTransporte) {
    return res.status(400).json({ error: "Todos os campos da Viagem são obrigatórios." });
  }

  // Verifica colaborador
  const colIndex = db.colaboradores.findIndex(c => c.matricula === novo.matricula);
  if (colIndex === -1) {
    return res.status(400).json({ error: "Colaborador não encontrado." });
  }

  const existingIndex = db.viagens.findIndex(v => v.id === novo.id);
  if (existingIndex !== -1) {
    db.viagens[existingIndex] = novo;
  } else {
    novo.id = novo.id || "V-" + Date.now();
    db.viagens.push(novo);
  }
  writeDB(db);
  res.json(novo);
});

// Bloqueios
app.get("/api/bloqueios", (req, res) => {
  const db = loadDB();
  res.json(db.bloqueios);
});

app.post("/api/bloqueios", (req, res) => {
  const db = loadDB();
  const novo: BloqueioCracha = req.body;

  if (!novo.matricula || !novo.origem || !novo.dataBloqueio || !novo.motivoDetalhado) {
    return res.status(400).json({ error: "Campos obrigatórios: Matrícula, Origem, Data de Bloqueio e Motivo Detalhado." });
  }

  // Verifica colaborador
  const colIndex = db.colaboradores.findIndex(c => c.matricula === novo.matricula);
  if (colIndex === -1) {
    return res.status(400).json({ error: "Colaborador não encontrado." });
  }

  novo.id = novo.id || "B-" + Date.now();
  novo.dataLiberacao = novo.dataLiberacao || "";

  db.bloqueios.push(novo);
  writeDB(db);
  res.json(novo);
});

app.put("/api/bloqueios/:id/liberar", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  const { dataLiberacao, dataRealizacao } = req.body;

  if (!dataLiberacao) {
    return res.status(400).json({ error: "Data de liberação é obrigatória para desbloquear." });
  }

  const index = db.bloqueios.findIndex(b => b.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Registro de bloqueio não encontrado." });
  }

  const block = db.bloqueios[index];
  block.dataLiberacao = dataLiberacao;
  
  // Define a data de realização de fato (caso não informada, assume a de liberação)
  const targetRealizacaoDate = dataRealizacao || dataLiberacao;
  block.dataRealizacao = targetRealizacaoDate;

  // Atualiza ASO ou Treinamento correspondente para regularizar no servidor
  if (block.origem === "ASO") {
    let asoUpdated = false;
    db.asos = db.asos.map(aso => {
      if (aso.matricula === block.matricula) {
        const dateV = new Date(aso.dataRealizacao + "T12:00:00");
        dateV.setMonth(dateV.getMonth() + aso.validadeMeses);
        const vencStr = dateV.toISOString().split("T")[0];
        const isAsoVencido = new Date(vencStr) < new Date();

        if (aso.tipoExame === "Pendente (Portaria)" || isAsoVencido) {
          asoUpdated = true;
          return {
            ...aso,
            dataRealizacao: targetRealizacaoDate,
            tipoExame: aso.tipoExame === "Pendente (Portaria)" ? "Periódico" : aso.tipoExame
          };
        }
      }
      return aso;
    });

    if (!asoUpdated) {
      db.asos.push({
        matricula: block.matricula,
        tipoExame: "Periódico",
        dataRealizacao: targetRealizacaoDate,
        validadeMeses: 12
      });
    }
  } else if (block.origem === "Treinamento" && block.tipoTreinamentoPendente) {
    let trUpdated = false;
    db.treinamentos = db.treinamentos.map(tr => {
      if (tr.matricula === block.matricula && tr.nomeTreinamento === block.tipoTreinamentoPendente) {
        trUpdated = true;
        return {
          ...tr,
          dataRealizacao: targetRealizacaoDate
        };
      }
      return tr;
    });

    if (!trUpdated) {
      db.treinamentos.push({
        id: "T-AUTO-" + Date.now(),
        matricula: block.matricula,
        nomeTreinamento: block.tipoTreinamentoPendente,
        dataRealizacao: targetRealizacaoDate,
        periodicidade: "1 ANO"
      });
    }
  }

  writeDB(db);
  res.json(block);
});

// Endpoints de Exclusão (Tabelas de 02 a 06)
app.delete("/api/asos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.asos = db.asos.filter(a => a.id !== id);
  writeDB(db);
  res.json({ success: true });
});

app.delete("/api/asos/:matricula/:tipoExame", (req, res) => {
  const db = loadDB();
  const { matricula, tipoExame } = req.params;
  const decodedTipo = decodeURIComponent(tipoExame).normalize("NFC").trim().toLowerCase();
  
  db.asos = db.asos.filter(a => {
    const normTipoExistente = a.tipoExame.normalize("NFC").trim().toLowerCase();
    return !(a.matricula.trim().toLowerCase() === matricula.trim().toLowerCase() && normTipoExistente === decodedTipo);
  });
  writeDB(db);
  res.json({ success: true });
});

app.delete("/api/treinamentos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.treinamentos = db.treinamentos.filter(t => t.id !== id);
  writeDB(db);
  res.json({ success: true });
});

app.delete("/api/viagens/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.viagens = db.viagens.filter(v => v.id !== id);
  writeDB(db);
  res.json({ success: true });
});

app.delete("/api/bloqueios/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.bloqueios = db.bloqueios.filter(b => b.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Memorandos API Endpoints
app.get("/api/memorandos", (req, res) => {
  const db = loadDB();
  res.json(db.memorandos || []);
});

app.post("/api/memorandos", (req, res) => {
  const db = loadDB();
  const novo: Memorando = req.body;
  if (!novo.matricula || !novo.nomeColaborador || !novo.tipoMemorando) {
    return res.status(400).json({ error: "Matrícula, Nome e Tipo de memorando são obrigatórios." });
  }
  novo.id = novo.id || "M-" + Date.now();
  novo.dataCriacao = novo.dataCriacao || new Date().toISOString().split("T")[0];
  novo.passagemOk = !!novo.passagemOk;
  novo.adiantamentoOk = !!novo.adiantamentoOk;
  novo.envioSedeOk = !!novo.envioSedeOk;
  novo.finalizada = !!novo.finalizada;

  db.memorandos = db.memorandos || [];
  db.memorandos.push(novo);
  writeDB(db);
  res.json(novo);
});

app.put("/api/memorandos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.memorandos = db.memorandos || [];
  const index = db.memorandos.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Memorando não encontrado." });
  }
  const atualizado = { ...db.memorandos[index], ...req.body };
  db.memorandos[index] = atualizado;
  writeDB(db);
  res.json(atualizado);
});

app.delete("/api/memorandos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.memorandos = (db.memorandos || []).filter(m => m.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Espelhos de Ponto
app.get("/api/espelhos", (req, res) => {
  const db = loadDB();
  res.json(db.espelhos || []);
});

app.post("/api/espelhos", (req, res) => {
  const db = loadDB();
  const novo: Espelho = req.body;
  if (!novo.matricula || !novo.mes || !novo.ano || !novo.fileName) {
    return res.status(400).json({ error: "Matrícula, Mês, Ano e Nome do arquivo são obrigatórios." });
  }
  novo.id = novo.id || "ESP-" + Date.now();
  novo.dataUpload = novo.dataUpload || new Date().toISOString().split("T")[0];

  db.espelhos = db.espelhos || [];
  // Se já existe um espelho de ponto para a mesma matrícula, mês e ano, substitui pelo novo
  db.espelhos = db.espelhos.filter(e => !(e.matricula === novo.matricula && e.mes === novo.mes && e.ano === novo.ano));
  db.espelhos.push(novo);

  writeDB(db);
  res.json(novo);
});

app.delete("/api/espelhos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.espelhos = (db.espelhos || []).filter(e => e.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Holerites
app.get("/api/holerites", (req, res) => {
  const db = loadDB();
  res.json(db.holerites || []);
});

app.post("/api/holerites", (req, res) => {
  const db = loadDB();
  const novo: Holerite = req.body;
  if (!novo.matricula || !novo.mes || !novo.ano || !novo.fileName) {
    return res.status(400).json({ error: "Matrícula, Mês, Ano e Nome do arquivo são obrigatórios." });
  }
  novo.id = novo.id || "HOL-" + Date.now();
  novo.dataUpload = novo.dataUpload || new Date().toISOString().split("T")[0];

  db.holerites = db.holerites || [];
  // Se já existe um holerite para a mesma matrícula, mês e ano, substitui pelo novo
  db.holerites = db.holerites.filter(h => !(h.matricula === novo.matricula && h.mes === novo.mes && h.ano === novo.ano));
  db.holerites.push(novo);

  writeDB(db);
  res.json(novo);
});

app.delete("/api/holerites/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.holerites = (db.holerites || []).filter(h => h.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Sindicatos
app.get("/api/sindicatos", (req, res) => {
  const db = loadDB();
  res.json(db.sindicatos || []);
});

app.post("/api/sindicatos", (req, res) => {
  const db = loadDB();
  const novo: Sindicato = req.body;
  if (!novo.matricula || !novo.fileName) {
    return res.status(400).json({ error: "Matrícula e Nome do arquivo são obrigatórios." });
  }
  novo.id = novo.id || "SIND-" + Date.now();
  novo.dataUpload = novo.dataUpload || new Date().toISOString().split("T")[0];

  db.sindicatos = db.sindicatos || [];
  // Se já existe sindicato para a mesma matrícula, substitui
  db.sindicatos = db.sindicatos.filter(s => s.matricula !== novo.matricula);
  db.sindicatos.push(novo);

  writeDB(db);
  res.json(novo);
});

app.delete("/api/sindicatos/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.sindicatos = (db.sindicatos || []).filter(s => s.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Férias (período aquisitivo + rateio de custo entre projeto de origem e atual)
app.get("/api/ferias", (req, res) => {
  const db = loadDB();
  res.json(db.ferias || []);
});

app.post("/api/ferias", (req, res) => {
  const db = loadDB();
  const novo: Ferias = req.body;
  if (!novo.matricula || !novo.paInicio || !novo.paFim || !novo.feriasInicio || !novo.feriasFim) {
    return res.status(400).json({ error: "Matrícula, período aquisitivo e período de férias são obrigatórios." });
  }
  if (novo.feriasFim < novo.feriasInicio) {
    return res.status(400).json({ error: "O fim das férias não pode ser anterior ao início." });
  }
  novo.id = novo.id || "FER-" + Date.now();
  novo.dataCriacao = novo.dataCriacao || new Date().toISOString().split("T")[0];

  db.ferias = db.ferias || [];
  const idx = db.ferias.findIndex(f => f.id === novo.id);
  if (idx >= 0) {
    db.ferias[idx] = novo; // edição de lançamento existente
  } else {
    db.ferias.push(novo);
  }

  writeDB(db);
  res.json(novo);
});

app.delete("/api/ferias/:id", (req, res) => {
  const db = loadDB();
  const { id } = req.params;
  db.ferias = (db.ferias || []).filter(f => f.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Compartilhamento Global de Credenciais do Google Drive em Multiusuários/Multinavegadores
let cachedGDriveCreds: any = null;

app.get("/api/gdrive-credentials", async (req, res) => {
  if (cachedGDriveCreds) {
    return res.json(cachedGDriveCreds);
  }
  try {
    const docRef = doc(dbFirestore, "colaboradores", "gdrive_credentials_active");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      cachedGDriveCreds = docSnap.data();
      return res.json(cachedGDriveCreds);
    }
  } catch (err) {
    console.error("Erro ao buscar credenciais do GDrive do Firestore:", err);
  }
  return res.json(null);
});

app.post("/api/gdrive-credentials", async (req, res) => {
  const { accessToken, user } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: "Token de acesso inválido ou nulo." });
  }
  const creds = {
    accessToken,
    user,
    updatedAt: new Date().toISOString()
  };
  cachedGDriveCreds = creds;
  try {
    const docRef = doc(dbFirestore, "colaboradores", "gdrive_credentials_active");
    await setDoc(docRef, creds);
    console.log("[Firestore] Credenciais compartilhadas do Google Drive salvas com sucesso em colaboradores/gdrive_credentials_active.");
  } catch (err) {
    console.error("Erro ao salvar credenciais do GDrive no Firestore:", err);
  }
  res.json(creds);
});

app.delete("/api/gdrive-credentials", async (req, res) => {
  cachedGDriveCreds = null;
  try {
    const docRef = doc(dbFirestore, "colaboradores", "gdrive_credentials_active");
    await deleteDoc(docRef);
    console.log("[Firestore] Credenciais GDrive desconectadas globais.");
  } catch (err) {
    console.error("Erro ao deletar credenciais do GDrive no Firestore:", err);
  }
  res.json({ success: true });
});

// Proxy para obter imagens ou documentos do Google Drive usando as credenciais do usuário/sistema
app.get("/api/gdrive-proxy", async (req, res) => {
  const { fileId, token: queryToken } = req.query;
  if (!fileId || typeof fileId !== "string") {
    return res.status(400).send("fileId is required");
  }

  // Tenta obter o token do query parameter, do header de Authorization ou assume o compartilhado/cacheado
  const authHeader = req.headers.authorization;
  let token = (typeof queryToken === "string" ? queryToken : null) || 
              (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);

  if (!token) {
    token = cachedGDriveCreds?.accessToken;
  }

  if (!token) {
    try {
      const docRef = doc(dbFirestore, "colaboradores", "gdrive_credentials_active");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        cachedGDriveCreds = docSnap.data();
        token = cachedGDriveCreds?.accessToken;
      }
    } catch (err) {
      console.error("[Proxy] Erro ao buscar credenciais do GDrive do Firestore:", err);
    }
  }

  if (!token) {
    // Fallback para link de download público direto se não houver token (funciona para PDFs e qualquer tipo de arquivo)
    return res.redirect(`https://docs.google.com/uc?export=download&id=${fileId}`);
  }

  try {
    const driveApiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(driveApiUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.warn(`[Proxy] Falha de autenticação/acesso no Google Drive API (status ${response.status}). Fazendo fallback público.`);
      return res.redirect(`https://docs.google.com/uc?export=download&id=${fileId}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache de 24 horas para performance

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (err) {
    console.error("[Proxy] Erro na requisição do Proxy GDrive:", err);
    return res.redirect(`https://docs.google.com/uc?export=download&id=${fileId}`);
  }
});


// Serve static assets out of output build directory and configure Vite as middleware in dev
async function startServer() {
  // Sincroniza e inicializa os dados do Firestore antes de levantar o servidor do app
  try {
    const firestoreData = await syncFromFirestore();
    cachedDb = firestoreData;
    fs.writeFileSync(DB_FILE, JSON.stringify(firestoreData, null, 2), "utf-8");
    console.log("[Firestore] Banco de dados em nuvem sincronizado com sucesso na inicialização.");
  } catch (err) {
    console.error("[Firestore] Erro na sincronização inicial das tabelas:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback handling
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ERP] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
