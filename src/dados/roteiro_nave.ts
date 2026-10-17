// Roteiro que já vem carregado: a despedida no túnel da nave (Gaburaverso).
// Para outro jogo, importe um falas.json (formato dos padrões Gabura) ou crie as falas no próprio estúdio.

import { SUGERIDOS } from './presets';
import { AJUSTES_PADRAO, type Projeto } from './modelo';

export function projetoNave(): Projeto {
  const agora = Date.now();
  const fala = (id: string, personagem: string, texto: string, dica: string, emocao: string) =>
    ({ id, personagem, texto, dica, emocao, tomadas: [], favorita: null, karaoke: null });
  return {
    versao_formato: 1,
    id: 'nave_gaburaverso',
    nome: 'Nave do Gaburaverso',
    local: 'tunel',
    criado: agora,
    alterado: agora,
    personagens: [
      { id: 'gabura', nome: 'Gabura', cor: '#8fd651', sugeridos: structuredClone(SUGERIDOS.gabura), falaTeste: 'tunel_gabura_001', voz: null },
      { id: 'metalgabutron', nome: 'MetalgabuTRON', cor: '#b9c2c8', sugeridos: structuredClone(SUGERIDOS.metalgabutron), falaTeste: 'tunel_metalgabutron_001', voz: null },
      { id: 'gabura_gato', nome: 'Gabura gato', cor: '#ffd166', sugeridos: structuredClone(SUGERIDOS.gabura_gato), falaTeste: 'tunel_gabura_gato_001', voz: null },
      { id: 'gojo', nome: 'Gojo', cor: '#8a5cf0', sugeridos: structuredClone(SUGERIDOS.gojo), falaTeste: 'tunel_gojo_001', voz: null },
      { id: 'fred', nome: 'Fred', cor: '#ff7a6b', sugeridos: structuredClone(SUGERIDOS.fred), falaTeste: 'tunel_fred_001', voz: null },
    ],
    falas: [
      fala('tunel_gabura_001', 'gabura', 'Valeu demais pela ajuda! Sem você a nave ainda estaria presa entre dimensões. Boa viagem!',
        'Alegre e agradecido, com sorriso na voz.', 'feliz'),
      fala('tunel_metalgabutron_001', 'metalgabutron', 'Parabéns. Sem você eu jamais conseguiria... ligar um LED. Bip-bop. Isso foi sarcasmo.',
        'Tom de tédio. Pausa longa antes de "ligar um LED"; "Bip-bop" bem seco.', 'sarcastico'),
      fala('tunel_gabura_gato_001', 'gabura_gato', 'E lembre-se: nunca aperte botões grandes e brilhantes sem saber o que eles fazem!',
        'Conselho de quem aprendeu do jeito difícil; meio sem graça no fim.', 'sem_graca'),
      fala('tunel_gojo_001', 'gojo', '(risadas) Hahaha! Tchauzinho!',
        'Risada solta antes; "Tchauzinho" cantado.', 'feliz'),
      fala('tunel_fred_001', 'fred', '(risadas) Hahaha! Tchauzinho!',
        'Risadinha curta e rápida; "Tchauzinho" bem agudo.', 'feliz'),
    ],
    ajustes: { ...AJUSTES_PADRAO },
  };
}
