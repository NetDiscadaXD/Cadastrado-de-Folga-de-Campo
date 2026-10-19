/**
 * Converte um link de visualização do Google Drive (webViewLink) para um link de imagem direta / incorporada (embeddable).
 * Isso permite que imagens hospedadas no Google Drive (com permissão pública de leitura) sejam carregadas diretamente em tags <img> no navegador.
 */
export function getDirectDriveImageURL(url: string | null | undefined): string {
  if (!url) return "";
  
  // Se for uma imagem base64 ou URL de dados local, já é uma url válida
  if (url.startsWith("data:")) return url;

  // Se já for a URL do nosso proxy, mantém para evitar loops
  if (url.includes("/api/gdrive-proxy")) return url;

  // Tenta extrair o File ID do URL do Google Drive
  let fileId = "";
  
  const dFormat = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const lh3Format = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  
  if (dFormat && dFormat[1]) {
    fileId = dFormat[1];
  } else if (lh3Format && lh3Format[1]) {
    fileId = lh3Format[1];
  } else {
    const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam && idParam[1]) {
      fileId = idParam[1];
    }
  }

  if (fileId) {
    // Tenta extrair o parâmetro de cache-busting para anexá-lo à nova URL
    const tParam = url.match(/[?&]t=([0-9]+)/);
    const cacheBust = tParam ? `&t=${tParam[1]}` : "";
    
    // Retorna o formato do nosso proxy do backend
    return `/api/gdrive-proxy?fileId=${fileId}${cacheBust}`;
  }

  return url;
}
