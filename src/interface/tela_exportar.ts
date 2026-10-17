// Aba "Exportar": ZIP para o jogo, backup do projeto, troca de presets, pasta do projeto e lista de projetos.

import { opusDisponivel } from '../audio/arquivos_audio';
import { armazenamento } from '../dados/armazenamento';
import {
  exportarParaJogo, exportarPresets, exportarProjeto, importarPresets, importarProjeto, projetoDeRoteiro,
} from '../dados/exportar';
import { paraId, tomadaFavorita, type Projeto } from '../dados/modelo';
import { escolherPasta, esquecerPasta, pastaDisponivel, reconectar } from '../dados/pasta';
import { projetoNave } from '../dados/roteiro_nave';
import { copiarTudoParaPasta } from './acoes';
import { avisar, confirmar } from './dialogos';
import { baixar, escolherArquivo, h, seg } from './dom';
import { estado, mudou, personagem, projeto, redesenhar, salvarAgora } from './estado';
import { esquecerTomada } from './reprodutor';
import { carregarPasta } from './pasta_ui';

let exportando: { fracao: number; texto: string } | null = null;
let avisosUltima: string[] = [];
let listaProjetos: Projeto[] = [];

/** Abre outro projeto (usado aqui e no início do app). */
export async function abrirProjeto(p: Projeto): Promise<void> {
  await salvarAgora();
  estado.projeto = p;
  estado.personagemSel = ''; estado.falaSel = ''; estado.tomadaSel = '';
  await armazenamento.salvarProjeto(p);
  await armazenamento.salvarConfig('projeto_atual', p.id);
  await carregarPasta();
  redesenhar();
}

async function gerarZip(): Promise<void> {
  if (exportando) return;
  await salvarAgora();
  exportando = { fracao: 0, texto: 'Começando…' };
  redesenhar();
  try {
    const r = await exportarParaJogo(projeto(), (fracao, texto) => {
      exportando = { fracao, texto };
      const barra = document.querySelector<HTMLProgressElement>('#progresso-export');
      const rot = document.querySelector('#progresso-texto');
      if (barra) barra.value = fracao;
      if (rot) rot.textContent = texto;
    });
    avisosUltima = r.avisos;
    baixar(r.zip, r.nomeArquivo, 'application/zip');
    avisar(`ZIP pronto: ${r.nomeArquivo}`, 'ok');
  } catch (e) {
    avisar('Erro ao exportar: ' + (e as Error).message, 'erro');
  } finally {
    exportando = null;
    redesenhar();
  }
}

function tabelaFalas(): HTMLElement {
  const p = projeto();
  return h('div', { class: 'tabela' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Fala'), h('th', {}, 'Personagem'), h('th', {}, 'Voz'), h('th', {}, 'Tomada ★'), h('th', {}, 'Situação'))),
    h('tbody', {}, p.falas.map((f) => {
      const pers = personagem(f.personagem);
      const t = tomadaFavorita(f);
      return h('tr', {},
        h('td', {}, h('code', {}, f.id)),
        h('td', {}, h('i', { class: 'bolinha', style: { background: pers?.cor ?? '#888' } }), ' ', pers?.nome ?? f.personagem),
        h('td', {}, pers?.voz?.nome ?? h('span', { class: 'falta' }, 'sem voz')),
        h('td', {}, t ? `tomada ${f.tomadas.indexOf(t) + 1} · ${seg(t.fim - t.inicio)}` : '—'),
        h('td', {}, t ? h('span', { class: 'escolhida' }, 'vai para o jogo') : h('span', { class: 'falta' }, 'fica de fora')));
    }))));
}

function secaoPasta(): HTMLElement {
  const p = projeto();
  if (!pastaDisponivel()) {
    return h('div', { class: 'caixa' }, h('h3', {}, 'Pasta do projeto'),
      h('p', { class: 'nota' }, 'Este navegador não permite salvar numa pasta. Use o Chrome no computador, ou o backup do projeto abaixo.'));
  }
  const conteudo: (HTMLElement | string)[] = [];
  if (estado.pasta && !estado.pastaPrecisaPermissao) {
    conteudo.push(h('p', {}, 'Salvando também na pasta ', h('b', {}, estado.pasta.name), '. Cada tomada vira um WAV em limpo/<fala>/.'));
    conteudo.push(h('div', { class: 'linha-bts' },
      h('button', { class: 'bt', type: 'button', onclick: async () => { await copiarTudoParaPasta(); avisar('Tudo copiado para a pasta.', 'ok'); } }, 'Copiar tudo de novo'),
      h('button', { class: 'bt', type: 'button', onclick: async () => { await esquecerPasta(p.id); estado.pasta = null; redesenhar(); } }, 'Parar de usar a pasta')));
  } else if (estado.pasta) {
    conteudo.push(h('p', {}, `O Chrome precisa da sua confirmação para voltar a salvar na pasta "${estado.pasta.name}".`));
    conteudo.push(h('button', {
      class: 'bt lima', type: 'button', onclick: async () => {
        if (estado.pasta && (await reconectar(estado.pasta))) { estado.pastaPrecisaPermissao = false; await copiarTudoParaPasta(); avisar('Pasta reconectada.', 'ok'); redesenhar(); }
      },
    }, 'Reconectar pasta'));
  } else {
    conteudo.push(h('p', { class: 'nota' }, 'Opcional. Tudo já fica salvo no navegador; a pasta é uma cópia de segurança no seu disco, atualizada a cada tomada.'));
    conteudo.push(h('button', {
      class: 'bt', type: 'button', onclick: async () => {
        try {
          estado.pasta = await escolherPasta(p.id);
          estado.pastaPrecisaPermissao = false;
          await copiarTudoParaPasta();
          avisar(`Salvando também em "${estado.pasta.name}".`, 'ok');
          redesenhar();
        } catch (e) { if ((e as DOMException).name !== 'AbortError') avisar('Não foi possível usar a pasta: ' + (e as Error).message, 'erro'); }
      },
    }, 'Escolher pasta do projeto'));
  }
  return h('div', { class: 'caixa' }, h('h3', {}, 'Pasta do projeto'), ...conteudo);
}

