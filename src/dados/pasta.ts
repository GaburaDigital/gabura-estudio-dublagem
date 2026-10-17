// Pasta do projeto no computador (opcional).
// O Chrome deixa o app escrever numa pasta que você escolhe (File System Access API).
// Cada tomada vira um WAV em <pasta>/limpo/<fala>/ assim que é gravada, e o projeto.json é atualizado.
// Funciona no Chrome do Linux e do macOS. Depois de reabrir o app, o Chrome pede para confirmar o acesso.

import { armazenamento } from './armazenamento';

interface PastaComPermissao extends FileSystemDirectoryHandle {
  queryPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

type JanelaComPasta = Window & { showDirectoryPicker?: (o?: { mode?: string; id?: string }) => Promise<FileSystemDirectoryHandle> };

export function pastaDisponivel(): boolean {
  return typeof (window as JanelaComPasta).showDirectoryPicker === 'function';
}

const chave = (projeto: string) => 'pasta_' + projeto;

export async function escolherPasta(projeto: string): Promise<FileSystemDirectoryHandle> {
  const h = await (window as JanelaComPasta).showDirectoryPicker!({ mode: 'readwrite', id: 'estudio_dublagem' });
  await armazenamento.salvarConfig(chave(projeto), h);
  return h;
}

export async function esquecerPasta(projeto: string): Promise<void> {
  await armazenamento.salvarConfig(chave(projeto), null);
}

/** Pasta lembrada e o estado da permissão ("granted" = pode escrever; "prompt" = precisa de um clique). */
export async function pastaLembrada(projeto: string): Promise<{ pasta: FileSystemDirectoryHandle; estado: PermissionState } | null> {
  const h = await armazenamento.lerConfig<PastaComPermissao | null>(chave(projeto)).catch(() => null);
  if (!h) return null;
  const estado = await h.queryPermission({ mode: 'readwrite' }).catch(() => 'denied' as PermissionState);
  return { pasta: h, estado };
}

/** Pede de novo a permissão (precisa vir de um clique). */
export async function reconectar(h: FileSystemDirectoryHandle): Promise<boolean> {
  return (await (h as PastaComPermissao).requestPermission({ mode: 'readwrite' })) === 'granted';
}

/** Escreve um arquivo dentro da pasta, criando subpastas ("limpo/fala_x/t1.wav"). */
export async function escreverNaPasta(raiz: FileSystemDirectoryHandle, caminho: string, dados: Uint8Array | string): Promise<void> {
  const partes = caminho.split('/');
  const nome = partes.pop()!;
  let dir = raiz;
  for (const p of partes) dir = await dir.getDirectoryHandle(p, { create: true });
  const arq = await dir.getFileHandle(nome, { create: true });
  const w = await arq.createWritable();
  await w.write(typeof dados === 'string' ? dados : new Blob([dados as Uint8Array<ArrayBuffer>]));
  await w.close();
}

export async function apagarDaPasta(raiz: FileSystemDirectoryHandle, caminho: string): Promise<void> {
  const partes = caminho.split('/');
  const nome = partes.pop()!;
  try {
    let dir = raiz;
    for (const p of partes) dir = await dir.getDirectoryHandle(p);
    await dir.removeEntry(nome);
  } catch { /* já não existia */ }
}
