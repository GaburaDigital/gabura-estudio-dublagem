// Ponto de partida do Estúdio de Dublagem Gabura.
// Monta o cabeçalho (projeto, microfone, abas), desenha a aba atual e cuida dos atalhos de teclado.

import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import './estilo.css';

import { Gravador } from './audio/gravador';
import { armazenamento } from './dados/armazenamento';
import { AJUSTES_PADRAO, type Projeto } from './dados/modelo';
import { projetoNave } from './dados/roteiro_nave';
import {
  alternarGravacao, apagarTomada, aoVivo, gravador, ligarMicrofone, marcarFavorita, tomadaEmFoco,
} from './interface/acoes';
import { abrirJanela, avisar } from './interface/dialogos';
import { h } from './interface/dom';
import { aoMudar, estado, fala, mudou, projeto, redesenhar, type Aba } from './interface/estado';
import { cancelarKaraoke, karaokeEmAndamento, marcarPalavra, ouvirComEfeito, ouvirLimpo } from './interface/painel_fala';
import { carregarPasta } from './interface/pasta_ui';
import { aoTrocarReproducao, parar } from './interface/reprodutor';
import { falaAtual, moverFala, telaGravar } from './interface/tela_gravar';
import { telaExportar } from './interface/tela_exportar';
import { fecharAjuste, telaVozes } from './interface/tela_vozes';

const app = document.getElementById('app')!;
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'vozes', nome: 'Vozes' },
  { id: 'gravar', nome: 'Gravar' },
  { id: 'exportar', nome: 'Exportar' },
];

// ---------- medidor do microfone ----------
const medidor = h('span', { class: 'medidor', role: 'meter', 'aria-label': 'Nível do microfone', 'aria-valuemin': '0', 'aria-valuemax': '1' }, h('span', { class: 'medidor-nivel' }));
let picoMostrado = 0;
aoVivo.nivel = (pico) => { picoMostrado = Math.max(pico, picoMostrado * 0.92); };
function animarMedidor(): void {
  picoMostrado *= 0.96;
  const db = 20 * Math.log10(picoMostrado + 1e-6);
  const frac = Math.max(0, Math.min(1, (db + 54) / 54));
  const nivel = medidor.firstElementChild as HTMLElement;
  nivel.style.width = `${frac * 100}%`;
  nivel.className = 'medidor-nivel' + (picoMostrado > 0.95 ? ' estourou' : picoMostrado > 0.5 ? ' alto' : '');
  medidor.setAttribute('aria-valuenow', frac.toFixed(2));
  requestAnimationFrame(animarMedidor);
}
requestAnimationFrame(animarMedidor);

// ---------- ajustes ----------
async function abrirAjustes(): Promise<void> {
  const p = projeto();
  let mics: { id: string; nome: string }[] = [];
  try { mics = await Gravador.listar(); } catch { /* sem permissão ainda */ }
  const sel = h('select', { id: 'aj-mic', class: 'campo' },
    h('option', { value: '' }, 'Padrão do sistema'),
    mics.map((m) => h('option', { value: m.id, selected: m.id === p.ajustes.microfone }, m.nome)));
  const limpeza = h('input', { id: 'aj-limpeza', type: 'checkbox', checked: p.ajustes.limpezaDoNavegador });
  const contagem = h('input', { id: 'aj-contagem', type: 'checkbox', checked: p.ajustes.contagem });
  const legenda = h('select', { id: 'aj-legenda', class: 'campo' },
    h('option', { value: 'duracao', selected: p.ajustes.legenda === 'duracao' }, 'Pela duração do áudio'),
    h('option', { value: 'karaoke', selected: p.ajustes.legenda === 'karaoke' }, 'Karaokê (marcar o tempo de cada palavra)'));
  const salvar = h('button', { class: 'bt lima', type: 'submit' }, 'Salvar');
  const fechar = h('button', { class: 'bt', type: 'button' }, 'Cancelar');
  const form = h('form', { class: 'modal-corpo largo' },
    h('h3', {}, 'Ajustes'),
    h('label', { class: 'rotulo', for: 'aj-mic' }, 'Microfone'), sel,
    mics.every((m) => m.nome.startsWith('Microfone ')) ? h('p', { class: 'nota' }, 'Os nomes dos microfones aparecem depois que você permite o microfone pela primeira vez.') : null,
    h('label', { class: 'check', for: 'aj-limpeza' }, limpeza, 'Usar também a limpeza de ruído do Chrome (deixe desligado com headset bom)'),
    h('label', { class: 'check', for: 'aj-contagem' }, contagem, 'Contagem 3, 2, 1 antes de gravar'),
    h('label', { class: 'rotulo', for: 'aj-legenda' }, 'Legenda no jogo'), legenda,
    h('p', { class: 'nota' }, 'No modo karaokê, a aba Gravar ganha o botão "Marcar palavras": você ouve a fala e toca K no começo de cada palavra.'),
    h('div', { class: 'modal-bts' }, fechar, salvar));
  const j = abrirJanela(form);
  fechar.onclick = () => j.fechar();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const trocouMic = sel.value !== p.ajustes.microfone || limpeza.checked !== p.ajustes.limpezaDoNavegador;
    p.ajustes.microfone = sel.value;
    p.ajustes.limpezaDoNavegador = limpeza.checked;
    p.ajustes.contagem = contagem.checked;
    p.ajustes.legenda = legenda.value as 'duracao' | 'karaoke';
    j.fechar();
    mudou();
    if (trocouMic && gravador.ligado) await ligarMicrofone();
  });
}

