import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import * as XLSX from "xlsx";

// Inicializa o Firebase client-side de forma segura (singleton)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive");

// Tenta recuperar token de acesso persistido no localStorage (evita desconexão ao atualizar/compilar)
let inMemoryAccessToken: string | null = localStorage.getItem("gdrive_access_token");
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const storedToken = localStorage.getItem("gdrive_access_token");
      if (storedToken) {
        inMemoryAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else if (inMemoryAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, inMemoryAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Quando o Firebase está inicializando, o estado do usuário pode vir temporariamente nulo.
      // NÃO vamos limpar o localStorage aqui para evitar desconexões acidentais ao recarregar a página.
      inMemoryAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Não foi possível obter o token de acesso do Google.");
    }
    inMemoryAccessToken = credential.accessToken;
    localStorage.setItem("gdrive_access_token", credential.accessToken);
    return { user: result.user, accessToken: inMemoryAccessToken };
  } catch (err) {
    console.error("Erro de autenticação no Google:", err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return inMemoryAccessToken;
};

export const setSharedAccessTokenInAuth = (token: string | null) => {
  inMemoryAccessToken = token;
  if (token) {
    localStorage.setItem("gdrive_access_token", token);
  } else {
    localStorage.removeItem("gdrive_access_token");
  }
};

export const logoutGoogle = async () => {
  await signOut(auth);
  inMemoryAccessToken = null;
  localStorage.removeItem("gdrive_access_token");
  localStorage.removeItem("gdrive_user");
};

// Conversor de base64 Data URL para Blob binário
export function base64ToBlob(base64Data: string, defaultType: string = "application/octet-stream"): Blob {
  const sliceSize = 512;
  let contentType = defaultType;
  let base64WithoutHeader = base64Data;
  
  if (base64Data.includes("data:") && base64Data.includes(";base64,")) {
    const parts = base64Data.split(";base64,");
    contentType = parts[0].replace("data:", "");
    base64WithoutHeader = parts[1];
  }
  
  try {
    const byteCharacters = atob(base64WithoutHeader);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: contentType });
  } catch (err) {
    console.error("Erro ao converter base64 para Blob:", err);
    return new Blob([base64Data], { type: contentType });
  }
}

// Retorna ou cria a pasta "Borborema ERP - Anexos" no Google Drive
export async function getOrCreateFolder(accessToken: string): Promise<string> {
  const cacheKey = `gdrive_folder_id_${auth.currentUser?.uid || "global"}`;
  const existingId = sessionStorage.getItem(cacheKey);
  if (existingId) return existingId;
  
  try {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='Borborema ERP - Anexos' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    if (!searchRes.ok) {
      throw new Error("Erro ao pesquisar diretórios no Google Drive");
    }
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const id = searchData.files[0].id;
      sessionStorage.setItem(cacheKey, id);
      return id;
    }
    
    // Cria nova pasta de destino
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Borborema ERP - Anexos",
        mimeType: "application/vnd.google-apps.folder"
      })
    });
    if (!createRes.ok) {
      throw new Error("Erro ao criar nova pasta de anexo.");
    }
    const folder = await createRes.json();
    sessionStorage.setItem(cacheKey, folder.id);
    return folder.id;
  } catch (err) {
    console.error("Erro ao criar/pesquisar pasta no Google Drive:", err);
    throw err;
  }
}

export interface FolderHierarchy {
  rootId: string;
  cadastroId: string;
  fotosId: string;
  folgaId: string;
  passagensId: string;
  adiantamentosId: string;
  memorandoId: string;
  espelhosId: string;
  holeritesId: string;
  sindicatosId: string;
}

