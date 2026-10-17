// Cadeia completa de efeitos de voz.
// Ordem: corte → limpeza/tom/formante/velocidade/vocoder (espectral) → robô → rouquidão → equalizador
//        → rádio → vibrato → eco → sala → compressor → nivelar volume.
// A gravação guardada é sempre a voz limpa; o efeito é aplicado aqui, quando você ouve ou exporta.

import { processarEspectral } from './espectral';
import type { ParametrosVoz } from './parametros';

export const TAXA = 48000;

/** Corta a gravação entre início e fim (segundos). */
export function cortar(x: Float32Array, inicio: number, fim: number, taxa = TAXA): Float32Array {
  const a = Math.max(0, Math.floor(inicio * taxa));
  const b = Math.min(x.length, Math.ceil(fim * taxa));
  return x.slice(a, Math.max(a, b));
}

/** Resposta de sala sintética: ruído que vai sumindo (como bater palma numa sala). */
function respostaDeSala(ctx: BaseAudioContext, tamanho: number): AudioBuffer {
  const dur = 0.25 + tamanho * 2.2;
  const n = Math.floor(dur * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  let semente = 12345;
  const aleatorio = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = aleatorio() * Math.pow(1 - t, 2.2) * (i < 64 ? i / 64 : 1);
    }
  }
  return buf;
}

/** Curva de saturação suave para a rouquidão. */
function curvaRouca(forca: number): Float32Array<ArrayBuffer> {
  const n = 2048, c = new Float32Array(n);
  const k = 1 + forca * 18;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  return c;
}

/** Ganho para deixar todas as falas com volume parecido (~ −18 dBFS nas partes faladas, pico até −1 dBFS). */
function nivelar(x: Float32Array, volumeDb: number): Float32Array {
  const bloco = 1024;
  const energias: number[] = [];
  let pico = 0;
  for (let i = 0; i < x.length; i++) pico = Math.max(pico, Math.abs(x[i]));
  for (let i = 0; i + bloco <= x.length; i += bloco) {
    let s = 0;
    for (let j = 0; j < bloco; j++) s += x[i + j] * x[i + j];
    energias.push(Math.sqrt(s / bloco));
  }
  if (pico < 1e-6) return x;
  const maior = Math.max(...energias, 1e-9);
  const falados = energias.filter((e) => e > maior * 0.1); // ignora os silêncios
  const rms = falados.length ? Math.sqrt(falados.reduce((a, e) => a + e * e, 0) / falados.length) : maior;
  const alvo = Math.pow(10, -18 / 20) * Math.pow(10, volumeDb / 20);
  const ganho = Math.min(alvo / rms, Math.pow(10, -1 / 20) / pico);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = x[i] * ganho;
  return y;
}

/** Tira o silêncio que sobrou no fim (cauda de eco e sala já acabou). */
function aparaFim(x: Float32Array, taxa: number): Float32Array {
  let fim = x.length;
  const limiar = 0.0008;
  while (fim > 0 && Math.abs(x[fim - 1]) < limiar) fim--;
  return x.slice(0, Math.min(x.length, fim + Math.floor(taxa * 0.05)));
}

