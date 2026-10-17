// Gravação dos arquivos de áudio: WAV (original, sem perda), Opus em .ogg (leve, para o jogo)
// e a curva de volume (para mexer a boca/luzes do personagem enquanto ele fala).

// ---------------- WAV ----------------

/** Cria um WAV mono. bits = 16 ou 24. */
export function criarWav(x: Float32Array, taxa: number, bits: 16 | 24 = 24): Uint8Array {
  const bytes = bits / 8;
  const dados = x.length * bytes;
  const out = new Uint8Array(44 + dados);
  const v = new DataView(out.buffer);
  const txt = (pos: number, s: string) => { for (let i = 0; i < s.length; i++) out[pos + i] = s.charCodeAt(i); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + dados, true); txt(8, 'WAVE');
  txt(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true); v.setUint32(28, taxa * bytes, true); v.setUint16(32, bytes, true); v.setUint16(34, bits, true);
  txt(36, 'data'); v.setUint32(40, dados, true);
  let pos = 44;
  for (let i = 0; i < x.length; i++) {
    const s = Math.max(-1, Math.min(1, x[i]));
    if (bits === 16) { v.setInt16(pos, Math.round(s * 32767), true); pos += 2; }
    else {
      const n = Math.round(s * 8388607);
      out[pos] = n & 0xff; out[pos + 1] = (n >> 8) & 0xff; out[pos + 2] = (n >> 16) & 0xff; pos += 3;
    }
  }
  return out;
}

/** Lê um WAV PCM (16, 24 ou 32 bits float) e devolve mono + taxa. Usado ao importar um projeto. */
export function lerWav(dados: Uint8Array): { amostras: Float32Array; taxa: number } {
  const v = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  let pos = 12, taxa = 48000, canais = 1, bits = 16, formato = 1;
  while (pos + 8 <= dados.length) {
    const id = String.fromCharCode(dados[pos], dados[pos + 1], dados[pos + 2], dados[pos + 3]);
    const tam = v.getUint32(pos + 4, true);
    if (id === 'fmt ') {
      formato = v.getUint16(pos + 8, true); canais = v.getUint16(pos + 10, true);
      taxa = v.getUint32(pos + 12, true); bits = v.getUint16(pos + 22, true);
    } else if (id === 'data') {
      const b = bits / 8, n = Math.floor(tam / (b * canais));
      const am = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const p = pos + 8 + i * b * canais;
        if (formato === 3) am[i] = v.getFloat32(p, true);
        else if (bits === 16) am[i] = v.getInt16(p, true) / 32768;
        else { let s = dados[p] | (dados[p + 1] << 8) | (dados[p + 2] << 16); if (s & 0x800000) s -= 0x1000000; am[i] = s / 8388608; }
      }
      return { amostras: am, taxa };
    }
    pos += 8 + tam + (tam & 1);
  }
  throw new Error('WAV sem dados de áudio.');
}

// ---------------- Ogg Opus ----------------
// O Chrome codifica Opus pela WebCodecs (AudioEncoder). Aqui só "embalamos" os pacotes no formato Ogg.

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

function crcOgg(d: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < d.length; i++) crc = ((crc << 8) ^ TABELA_CRC[((crc >>> 24) & 0xff) ^ d[i]]) >>> 0;
  return crc >>> 0;
}

/** Monta uma página Ogg com um ou mais pacotes inteiros. */
function paginaOgg(pacotes: Uint8Array[], granulo: bigint, serial: number, seq: number, flags: number): Uint8Array {
  const segs: number[] = [];
  for (const p of pacotes) {
    let n = p.length;
    while (n >= 255) { segs.push(255); n -= 255; }
    segs.push(n);
  }
  const corpo = pacotes.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(27 + segs.length + corpo);
  const v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  out[4] = 0; out[5] = flags;
  v.setBigUint64(6, granulo, true);
  v.setUint32(14, serial, true); v.setUint32(18, seq, true); v.setUint32(22, 0, true);
  out[26] = segs.length;
  out.set(segs, 27);
  let pos = 27 + segs.length;
  for (const p of pacotes) { out.set(p, pos); pos += p.length; }
  v.setUint32(22, crcOgg(out), true);
  return out;
}

export function opusDisponivel(): boolean {
  return typeof (globalThis as { AudioEncoder?: unknown }).AudioEncoder === 'function';
}

