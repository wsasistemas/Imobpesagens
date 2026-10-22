/**
 * Fila local (IndexedDB) das fotos de evidência capturadas sem conexão.
 * Cada item guarda o JPEG já comprimido e os metadados da captura.
 */

export type ItemFila = {
  id: string;
  processoId: string;
  posicao: number;
  rotulo: string;
  versao: number;
  substituiId: string | null;
  motivo: string | null;
  lat: number | null;
  lng: number | null;
  capturadoEm: string;
  arquivo: Blob;
};

const DB_NOME = "sucata-evidencias";
const STORE = "fila";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function filaDisponivel(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function enfileirar(item: ItemFila): Promise<void> {
  const db = await abrirBanco();
  const tx = db.transaction(STORE, "readwrite");
  await pedido(tx.objectStore(STORE).put(item));
  db.close();
}

export async function listarFila(processoId?: string): Promise<ItemFila[]> {
  if (!filaDisponivel()) return [];
  const db = await abrirBanco();
  const tx = db.transaction(STORE, "readonly");
  const todos = (await pedido(tx.objectStore(STORE).getAll())) as ItemFila[];
  db.close();
  return processoId ? todos.filter((i) => i.processoId === processoId) : todos;
}

export async function removerDaFila(id: string): Promise<void> {
  const db = await abrirBanco();
  const tx = db.transaction(STORE, "readwrite");
  await pedido(tx.objectStore(STORE).delete(id));
  db.close();
}
