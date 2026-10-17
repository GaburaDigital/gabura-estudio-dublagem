// Efeitos que precisam "abrir" o som em frequências (vocoder de fase):
//  - limpeza de ruído (subtração espectral),
//  - tom (pitch) e formante (tamanho da voz) separados,
//  - velocidade sem mudar o tom,
//  - vocoder retrô (a voz "cantada" por um sintetizador em nota fixa).
//
// Analogia com a Godot: é como um AudioEffectPitchShift, só que com controle do formante,
// o que permite fazer um hamster (tom e formante para cima) ou um gigante (os dois para baixo).

import { FFT, janelaHann } from './fft';
import type { ParametrosVoz } from './parametros';

const N = 2048;          // tamanho de cada pedacinho analisado (~43 ms a 48 kHz)
const SOBREPOSICAO = 4;  // cada pedacinho começa 1/4 depois do anterior
const SALTO = N / SOBREPOSICAO;

/** Diz se algum efeito desta etapa está ligado (senão, o som passa sem mudança nenhuma). */
export function precisaEspectral(p: ParametrosVoz): boolean {
  return p.tom !== 0 || p.formante !== 0 || p.velocidade !== 1 || p.vocoderMistura > 0 || p.limpeza > 0;
}

/** Média da magnitude dos pedacinhos mais silenciosos: o "retrato" do ruído de fundo. */
function perfilDoRuido(x: Float32Array, fft: FFT, janela: Float64Array): Float64Array {
  const metade = N / 2 + 1;
  const quadros: { energia: number; mag: Float64Array }[] = [];
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let pos = 0; pos + N <= x.length; pos += SALTO) {
    let energia = 0;
    for (let i = 0; i < N; i++) { const v = x[pos + i]; re[i] = v * janela[i]; im[i] = 0; energia += v * v; }
    fft.transformar(re, im);
    const mag = new Float64Array(metade);
    for (let k = 0; k < metade; k++) mag[k] = Math.hypot(re[k], im[k]);
    quadros.push({ energia, mag });
  }
  const ruido = new Float64Array(metade);
  if (quadros.length === 0) return ruido;
  quadros.sort((a, b) => a.energia - b.energia);
  const usar = Math.max(3, Math.floor(quadros.length * 0.12));
  const lista = quadros.slice(0, Math.min(usar, quadros.length));
  for (const q of lista) for (let k = 0; k < metade; k++) ruido[k] += q.mag[k] / lista.length;
  return ruido;
}

/** Envelope espectral: a "forma" do timbre (os formantes), sem os harmônicos. Média no domínio log. */
function envelope(mag: Float64Array, saida: Float64Array, raio: number): void {
  const n = mag.length;
  const logm = new Float64Array(n);
  for (let k = 0; k < n; k++) logm[k] = Math.log(mag[k] + 1e-9);
  // média móvel com soma acumulada, aplicada duas vezes (fica triangular, mais suave)
  const passar = (ent: Float64Array, sai: Float64Array) => {
    const acum = new Float64Array(n + 1);
    for (let k = 0; k < n; k++) acum[k + 1] = acum[k] + ent[k];
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - raio), b = Math.min(n, k + raio + 1);
      sai[k] = (acum[b] - acum[a]) / (b - a);
    }
  };
  const tmp = new Float64Array(n);
  passar(logm, tmp); passar(tmp, logm);
  for (let k = 0; k < n; k++) saida[k] = Math.exp(logm[k]);
}

/** Lê o envelope numa posição fracionária (interpolação linear). */
function lerEnvelope(env: Float64Array, pos: number): number {
  if (pos < 0 || pos >= env.length - 1) return 0;
  const i = Math.floor(pos), f = pos - i;
  return env[i] * (1 - f) + env[i + 1] * f;
}

