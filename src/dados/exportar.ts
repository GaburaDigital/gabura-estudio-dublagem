// Exportação e importação.
//  - Para o jogo: um ZIP com as pastas do jogo (descompacte na raiz do repositório do jogo).
//  - Projeto: um ZIP com tudo (para backup ou para continuar em outro computador).
//  - Presets: só as vozes (para trocar ajustes entre computadores).

import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { aplicarVoz, cortar, TAXA } from '../audio/efeitos';
import { criarWav, lerWav, criarOggOpus, opusDisponivel, criarCurva } from '../audio/arquivos_audio';
import { assinatura, voz, type ParametrosVoz } from '../audio/parametros';
import { armazenamento } from './armazenamento';
import { SUGERIDOS, sugeridosGenericos } from './presets';
import {
  AJUSTES_PADRAO, MAX_TOMADAS, escolherFalaTeste, paraId, tomadaFavorita,
  type Fala, type Personagem, type Preset, type Projeto, type VozEscolhida,
} from './modelo';

// ---------- tempo no formato das legendas ----------
function tempoVtt(s: number): string {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), seg = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const d2 = (n: number) => String(n).padStart(2, '0');
  return `${d2(h)}:${d2(m)}:${d2(seg)}.${String(r).padStart(3, '0')}`;
}

/** Legenda WebVTT de uma fala. No modo karaokê, cada palavra ganha seu tempo. */
export function criarVtt(f: Fala, duracao: number, modo: 'duracao' | 'karaoke'): string {
  const palavras = f.texto.split(/\s+/).filter(Boolean);
  let texto = f.texto;
  if (modo === 'karaoke' && f.karaoke && f.karaoke.tempos.length === palavras.length) {
    texto = palavras.map((p, i) => (i === 0 ? p : `<${tempoVtt(f.karaoke!.tempos[i])}>${p}`)).join(' ');
  }
  return `WEBVTT\n\n${f.id}\n${tempoVtt(0)} --> ${tempoVtt(duracao)}\n${texto}\n`;
}

/** Assinatura usada para saber se as marcas do karaokê ainda valem (voz e corte iguais). */
export function assinaturaKaraoke(projeto: Projeto, f: Fala): string {
  const pers = projeto.personagens.find((p) => p.id === f.personagem);
  const t = tomadaFavorita(f);
  return `${t?.id}|${t?.inicio.toFixed(3)}|${t?.fim.toFixed(3)}|${pers?.voz ? assinatura(pers.voz.p) : 'sem'}`;
}

export interface ResumoExportacao { zip: Uint8Array; nomeArquivo: string; avisos: string[]; }

