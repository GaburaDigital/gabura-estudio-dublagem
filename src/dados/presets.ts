// Catálogo de vozes.
// - SUGERIDOS: as 3 opções de cada personagem do Gaburaverso (pontos de partida para ajustar).
// - BIBLIOTECA: vozes prontas para personagens novos ou para "começar de outro preset".

import { voz } from '../audio/parametros';
import type { Preset } from './modelo';

export const SUGERIDOS: Record<string, Preset[]> = {
  gabura: [
    { id: 'gabura_natural', nome: 'Natural de estúdio', descricao: 'limpeza de ruído, grave suave e compressor leve', p: voz({ limpeza: 0.5, grave: 1.5, agudo: 1.5 }) },
    { id: 'gabura_radio', nome: 'Rádio do relógio', descricao: 'filtro de rádio leve, como se viesse do pulso', p: voz({ limpeza: 0.5, radio: 0.45, agudo: 1 }) },
    { id: 'gabura_holograma', nome: 'Holograma', descricao: 'natural com eco curto e brilho leve', p: voz({ limpeza: 0.5, eco: 0.18, ecoTempo: 0.07, ecoRepeticoes: 0.25, sala: 0.12, salaTamanho: 0.25, agudo: 3 }) },
  ],
  gaburia: [
    { id: 'gaburia_relogio', nome: 'Rádio do relógio', descricao: 'voz saindo de um alto-falante pequeno no pulso', p: voz({ tom: 1, radio: 0.5, agudo: 1, limpeza: 0.5 }) },
    { id: 'gaburia_assistente', nome: 'Assistente digital', descricao: 'rádio leve com um toque de robô, como uma IA', p: voz({ tom: 1.5, formante: 1, radio: 0.3, roboFreq: 220, roboMistura: 0.15, agudo: 2, limpeza: 0.5 }) },
    { id: 'gaburia_holograma', nome: 'Holograma', descricao: 'eco curto e brilho, parece vir de dentro do relógio', p: voz({ tom: 1, eco: 0.2, ecoTempo: 0.06, ecoRepeticoes: 0.25, sala: 0.12, salaTamanho: 0.2, agudo: 3, limpeza: 0.5 }) },
  ],
  metalgabutron: [
    { id: 'metal_robo', nome: 'Robô clássico', descricao: 'modulação em anel de 50 Hz e tom −2', p: voz({ tom: -2, roboFreq: 50, roboMistura: 0.7, agudo: 3, limpeza: 0.5 }) },
    { id: 'metal_lata', nome: 'Lata de sardinha', descricao: 'eco metálico bem curto e médios fortes', p: voz({ tom: -1, eco: 0.55, ecoTempo: 0.02, ecoRepeticoes: 0.7, medio: 5, radio: 0.3, limpeza: 0.5 }) },
    { id: 'metal_vocoder', nome: 'Vocoder retrô', descricao: 'sua voz "cantada" por um sintetizador em nota fixa', p: voz({ vocoderNota: 45, vocoderMistura: 0.85, agudo: 2, limpeza: 0.6 }) },
  ],
  gabura_gato: [
    { id: 'gato_charmoso', nome: 'Gato charmoso', descricao: 'tom +4, voz um pouco menor', p: voz({ tom: 4, formante: 3, limpeza: 0.5 }) },
    { id: 'gato_malandro', nome: 'Gato malandro', descricao: 'tom +3 e leve rouquidão', p: voz({ tom: 3, formante: 2, rouquidao: 0.25, limpeza: 0.5 }) },
    { id: 'gato_gatinho', nome: 'Gatinho', descricao: 'tom +6, mais fino', p: voz({ tom: 6, formante: 5, agudo: 1, limpeza: 0.5 }) },
  ],
  gojo: [
    { id: 'gojo_miau', nome: 'Miau', descricao: 'tom +7 com vibrato rápido', p: voz({ tom: 7, formante: 6, vibrato: 0.35, vibratoVel: 8, limpeza: 0.5 }) },
    { id: 'gojo_desenho', nome: 'Gato desenho', descricao: 'tom +8, seco e acelerado', p: voz({ tom: 8, formante: 7, velocidade: 1.12, limpeza: 0.5 }) },
    { id: 'gojo_gordo', nome: 'Gato gordo', descricao: 'tom +2, voz grande', p: voz({ tom: 2, formante: -3, grave: 2, limpeza: 0.5 }) },
  ],
  fred: [
    { id: 'fred_hamster', nome: 'Hamster', descricao: 'tom +12, 15% mais rápido', p: voz({ tom: 12, formante: 10, velocidade: 1.15, limpeza: 0.5 }) },
    { id: 'fred_esquilo', nome: 'Esquilo', descricao: 'tom +9 com vibrato', p: voz({ tom: 9, formante: 8, vibrato: 0.3, vibratoVel: 7, limpeza: 0.5 }) },
    { id: 'fred_timido', nome: 'Hamster tímido', descricao: 'tom +10, abafado', p: voz({ tom: 10, formante: 9, agudo: -6, limpeza: 0.5 }) },
  ],
};