export function processarEspectral(x: Float32Array, taxa: number, p: ParametrosVoz): Float32Array {
  if (!precisaEspectral(p) || x.length < N) return x;

  const fft = new FFT(N);
  const janela = janelaHann(N);
  const metade = N / 2 + 1;
  const fatorTom = Math.pow(2, p.tom / 12);
  const fatorFormante = Math.pow(2, p.formante / 12);
  const mudaTimbre = p.tom !== 0 || p.formante !== 0;
  const saltoSaida = Math.max(64, Math.round(SALTO / p.velocidade));
  const binHz = taxa / N;

  // limpeza de ruído
  const ruido = p.limpeza > 0 ? perfilDoRuido(x, fft, janela) : null;
  const forcaLimpeza = p.limpeza * 2.2;
  const ganhoAnterior = new Float64Array(metade).fill(1);

  // vocoder: frequência da nota e harmônicos até 8 kHz
  const f0 = 440 * Math.pow(2, (p.vocoderNota - 69) / 12);
  const harmonicos: number[] = [];
  for (let h = 1; h * f0 < Math.min(8000, taxa / 2 - binHz); h++) harmonicos.push((h * f0) / binHz);
  const fasesVocoder = new Float64Array(harmonicos.length);

  // entrada com folga no fim para o último pedacinho
  const entrada = new Float32Array(x.length + N);
  entrada.set(x);
  const totalQuadros = Math.floor((entrada.length - N) / SALTO) + 1;
  const tamSaida = (totalQuadros - 1) * saltoSaida + N;
  const saida = new Float64Array(tamSaida);
  const normal = new Float64Array(tamSaida);

  const re = new Float64Array(N), im = new Float64Array(N);
  const mag = new Float64Array(metade), freq = new Float64Array(metade);
  const faseAnterior = new Float64Array(metade);
  const faseSoma = new Float64Array(metade);
  const faseOriginal = new Float64Array(metade);
  // só limpeza (sem mudar tom, formante, velocidade nem vocoder): mantém as fases originais, som idêntico
  const soLimpeza = !mudaTimbre && p.velocidade === 1 && p.vocoderMistura === 0;
  const env = new Float64Array(metade);
  const sinMag = new Float64Array(metade), sinFreq = new Float64Array(metade);
  const raioEnv = Math.max(4, Math.round(260 / binHz));
  const esperado = (2 * Math.PI * SALTO) / N;

  for (let q = 0; q < totalQuadros; q++) {
    const posEnt = q * SALTO, posSai = q * saltoSaida;
    let energiaEntrada = 0;
    for (let i = 0; i < N; i++) { re[i] = entrada[posEnt + i] * janela[i]; im[i] = 0; }
    fft.transformar(re, im);

    // análise: magnitude e frequência "verdadeira" de cada faixa
    for (let k = 0; k < metade; k++) {
      let m = Math.hypot(re[k], im[k]);
      const fase = Math.atan2(im[k], re[k]);
      if (ruido) {
        let g = 1 - (forcaLimpeza * ruido[k]) / (m + 1e-12);
        g = Math.max(0.06, Math.min(1, g));
        g = Math.max(g, ganhoAnterior[k] * 0.55); // desce devagar: evita "chiado de bolhas"
        ganhoAnterior[k] = g;
        m *= g;
      }
      let d = fase - faseAnterior[k] - k * esperado;
      faseAnterior[k] = fase;
      faseOriginal[k] = fase;
      d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
      freq[k] = k + (d * N) / (2 * Math.PI * SALTO);
      mag[k] = m;
      energiaEntrada += m * m;
    }

    // síntese: desloca as faixas pelo tom e reaplica o envelope no lugar do formante
    sinMag.fill(0); sinFreq.fill(0);
    if (mudaTimbre) {
      envelope(mag, env, raioEnv);
      for (let k = 0; k < metade; k++) {
        const j = Math.round(k * fatorTom);
        if (j >= metade) break;
        sinMag[j] += mag[k] / (env[k] + 1e-12);
        sinFreq[j] = freq[k] * fatorTom;
      }
      for (let j = 0; j < metade; j++) sinMag[j] *= lerEnvelope(env, j / fatorFormante);
    } else {
      sinMag.set(mag); sinFreq.set(freq);
    }

    // espectro final (parte da voz)
    const misturaVoc = p.vocoderMistura;
    for (let k = 0; k < metade; k++) {
      faseSoma[k] = soLimpeza ? faseOriginal[k] : faseSoma[k] + (2 * Math.PI * sinFreq[k] * saltoSaida) / N;
      const m = sinMag[k] * (1 - misturaVoc);
      re[k] = m * Math.cos(faseSoma[k]);
      im[k] = m * Math.sin(faseSoma[k]);
    }

    // vocoder: harmônicos da nota fixa, cada um com a força do envelope da voz
    if (misturaVoc > 0) {
      if (!mudaTimbre) envelope(mag, env, raioEnv);
      const vRe = new Float64Array(metade), vIm = new Float64Array(metade);
      let energiaVoc = 0;
      for (let h = 0; h < harmonicos.length; h++) {
        const pos = harmonicos[h];
        const b = Math.round(pos);
        if (b >= metade) break;
        fasesVocoder[h] += (2 * Math.PI * pos * saltoSaida) / N;
        const a = lerEnvelope(env, pos / fatorFormante);
        vRe[b] += a * Math.cos(fasesVocoder[h]);
        vIm[b] += a * Math.sin(fasesVocoder[h]);
      }
      for (let k = 0; k < metade; k++) energiaVoc += vRe[k] * vRe[k] + vIm[k] * vIm[k];
      // o vocoder fica com a mesma energia da voz neste pedacinho
      const ganho = energiaVoc > 0 ? Math.sqrt(energiaEntrada / energiaVoc) * misturaVoc : 0;
      for (let k = 0; k < metade; k++) { re[k] += vRe[k] * ganho; im[k] += vIm[k] * ganho; }
    }

    // espelha a metade de cima (sinal real) e volta para o tempo
    for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    im[0] = 0; im[N / 2] = 0;
    fft.transformar(re, im, true);
    for (let i = 0; i < N; i++) {
      saida[posSai + i] += re[i] * janela[i];
      normal[posSai + i] += janela[i] * janela[i];
    }
  }

  const tamFinal = Math.round(x.length / p.velocidade);
  const res = new Float32Array(tamFinal);
  for (let i = 0; i < tamFinal && i < tamSaida; i++) res[i] = normal[i] > 1e-3 ? saida[i] / normal[i] : 0;
  return res;
}
