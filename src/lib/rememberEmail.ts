/** "Lembrar meu e-mail" na tela de login. Só o e-mail fica salvo no aparelho; a senha nunca. */
const STORAGE_KEY = 'frota-crefito11:email-salvo';

export function getRememberedEmail(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRememberedEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // armazenamento bloqueado: segue sem lembrar
  }
}
