// Parâmetros de uma voz (um "preset").
// Todos os controles da tela de ajuste viram números aqui. Zero (ou 1, na velocidade) = sem efeito.

export interface ParametrosVoz {
  /** Tom em semitons (−12 a +12). +12 = uma oitava acima. */
  tom: number;
  /** Formante em semitons (−12 a +12): o "tamanho" da voz. Positivo = voz de bicho pequeno; negativo = gigante. */
  formante: number;
  /** Velocidade da fala (0,8 a 1,3). Não muda o tom. */
  velocidade: number;
  /** Robô: frequência da modulação em anel (Hz) e quanto dela entra (0 a 1). */
  roboFreq: number;
  roboMistura: number;
  /** Vocoder: nota MIDI do sintetizador e quanto dele entra (0 a 1). */
  vocoderNota: number;
  vocoderMistura: number;
  /** Eco: quanto entra (0 a 1), tempo entre repetições (s) e quanto cada repetição volta (0 a 0,85). */
  eco: number;
  ecoTempo: number;
  ecoRepeticoes: number;
  /** Sala (reverberação): quanto entra (0 a 1) e tamanho da sala (0 a 1). */
  sala: number;
  salaTamanho: number;
  /** Rádio (0 a 1): corta graves e agudos, como alto-falante pequeno. */
  radio: number;
  /** Equalizador em dB (−12 a +12). */
  grave: number;
  medio: number;
  agudo: number;
  /** Rouquidão (0 a 1): saturação suave. */
  rouquidao: number;
  /** Vibrato: profundidade (0 a 1) e velocidade (Hz). */
  vibrato: number;
  vibratoVel: number;
  /** Limpeza de ruído (0 a 1). */
  limpeza: number;
  /** Volume final em dB (−12 a +6), depois de nivelar. */
  volume: number;
}

export const PARAMETROS_NEUTROS: ParametrosVoz = {
  tom: 0, formante: 0, velocidade: 1,
  roboFreq: 50, roboMistura: 0,
  vocoderNota: 45, vocoderMistura: 0,
  eco: 0, ecoTempo: 0.18, ecoRepeticoes: 0.3,
  sala: 0, salaTamanho: 0.4,
  radio: 0,
  grave: 0, medio: 0, agudo: 0,
  rouquidao: 0,
  vibrato: 0, vibratoVel: 6,
  limpeza: 0.5,
  volume: 0,
};

/** Cria parâmetros completos a partir de só alguns valores. */
export function voz(p: Partial<ParametrosVoz>): ParametrosVoz {
  return { ...PARAMETROS_NEUTROS, ...p };
}

/** Descrição de cada controle da tela de ajuste (rótulo, faixa, passo e unidade). */
export interface Controle {
  chave: keyof ParametrosVoz;
  rotulo: string;
  min: number;
  max: number;
  passo: number;
  unidade: string;
  grupo: string;
}

export const CONTROLES: Controle[] = [
  { chave: 'tom', rotulo: 'Tom', min: -12, max: 12, passo: 0.5, unidade: 'st', grupo: 'Voz' },
  { chave: 'formante', rotulo: 'Formante (tamanho)', min: -12, max: 12, passo: 0.5, unidade: 'st', grupo: 'Voz' },
  { chave: 'velocidade', rotulo: 'Velocidade', min: 0.8, max: 1.3, passo: 0.01, unidade: '×', grupo: 'Voz' },
  { chave: 'vibrato', rotulo: 'Vibrato', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Voz' },
  { chave: 'vibratoVel', rotulo: 'Vibrato · velocidade', min: 2, max: 12, passo: 0.1, unidade: 'Hz', grupo: 'Voz' },
  { chave: 'rouquidao', rotulo: 'Rouquidão', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Voz' },
  { chave: 'roboMistura', rotulo: 'Robô · mistura', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Robô' },
  { chave: 'roboFreq', rotulo: 'Robô · frequência', min: 20, max: 600, passo: 1, unidade: 'Hz', grupo: 'Robô' },
  { chave: 'vocoderMistura', rotulo: 'Vocoder · mistura', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Robô' },
  { chave: 'vocoderNota', rotulo: 'Vocoder · nota', min: 28, max: 72, passo: 1, unidade: 'nota', grupo: 'Robô' },
  { chave: 'eco', rotulo: 'Eco', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Espaço' },
  { chave: 'ecoTempo', rotulo: 'Eco · tempo', min: 0.02, max: 0.6, passo: 0.01, unidade: 's', grupo: 'Espaço' },
  { chave: 'ecoRepeticoes', rotulo: 'Eco · repetições', min: 0, max: 0.85, passo: 0.01, unidade: '', grupo: 'Espaço' },
  { chave: 'sala', rotulo: 'Sala', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Espaço' },
  { chave: 'salaTamanho', rotulo: 'Sala · tamanho', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Espaço' },
  { chave: 'radio', rotulo: 'Rádio', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Timbre' },
  { chave: 'grave', rotulo: 'Grave', min: -12, max: 12, passo: 0.5, unidade: 'dB', grupo: 'Timbre' },
  { chave: 'medio', rotulo: 'Médio', min: -12, max: 12, passo: 0.5, unidade: 'dB', grupo: 'Timbre' },
  { chave: 'agudo', rotulo: 'Agudo', min: -12, max: 12, passo: 0.5, unidade: 'dB', grupo: 'Timbre' },
  { chave: 'limpeza', rotulo: 'Limpeza de ruído', min: 0, max: 1, passo: 0.01, unidade: '', grupo: 'Acabamento' },
  { chave: 'volume', rotulo: 'Volume final', min: -12, max: 6, passo: 0.5, unidade: 'dB', grupo: 'Acabamento' },
];

/** Nome da nota MIDI (ex.: 45 → "Lá2"), para o controle do vocoder. */
export function nomeNota(midi: number): string {
  const nomes = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
  const m = Math.round(midi);
  return nomes[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/** Uma "impressão digital" dos parâmetros: serve para saber se o efeito mudou. */
export function assinatura(p: ParametrosVoz): string {
  return (Object.keys(PARAMETROS_NEUTROS) as (keyof ParametrosVoz)[]).map((k) => (+p[k]).toFixed(3)).join('|');
}