/** ZIP para o jogo. progresso(0..1, texto) mostra o andamento na tela. */
export async function exportarParaJogo(projeto: Projeto, progresso: (f: number, t: string) => void): Promise<ResumoExportacao> {
  const arquivos: Record<string, Uint8Array> = {};
  const avisos: string[] = [];
  const usarOpus = opusDisponivel();
  if (!usarOpus) avisos.push('Este navegador não codifica Opus: a versão leve saiu em WAV 16 bits.');
  const listaFalas: unknown[] = [];
  const prontas = projeto.falas.filter((f) => tomadaFavorita(f));
  projeto.falas.filter((f) => !tomadaFavorita(f)).forEach((f) => avisos.push(`"${f.id}" ficou de fora: nenhuma tomada com estrela.`));

  for (let i = 0; i < prontas.length; i++) {
    const f = prontas[i];
    progresso(i / prontas.length, `Preparando ${f.id}…`);
    const pers = projeto.personagens.find((p) => p.id === f.personagem);
    const t = tomadaFavorita(f)!;
    const bruto = await armazenamento.lerAudio(t.id);
    if (!bruto) { avisos.push(`Áudio de "${f.id}" não encontrado.`); continue; }
    const limpo = cortar(bruto, t.inicio, t.fim);
    const p = pers?.voz?.p ?? voz({});
    if (!pers?.voz) avisos.push(`${pers?.nome ?? f.personagem} ainda não tem voz escolhida: "${f.id}" saiu só com limpeza.`);
    const final = await aplicarVoz(limpo, p);
    const duracao = final.length / TAXA;

    const nomeLeve = usarOpus ? `${f.id}.ogg` : `${f.id}.wav`;
    arquivos[`public/audio/falas/${nomeLeve}`] = usarOpus ? await criarOggOpus(final, TAXA, projeto.ajustes.opusKbps) : criarWav(final, TAXA, 16);
    arquivos[`public/audio/falas/${f.id}.curva.json`] = strToU8(JSON.stringify(criarCurva(final, TAXA)));
    const karaokeValido = f.karaoke && f.karaoke.assinatura === assinaturaKaraoke(projeto, f);
    if (projeto.ajustes.legenda === 'karaoke' && !karaokeValido) avisos.push(`"${f.id}": legenda karaokê sem marcas (ou a voz mudou); saiu pela duração.`);
    const modo = projeto.ajustes.legenda === 'karaoke' && karaokeValido ? 'karaoke' : 'duracao';
    arquivos[`public/audio/falas/${f.id}.vtt`] = strToU8(criarVtt(f, duracao, modo));
    arquivos[`fontes_de_arte/dublagem/original/${f.id}.wav`] = criarWav(final, TAXA, 24);
    if (projeto.ajustes.incluirLimpo) arquivos[`fontes_de_arte/dublagem/limpo/${f.id}.wav`] = criarWav(limpo, TAXA, 24);

    listaFalas.push({
      id: f.id,
      personagem: f.personagem,
      texto: f.texto,
      emocao: f.emocao || null,
      tipo: 'personagem',
      audio: `audio/falas/${nomeLeve}`,
      curva_volume: `audio/falas/${f.id}.curva.json`,
      legenda: { arquivo: `audio/falas/${f.id}.vtt`, modo, tempos_palavras: modo === 'karaoke' ? f.karaoke!.tempos.map((x) => Math.round(x * 1000) / 1000) : null },
      duracao: Math.round(duracao * 1000) / 1000,
      efeito_voz: pers?.voz ? { nome: pers.voz.nome, origem: pers.voz.origem } : null,
      ambiente: null,
    });
  }
  progresso(0.97, 'Montando o ZIP…');
  arquivos['dados/falas.json'] = strToU8(JSON.stringify({ versao_formato: 1, falas: listaFalas }, null, 2));
  arquivos['fontes_de_arte/dublagem/presets.json'] = strToU8(JSON.stringify(dadosPresets(projeto, await armazenamento.listarPresets()), null, 2));
  arquivos['fontes_de_arte/dublagem/LEIA-ME.txt'] = strToU8(LEIA_ME_JOGO);
  const zip = zipSync(arquivos, { level: 6 });
  progresso(1, 'Pronto!');
  return { zip, nomeArquivo: `dublagem_${paraId(projeto.nome)}.zip`, avisos };
}

const LEIA_ME_JOGO = `Dublagem exportada pelo Estúdio de Dublagem Gabura.

Descompacte este ZIP na raiz do repositório do jogo:
- public/audio/falas/<id>.ogg  -> o áudio leve que o jogo carrega (Opus)
- public/audio/falas/<id>.curva.json -> volume a cada 1/30 s (para mexer boca e luzes)
- public/audio/falas/<id>.vtt  -> legenda da fala
- dados/falas.json            -> roteiro com caminhos, duração e legenda
- fontes_de_arte/dublagem/    -> WAV originais (com efeito) e limpos, e os presets (não vão para o jogo)
`;

// ---------- presets ----------
export function dadosPresets(projeto: Projeto, meus: Preset[]) {
  const vozes: Record<string, VozEscolhida | null> = {};
  projeto.personagens.forEach((p) => { vozes[p.id] = p.voz; });
  return { versao_formato: 1, projeto: projeto.id, vozes, meus_presets: meus };
}