export const BIBLIOTECA: Preset[] = [
  { id: 'bib_natural', nome: 'Natural', descricao: 'só limpeza e acabamento', p: voz({ limpeza: 0.5 }) },
  { id: 'bib_radio', nome: 'Rádio', descricao: 'alto-falante pequeno', p: voz({ radio: 0.8 }) },
  { id: 'bib_robo', nome: 'Robô', descricao: 'modulação em anel', p: voz({ roboMistura: 0.7, roboFreq: 60, tom: -2 }) },
  { id: 'bib_robo_fino', nome: 'Robô pequeno', descricao: 'robô agudo e rápido', p: voz({ roboMistura: 0.6, roboFreq: 120, tom: 5, formante: 4, velocidade: 1.08 }) },
  { id: 'bib_gigante', nome: 'Gigante', descricao: 'grave, enorme e com sala', p: voz({ tom: -5, formante: -4, sala: 0.2, salaTamanho: 0.7, grave: 3 }) },
  { id: 'bib_monstro', nome: 'Monstro', descricao: 'grave e rouco', p: voz({ tom: -7, formante: -5, rouquidao: 0.5, grave: 4 }) },
  { id: 'bib_crianca', nome: 'Criança', descricao: 'mais aguda e menor', p: voz({ tom: 4, formante: 3.5 }) },
  { id: 'bib_idoso', nome: 'Idoso', descricao: 'voz trêmula e um pouco rouca', p: voz({ tom: -1, vibrato: 0.35, vibratoVel: 5.5, rouquidao: 0.2, velocidade: 0.92 }) },
  { id: 'bib_aguda', nome: 'Voz aguda adulta', descricao: 'tom +4, formante +2', p: voz({ tom: 4, formante: 2 }) },
  { id: 'bib_grave', nome: 'Voz grave adulta', descricao: 'tom −4, formante −2', p: voz({ tom: -4, formante: -2 }) },
  { id: 'bib_fumante', nome: 'Rouco de fumaça', descricao: 'grave e áspero', p: voz({ tom: -2, rouquidao: 0.45, grave: 3 }) },
  { id: 'bib_dinossauro', nome: 'Dinossauro', descricao: 'muito grave, rouco e com eco', p: voz({ tom: -10, formante: -6, rouquidao: 0.6, sala: 0.2, salaTamanho: 0.8 }) },
  { id: 'bib_nasal', nome: 'Nasal', descricao: 'voz pelo nariz', p: voz({ medio: 9, grave: -6, radio: 0.3 }) },
  { id: 'bib_zumbi', nome: 'Zumbi', descricao: 'lento, rouco e trêmulo', p: voz({ tom: -4, vibrato: 0.5, vibratoVel: 3, rouquidao: 0.4, velocidade: 0.85 }) },
  { id: 'bib_coelho', nome: 'Coelho', descricao: 'agudo e saltitante', p: voz({ tom: 7, formante: 6, velocidade: 1.1 }) },
  { id: 'bib_urso', nome: 'Urso', descricao: 'grave e fofo', p: voz({ tom: -6, formante: -5, grave: 4 }) },
  { id: 'bib_peixe', nome: 'Peixe', descricao: 'voz debaixo d’água', p: voz({ vibrato: 0.8, vibratoVel: 9, eco: 0.3, ecoTempo: 0.04, ecoRepeticoes: 0.5, agudo: -9 }) },
  { id: 'bib_alien', nome: 'Alien', descricao: 'metálico e trêmulo', p: voz({ roboMistura: 0.5, roboFreq: 300, tom: 3, vibrato: 0.3, vibratoVel: 7 }) },
  { id: 'bib_hamster', nome: 'Hamster', descricao: 'bem agudo e rápido', p: voz({ tom: 12, formante: 10, velocidade: 1.15 }) },
  { id: 'bib_gato', nome: 'Gato', descricao: 'agudo com vibrato', p: voz({ tom: 7, formante: 6, vibrato: 0.35, vibratoVel: 8 }) },
];

/** 3 opções para um personagem novo (sem sugestões próprias). */
export function sugeridosGenericos(): Preset[] {
  return ['bib_natural', 'bib_radio', 'bib_gigante'].map((id) => structuredClone(BIBLIOTECA.find((b) => b.id === id)!));
}
