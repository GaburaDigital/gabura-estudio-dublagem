// Painel de uma fala: teleprompter, onda (com corte), botões de gravar/ouvir e a lista de tomadas.
// Usado na aba Vozes (frase de teste) e na aba Gravar.

import { voz } from '../audio/parametros';
import { MAX_TOMADAS, type Fala, type Tomada } from '../dados/modelo';
import { assinaturaKaraoke } from '../dados/exportar';
import {
  alternarGravacao, apagarTomada, aoVivo, contagem, marcarFavorita, podeGravar, salvarProjetoNaPasta, tomadaEmFoco,
} from './acoes';
import { h, seg } from './dom';
import { avisar } from './dialogos';
import { estado, mudou, personagem, projeto, redesenhar } from './estado';
import { Onda, OndaAoVivo } from './onda';
import { audioBruto, audioComEfeito, audioLimpo, parar, tocandoAgora, tocar } from './reprodutor';

const ondaAoVivo = new OndaAoVivo();
let ultimaGravacao = '';
aoVivo.amostras = (x) => ondaAoVivo.adicionar(x);

// karaokê: marcação em andamento
const marcacao = { fala: '', tempos: [] as number[] };

/** Toca a tomada com o efeito do personagem (ou um efeito escolhido). */
export async function ouvirComEfeito(f: Fala, t: Tomada, p = personagem(f.personagem)?.voz?.p ?? voz({}), chave = 'efeito', aoAcabar?: () => void): Promise<void> {
  const k = `${t.id}|${chave}`;
  if (tocandoAgora()?.chave === k) { parar(); return; }
  document.body.classList.add('calculando');
  try {
    const y = await audioComEfeito(t, p);
    if (y) tocar(y, k, aoAcabar);
  } catch (e) {
    avisar('Erro ao aplicar o efeito: ' + (e as Error).message, 'erro');
  } finally { document.body.classList.remove('calculando'); }
}

export async function ouvirLimpo(t: Tomada): Promise<void> {
  const k = `${t.id}|limpo`;
  if (tocandoAgora()?.chave === k) { parar(); return; }
  const y = await audioLimpo(t);
  if (y) tocar(y, k);
}

/** Começa a marcar as palavras do karaokê. */
export async function comecarKaraoke(f: Fala): Promise<void> {
  const t = f.tomadas.find((x) => x.id === f.favorita);
  if (!t) { avisar('Marque uma tomada com estrela antes.', 'erro'); return; }
  marcacao.fala = f.id; marcacao.tempos = [];
  redesenhar();
  await ouvirComEfeito(f, t, undefined, 'karaoke', () => {
    // o áudio acabou antes de marcar todas as palavras
    if (marcacao.fala === f.id) {
      marcacao.fala = '';
      avisar('O áudio acabou antes de marcar todas as palavras. Tente de novo, tocando K um pouco antes de cada palavra.', 'erro');
      redesenhar();
    }
  });
}

/** Uma batida na tecla K: marca o começo da próxima palavra. */
export function marcarPalavra(f: Fala): void {
  if (marcacao.fala !== f.id) return;
  const agora = tocandoAgora();
  if (!agora || !agora.chave.endsWith('|karaoke')) return;
  const palavras = f.texto.split(/\s+/).filter(Boolean);
  marcacao.tempos.push(Math.max(0, agora.tempo));
  if (marcacao.tempos.length >= palavras.length) {
    f.karaoke = { tempos: [...marcacao.tempos], assinatura: assinaturaKaraoke(projeto(), f) };
    marcacao.fala = '';
    mudou();
    avisar('Legenda karaokê marcada!', 'ok');
  } else redesenhar();
}

export function cancelarKaraoke(): void { if (marcacao.fala) { marcacao.fala = ''; parar(); redesenhar(); } }

