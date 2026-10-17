// Ao abrir um projeto, recupera a pasta lembrada (se houver) e vê se ainda há permissão.

import { pastaDisponivel, pastaLembrada } from '../dados/pasta';
import { estado } from './estado';

export async function carregarPasta(): Promise<void> {
  estado.pasta = null;
  estado.pastaPrecisaPermissao = false;
  if (!pastaDisponivel() || !estado.projeto) return;
  const r = await pastaLembrada(estado.projeto.id);
  if (!r) return;
  estado.pasta = r.pasta;
  estado.pastaPrecisaPermissao = r.estado !== 'granted';
}