export async function getOrCreateFolderHierarchy(accessToken: string): Promise<FolderHierarchy> {
  const cacheKey = `gdrive_hierarchy_v2_${auth.currentUser?.uid || "global"}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.rootId && parsed.cadastroId && parsed.fotosId && parsed.folgaId && parsed.passagensId && parsed.adiantamentosId && parsed.memorandoId && parsed.espelhosId && parsed.holeritesId && parsed.sindicatosId) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  const getFolderId = async (name: string, parentId?: string): Promise<string> => {
    // 1. Search with parents restriction
    let query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    } else {
      query += ` and 'root' in parents`;
    }

    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          return data.files[0].id;
        }
      } else {
        const errText = await res.text();
        console.error(`Erro ao pesquisar pasta ${name} (com restrição de parent):`, errText);
        if (res.status === 403 || errText.includes("insufficient") || errText.includes("permission")) {
          sessionStorage.setItem("gdrive_last_error", "Acesso Negado (403): Permissão insuficiente no Google Drive. Lembre-se de aceitar todas as permissões ao fazer login.");
          throw new Error("LOG_ERROR_INSUFFICIENT_SCOPE");
        }
      }
    } catch (e: any) {
      if (e.message === "LOG_ERROR_INSUFFICIENT_SCOPE") throw e;
      console.warn(`Erro na busca com parent da pasta ${name}, tentando busca global...`, e);
    }

    // 2. Global search fallback (ignore parent/root constraint)
    let globalQuery = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    try {
      const resGlobal = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(globalQuery)}&fields=files(id,parents)`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (resGlobal.ok) {
        const dataGlobal = await resGlobal.json();
        if (dataGlobal.files && dataGlobal.files.length > 0) {
          if (parentId) {
            // Find a folder that has the correct parent among its parents array
            const matchedFolder = dataGlobal.files.find((f: any) => f.parents && f.parents.includes(parentId));
            if (matchedFolder) return matchedFolder.id;
          } else {
            return dataGlobal.files[0].id;
          }
        }
      } else {
        const errGlobalText = await resGlobal.text();
        console.error(`Erro ao pesquisar pasta ${name} (global):`, errGlobalText);
        if (resGlobal.status === 403 || errGlobalText.includes("insufficient") || errGlobalText.includes("permission")) {
          sessionStorage.setItem("gdrive_last_error", "Acesso Negado (403): Permissão insuficiente no Google Drive. Lembre-se de aceitar todas as permissões ao fazer login.");
          throw new Error("LOG_ERROR_INSUFFICIENT_SCOPE");
        }
      }
    } catch (e: any) {
      if (e.message === "LOG_ERROR_INSUFFICIENT_SCOPE") throw e;
      console.warn("Falha no fallback de busca.", e);
    }

    // 3. Create folder
    console.log(`Criando pasta: ${name} (parentId: ${parentId})`);
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : ["root"]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`Erro ao criar pasta ${name}:`, errText);
      if (createRes.status === 403 || errText.includes("insufficient") || errText.includes("permission")) {
        sessionStorage.setItem("gdrive_last_error", "Acesso Negado (403): Permissão insuficiente no Google Drive. Lembre-se de aceitar todas as permissões ao fazer login.");
        throw new Error("LOG_ERROR_INSUFFICIENT_SCOPE");
      }
      throw new Error(`Erro ao criar pasta ${name} (${createRes.status}): ${errText}`);
    }

    const created = await createRes.json();
    console.log(`Pasta criada com sucesso: ${name} (ID: ${created.id})`);

    // Grant public reader permissions (anyone with link can read/access)
    try {
      const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${created.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: "reader", type: "anyone" })
      });
      if (!permRes.ok) {
        console.warn(`Aviso ao conceder permissão na pasta ${name}:`, await permRes.text());
      }
    } catch (err) {
      console.warn(`Erro ao setar permissao publica para pasta ${name}:`, err);
    }

    return created.id;
  };

  try {
    sessionStorage.removeItem("gdrive_last_error");
    
    const rootId = await getFolderId("Gestão de Folga");
    const cadastroId = await getFolderId("02 Cadastro de colaboradores", rootId);
    const fotosId = await getFolderId("Fotos Colaboradores", cadastroId);
    const folgaId = await getFolderId("03. Folga de Campo", rootId);
    const passagensId = await getFolderId("Anexo das Passagens", folgaId);
    const adiantamentosId = await getFolderId("Anexos dos adiantamentos de viagem", folgaId);
    const memorandoId = await getFolderId("04. Memorando", rootId);
    const espelhosId = await getFolderId("06. Espelhos de Ponto", rootId);
    const holeritesId = await getFolderId("07. Holerites", rootId);
    const sindicatosId = await getFolderId("08. Sindicato", rootId);

    const hierarchy: FolderHierarchy = {
      rootId,
      cadastroId,
      fotosId,
      folgaId,
      passagensId,
      adiantamentosId,
      memorandoId,
      espelhosId,
      holeritesId,
      sindicatosId
    };

    sessionStorage.setItem(cacheKey, JSON.stringify(hierarchy));
    return hierarchy;
  } catch (err: any) {
    console.error("Erro ao criar/verificar hierarquia de pastas no Drive:", err);
    sessionStorage.removeItem(cacheKey);
    if (!sessionStorage.getItem("gdrive_last_error")) {
      sessionStorage.setItem("gdrive_last_error", err.message || "Erro desconhecido ao carregar/criar pastas no Google Drive.");
    }
    throw err;
  }
}