function secaoProjetos(): HTMLElement {
  const p = projeto();
  const lista = h('ul', { class: 'lista-projetos' });
  void armazenamento.listarProjetos().then((todos) => {
    listaProjetos = todos.sort((a, b) => b.alterado - a.alterado);
    lista.replaceChildren(...listaProjetos.map((x) => h('li', {},
      h('span', {}, h('b', {}, x.nome), ' ', h('small', { class: 'nota' }, `${x.falas.length} falas · ${new Date(x.alterado).toLocaleDateString('pt-BR')}`)),
      x.id === p.id ? h('span', { class: 'escolhida' }, 'aberto') : h('span', { class: 'linha-bts' },
        h('button', { class: 'bt mini', type: 'button', onclick: () => void abrirProjeto(x) }, 'Abrir'),
        h('button', {
          class: 'bt mini perigo-texto', type: 'button', onclick: async () => {
            const n = x.falas.reduce((a, f) => a + f.tomadas.length, 0);
            if (!(await confirmar(`Apagar o projeto "${x.nome}"?`, `O roteiro e ${n} tomada(s) serão apagados deste computador. Faça um backup antes, se quiser guardar.`))) return;
            for (const f of x.falas) for (const t of f.tomadas) { esquecerTomada(t.id); await armazenamento.apagarAudio(t.id); }
            await armazenamento.apagarProjeto(x.id);
            redesenhar();
          },
        }, 'Apagar')))));
  });
  return h('div', { class: 'caixa' },
    h('h3', {}, 'Projetos neste computador'), lista,
    h('div', { class: 'linha-bts' },
      h('button', {
        class: 'bt', type: 'button', onclick: async () => {
          const a = await escolherArquivo('.json,application/json');
          if (!a) return;
          try { await abrirProjeto(projetoDeRoteiro(new TextDecoder().decode(a.bytes), a.nome)); avisar('Roteiro importado como projeto novo.', 'ok'); }
          catch (e) { avisar('Roteiro inválido: ' + (e as Error).message, 'erro'); }
        },
      }, 'Novo projeto a partir de um roteiro (falas.json)'),
      h('button', {
        class: 'bt', type: 'button', onclick: async () => {
          const novo = projetoNave();
          novo.id = 'nave_gaburaverso_' + Date.now().toString(36); novo.nome = 'Nave do Gaburaverso (nova cópia)';
          await abrirProjeto(novo);
        },
      }, 'Nova cópia do roteiro da Nave'),
      h('button', {
        class: 'bt', type: 'button', onclick: async () => {
          const agora = Date.now();
          await abrirProjeto({ versao_formato: 1, id: 'projeto_' + agora.toString(36), nome: 'Projeto novo', local: 'fala', criado: agora, alterado: agora, personagens: [], falas: [], ajustes: { ...projeto().ajustes } });
        },
      }, 'Projeto vazio')));
}