export function exportarPresets(projeto: Projeto, meus: Preset[]): Uint8Array {
  return strToU8(JSON.stringify(dadosPresets(projeto, meus), null, 2));
}

/** Aplica vozes e presets vindos de outro computador. Devolve quantos itens entraram. */
export async function importarPresets(projeto: Projeto, bytes: Uint8Array): Promise<{ vozes: number; presets: number }> {
  const d = JSON.parse(strFromU8(bytes)) as { versao_formato?: number; vozes?: Record<string, VozEscolhida | null>; meus_presets?: Preset[] };
  if (d.versao_formato !== 1) throw new Error('Arquivo de presets em formato desconhecido.');
  let vozes = 0, presets = 0;
  for (const [id, v] of Object.entries(d.vozes ?? {})) {
    const pers = projeto.personagens.find((p) => p.id === id);
    if (pers && v) { pers.voz = { ...v, p: voz(v.p) }; vozes++; }
  }
  for (const p of d.meus_presets ?? []) { await armazenamento.salvarPreset({ ...p, p: voz(p.p) }); presets++; }
  return { vozes, presets };
}

// ---------- projeto completo ----------
export async function exportarProjeto(projeto: Projeto): Promise<Uint8Array> {
  const arquivos: Record<string, Uint8Array> = {};
  arquivos['projeto.json'] = strToU8(JSON.stringify(projeto, null, 2));
  arquivos['meus_presets.json'] = strToU8(JSON.stringify(await armazenamento.listarPresets(), null, 2));
  for (const f of projeto.falas) for (const t of f.tomadas) {
    const a = await armazenamento.lerAudio(t.id);
    if (a) arquivos[`tomadas/${f.id}/${t.id}.wav`] = criarWav(a, TAXA, 24);
  }
  return zipSync(arquivos, { level: 6 });
}

export async function importarProjeto(bytes: Uint8Array): Promise<Projeto> {
  const arq = unzipSync(bytes);
  if (!arq['projeto.json']) throw new Error('Este ZIP não é um projeto do estúdio (falta o projeto.json).');
  const projeto = JSON.parse(strFromU8(arq['projeto.json'])) as Projeto;
  if (projeto.versao_formato !== 1) throw new Error('Projeto em formato desconhecido.');
  projeto.ajustes = { ...AJUSTES_PADRAO, ...projeto.ajustes };
  for (const f of projeto.falas) for (const t of f.tomadas) {
    const w = arq[`tomadas/${f.id}/${t.id}.wav`];
    if (w) await armazenamento.salvarAudio(t.id, lerWav(w).amostras);
  }
  if (arq['meus_presets.json']) {
    for (const p of JSON.parse(strFromU8(arq['meus_presets.json'])) as Preset[]) await armazenamento.salvarPreset(p);
  }
  return projeto;
}

// ---------- roteiro (falas.json dos padrões Gabura) ----------
interface FalaRoteiro { id: string; personagem: string; texto: string; emocao?: string; dica?: string; marcante?: boolean; }
interface PresetRoteiro { id?: string; nome: string; descricao?: string; p?: Partial<ParametrosVoz>; }
interface PersonagemRoteiro {
  id: string; nome?: string; cor?: string;
  /** 3 vozes para testar (opcional; sem elas o estúdio usa as sugestões conhecidas ou as genéricas). */
  sugeridos?: PresetRoteiro[];
  /** Voz já escolhida em outro projeto (opcional). */
  voz?: { origem?: string; nome: string; p?: Partial<ParametrosVoz> };
}
interface Roteiro { versao_formato?: number; nome?: string; local?: string; falas?: FalaRoteiro[]; personagens?: PersonagemRoteiro[]; }

const CORES = ['#8fd651', '#4fd6d0', '#8a5cf0', '#ff7a6b', '#ffd166', '#b9c2c8', '#f29bd4'];

