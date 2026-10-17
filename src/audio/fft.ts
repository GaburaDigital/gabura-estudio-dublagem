// FFT (transformada rápida de Fourier) radix-2, no lugar.
// É ela que "abre" o som em frequências para mudar o tom, o tamanho da voz e limpar ruído.
// Escrita à mão para não depender de biblioteca e para servir de material de aula.

export class FFT {
  readonly n: number;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly reverso: Uint32Array;

  constructor(n: number) {
    if ((n & (n - 1)) !== 0) throw new Error('O tamanho da FFT precisa ser potência de 2.');
    this.n = n;
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    // tabela de bits invertidos: reorganiza a entrada antes das "borboletas"
    this.reverso = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.reverso[i] = r;
    }
  }

  /** Transforma (re, im) no lugar. inversa=true faz a volta (já dividida por n). */
  transformar(re: Float64Array, im: Float64Array, inversa = false): void {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const j = this.reverso[i];
      if (j > i) {
        const tr = re[i]; re[i] = re[j]; re[j] = tr;
        const ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    const sinal = inversa ? 1 : -1;
    for (let tam = 2; tam <= n; tam *= 2) {
      const meio = tam / 2;
      const passo = n / tam;
      for (let i = 0; i < n; i += tam) {
        for (let j = 0; j < meio; j++) {
          const wr = this.cos[j * passo];
          const wi = sinal * this.sin[j * passo];
          const a = i + j, b = a + meio;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inversa) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
}

/** Janela de Hann: suaviza as bordas de cada pedacinho de som. */
export function janelaHann(n: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}
