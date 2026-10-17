# Estúdio de Dublagem Gabura

**Link:** https://gaburadigital.github.io/gabura-estudio-dublagem/

<img src="docs/qrcode.png" alt="QR code do link do estúdio" width="180">

Ferramenta do Gaburaverso dedicada a **gravar vozes**. Roda no **Chrome do computador** (Linux e macOS) e funciona **sem internet** depois da primeira visita.

> Na primeira visita, clique no ícone de instalar na barra de endereço do Chrome ("Instalar Estúdio de Dublagem Gabura"). Ele vira um app no computador e abre mesmo offline.
> O QR code serve para abrir o link no celular e mandar para o computador; o estúdio não foi feito para celular nem para o Quest.

## Como usar

1. **Ligar o microfone** (canto superior direito). Em **Ajustes**, escolha o headset USB. Fale normalmente: o medidor deve ficar verde, chegando no amarelo nos picos; vermelho é alto demais.
2. **Vozes:** para cada personagem, grave a frase de teste (a fala mais marcante dele). Ouça nas 3 opções (A, B, C), clique em **Ajustar** para mexer nos controles e em **Usar** para escolher. Essa gravação já vale como tomada da fala.
3. **Gravar:** cada fala do roteiro tem teleprompter e dica (opcional). Grave até **5 tomadas**. A **estrela** marca a favorita, que é a que vai para o jogo. Para tirar sobra do começo e do fim, arraste as alças verdes da onda. Para apagar uma tomada, use **Apagar**; o estúdio sempre pede confirmação.
4. **Exportar:** **Gerar ZIP para o jogo**. Descompacte o ZIP na raiz do repositório do jogo.

A voz gravada fica guardada **limpa** (sem efeito). O efeito é aplicado quando você ouve ou exporta. Assim, dá para trocar o preset depois sem regravar.

### Atalhos

| Tecla | Ação |
|---|---|
| espaço | gravar / parar |
| P | ouvir com efeito |
| O | ouvir sem efeito |
| S | marcar a tomada como favorita |
| Delete | apagar a tomada (com confirmação) |
| 1 a 5 | escolher a tomada |
| ↑ ↓ | trocar de fala (aba Gravar) |
| K | marcar palavra (legenda karaokê) |
| Esc | parar o som |

### Legenda

Em **Ajustes → Legenda no jogo** há dois modos:

- **Pela duração:** a frase inteira aparece enquanto o áudio toca.
- **Karaokê:** ouça a fala e toque **K** no começo de cada palavra. Se você mudar a voz ou o corte depois, o estúdio avisa que é preciso marcar de novo.

### Gravar em dois computadores (com a fonoaudióloga)

- **Exportar projeto / Importar projeto** levam tudo: roteiro, vozes e todas as tomadas, num ZIP.
- **Exportar vozes / Importar vozes** levam só as vozes escolhidas e os seus presets, num arquivo pequeno.
- **Pasta do projeto** (opcional, Chrome): cada tomada também é salva como WAV numa pasta do computador, na hora.

## O que vem no ZIP para o jogo

```
public/audio/falas/<id>.ogg          áudio leve (Opus, 48 kbps, mono, 48 kHz)
public/audio/falas/<id>.curva.json   volume a cada 1/30 s (para boca e luzes)
public/audio/falas/<id>.vtt          legenda (WebVTT)
dados/falas.json                     roteiro com caminhos, duração e legenda
fontes_de_arte/dublagem/original/    WAV 48 kHz 24 bits com efeito
fontes_de_arte/dublagem/limpo/       WAV sem efeito
fontes_de_arte/dublagem/presets.json vozes escolhidas
```

O `dados/falas.json` segue o formato dos padrões Gabura (`versao_formato: 1`). Se o jogo já tiver um `falas.json` com outras falas, junte as listas em vez de substituir.

### Por que Opus (.ogg)?

No navegador, cada áudio é decodificado **uma vez**, quando o jogo carrega (`decodeAudioData`). Depois disso ele fica pronto na memória e tocar não gasta processador a mais. O Opus deixa os arquivos cerca de 30 vezes menores que o WAV, com ótima qualidade para voz, e o navegador do Quest toca normalmente.

