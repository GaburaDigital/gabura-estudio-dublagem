// Aba "Vozes": escolher a voz de cada personagem antes de gravar tudo.
// Você grava a frase de teste uma vez, ouve nas 3 opções, ajusta e escolhe.
// A gravação de teste já conta como tomada da fala (aparece como pronta na aba Gravar).

import { CONTROLES, nomeNota, voz, type ParametrosVoz } from '../audio/parametros';
import { armazenamento } from '../dados/armazenamento';
import { escolherFalaTeste, novoId, paraId, type Personagem, type Preset } from '../dados/modelo';
import { BIBLIOTECA, sugeridosGenericos } from '../dados/presets';
import { tomadaEmFoco } from './acoes';
import { avisar, confirmar, pedirTexto } from './dialogos';
import { h } from './dom';
import { estado, fala, mudou, projeto, redesenhar } from './estado';
import { ouvirComEfeito, painelFala } from './painel_fala';
import { parar, tocandoAgora } from './reprodutor';

/** Ajuste em andamento (cópia de trabalho; só vira a voz do personagem em "Usar esta voz"). */
let rascunho: { personagem: string; origem: string; nome: string; p: ParametrosVoz; original: ParametrosVoz } | null = null;
let tocarAoSoltar = true;

function statusPersonagem(p: Personagem): string {
  if (p.voz) return 'escolhida';
  if (p.id === estado.personagemSel) return 'testando';
  return 'falta';
}

