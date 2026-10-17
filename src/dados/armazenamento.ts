// Guarda tudo no próprio navegador (IndexedDB), que funciona offline e aguenta áudio.
// Cada tomada fica salva assim que você para de gravar. Para levar para outro computador,
// use "Exportar projeto" (um .zip com tudo) ou a pasta do projeto.

import type { Preset, Projeto } from './modelo';

const NOME_BANCO = 'gabura_estudio_dublagem';
const VERSAO = 1;

let bancoAberto: Promise<IDBDatabase> | null = null;

function banco(): Promise<IDBDatabase> {
  if (!bancoAberto) {
    bancoAberto = new Promise((ok, erro) => {
      const req = indexedDB.open(NOME_BANCO, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projetos')) db.createObjectStore('projetos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audios')) db.createObjectStore('audios');
        if (!db.objectStoreNames.contains('meus_presets')) db.createObjectStore('meus_presets', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
  }
  return bancoAberto;
}

function pedir<T>(loja: string, modo: IDBTransactionMode, acao: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return banco().then((db) => new Promise<T>((ok, erro) => {
    const tx = db.transaction(loja, modo);
    const req = acao(tx.objectStore(loja));
    tx.oncomplete = () => ok(req.result as T);
    tx.onerror = () => erro(tx.error);
    tx.onabort = () => erro(tx.error ?? new Error('Gravação cancelada (o disco pode estar cheio).'));
  }));
}

export const armazenamento = {
  salvarProjeto: (p: Projeto) => pedir<IDBValidKey>('projetos', 'readwrite', (s) => s.put(structuredClone(p))),
  lerProjeto: (id: string) => pedir<Projeto | undefined>('projetos', 'readonly', (s) => s.get(id)),
  listarProjetos: () => pedir<Projeto[]>('projetos', 'readonly', (s) => s.getAll()),
  apagarProjeto: (id: string) => pedir<undefined>('projetos', 'readwrite', (s) => s.delete(id)),

  salvarAudio: (id: string, x: Float32Array) => pedir<IDBValidKey>('audios', 'readwrite', (s) => s.put(x.slice().buffer, id)),
  async lerAudio(id: string): Promise<Float32Array | null> {
    const b = await pedir<ArrayBuffer | undefined>('audios', 'readonly', (s) => s.get(id));
    return b ? new Float32Array(b) : null;
  },
  apagarAudio: (id: string) => pedir<undefined>('audios', 'readwrite', (s) => s.delete(id)),

  salvarPreset: (p: Preset) => pedir<IDBValidKey>('meus_presets', 'readwrite', (s) => s.put(structuredClone(p))),
  listarPresets: () => pedir<Preset[]>('meus_presets', 'readonly', (s) => s.getAll()),
  apagarPreset: (id: string) => pedir<undefined>('meus_presets', 'readwrite', (s) => s.delete(id)),

  salvarConfig: (chave: string, valor: unknown) => pedir<IDBValidKey>('config', 'readwrite', (s) => s.put(valor, chave)),
  lerConfig: <T>(chave: string) => pedir<T | undefined>('config', 'readonly', (s) => s.get(chave)),
};