export function telaExportar(): HTMLElement {
  const p = projeto();
  const prontas = p.falas.filter((f) => tomadaFavorita(f)).length;
  const semVoz = p.personagens.filter((x) => !x.voz).map((x) => x.nome);

  const legenda = h('select', { id: 'ex-legenda', class: 'campo', onchange: (e: Event) => { p.ajustes.legenda = (e.target as HTMLSelectElement).value as 'duracao' | 'karaoke'; mudou(); } },
    h('option', { value: 'duracao', selected: p.ajustes.legenda === 'duracao' }, 'Pela duração do áudio'),
    h('option', { value: 'karaoke', selected: p.ajustes.legenda === 'karaoke' }, 'Karaokê (tempo de cada palavra)'));
  const qualidade = h('select', { id: 'ex-kbps', class: 'campo', onchange: (e: Event) => { p.ajustes.opusKbps = Number((e.target as HTMLSelectElement).value); mudou(false); } },
    [32, 48, 64, 96].map((k) => h('option', { value: k, selected: p.ajustes.opusKbps === k }, `${k} kbps${k === 48 ? ' (recomendado)' : ''}`)));
  const limpo = h('input', { id: 'ex-limpo', type: 'checkbox', checked: p.ajustes.incluirLimpo, onchange: (e: Event) => { p.ajustes.incluirLimpo = (e.target as HTMLInputElement).checked; mudou(false); } });

  return h('div', { class: 'pagina-exportar' },
    h('section', { class: 'caixa destaque' },
      h('h2', {}, 'ZIP para o jogo'),
      h('p', { class: 'nota' }, `${prontas} de ${p.falas.length} falas com estrela. Só a tomada com estrela de cada fala vai para o ZIP. Descompacte o ZIP na raiz do repositório do jogo: os arquivos já caem nas pastas certas.`),
      semVoz.length ? h('div', { class: 'faixa-alerta' }, `Sem voz escolhida: ${semVoz.join(', ')}.`) : null,
      opusDisponivel() ? null : h('div', { class: 'faixa-alerta' }, 'Este navegador não codifica Opus; a versão leve sairá em WAV. Use o Chrome atualizado.'),
      tabelaFalas(),
      h('div', { class: 'form-linha' },
        h('label', { class: 'rotulo', for: 'ex-legenda' }, 'Legenda'), legenda,
        h('label', { class: 'rotulo', for: 'ex-kbps' }, 'Qualidade do Opus'), qualidade,
        h('label', { class: 'check', for: 'ex-limpo' }, limpo, 'Incluir também os WAV sem efeito')),
      exportando
        ? h('div', { class: 'progresso' }, h('progress', { id: 'progresso-export', max: 1, value: exportando.fracao }), h('span', { id: 'progresso-texto' }, exportando.texto))
        : h('button', { class: 'bt lima grande', type: 'button', disabled: prontas === 0, onclick: () => void gerarZip() }, 'Gerar ZIP para o jogo'),
      avisosUltima.length ? h('ul', { class: 'avisos-export' }, avisosUltima.map((a) => h('li', {}, a))) : null,
      h('details', {}, h('summary', {}, 'O que vem no ZIP'),
        h('pre', { class: 'arvore' }, `public/audio/falas/<id>.ogg          ← áudio leve que o jogo carrega (Opus)
public/audio/falas/<id>.curva.json   ← volume a cada 1/30 s (boca, luzes)
public/audio/falas/<id>.vtt          ← legenda
dados/falas.json                     ← roteiro com caminhos, duração e legenda
fontes_de_arte/dublagem/original/    ← WAV 48 kHz 24 bits com efeito
fontes_de_arte/dublagem/limpo/       ← WAV sem efeito (para refazer a voz no futuro)
fontes_de_arte/dublagem/presets.json ← as vozes escolhidas`))),
    h('div', { class: 'duas' },
      h('section', { class: 'caixa' },
        h('h3', {}, 'Levar para outro computador'),
        h('p', { class: 'nota' }, 'O projeto inteiro (roteiro, vozes e todas as tomadas) num ZIP. No outro computador, abra o estúdio e use "Importar projeto".'),
        h('div', { class: 'linha-bts' },
          h('button', { class: 'bt', type: 'button', onclick: async () => { await salvarAgora(); baixar(await exportarProjeto(p), `projeto_${paraId(p.nome)}.zip`, 'application/zip'); } }, 'Exportar projeto'),
          h('button', {
            class: 'bt', type: 'button', onclick: async () => {
              const a = await escolherArquivo('.zip,application/zip');
              if (!a) return;
              try {
                const novo = await importarProjeto(a.bytes);
                const existe = await armazenamento.lerProjeto(novo.id);
                if (existe && !(await confirmar(`Substituir "${existe.nome}"?`, 'Já existe um projeto com este nome neste computador. As tomadas dele que não estiverem no ZIP continuam guardadas, mas o roteiro será trocado.', 'Substituir'))) return;
                await abrirProjeto(novo);
                avisar('Projeto importado.', 'ok');
              } catch (e) { avisar('Não consegui importar: ' + (e as Error).message, 'erro'); }
            },
          }, 'Importar projeto'))),
      h('section', { class: 'caixa' },
        h('h3', {}, 'Trocar só as vozes'),
        h('p', { class: 'nota' }, 'As vozes escolhidas de cada personagem e os seus presets, num arquivo pequeno. Bom para combinar ajustes com a fonoaudióloga.'),
        h('div', { class: 'linha-bts' },
          h('button', { class: 'bt', type: 'button', onclick: () => baixar(exportarPresets(p, estado.meusPresets), `vozes_${paraId(p.nome)}.json`, 'application/json') }, 'Exportar vozes'),
          h('button', {
            class: 'bt', type: 'button', onclick: async () => {
              const a = await escolherArquivo('.json,application/json');
              if (!a) return;
              try {
                const r = await importarPresets(p, a.bytes);
                estado.meusPresets = await armazenamento.listarPresets();
                mudou();
                avisar(`${r.vozes} voz(es) de personagem e ${r.presets} preset(s) importados.`, 'ok');
              } catch (e) { avisar('Arquivo inválido: ' + (e as Error).message, 'erro'); }
            },
          }, 'Importar vozes')))),
    h('div', { class: 'duas' }, secaoPasta(), secaoProjetos()));
}