### Exemplo de uso no jogo (TypeScript)

```ts
// Carrega uma fala exportada pelo estúdio e toca com a boca mexendo pela curva de volume.
interface FalaJogo { id: string; audio: string; curva_volume: string; texto: string; duracao: number }
interface Curva { quadros_por_segundo: number; valores: number[] }

const ctx = new AudioContext();

async function carregarFala(f: FalaJogo) {
  const base = import.meta.env.BASE_URL;
  const [buf, curva] = await Promise.all([
    fetch(base + f.audio).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)),
    fetch(base + f.curva_volume).then((r) => r.json() as Promise<Curva>),
  ]);
  return { buf, curva };
}

function tocarFala(buf: AudioBuffer, curva: Curva, aoVolume: (v: number) => void) {
  const fonte = ctx.createBufferSource();
  fonte.buffer = buf;
  fonte.connect(ctx.destination);
  const inicio = ctx.currentTime;
  fonte.start();
  const passo = () => {
    const i = Math.floor((ctx.currentTime - inicio) * curva.quadros_por_segundo);
    if (i >= curva.valores.length) { aoVolume(0); return; }
    aoVolume(curva.valores[i]); // 0 = boca fechada, 1 = bem aberta
    requestAnimationFrame(passo);
  };
  passo();
}
```

## Rodar no computador (desenvolvimento)

```bash
npm install
npm run dev          # abre em http://localhost:5173/gabura-estudio-dublagem/
npm run build        # gera dist/ (o mesmo que vai para o GitHub Pages)
npm run build:arquivo  # gera dist_arquivo/index.html: um único arquivo que abre sem servidor
```

O arquivo único (`build:arquivo`) pode ser copiado para um pendrive e aberto direto no Chrome. Nele o microfone e o salvamento funcionam, mas o app não "instala".

## Publicação

Todo push na branch `main` publica no GitHub Pages pela Action `.github/workflows/deploy.yml`. Configure uma vez: **Settings → Pages → Source: GitHub Actions**. Se o navegador mostrar a versão antiga, recarregue a página: a versão nova já foi baixada.

## Como funciona por dentro

| Arquivo | Para quê |
|---|---|
| `src/audio/gravador.ts` | microfone, medidor e gravação limpa em 48 kHz |
| `src/audio/espectral.ts` | tom, formante (tamanho da voz), velocidade, vocoder e limpeza de ruído (vocoder de fase) |
| `src/audio/efeitos.ts` | cadeia completa: robô, rouquidão, equalizador, rádio, vibrato, eco, sala, compressor e nivelamento |
| `src/audio/arquivos_audio.ts` | WAV, Opus em Ogg (WebCodecs) e curva de volume |
| `src/dados/presets.ts` | as 3 vozes de cada personagem e a biblioteca de vozes |
| `src/dados/roteiro_nave.ts` | roteiro que já vem carregado (túnel da nave) |
| `src/dados/exportar.ts` | ZIP do jogo, backup do projeto e troca de vozes |

Para juntar falas novas a um projeto que já tem gravações, use **Exportar → Adicionar falas de um roteiro a este projeto**: as tomadas gravadas continuam e as falas novas entram na lista. O roteiro pode trazer as 3 vozes sugeridas (`sugeridos`) e a voz já escolhida (`voz`) de cada personagem; veja `dados/roteiro_nave_completo.json`.

Para outro jogo, use **Exportar → Novo projeto a partir de um roteiro**, com um `falas.json` no formato de `dados/exemplo_roteiro.json`. A fala com `"marcante": true` vira a frase de teste do personagem; sem ela, o estúdio usa a fala mais longa.

## Licença

Código sob **MIT**. A marca Gaburaverso, os personagens e os roteiros são **reservados** à Gabura Digital. As fontes Baloo 2 e Nunito usam a SIL Open Font License 1.1. Detalhes em [LICENSE](LICENSE).