function teleprompter(f: Fala, palavraAtiva: number): HTMLElement {
  const pers = personagem(f.personagem);
  const palavras = f.texto.split(/\s+/).filter(Boolean);
  return h('div', { class: 'prompter' },
    h('div', { class: 'prompter-quem' },
      h('i', { class: 'bolinha', style: { background: pers?.cor ?? '#888' } }),
      pers?.nome ?? f.personagem,
      pers?.voz ? h('span', { class: 'prompter-voz' }, '· ' + pers.voz.nome) : h('span', { class: 'prompter-voz' }, '· sem voz escolhida'),
      h('span', { class: 'prompter-id' }, f.id)),
    h('p', { class: 'prompter-texto', 'data-fala': f.id },
      palavras.map((p, i) => h('span', { class: i < palavraAtiva ? 'lida' : '' }, p + ' '))),
    f.dica ? h('p', { class: 'prompter-dica' }, 'Dica: ' + f.dica) : null);
}

export function painelFala(f: Fala, opcoes: { compacto?: boolean } = {}): HTMLElement {
  const gravandoEsta = estado.gravandoFala === f.id;
  const t = tomadaEmFoco(f);
  const bloqueio = podeGravar(f);
  const raiz = h('div', { class: 'painel-fala' + (opcoes.compacto ? ' compacto' : '') });

  // palavra iluminada: durante a marcação do karaokê ou tocando com marcas válidas
  let palavraAtiva = 0;
  if (marcacao.fala === f.id) palavraAtiva = marcacao.tempos.length;
  raiz.append(teleprompter(f, palavraAtiva));

  // onda
  const caixaOnda = h('div', { class: 'caixa-onda' + (gravandoEsta ? ' gravando' : '') });
  if (gravandoEsta || contagem.valor > 0) {
    if (!ultimaGravacao) { ultimaGravacao = f.id; ondaAoVivo.limpar(); } // começou uma gravação nova
    caixaOnda.append(ondaAoVivo.el);
    if (contagem.valor > 0) caixaOnda.append(h('div', { class: 'contagem', 'aria-live': 'assertive' }, String(contagem.valor)));
    requestAnimationFrame(() => ondaAoVivo.desenhar());
  } else if (t) {
    ultimaGravacao = '';
    const onda = new Onda({
      amostras: new Float32Array(1), inicio: t.inicio, fim: t.fim,
      aoCortar: (ini, fim) => { t.inicio = ini; t.fim = fim; mudou(false); void salvarProjetoNaPasta(); },
    });
    caixaOnda.append(onda.el);
    void audioBruto(t).then((a) => { if (a) onda.trocar({ amostras: a }); });
    // agulha enquanto toca a versão limpa (a única com o mesmo tempo da onda)
    const animar = () => {
      if (!onda.el.isConnected) return;
      const ag = tocandoAgora();
      if (ag && ag.chave === `${t.id}|limpo`) onda.marcarAgulha(t.inicio + ag.tempo);
      else onda.marcarAgulha(-1);
      // karaokê: ilumina as palavras conforme as marcas
      const k = f.karaoke;
      const prompt = raiz.querySelector('.prompter-texto');
      if (prompt && ag && ag.chave.startsWith(t.id + '|') && k && marcacao.fala !== f.id && k.assinatura === assinaturaKaraoke(projeto(), f)) {
        const n = k.tempos.filter((x) => x <= ag.tempo).length;
        prompt.querySelectorAll('span').forEach((s, i) => s.classList.toggle('lida', i < n));
      }
      requestAnimationFrame(animar);
    };
    requestAnimationFrame(animar);
    caixaOnda.append(h('div', { class: 'onda-legenda' }, 'arraste as alças verdes para cortar o começo e o fim'));
  } else {
    ultimaGravacao = '';
    caixaOnda.append(h('div', { class: 'onda-vazia' }, 'Nenhuma tomada ainda. Aperte "Gravar" (ou a barra de espaço) e leia a fala.'));
  }
  raiz.append(caixaOnda);

  // botões principais
  const tocando = tocandoAgora();
  const btGravar = h('button', {
    class: 'bt grande ' + (gravandoEsta ? 'gravando' : 'rec'), type: 'button',
    disabled: !!bloqueio && !gravandoEsta,
    onclick: () => void alternarGravacao(f),
    title: bloqueio ?? 'Barra de espaço',
  }, gravandoEsta ? '■ Parar' : contagem.valor > 0 ? 'Cancelar' : '● Gravar');
  const btEfeito = h('button', {
    class: 'bt', type: 'button', disabled: !t || gravandoEsta, title: 'Tecla P',
    onclick: () => t && void ouvirComEfeito(f, t),
  }, tocando?.chave === `${t?.id}|efeito` ? '■ Parar' : '▶ Ouvir com efeito');
  const btLimpo = h('button', {
    class: 'bt', type: 'button', disabled: !t || gravandoEsta, title: 'Tecla O',
    onclick: () => t && void ouvirLimpo(t),
  }, tocando?.chave === `${t?.id}|limpo` ? '■ Parar' : '▶ Sem efeito');
  raiz.append(h('div', { class: 'linha-bts' },
    btGravar, h('kbd', {}, 'espaço'), btEfeito, h('kbd', {}, 'P'), btLimpo, h('kbd', {}, 'O'),
    bloqueio && !gravandoEsta ? h('span', { class: 'nota alerta' }, bloqueio) : null));

  // tomadas
  const lista = h('ol', { class: 'tomadas', 'aria-label': 'Tomadas' });
  f.tomadas.forEach((tm, i) => {
    const fav = f.favorita === tm.id;
    const sel = t?.id === tm.id;
    lista.append(h('li', { class: 'tomada' + (fav ? ' fav' : '') + (sel ? ' sel' : '') },
      h('button', {
        class: 'estrela', type: 'button', 'aria-pressed': String(fav),
        title: fav ? 'Favorita (vai para o jogo)' : 'Marcar como favorita (tecla S)',
        onclick: () => marcarFavorita(f, tm),
      }, fav ? '★' : '☆'),
      h('button', { class: 'tomada-nome', type: 'button', onclick: () => { estado.tomadaSel = tm.id; redesenhar(); } },
        `Tomada ${i + 1}`, h('span', {}, seg(tm.fim - tm.inicio))),
      h('button', { class: 'bt mini', type: 'button', onclick: () => { estado.tomadaSel = tm.id; void ouvirComEfeito(f, tm); } },
        tocando?.chave === `${tm.id}|efeito` ? '■' : '▶'),
      h('button', { class: 'bt mini perigo-texto', type: 'button', title: 'Apagar tomada (tecla Delete)', 'aria-label': `Apagar tomada ${i + 1}`, onclick: () => void apagarTomada(f, tm) }, 'Apagar'),
    ));
  });
  raiz.append(h('div', { class: 'tomadas-cab' },
    h('h4', {}, 'Tomadas'), h('span', { class: 'nota' }, `${f.tomadas.length} de ${MAX_TOMADAS} · a estrela escolhe a que vai para o jogo`)));
  if (f.tomadas.length) raiz.append(lista);

  // karaokê
  if (!opcoes.compacto && projeto().ajustes.legenda === 'karaoke') {
    const palavras = f.texto.split(/\s+/).filter(Boolean);
    const valido = f.karaoke && f.karaoke.assinatura === assinaturaKaraoke(projeto(), f);
    const emMarcacao = marcacao.fala === f.id;
    raiz.append(h('div', { class: 'karaoke' },
      h('h4', {}, 'Legenda karaokê'),
      emMarcacao
        ? h('p', { class: 'nota' }, `Toque K no começo de cada palavra: ${marcacao.tempos.length} de ${palavras.length}.`)
        : h('p', { class: 'nota' }, valido ? 'Marcas prontas. Ouça com efeito para conferir.' : f.karaoke ? 'A voz ou o corte mudou: marque de novo.' : 'Ainda sem marcas.'),
      h('div', { class: 'linha-bts' },
        emMarcacao
          ? [h('button', { class: 'bt lima', type: 'button', onclick: () => marcarPalavra(f) }, 'Palavra!'), h('kbd', {}, 'K'),
            h('button', { class: 'bt', type: 'button', onclick: cancelarKaraoke }, 'Cancelar')]
          : h('button', { class: 'bt', type: 'button', disabled: !f.favorita, onclick: () => void comecarKaraoke(f) }, valido ? 'Marcar de novo' : 'Marcar palavras'))));
  }
  return raiz;
}

export function karaokeEmAndamento(): string { return marcacao.fala; }
