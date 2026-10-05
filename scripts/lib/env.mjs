import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Carrega .env.local e depois .env, sem sobrescrever variáveis já definidas
 * (na Vercel elas vêm do painel do projeto e têm prioridade).
 */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    const vars = parseEnv(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(vars)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