// ---------- desenho ----------
function cabecalho(): HTMLElement {
  const p = projeto();
  return h('header', { class: 'barra' },
    h('div', { class: 'marca' }, 'Estúdio ', h('span', {}, 'Gabura'), h('small', {}, 'dublagem')),
    h('button', { class: 'projeto-nome', type: 'button', title: 'Trocar de projeto (aba Exportar)', onclick: () => { estado.aba = 'exportar'; redesenhar(); } }, p.nome),
    h('nav', { class: 'abas', 'aria-label': 'Etapas' },
      ABAS.map((a) => h('button', {
        class: 'aba' + (estado.aba === a.id ? ' on' : ''), type: 'button', 'aria-current': estado.aba === a.id ? 'page' : undefined,
        onclick: () => { estado.aba = a.id; parar(); cancelarKaraoke(); redesenhar(); },
      }, a.nome))),
    h('div', { class: 'mic' },
      gravador.ligado
        ? [medidor, h('span', { class: 'mic-estado' }, estado.gravandoFala ? '● gravando' : 'microfone ligado')]
        : h('button', { class: 'bt mini', type: 'button', onclick: () => void ligarMicrofone() }, 'Ligar microfone'),
      h('button', { class: 'bt mini', type: 'button', onclick: () => void abrirAjustes(), 'aria-label': 'Ajustes' }, 'Ajustes')));
}

function desenhar(): void {
  if (!estado.projeto) return;
  // não redesenha no meio de um arraste de controle (o controle perderia o "pegador")
  if (arrastandoControle) { redesenhoPendente = true; return; }
  const rolagem = window.scrollY;
  const focoId = (document.activeElement as HTMLElement | null)?.id;
  const tela = estado.aba === 'vozes' ? telaVozes() : estado.aba === 'gravar' ? telaGravar() : telaExportar();
  app.replaceChildren(cabecalho(), h('main', { class: 'conteudo' }, tela),
    h('footer', { class: 'rodape' }, offlineTexto(), ' · ', atalhosTexto()));
  if (focoId) document.getElementById(focoId)?.focus();
  window.scrollTo(0, rolagem);
}

let arrastandoControle = false;
let redesenhoPendente = false;
document.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).matches?.('input[type=range]')) arrastandoControle = true; });
document.addEventListener('pointerup', () => {
  if (!arrastandoControle) return;
  arrastandoControle = false;
  if (redesenhoPendente) { redesenhoPendente = false; setTimeout(desenhar, 0); }
});

let estadoOffline = __ARQUIVO_UNICO__ ? 'arquivo local: funciona sem internet' : import.meta.env.PROD ? 'preparando modo offline…' : 'modo de desenvolvimento';
function offlineTexto(): string { return estadoOffline; }
function atalhosTexto(): string {
  return 'Atalhos: espaço grava/para · P ouve com efeito · O ouve sem efeito · S estrela · Delete apaga a tomada · ↑ ↓ trocam de fala · 1 a 5 escolhem a tomada';
}