/** Aplica toda a cadeia de efeitos. Devolve um Float32Array mono na mesma taxa. */
export async function aplicarVoz(limpo: Float32Array, p: ParametrosVoz, taxa = TAXA): Promise<Float32Array> {
  // 1) efeitos espectrais
  const x = processarEspectral(limpo, taxa, p);
  if (x.length === 0) return x;

  // 2) efeitos de "pedal" no OfflineAudioContext (renderiza mais rápido que o tempo real)
  const temCauda = p.eco > 0 || p.sala > 0;
  const cauda = temCauda ? Math.min(3, p.eco > 0 ? p.ecoTempo * 8 : 0) + (p.sala > 0 ? 0.3 + p.salaTamanho * 2.2 : 0) : 0;
  const total = x.length + Math.ceil((cauda + 0.05) * taxa);
  const ctx = new OfflineAudioContext(1, total, taxa);
  const buf = ctx.createBuffer(1, x.length, taxa);
  buf.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buf;

  let atual: AudioNode = fonte;

  // robô: modulação em anel (a voz multiplicada por uma onda senoidal)
  if (p.roboMistura > 0) {
    const anel = ctx.createGain();
    anel.gain.value = 1 - p.roboMistura;
    const osc = ctx.createOscillator();
    osc.frequency.value = p.roboFreq;
    const prof = ctx.createGain();
    prof.gain.value = p.roboMistura;
    osc.connect(prof).connect(anel.gain);
    osc.start();
    atual.connect(anel);
    atual = anel;
  }

  // rouquidão: saturação misturada com a voz original
  if (p.rouquidao > 0) {
    const pre = ctx.createGain(); pre.gain.value = 1 + p.rouquidao * 2;
    const sat = ctx.createWaveShaper(); sat.curve = curvaRouca(p.rouquidao); sat.oversample = '4x';
    const mol = ctx.createGain(); mol.gain.value = p.rouquidao * 0.7;
    const seco = ctx.createGain(); seco.gain.value = 1 - p.rouquidao * 0.5;
    const soma = ctx.createGain();
    atual.connect(pre).connect(sat).connect(mol).connect(soma);
    atual.connect(seco).connect(soma);
    atual = soma;
  }

  // equalizador de 3 faixas
  const grave = ctx.createBiquadFilter(); grave.type = 'lowshelf'; grave.frequency.value = 220; grave.gain.value = p.grave;
  const medio = ctx.createBiquadFilter(); medio.type = 'peaking'; medio.frequency.value = 1200; medio.Q.value = 0.9; medio.gain.value = p.medio;
  const agudo = ctx.createBiquadFilter(); agudo.type = 'highshelf'; agudo.frequency.value = 4200; agudo.gain.value = p.agudo;
  atual.connect(grave).connect(medio).connect(agudo);
  atual = agudo;

  // rádio: alto-falante pequeno (sem graves e sem agudos, com um "nariz" nos médios)
  if (p.radio > 0) {
    const pa = ctx.createBiquadFilter(); pa.type = 'highpass'; pa.frequency.value = 450; pa.Q.value = 0.8;
    const pb = ctx.createBiquadFilter(); pb.type = 'lowpass'; pb.frequency.value = 3200; pb.Q.value = 0.8;
    const nariz = ctx.createBiquadFilter(); nariz.type = 'peaking'; nariz.frequency.value = 1600; nariz.Q.value = 1.2; nariz.gain.value = 6;
    const mol = ctx.createGain(); mol.gain.value = p.radio * 1.6;
    const seco = ctx.createGain(); seco.gain.value = 1 - p.radio;
    const soma = ctx.createGain();
    atual.connect(pa).connect(pb).connect(nariz).connect(mol).connect(soma);
    atual.connect(seco).connect(soma);
    atual = soma;
  }

  // vibrato: um atraso que balança, fazendo o tom tremer
  if (p.vibrato > 0) {
    const atraso = ctx.createDelay(0.05);
    atraso.delayTime.value = 0.008;
    const lfo = ctx.createOscillator(); lfo.frequency.value = p.vibratoVel;
    const prof = ctx.createGain(); prof.gain.value = (0.0035 * p.vibrato * 6) / p.vibratoVel;
    lfo.connect(prof).connect(atraso.delayTime);
    lfo.start();
    atual.connect(atraso);
    atual = atraso;
  }

  const saida = ctx.createGain();

  // eco: repetições que voltam cada vez mais fracas
  if (p.eco > 0) {
    const atraso = ctx.createDelay(1);
    atraso.delayTime.value = p.ecoTempo;
    const volta = ctx.createGain(); volta.gain.value = p.ecoRepeticoes;
    const mol = ctx.createGain(); mol.gain.value = p.eco;
    atual.connect(atraso);
    atraso.connect(volta).connect(atraso);
    atraso.connect(mol).connect(saida);
  }

  // sala: reverberação
  if (p.sala > 0) {
    const conv = ctx.createConvolver();
    conv.buffer = respostaDeSala(ctx, p.salaTamanho);
    const mol = ctx.createGain(); mol.gain.value = p.sala * 0.6;
    atual.connect(conv).connect(mol).connect(saida);
  }

  atual.connect(saida);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15; comp.knee.value = 8;
  saida.connect(comp).connect(ctx.destination);

  fonte.start();
  const rend = await ctx.startRendering();
  let y: Float32Array = rend.getChannelData(0).slice();
  if (temCauda) y = aparaFim(y, taxa);
  else y = y.slice(0, x.length);
  return nivelar(y, p.volume);
}

/** Acha início e fim da fala (tira silêncio do começo e do fim, deixando 0,12 s de folga). */
export function acharFala(x: Float32Array, taxa = TAXA): { inicio: number; fim: number } {
  const bloco = Math.floor(taxa * 0.01);
  const niveis: number[] = [];
  for (let i = 0; i + bloco <= x.length; i += bloco) {
    let s = 0;
    for (let j = 0; j < bloco; j++) s += x[i + j] * x[i + j];
    niveis.push(Math.sqrt(s / bloco));
  }
  if (niveis.length === 0) return { inicio: 0, fim: x.length / taxa };
  const ordenados = [...niveis].sort((a, b) => a - b);
  const fundo = ordenados[Math.floor(ordenados.length * 0.1)];
  const maior = ordenados[ordenados.length - 1];
  const limiar = Math.max(fundo * 3, maior * 0.06);
  let a = niveis.findIndex((n) => n > limiar);
  let b = niveis.length - 1 - [...niveis].reverse().findIndex((n) => n > limiar);
  if (a < 0) { a = 0; b = niveis.length - 1; }
  const folga = 0.12;
  return {
    inicio: Math.max(0, (a * bloco) / taxa - folga),
    fim: Math.min(x.length / taxa, ((b + 1) * bloco) / taxa + folga),
  };
}