export async function uploadExcelToGDriveAsSheets(
  accessToken: string,
  folderId: string,
  fileName: string,
  workbook: XLSX.WorkBook
): Promise<{ id: string; webViewLink: string }> {
  // Convert workbook to binary array
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const fileBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  
  // Search if a file with same name already exists in this folder to locate and overwrite/update it
  let existingFileId: string | null = null;
  try {
    const query = `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        existingFileId = searchData.files[0].id;
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar planilha existente no Drive:", err);
  }

  const metadata = {
    name: fileName,
    mimeType: "application/vnd.google-apps.spreadsheet",
    parents: existingFileId ? undefined : [folderId]
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", fileBlob);

  let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
  let method = "POST";

  if (existingFileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,webViewLink`;
    method = "PATCH";
  }

  const res = await fetch(url, {
    method: method,
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Erro ao subir planilha para o Google Drive:", errText);
    throw new Error("Não foi possível salvar a planilha no Google Drive.");
  }

  const result = await res.json();

  // Permissão pública
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    });
  } catch (permErr) {
    console.warn("Erro ao definir permissão pública para a planilha:", permErr);
  }

  return result;
}

// Realiza o Upload de arquivo físico no Google Drive (Multipart)
export async function uploadFileToDrive(
  accessToken: string,
  file: File,
  folderId?: string
): Promise<{ id: string; webViewLink: string }> {
  try {
    // Busca se já existe um arquivo com o mesmo nome nesta pasta para sobrescrever
    let existingFileId: string | null = null;
    if (folderId) {
      try {
        const query = `name='${file.name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`;
        const searchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.files && searchData.files.length > 0) {
            existingFileId = searchData.files[0].id;
            console.log(`[Google Drive] Arquivo existente encontrado com ID ${existingFileId}. Sobrescrevendo...`);
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar arquivo existente no Drive:", err);
      }
    }

    const metadata = {
      name: file.name,
      parents: existingFileId ? undefined : (folderId ? [folderId] : undefined)
    };
    
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);
    
    let url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
    let method = "POST";

    if (existingFileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,webViewLink`;
      method = "PATCH";
    }

    const res = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: form
    });
    if (!res.ok) {
      const errorMsg = await res.text();
      console.error("Falha no upload para o Drive:", errorMsg);
      throw new Error("Não foi possível carregar o arquivo no Google Drive.");
    }
    
    const result = await res.json();
    
    // Adiciona permissão de leitura global (público com link) para que possa ser lido/baixado por qualquer computador
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: "reader",
          type: "anyone"
        })
      });
    } catch (permErr) {
      console.warn("Aviso ao conceder permissão pública ao arquivo:", permErr);
    }
    
    return result;
  } catch (err) {
    console.error("Erro no upload do arquivo:", err);
    throw err;
  }
}

// Converte String Base64 para arquivo binário e faz o upload
export async function uploadBase64ToDrive(
  accessToken: string,
  base64Data: string,
  fileName: string,
  folderId?: string
): Promise<{ id: string; webViewLink: string }> {
  try {
    const blob = base64ToBlob(base64Data);
    const file = new File([blob], fileName, { type: blob.type });
    return await uploadFileToDrive(accessToken, file, folderId);
  } catch (err) {
    console.error("Erro no processamento base64 para Google Drive:", err);
    throw err;
  }
}
