// Tocar as tomadas (limpas ou com efeito) e guardar o resultado do efeito para não recalcular.

import { aplicarVoz, cortar, TAXA } from '../audio/efeitos';
import { assinatura, type ParametrosVoz } from '../audio/parametros';
import { armazenamento } from '../dados/armazenamento';
import type { Tomada } from '../dados/modelo';

let ctx: AudioContext | null = null;
let atual: { fonte: AudioBufferSourceNode; inicio: number; chave: string } | null = null;
const ouvintes = new Set<() => void>();

function contexto(): AudioContext {
  if (!ctx) ctx = new AudioContext({ sampleRate: TAXA });
  void ctx.resume();
  return ctx;
}

/** Avisa quando algo começa ou para de tocar (para trocar ícones ▶/■). */
export function aoTrocarReproducao(f: () => void): void { ouvintes.add(f); }
const avisar = () => ouvintes.forEach((f) => f());

export function parar(): void {
  if (atual) { try { atual.fonte.stop(); } catch { /* já parou */ } atual = null; avisar(); }
}

/** O que está tocando agora (chave) e há quantos segundos. */
export function tocandoAgora(): { chave: string; tempo: number } | null {
  if (!atual || !ctx) return null;
  return { chave: atual.chave, tempo: ctx.currentTime - atual.inicio };
}

/** Toca amostras. "chave" identifica o que está tocando (ex.: "t_abc|efeito"). */
export function tocar(x: Float32Array, chave: string, aoAcabar?: () => void): void {
  parar();
  const c = contexto();
  const buf = c.createBuffer(1, Math.max(1, x.length), TAXA);
  buf.copyToChannel(x as Float32Array<ArrayBuffer>, 0);
  const fonte = c.createBufferSource();
  fonte.buffer = buf;
  fonte.connect(c.destination);
  const meu = { fonte, inicio: c.currentTime + 0.02, chave };
  fonte.onended = () => { if (atual === meu) { atual = null; avisar(); } aoAcabar?.(); };
  fonte.start(meu.inicio);
  atual = meu;
  avisar();
}

// ---------- cache ----------
const brutos = new Map<string, Float32Array>();
const renderizados = new Map<string, Float32Array>();

export async function audioBruto(t: Tomada): Promise<Float32Array | null> {
  if (brutos.has(t.id)) return brutos.get(t.id)!;
  const a = await armazenamento.lerAudio(t.id);
  if (a) brutos.set(t.id, a);
  return a;
}

export function guardarBruto(id: string, x: Float32Array): void { brutos.set(id, x); }
export function esquecerTomada(id: string): void {
  brutos.delete(id);
  for (const k of [...renderizados.keys()]) if (k.startsWith(id + '|')) renderizados.delete(k);
}

/** A tomada cortada, sem efeito. */
export async function audioLimpo(t: Tomada): Promise<Float32Array | null> {
  const b = await audioBruto(t);
  return b ? cortar(b, t.inicio, t.fim) : null;
}

/** A tomada cortada com o efeito (calcula uma vez e guarda). */
export async function audioComEfeito(t: Tomada, p: ParametrosVoz): Promise<Float32Array | null> {
  const chave = `${t.id}|${t.inicio.toFixed(3)}|${t.fim.toFixed(3)}|${assinatura(p)}`;
  if (renderizados.has(chave)) return renderizados.get(chave)!;
  const limpo = await audioLimpo(t);
  if (!limpo) return null;
  const y = await aplicarVoz(limpo, p);
  if (renderizados.size > 40) renderizados.delete(renderizados.keys().next().value!);
  renderizados.set(chave, y);
  return y;
}
