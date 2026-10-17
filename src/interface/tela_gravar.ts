// Aba "Gravar": as falas do roteiro, uma por cartão, com teleprompter, tomadas e estrela.

import { MAX_TOMADAS, paraId, tomadaFavorita, type Fala } from '../dados/modelo';
import { abrirJanela, avisar, confirmar } from './dialogos';
import { h } from './dom';
import { estado, mudou, personagem, projeto, redesenhar } from './estado';
import { painelFala } from './painel_fala';
import { parar } from './reprodutor';
import { armazenamento } from '../dados/armazenamento';
import { esquecerTomada } from './reprodutor';

function statusFala(f: Fala): { classe: string; texto: string } {
  if (tomadaFavorita(f)) return { classe: 'escolhida', texto: '★ pronta' };
  if (f.tomadas.length) return { classe: 'testando', texto: `${f.tomadas.length} tomada(s)` };
  return { classe: 'falta', texto: 'falta' };
}

/** Próximo id livre no padrão <local>_<personagem>_<nnn>. */
function proximoId(local: string, pers: string): string {
  const p = projeto();
  for (let n = 1; n < 1000; n++) {
    const id = `${paraId(local || 'fala')}_${pers}_${String(n).padStart(3, '0')}`;
    if (!p.falas.some((f) => f.id === id)) return id;
  }
  return `${pers}_${Date.now()}`;
}

/** Janela para criar ou editar uma fala. */
function editarFala(existente?: Fala): void {
  const p = projeto();
  const persSel = h('select', { id: 'ff-pers', class: 'campo' }, p.personagens.map((x) => h('option', { value: x.id, selected: x.id === (existente?.personagem ?? estado.personagemSel) }, x.nome)));
  const local = h('input', { id: 'ff-local', class: 'campo', value: existente ? existente.id.split('_')[0] : p.local || 'fala' });
  const texto = h('textarea', { id: 'ff-texto', class: 'campo', rows: 3 }, existente?.texto ?? '');
  const dica = h('input', { id: 'ff-dica', class: 'campo', value: existente?.dica ?? '', placeholder: 'opcional' });
  const emocao = h('input', { id: 'ff-emocao', class: 'campo', value: existente?.emocao ?? '', placeholder: 'opcional (ex.: feliz, sem_graca)' });
  const salvar = h('button', { class: 'bt lima', type: 'submit' }, existente ? 'Salvar' : 'Criar fala');
  const cancelar = h('button', { class: 'bt', type: 'button' }, 'Cancelar');
  const apagar = existente ? h('button', { class: 'bt perigo-texto', type: 'button' }, 'Apagar fala') : null;
  const form = h('form', { class: 'modal-corpo largo' },
    h('h3', {}, existente ? `Editar ${existente.id}` : 'Nova fala'),
    h('label', { class: 'rotulo', for: 'ff-pers' }, 'Personagem'), persSel,
    existente ? null : [h('label', { class: 'rotulo', for: 'ff-local' }, 'Local (vira o começo do id, ex.: ponte, tunel)'), local],
    h('label', { class: 'rotulo', for: 'ff-texto' }, 'Texto da fala'), texto,
    h('label', { class: 'rotulo', for: 'ff-dica' }, 'Dica de interpretação'), dica,
    h('label', { class: 'rotulo', for: 'ff-emocao' }, 'Emoção (para o jogo)'), emocao,
    h('div', { class: 'modal-bts' }, apagar, cancelar, salvar));
  const j = abrirJanela(form);
  cancelar.onclick = () => j.fechar();
  if (apagar && existente) apagar.onclick = async () => {
    j.fechar();
    if (!(await confirmar(`Apagar a fala ${existente.id}?`, `O texto e ${existente.tomadas.length} tomada(s) gravada(s) serão apagados deste computador. Não dá para desfazer.`))) return;
    parar();
    for (const t of existente.tomadas) { esquecerTomada(t.id); await armazenamento.apagarAudio(t.id); }
    p.falas = p.falas.filter((f) => f !== existente);
    p.personagens.forEach((x) => { if (x.falaTeste === existente.id) x.falaTeste = ''; });
    estado.falaSel = p.falas[0]?.id ?? '';
    mudou();
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = texto.value.trim();
    if (!t) { texto.focus(); return; }
    if (existente) {
      if (existente.texto !== t) existente.karaoke = null;
      Object.assign(existente, { personagem: persSel.value, texto: t, dica: dica.value.trim(), emocao: paraId(emocao.value) === 'item' ? '' : paraId(emocao.value) });
    } else {
      const nova: Fala = { id: proximoId(local.value, persSel.value), personagem: persSel.value, texto: t, dica: dica.value.trim(), emocao: emocao.value.trim() ? paraId(emocao.value) : '', tomadas: [], favorita: null, karaoke: null };
      p.falas.push(nova);
      if (!p.local) p.local = paraId(local.value);
      estado.falaSel = nova.id;
      avisar(`Fala ${nova.id} criada.`, 'ok');
    }
    j.fechar();
    mudou();
  });
  texto.focus();
}

