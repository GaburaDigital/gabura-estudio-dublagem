// Estado do app: o projeto aberto, a aba, a fala selecionada e quem precisa redesenhar quando algo muda.
// Funciona como um "autoload" da Godot: um único lugar que todas as telas consultam.

import { armazenamento } from '../dados/armazenamento';
import type { Fala, Personagem, Preset, Projeto } from '../dados/modelo';

export type Aba = 'vozes' | 'gravar' | 'exportar';

export const estado = {
  projeto: null as Projeto | null,
  aba: 'vozes' as Aba,
  personagemSel: '' as string,
  falaSel: '' as string,
  tomadaSel: '' as string,
  meusPresets: [] as Preset[],
  pasta: null as FileSystemDirectoryHandle | null,
  pastaPrecisaPermissao: false,
  gravandoFala: '' as string,
};

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

export function aoMudar(f: Ouvinte): void { ouvintes.add(f); }

/** Avisa as telas para redesenharem. */
export function redesenhar(): void { ouvintes.forEach((f) => f()); }

let salvarDepois: number | undefined;
/** Salva o projeto (com um pequeno atraso, para juntar várias mudanças seguidas) e redesenha. */
export function mudou(redesenharAgora = true): void {
  const p = estado.projeto;
  if (p) {
    p.alterado = Date.now();
    window.clearTimeout(salvarDepois);
    salvarDepois = window.setTimeout(() => { void armazenamento.salvarProjeto(p); }, 250);
  }
  if (redesenharAgora) redesenhar();
}

/** Salva já (usado antes de exportar ou trocar de projeto). */
export async function salvarAgora(): Promise<void> {
  window.clearTimeout(salvarDepois);
  if (estado.projeto) await armazenamento.salvarProjeto(estado.projeto);
}

export function projeto(): Projeto {
  if (!estado.projeto) throw new Error('Nenhum projeto aberto.');
  return estado.projeto;
}

export function personagem(id: string): Personagem | undefined {
  return estado.projeto?.personagens.find((p) => p.id === id);
}

export function fala(id: string): Fala | undefined {
  return estado.projeto?.falas.find((f) => f.id === id);
}
