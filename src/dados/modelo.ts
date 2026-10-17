// Formato dos dados do estúdio (o "projeto de dublagem").
// Os IDs seguem os padrões do Gabura: personagem = "gabura", fala = "<local>_<personagem>_<nnn>".

import type { ParametrosVoz } from '../audio/parametros';

export const MAX_TOMADAS = 5;

export interface Preset {
  id: string;
  nome: string;
  descricao: string;
  p: ParametrosVoz;
}

export interface VozEscolhida {
  /** De onde a voz partiu (id do preset sugerido ou de "meus presets"). */
  origem: string;
  nome: string;
  p: ParametrosVoz;
}

export interface Personagem {
  id: string;
  nome: string;
  cor: string;
  /** As 3 opções para testar. */
  sugeridos: Preset[];
  /** Fala usada como frase de teste (a mais marcante; se não houver, a mais longa). */
  falaTeste: string;
  voz: VozEscolhida | null;
}

export interface Tomada {
  id: string;
  criada: number;
  /** Duração total gravada (s). */
  duracao: number;
  /** Corte: trecho usado (s). */
  inicio: number;
  fim: number;
}

export interface MarcasKaraoke {
  /** Início de cada palavra (s), medido no áudio com efeito. */
  tempos: number[];
  /** Assinatura da voz e do corte quando as marcas foram feitas. Se mudar, é preciso marcar de novo. */
  assinatura: string;
}

export interface Fala {
  id: string;
  personagem: string;
  texto: string;
  /** Dica de interpretação (opcional). */
  dica: string;
  emocao: string;
  tomadas: Tomada[];
  favorita: string | null;
  karaoke: MarcasKaraoke | null;
}

export interface Ajustes {
  microfone: string;
  limpezaDoNavegador: boolean;
  contagem: boolean;
  legenda: 'duracao' | 'karaoke';
  opusKbps: number;
  incluirLimpo: boolean;
}

export interface Projeto {
  versao_formato: 1;
  id: string;
  nome: string;
  local: string;
  criado: number;
  alterado: number;
  personagens: Personagem[];
  falas: Fala[];
  ajustes: Ajustes;
}

export const AJUSTES_PADRAO: Ajustes = {
  microfone: '',
  limpezaDoNavegador: false,
  contagem: true,
  legenda: 'duracao',
  opusKbps: 48,
  incluirLimpo: true,
};

/** Transforma um texto em identificador ASCII (sem acento, sem ç, com sublinhado). */
export function paraId(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ç/gi, 'c')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

export function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Fala que vai para o jogo: a tomada com estrela. */
export function tomadaFavorita(f: Fala): Tomada | null {
  return f.tomadas.find((t) => t.id === f.favorita) ?? null;
}

/** Escolhe a frase de teste: a marcada no roteiro; senão a fala mais longa do personagem. */
export function escolherFalaTeste(falas: Fala[], personagem: string, sugerida?: string): string {
  if (sugerida && falas.some((f) => f.id === sugerida)) return sugerida;
  const doPersonagem = falas.filter((f) => f.personagem === personagem);
  doPersonagem.sort((a, b) => b.texto.length - a.texto.length);
  return doPersonagem[0]?.id ?? '';
}