export function falaAtual(): Fala | undefined {
  const p = projeto();
  if (!p.falas.some((f) => f.id === estado.falaSel)) estado.falaSel = (p.falas.find((f) => !tomadaFavorita(f)) ?? p.falas[0])?.id ?? '';
  return p.falas.find((f) => f.id === estado.falaSel);
}

/** Vai para a fala de cima (−1) ou de baixo (+1). */
export function moverFala(d: number): void {
  const p = projeto();
  const i = p.falas.findIndex((f) => f.id === estado.falaSel);
  const n = p.falas[Math.max(0, Math.min(p.falas.length - 1, i + d))];
  if (n && n.id !== estado.falaSel) { estado.falaSel = n.id; estado.tomadaSel = ''; parar(); redesenhar(); }
}

export function telaGravar(): HTMLElement {
  const p = projeto();
  const f = falaAtual();
  const prontas = p.falas.filter((x) => tomadaFavorita(x)).length;

  const lateral = h('nav', { class: 'lateral', 'aria-label': 'Falas' },
    p.personagens.map((pers) => {
      const falas = p.falas.filter((x) => x.personagem === pers.id);
      if (!falas.length) return null;
      return h('div', { class: 'grupo-falas' },
        h('div', { class: 'grupo-titulo' }, h('i', { class: 'bolinha', style: { background: pers.cor } }), pers.nome),
        falas.map((x) => {
          const st = statusFala(x);
          return h('button', {
            class: 'pers fala-item' + (x.id === estado.falaSel ? ' on' : ''), type: 'button',
            onclick: () => { estado.falaSel = x.id; estado.tomadaSel = ''; parar(); redesenhar(); },
          }, h('span', { class: 'pers-nome' }, x.texto), h('small', { class: st.classe }, st.texto));
        }));
    }),
    h('button', { class: 'pers novo', type: 'button', onclick: () => editarFala() }, '+ nova fala'));

  const miolo = h('div', { class: 'miolo' });
  miolo.append(h('div', { class: 'cab-secao' },
    h('h2', {}, 'Gravar falas'),
    h('p', { class: 'nota' }, `${prontas} de ${p.falas.length} falas prontas · até ${MAX_TOMADAS} tomadas por fala · ↑ ↓ trocam de fala`)));
  if (f) {
    const pers = personagem(f.personagem);
    if (pers && !pers.voz) {
      miolo.append(h('div', { class: 'faixa-alerta' },
        `${pers.nome} ainda não tem voz escolhida. `,
        h('button', { class: 'bt mini', type: 'button', onclick: () => { estado.aba = 'vozes'; estado.personagemSel = pers.id; redesenhar(); } }, 'Escolher a voz')));
    }
    miolo.append(painelFala(f));
    miolo.append(h('div', { class: 'linha-bts direita' },
      h('button', { class: 'bt', type: 'button', onclick: () => editarFala(f) }, 'Editar fala')));
  } else {
    miolo.append(h('p', { class: 'onda-vazia' }, 'Nenhuma fala no roteiro. Clique em "+ nova fala".'));
  }
  return h('div', { class: 'corpo' }, lateral, miolo);
}