aoMudar(desenhar);
aoTrocarReproducao(desenhar);

// ---------- atalhos ----------
function falaDaTela() {
  if (estado.aba === 'gravar') return falaAtual();
  if (estado.aba === 'vozes') {
    const pers = projeto().personagens.find((x) => x.id === estado.personagemSel);
    return pers ? fala(pers.falaTeste) : undefined;
  }
  return undefined;
}

document.addEventListener('keydown', (e) => {
  const alvo = e.target as HTMLElement;
  if (alvo.closest('input, textarea, select, [contenteditable], .modal')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const f = falaDaTela();
  if (!f) return;
  const t = tomadaEmFoco(f);
  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (!e.repeat) void alternarGravacao(f);
      break;
    case 'p': case 'P': if (t) void ouvirComEfeito(f, t); break;
    case 'o': case 'O': if (t) void ouvirLimpo(t); break;
    case 's': case 'S': if (t) marcarFavorita(f, t); break;
    case 'k': case 'K': if (karaokeEmAndamento() === f.id) { e.preventDefault(); marcarPalavra(f); } break;
    case 'Delete': case 'Backspace': if (t && !estado.gravandoFala) { e.preventDefault(); void apagarTomada(f, t); } break;
    case 'ArrowDown': if (estado.aba === 'gravar') { e.preventDefault(); moverFala(1); } break;
    case 'ArrowUp': if (estado.aba === 'gravar') { e.preventDefault(); moverFala(-1); } break;
    case 'Escape': cancelarKaraoke(); parar(); break;
    default:
      if (/^[1-5]$/.test(e.key)) {
        const tm = f.tomadas[Number(e.key) - 1];
        if (tm) { estado.tomadaSel = tm.id; redesenhar(); }
      }
  }
});

// a barra de espaço num botão focado também "clicaria" nele: evita gravar e parar ao mesmo tempo
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && (e.target as HTMLElement).tagName === 'BUTTON' && !(e.target as HTMLElement).closest('.modal')) e.preventDefault();
});

// ---------- modo offline (service worker) ----------
if (import.meta.env.PROD && !__ARQUIVO_UNICO__ && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then(async (reg) => {
    await navigator.serviceWorker.ready;
    estadoOffline = 'pronto para usar sem internet';
    reg.addEventListener('updatefound', () => { estadoOffline = 'versão nova baixada: recarregue a página para usar'; desenhar(); });
    desenhar();
  }).catch(() => { estadoOffline = 'modo offline indisponível'; desenhar(); });
}

// ---------- início ----------
async function iniciar(): Promise<void> {
  if (!window.isSecureContext) avisar('Abra o estúdio por https ou pelo arquivo no computador; o microfone não funciona aqui.', 'erro');
  try {
    estado.meusPresets = await armazenamento.listarPresets();
    const idAtual = await armazenamento.lerConfig<string>('projeto_atual');
    let p: Projeto | undefined = idAtual ? await armazenamento.lerProjeto(idAtual) : undefined;
    if (!p) {
      p = projetoNave();
      await armazenamento.salvarProjeto(p);
      await armazenamento.salvarConfig('projeto_atual', p.id);
    }
    p.ajustes = { ...AJUSTES_PADRAO, ...p.ajustes };
    estado.projeto = p;
    await carregarPasta();
  } catch (e) {
    // sem IndexedDB (janela anônima muito restrita): funciona só enquanto a aba estiver aberta
    avisar('Não consegui usar o armazenamento do navegador; nada será salvo ao fechar. ' + (e as Error).message, 'erro');
    estado.projeto = projetoNave();
  }
  if (estado.pastaPrecisaPermissao) avisar('Clique em "Reconectar pasta" (aba Exportar) para voltar a salvar na pasta do projeto.', 'info');
  fecharAjuste();
  desenhar();
  window.addEventListener('beforeunload', (e) => { if (estado.gravandoFala) { e.preventDefault(); } });
}

void iniciar();
