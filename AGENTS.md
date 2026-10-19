# Instruções para o Agente de Codificação (Coding Agent Instructions)

## REGRA CRÍTICA DE PERSISTÊNCIA DE DADOS (CRITICAL DATA PERSISTENCE RULE)

**PORTUGUÊS:**
- **NUNCA exclua, limpe ou reinicie os dados históricos preenchidos** pelo usuário nas coleções do Firestore ou no arquivo `database.json`.
- Ao realizar modificações, inclusões, atualizações, correções de bugs ou melhorias no código do aplicativo, garanta que a estrutura existente de coleções (`colaboradores`, `asos`, `treinamentos`, `viagens`, `bloqueios`, `memorandos`) e seus documentos correspondentes no banco de dados sejam totalmente preservados.
- O semeamento inicial de dados padrão (`seedDefaultData` ou dados mocados de exemplo) só deve ocorrer caso as coleções do banco de dados na nuvem estejam **completamente vazias**. Se houver qualquer registro preenchido na nuvem, ele deve ser lido e mantido intacto.
- Nunca insira trechos de código que forcem reset de coleções, comandos de limpeza em lote, ou sobrescrevam matrizes integras sem antes realizar a sincronização diferencial diferencial segura.

**ENGLISH:**
- **NEVER delete, clear, or reset completed historical data** entered by the user in Firestore collections or the `database.json` file.
- When performing code modifications, additions, updates, bug fixes, or application improvements, ensure that the existing structure of collections (`colaboradores`, `asos`, `treinamentos`, `viagens`, `bloqueios`, `memorandos`) and their corresponding documents in the database are fully preserved.
- Default data seeding must only run if cloud database collections are **completely empty**. If there are existing records, they must be fetched and left intact.
- Never write code blocks that force-reset collections, batch-delete, or overwrite healthy arrays without performing a safe differential sync.
