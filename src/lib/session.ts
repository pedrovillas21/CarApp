/**
 * Expiração por inatividade: o login vale 24 h a partir da última vez que o app foi aberto.
 * Cada abertura (ou volta ao app) renova o prazo. Se passar de 24 h sem abrir, pede login de novo.
 *
 * Exemplo: entrou às 9h e abriu de novo às 15h → pode entrar sem senha até 15h do dia seguinte.
 */
const STORAGE_KEY = 'frota-crefito11:ultimo-acesso';

export const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000;

function readLastActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markActivity(now = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, String(now));
  } catch {
    // armazenamento bloqueado: a sessão do Supabase também não persiste, então não há o que expirar
  }
}

export function clearActivity() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // idem
  }
}

/** Sem registro de atividade conta como expirado: força login. */
export function isIdleExpired(now = Date.now()) {
  const last = readLastActivity();
  return last === null || now - last > IDLE_LIMIT_MS;
}