function abrirAjuste(pers: Personagem, origem: string, nome: string, p: ParametrosVoz): void {
  rascunho = { personagem: pers.id, origem, nome, p: { ...voz(p) }, original: { ...voz(p) } };
  redesenhar();
  requestAnimationFrame(() => document.querySelector('.ajuste-voz')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
}

function usarVoz(pers: Personagem, origem: string, nome: string, p: ParametrosVoz): void {
  pers.voz = { origem, nome, p: { ...p } };
  mudou();
  avisar(`${pers.nome} agora usa a voz "${nome}".`, 'ok');
  // vai para o próximo personagem que ainda não tem voz
  const proximo = projeto().personagens.find((x) => !x.voz);
  if (proximo) { estado.personagemSel = proximo.id; rascunho = null; redesenhar(); }
}

async function ouvirPreset(pers: Personagem, p: ParametrosVoz, chave: string): Promise<void> {
  const f = fala(pers.falaTeste);
  const t = f && tomadaEmFoco(f);
  if (!f || !t) { avisar('Grave a frase de teste primeiro.', 'erro'); return; }
  await ouvirComEfeito(f, t, p, chave);
}

function cartaoPreset(pers: Personagem, pr: Preset, letra: string): HTMLElement {
  const escolhida = pers.voz?.origem === pr.id;
  const chave = 'preset_' + pr.id;
  const f = fala(pers.falaTeste);
  const t = f && tomadaEmFoco(f);
  const tocando = tocandoAgora()?.chave === `${t?.id}|${chave}`;
  return h('div', { class: 'op' + (escolhida ? ' escolhida' : '') },
    h('b', {}, `${letra} · ${pr.nome}`),
    h('span', { class: 'nota' }, pr.descricao),
    h('div', { class: 'linha-bts' },
      h('button', { class: 'bt ' + (tocando ? '' : 'lima'), type: 'button', disabled: !t, onclick: () => void ouvirPreset(pers, pr.p, chave) }, tocando ? '■ Parar' : '▶ Ouvir'),
      h('button', { class: 'bt', type: 'button', onclick: () => abrirAjuste(pers, pr.id, pr.nome, pr.p) }, 'Ajustar'),
      h('button', { class: 'bt', type: 'button', disabled: escolhida, onclick: () => usarVoz(pers, pr.id, pr.nome, pr.p) }, escolhida ? '✓ Escolhida' : 'Usar')));
}

function formatar(chave: keyof ParametrosVoz, v: number, unidade: string): string {
  if (chave === 'vocoderNota') return nomeNota(v);
  if (unidade === '×') return v.toFixed(2).replace('.', ',') + '×';
  if (unidade === '') return Math.round(v * 100) + '%';
  const s = (Math.round(v * 10) / 10).toString().replace('.', ',');
  return (unidade === 'st' || unidade === 'dB') && v > 0 ? '+' + s + ' ' + unidade : s + ' ' + unidade;
}

function painelAjuste(pers: Personagem): HTMLElement | null {
  if (!rascunho || rascunho.personagem !== pers.id) return null;
  const r = rascunho;
  const chave = 'ajuste';
  const f = fala(pers.falaTeste);
  const t = f && tomadaEmFoco(f);
  const tocando = tocandoAgora()?.chave === `${t?.id}|${chave}`;
  const ouvir = () => void ouvirPreset(pers, r.p, chave);

  const grupos = new Map<string, HTMLElement>();
  for (const c of CONTROLES) {
    if (!grupos.has(c.grupo)) grupos.set(c.grupo, h('fieldset', { class: 'grupo' }, h('legend', {}, c.grupo)));
    const id = `aj-${c.chave}`;
    const valor = h('output', { for: id }, formatar(c.chave, r.p[c.chave], c.unidade));
    const campo = h('input', { id, type: 'range', min: c.min, max: c.max, step: c.passo, value: String(r.p[c.chave]) });
    campo.addEventListener('input', () => { r.p[c.chave] = Number(campo.value); valor.textContent = formatar(c.chave, r.p[c.chave], c.unidade); });
    campo.addEventListener('change', () => { if (tocarAoSoltar && t) { parar(); ouvir(); } });
    campo.addEventListener('dblclick', () => { r.p[c.chave] = r.original[c.chave]; campo.value = String(r.p[c.chave]); valor.textContent = formatar(c.chave, r.p[c.chave], c.unidade); });
    grupos.get(c.grupo)!.append(h('div', { class: 'controle' }, h('label', { for: id }, c.rotulo, valor), campo));
  }

  const base = h('select', { id: 'aj-base', class: 'campo' },
    h('option', { value: '' }, 'Começar de outro preset…'),
    h('optgroup', { label: 'Sugestões deste personagem' }, pers.sugeridos.map((s) => h('option', { value: 's:' + s.id }, s.nome))),
    estado.meusPresets.length ? h('optgroup', { label: 'Meus presets' }, estado.meusPresets.map((s) => h('option', { value: 'm:' + s.id }, s.nome))) : null,
    h('optgroup', { label: 'Biblioteca' }, BIBLIOTECA.map((s) => h('option', { value: 'b:' + s.id }, s.nome))));
  base.addEventListener('change', () => {
    const [tipo, id] = base.value.split(':');
    const lista = tipo === 's' ? pers.sugeridos : tipo === 'm' ? estado.meusPresets : BIBLIOTECA;
    const pr = lista.find((x) => x.id === id);
    if (pr) abrirAjuste(pers, pr.id, pr.nome, pr.p);
  });

  const ehMeu = estado.meusPresets.some((m) => m.id === r.origem);
  return h('section', { class: 'ajuste-voz', 'aria-label': 'Ajuste da voz' },
    h('div', { class: 'ajuste-cab' },
      h('h3', {}, `Ajustando: ${r.nome}`),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: tocarAoSoltar, onchange: (e: Event) => { tocarAoSoltar = (e.target as HTMLInputElement).checked; } }), 'tocar ao soltar o controle'),
      base),
    h('p', { class: 'nota' }, 'Dica: clique duas vezes num controle para voltar ao valor de antes.'),
    h('div', { class: 'grupos' }, [...grupos.values()]),
    h('div', { class: 'linha-bts' },
      h('button', { class: 'bt', type: 'button', disabled: !t, onclick: ouvir }, tocando ? '■ Parar' : '▶ Ouvir ajuste'),
      h('button', { class: 'bt lima', type: 'button', onclick: () => usarVoz(pers, r.origem, r.nome, r.p) }, '✓ Usar esta voz'),
      h('button', {
        class: 'bt', type: 'button', onclick: async () => {
          const nome = await pedirTexto('Salvar como meu preset', 'Nome do preset', ehMeu ? r.nome : `${r.nome} (${pers.nome})`);
          if (!nome) return;
          const existente = estado.meusPresets.find((m) => m.nome === nome);
          const pr: Preset = { id: existente?.id ?? novoId('meu_' + paraId(nome)), nome, descricao: `ajustado para ${pers.nome}`, p: { ...r.p } };
          await armazenamento.salvarPreset(pr);
          estado.meusPresets = await armazenamento.listarPresets();
          r.origem = pr.id; r.nome = nome;
          avisar(`Preset "${nome}" salvo. Ele aparece em todos os projetos.`, 'ok');
          redesenhar();
        },
      }, 'Salvar como meu preset'),
      ehMeu ? h('button', {
        class: 'bt perigo-texto', type: 'button', onclick: async () => {
          if (!(await confirmar(`Apagar o preset "${r.nome}"?`, 'Ele some da lista "Meus presets". Personagens que já usam esta voz continuam com ela.'))) return;
          await armazenamento.apagarPreset(r.origem);
          estado.meusPresets = await armazenamento.listarPresets();
          redesenhar();
        },
      }, 'Apagar preset') : null,
      h('button', { class: 'bt', type: 'button', onclick: () => { r.p = { ...r.original }; redesenhar(); } }, 'Voltar ao original'),
      h('button', { class: 'bt', type: 'button', onclick: () => { rascunho = null; redesenhar(); } }, 'Fechar')));
}