/** Codifica mono 48 kHz em Opus e devolve o arquivo .ogg. */
export async function criarOggOpus(x: Float32Array, taxa: number, kbps = 48): Promise<Uint8Array> {
  if (!opusDisponivel()) throw new Error('Este navegador não codifica Opus (precisa do Chrome 94 ou mais novo).');
  const pacotes: { dados: Uint8Array; amostras: number }[] = [];
  let erro: unknown = null;
  let preSkip = 312;
  const enc = new AudioEncoder({
    output: (chunk, meta) => {
      const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d);
      const amostras = Math.round(((chunk.duration ?? 20000) * taxa) / 1e6);
      pacotes.push({ dados: d, amostras });
      const desc = meta?.decoderConfig?.description;
      if (desc) {
        const b = desc instanceof ArrayBuffer ? new Uint8Array(desc) : new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength);
        if (b.length >= 12 && String.fromCharCode(...b.slice(0, 8)) === 'OpusHead') preSkip = b[10] | (b[11] << 8);
      }
    },
    error: (e) => { erro = e; },
  });
  enc.configure({ codec: 'opus', sampleRate: taxa, numberOfChannels: 1, bitrate: kbps * 1000 });
  const bloco = taxa; // 1 s por vez
  for (let i = 0; i < x.length; i += bloco) {
    const parte = x.slice(i, i + bloco);
    const dado = new AudioData({ format: 'f32', sampleRate: taxa, numberOfFrames: parte.length, numberOfChannels: 1, timestamp: Math.round((i / taxa) * 1e6), data: parte });
    enc.encode(dado);
    dado.close();
  }
  await enc.flush();
  enc.close();
  if (erro) throw erro;

  // cabeçalhos obrigatórios do Opus no Ogg
  const cab = new Uint8Array(19);
  const vc = new DataView(cab.buffer);
  cab.set([..."OpusHead"].map((c) => c.charCodeAt(0)), 0);
  cab[8] = 1; cab[9] = 1; vc.setUint16(10, preSkip, true); vc.setUint32(12, taxa, true); vc.setInt16(16, 0, true); cab[18] = 0;
  const fornecedor = new TextEncoder().encode('Estudio de Dublagem Gabura');
  const tags = new Uint8Array(8 + 4 + fornecedor.length + 4);
  const vt = new DataView(tags.buffer);
  tags.set([..."OpusTags"].map((c) => c.charCodeAt(0)), 0);
  vt.setUint32(8, fornecedor.length, true); tags.set(fornecedor, 12); vt.setUint32(12 + fornecedor.length, 0, true);

  const serial = (Math.random() * 0xffffffff) >>> 0;
  const paginas: Uint8Array[] = [];
  let seq = 0;
  paginas.push(paginaOgg([cab], 0n, serial, seq++, 0x02));
  paginas.push(paginaOgg([tags], 0n, serial, seq++, 0));
  // ~1 s de áudio por página; o grânulo final diz o tamanho exato (corta a sobra do último pacote)
  let granulo = BigInt(preSkip);
  const fimExato = BigInt(preSkip + x.length);
  let grupo: Uint8Array[] = [];
  let amostrasGrupo = 0;
  for (let i = 0; i < pacotes.length; i++) {
    grupo.push(pacotes[i].dados);
    amostrasGrupo += pacotes[i].amostras;
    const ultimo = i === pacotes.length - 1;
    if (amostrasGrupo >= taxa || grupo.length >= 50 || ultimo) {
      granulo += BigInt(amostrasGrupo);
      const g = ultimo ? (granulo < fimExato ? granulo : fimExato) : granulo;
      paginas.push(paginaOgg(grupo, g, serial, seq++, ultimo ? 0x04 : 0));
      grupo = []; amostrasGrupo = 0;
    }
  }
  const total = paginas.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of paginas) { out.set(p, pos); pos += p.length; }
  return out;
}

// ---------------- Curva de volume ----------------

export interface CurvaVolume {
  versao_formato: 1;
  quadros_por_segundo: number;
  duracao: number;
  valores: number[];
}

/** Volume (0 a 1) a cada 1/30 s. O rig de fala do personagem usa para abrir a boca, piscar luzes etc. */
export function criarCurva(x: Float32Array, taxa: number, qps = 30): CurvaVolume {
  const bloco = Math.floor(taxa / qps);
  const brutos: number[] = [];
  for (let i = 0; i < x.length; i += bloco) {
    let s = 0; const fim = Math.min(x.length, i + bloco);
    for (let j = i; j < fim; j++) s += x[j] * x[j];
    brutos.push(Math.sqrt(s / Math.max(1, fim - i)));
  }
  const maior = Math.max(...brutos, 1e-9);
  let anterior = 0;
  const valores = brutos.map((r) => {
    const db = 20 * Math.log10(r / maior + 1e-9);
    let v = Math.max(0, Math.min(1, (db + 40) / 40)); // −40 dB → 0, máximo → 1
    v = v > anterior ? v : anterior * 0.6 + v * 0.4; // abre rápido, fecha suave
    anterior = v;
    return Math.round(v * 1000) / 1000;
  });
  return { versao_formato: 1, quadros_por_segundo: qps, duracao: Math.round((x.length / taxa) * 1000) / 1000, valores };
}
