// Configuração do Vite.
// Dois jeitos de gerar o app:
//  - "npm run build": pasta dist/ para o GitHub Pages (com service worker, funciona offline depois da 1ª visita);
//  - "npm run build:arquivo": um único estudio_dublagem.html que abre direto do computador, sem internet.
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Depois do build, escreve no sw.js a lista de arquivos e uma versão nova do cache. */
function listaOffline(): Plugin {
  return {
    name: 'lista-offline',
    apply: 'build',
    closeBundle() {
      const raiz = 'dist';
      const todos: string[] = [];
      const andar = (d: string) => {
        for (const n of readdirSync(d)) {
          const c = join(d, n);
          if (statSync(c).isDirectory()) andar(c);
          else if (n !== 'sw.js') todos.push('./' + relative(raiz, c).replace(/\\/g, '/'));
        }
      };
      andar(raiz);
      todos.push('./');
      const versao = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const sw = readFileSync(join(raiz, 'sw.js'), 'utf8')
        .replace('__VERSAO__', versao)
        .replace('__ARQUIVOS__', JSON.stringify(todos, null, 2));
      writeFileSync(join(raiz, 'sw.js'), sw);
    },
  };
}

export default defineConfig(({ mode }) => {
  const arquivoUnico = mode === 'arquivo';
  return {
    base: arquivoUnico ? './' : '/gabura-estudio-dublagem/',
    define: {
      __ARQUIVO_UNICO__: JSON.stringify(arquivoUnico),
      // data da compilação, mostrada no rodapé para saber qual versão está aberta
      __VERSAO_APP__: JSON.stringify(new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' })),
    },
    plugins: arquivoUnico ? [viteSingleFile()] : [listaOffline()],
    build: {
      outDir: arquivoUnico ? 'dist_arquivo' : 'dist',
      assetsInlineLimit: arquivoUnico ? 100_000_000 : 4096,
      copyPublicDir: !arquivoUnico,
    },
  };
});
