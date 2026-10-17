// Ações usadas por mais de uma tela: microfone, gravar uma tomada, apagar, marcar estrela,
// e o espelho na pasta do projeto.

import { acharFala, TAXA } from '../audio/efeitos';
import { criarWav } from '../audio/arquivos_audio';
import { Gravador } from '../audio/gravador';
import { armazenamento } from '../dados/armazenamento';
import { MAX_TOMADAS, novoId, type Fala, type Tomada } from '../dados/modelo';
import { apagarDaPasta, escreverNaPasta } from '../dados/pasta';
import { avisar, confirmar } from './dialogos';
import { estado, mudou, projeto, redesenhar } from './estado';
import { esquecerTomada, guardarBruto, parar as pararSom } from './reprodutor';

export const gravador = new Gravador();

/** Ouvintes do nível do microfone (medidor) e das amostras ao vivo (onda). */
export const aoVivo = { nivel: (_p: number) => {}, amostras: (_x: Float32Array) => {} };
gravador.aoNivel = (pico, novas) => { aoVivo.nivel(pico); if (novas) aoVivo.amostras(novas); };

export async function ligarMicrofone(): Promise<boolean> {
  try {
    const p = projeto();
    await gravador.ligar(p.ajustes.microfone, p.ajustes.limpezaDoNavegador);
    if (!p.ajustes.microfone && gravador.microfoneAtual) { p.ajustes.microfone = gravador.microfoneAtual; mudou(false); }
    redesenhar();
    return true;
  } catch (e) {
    const nome = (e as DOMException).name;
    if (nome === 'NotAllowedError') avisar('O Chrome não liberou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.', 'erro');
    else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
      avisar('Microfone não encontrado. Confira se o headset está conectado e escolha de novo em Ajustes.', 'erro');
      projeto().ajustes.microfone = ''; mudou(false);
    } else avisar('Não foi possível ligar o microfone: ' + (e as Error).message, 'erro');
    redesenhar();
    return false;
  }
}

// ---------- pasta do projeto ----------
async function espelhar(acao: (pasta: FileSystemDirectoryHandle) => Promise<void>): Promise<void> {
  if (!estado.pasta || estado.pastaPrecisaPermissao) return;
  try { await acao(estado.pasta); } catch (e) {
    estado.pastaPrecisaPermissao = true;
    avisar('Não consegui salvar na pasta do projeto (' + (e as Error).message + '). Reconecte a pasta.', 'erro');
    redesenhar();
  }
}

export function caminhoTomada(f: Fala, t: Tomada): string {
  return `limpo/${f.id}/${f.id}_t${t.criada.toString(36)}.wav`;
}

export async function salvarProjetoNaPasta(): Promise<void> {
  await espelhar((pasta) => escreverNaPasta(pasta, 'projeto.json', JSON.stringify(projeto(), null, 2)));
}

/** Copia todas as tomadas para a pasta (usado ao escolher uma pasta nova). */
export async function copiarTudoParaPasta(): Promise<void> {
  for (const f of projeto().falas) for (const t of f.tomadas) {
    const a = await armazenamento.lerAudio(t.id);
    if (a) await espelhar((pasta) => escreverNaPasta(pasta, caminhoTomada(f, t), criarWav(a, TAXA, 24)));
  }
  await salvarProjetoNaPasta();
}

// ---------- gravar ----------
export const contagem = { valor: 0 };

export function podeGravar(f: Fala): string | null {
  if (f.tomadas.length >= MAX_TOMADAS) return `Limite de ${MAX_TOMADAS} tomadas: apague uma para gravar outra.`;
  return null;
}

let cancelarContagem: (() => void) | null = null;