async function novoPersonagem(): Promise<void> {
  const nome = await pedirTexto('Novo personagem', 'Nome do personagem');
  if (!nome) return;
  const p = projeto();
  let id = paraId(nome);
  while (p.personagens.some((x) => x.id === id)) id += '_2';
  p.personagens.push({ id, nome, cor: '#4fd6d0', sugeridos: sugeridosGenericos(), falaTeste: '', voz: null });
  estado.personagemSel = id;
  mudou();
  avisar('Personagem criado. Crie uma fala para ele na aba Gravar.', 'ok');
}

export function telaVozes(): HTMLElement {
  const p = projeto();
  if (!estado.personagemSel || !p.personagens.some((x) => x.id === estado.personagemSel)) {
    estado.personagemSel = (p.personagens.find((x) => !x.voz) ?? p.personagens[0])?.id ?? '';
  }
  const pers = p.personagens.find((x) => x.id === estado.personagemSel);
  const faltam = p.personagens.filter((x) => !x.voz).length;

  const lateral = h('nav', { class: 'lateral', 'aria-label': 'Personagens' },
    p.personagens.map((x) => {
      const st = statusPersonagem(x);
      return h('button', {
        class: 'pers' + (x.id === estado.personagemSel ? ' on' : ''), type: 'button',
        onclick: () => { estado.personagemSel = x.id; rascunho = null; parar(); redesenhar(); },
      }, h('i', { class: 'bolinha', style: { background: x.cor } }), h('span', { class: 'pers-nome' }, x.nome), h('small', { class: st }, st));
    }),
    h('button', { class: 'pers novo', type: 'button', onclick: () => void novoPersonagem() }, '+ personagem'));

  const miolo = h('div', { class: 'miolo' });
  if (pers) {
    if (!pers.falaTeste || !fala(pers.falaTeste)) pers.falaTeste = escolherFalaTeste(p.falas, pers.id);
    const f = fala(pers.falaTeste);
    miolo.append(h('div', { class: 'cab-secao' },
      h('h2', {}, `Voz de ${pers.nome}`),
      h('p', { class: 'nota' }, faltam ? `Faltam ${faltam} personagem(ns) sem voz escolhida.` : 'Todos os personagens já têm voz. Pode gravar na aba Gravar!'),
      pers.voz ? h('p', { class: 'voz-atual' }, 'Voz escolhida: ', h('b', {}, pers.voz.nome), ' ',
        h('button', { class: 'bt mini', type: 'button', onclick: () => abrirAjuste(pers, pers.voz!.origem, pers.voz!.nome, pers.voz!.p) }, 'Ajustar')) : null));
    if (f) {
      miolo.append(h('p', { class: 'rotulo' }, 'Frase de teste (a gravação já vale como tomada desta fala)'));
      miolo.append(painelFala(f, { compacto: true }));
      miolo.append(h('h3', { class: 'titulo-opcoes' }, 'Ouça a frase nas 3 vozes'));
      miolo.append(h('div', { class: 'opcoes' }, pers.sugeridos.map((s, i) => cartaoPreset(pers, s, 'ABC'[i] ?? String(i + 1)))));
      const ajuste = painelAjuste(pers);
      if (ajuste) miolo.append(ajuste);
    } else {
      miolo.append(h('p', { class: 'onda-vazia' }, 'Este personagem ainda não tem falas. Crie uma na aba Gravar e volte aqui.'));
    }
  }
  return h('div', { class: 'corpo' }, lateral, miolo);
}

export function fecharAjuste(): void { rascunho = null; }