function lerRoteiro(texto: string): Roteiro {
  const d = JSON.parse(texto) as Roteiro;
  if (!Array.isArray(d.falas) || d.falas.length === 0) throw new Error('O roteiro precisa ter uma lista "falas".');
  return d;
}

function falasDoRoteiro(d: Roteiro): Fala[] {
  return d.falas!.map((f) => ({
    id: paraId(f.id), personagem: paraId(f.personagem), texto: f.texto ?? '', dica: f.dica ?? '', emocao: f.emocao ?? '',
    tomadas: [], favorita: null, karaoke: null,
  }));
}

/** Monta um personagem a partir do roteiro (sugestões e voz vindas do arquivo têm prioridade). */
function personagemDoRoteiro(d: Roteiro, falas: Fala[], id: string, i: number): Personagem {
  const info = d.personagens?.find((p) => paraId(p.id) === id);
  const marcante = d.falas!.find((f) => paraId(f.personagem) === id && f.marcante);
  const sugeridos: Preset[] = info?.sugeridos?.length
    ? info.sugeridos.map((s, k) => ({ id: s.id ?? `${id}_sugestao_${k + 1}`, nome: s.nome, descricao: s.descricao ?? '', p: voz(s.p ?? {}) }))
    : structuredClone(SUGERIDOS[id] ?? sugeridosGenericos());
  return {
    id,
    nome: info?.nome ?? id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    cor: info?.cor ?? CORES[i % CORES.length],
    sugeridos,
    falaTeste: escolherFalaTeste(falas, id, marcante ? paraId(marcante.id) : undefined),
    voz: info?.voz ? { origem: info.voz.origem ?? 'roteiro', nome: info.voz.nome, p: voz(info.voz.p ?? {}) } : null,
  };
}

export function projetoDeRoteiro(texto: string, nomeArquivo: string): Projeto {
  const d = lerRoteiro(texto);
  const falas = falasDoRoteiro(d);
  const ids = [...new Set(falas.map((f) => f.personagem))];
  const personagens = ids.map((id, i) => personagemDoRoteiro(d, falas, id, i));
  const nome = d.nome ?? nomeArquivo.replace(/\.json$/i, '');
  const agora = Date.now();
  return { versao_formato: 1, id: paraId(nome) + '_' + agora.toString(36), nome, local: d.local ?? '', criado: agora, alterado: agora, personagens, falas, ajustes: { ...AJUSTES_PADRAO } };
}

/**
 * Junta um roteiro ao projeto aberto: acrescenta as falas e os personagens novos.
 * Falas que já existem (mesmo id) ficam como estão, com as tomadas gravadas; só o texto e a dica são atualizados.
 */
export function mesclarRoteiro(projeto: Projeto, texto: string): { novas: number; atualizadas: number; personagens: number } {
  const d = lerRoteiro(texto);
  const falas = falasDoRoteiro(d);
  let novas = 0, atualizadas = 0, personagens = 0;
  for (const f of falas) {
    const existente = projeto.falas.find((x) => x.id === f.id);
    if (existente) {
      if (existente.texto !== f.texto) existente.karaoke = null;
      existente.texto = f.texto; existente.dica = f.dica; existente.emocao = f.emocao;
      atualizadas++;
    } else { projeto.falas.push(f); novas++; }
  }
  const ids = [...new Set(falas.map((f) => f.personagem))];
  ids.forEach((id) => {
    const pers = projeto.personagens.find((p) => p.id === id);
    if (!pers) {
      projeto.personagens.push(personagemDoRoteiro(d, projeto.falas, id, projeto.personagens.length));
      personagens++;
    } else if (!pers.voz) {
      const doArquivo = personagemDoRoteiro(d, projeto.falas, id, 0);
      if (doArquivo.voz) pers.voz = doArquivo.voz;
    }
  });
  return { novas, atualizadas, personagens };
}

export { MAX_TOMADAS };