/** Começa a gravar a fala (com contagem 3, 2, 1 se estiver ligada). */
export async function comecarGravacao(f: Fala): Promise<void> {
  if (estado.gravandoFala || cancelarContagem) return;
  const motivo = podeGravar(f);
  if (motivo) { avisar(motivo, 'erro'); return; }
  pararSom();
  if (!gravador.ligado && !(await ligarMicrofone())) return;
  if (projeto().ajustes.contagem) {
    const cancelada = await new Promise<boolean>((ok) => {
      let n = 3;
      contagem.valor = n; redesenhar();
      const id = window.setInterval(() => {
        n--; contagem.valor = n; redesenhar();
        if (n <= 0) { window.clearInterval(id); cancelarContagem = null; ok(false); }
      }, 450);
      cancelarContagem = () => { window.clearInterval(id); cancelarContagem = null; contagem.valor = 0; redesenhar(); ok(true); };
    });
    if (cancelada) return;
  }
  gravador.comecar();
  estado.gravandoFala = f.id;
  redesenhar();
}

/** Para a gravação e guarda a tomada (com corte automático do silêncio). */
export async function pararGravacao(): Promise<void> {
  if (cancelarContagem) { cancelarContagem(); return; }
  const f = projeto().falas.find((x) => x.id === estado.gravandoFala);
  estado.gravandoFala = '';
  if (!f) return;
  const x = await gravador.parar();
  if (x.length < TAXA * 0.3) { avisar('Gravação curta demais; tente de novo.', 'info'); redesenhar(); return; }
  const corte = acharFala(x);
  const t: Tomada = { id: novoId('t'), criada: Date.now(), duracao: x.length / TAXA, inicio: corte.inicio, fim: corte.fim };
  await armazenamento.salvarAudio(t.id, x);
  guardarBruto(t.id, x);
  f.tomadas.push(t);
  if (!f.favorita) f.favorita = t.id; // a primeira tomada já ganha estrela; você troca quando quiser
  estado.tomadaSel = t.id;
  mudou();
  void espelhar(async (pasta) => {
    await escreverNaPasta(pasta, caminhoTomada(f, t), criarWav(x, TAXA, 24));
    await escreverNaPasta(pasta, 'projeto.json', JSON.stringify(projeto(), null, 2));
  });
}

export async function alternarGravacao(f: Fala): Promise<void> {
  if (estado.gravandoFala || cancelarContagem) await pararGravacao();
  else await comecarGravacao(f);
}

// ---------- tomadas ----------
export function marcarFavorita(f: Fala, t: Tomada): void {
  f.favorita = t.id;
  mudou();
  void salvarProjetoNaPasta();
}

/** Apaga uma tomada, sempre perguntando antes. */
export async function apagarTomada(f: Fala, t: Tomada): Promise<void> {
  const n = f.tomadas.indexOf(t) + 1;
  const ehFavorita = f.favorita === t.id;
  const ok = await confirmar(
    `Apagar a tomada ${n}?`,
    (ehFavorita ? 'Esta é a tomada com estrela. ' : '') + 'A gravação será apagada deste computador e não dá para desfazer.',
  );
  if (!ok) return;
  pararSom();
  f.tomadas = f.tomadas.filter((x) => x.id !== t.id);
  if (ehFavorita) f.favorita = f.tomadas[f.tomadas.length - 1]?.id ?? null;
  if (ehFavorita) f.karaoke = null;
  if (estado.tomadaSel === t.id) estado.tomadaSel = f.favorita ?? '';
  esquecerTomada(t.id);
  await armazenamento.apagarAudio(t.id);
  mudou();
  avisar(`Tomada ${n} apagada.`, 'ok');
  void espelhar(async (pasta) => {
    await apagarDaPasta(pasta, caminhoTomada(f, t));
    await escreverNaPasta(pasta, 'projeto.json', JSON.stringify(projeto(), null, 2));
  });
}

/** Tomada que a tela mostra: a selecionada, senão a favorita, senão a última. */
export function tomadaEmFoco(f: Fala): Tomada | null {
  return f.tomadas.find((t) => t.id === estado.tomadaSel) ?? f.tomadas.find((t) => t.id === f.favorita) ?? f.tomadas[f.tomadas.length - 1] ?? null;
}
