#!/usr/bin/env node
/**
 * Cadastra (ou atualiza) um administrador do painel (só leitura das viagens).
 *
 *   npm run admin:create -- --email ana@crefito11.org --name "Ana Souza"
 *   npm run admin:create -- --email ana@crefito11.org --reset-password
 *   npm run admin:create -- --email ana@crefito11.org --password "senha-escolhida"
 *   npm run admin:create -- --email ana@crefito11.org --disable
 *
 * Se o e-mail já for de um condutor, ele só ganha o acesso ao painel (a senha não muda).
 * Sem --password, gera uma senha forte e mostra uma única vez no terminal.
 * Precisa de VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no .env.local.
 */
import { randomInt } from 'node:crypto';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';

loadEnv();

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    'reset-password': { type: 'boolean', default: false },
    disable: { type: 'boolean', default: false },
    enable: { type: 'boolean', default: false },
  },
});

function stop(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function generatePassword(length = 14) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) stop('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.');

const email = values.email?.trim().toLowerCase();
if (!email || !email.includes('@')) stop('Informe --email.');

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUser(address) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) stop(`Não foi possível listar usuários: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === address);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

let user = await findUser(email);
let password = null;

// Bloquear só tira o acesso ao painel: se a pessoa também for condutora, continua usando o app.
if (values.disable || values.enable) {
  if (!user) stop(`Usuário ${email} não existe.`);
  const active = values.enable;
  const { data, error } = await admin.from('admins').update({ active }).eq('id', user.id).select('id');
  if (error) stop(error.message);
  if (!data.length) stop(`${email} não é administrador.`);
  console.log(`✔ ${email} ${active ? 'pode usar o painel de novo' : 'sem acesso ao painel'}.`);
  process.exit(0);
}

if (!user) {
  const name = values.name?.trim();
  if (!name) stop('Para um usuário novo, informe --name "Nome Sobrenome".');
  password = values.password ?? generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) stop(`Não foi possível criar o usuário: ${error.message}`);
  user = data.user;
} else if (values.password || values['reset-password']) {
  password = values.password ?? generatePassword();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) stop(`Não foi possível trocar a senha: ${error.message}`);
}

const fullName = values.name?.trim() || user.user_metadata?.full_name;
if (!fullName) stop('Informe --name "Nome Sobrenome".');

const { error: adminError } = await admin
  .from('admins')
  .upsert({ id: user.id, full_name: fullName, active: true }, { onConflict: 'id' });
if (adminError) stop(`Usuário pronto, mas falhou ao liberar o painel: ${adminError.message}`);

console.log(`✔ Administrador pronto: ${fullName} <${email}>`);
if (password) {
  console.log(`  Senha: ${password}`);
  console.log('  Entregue a senha pessoalmente. Ela não será mostrada de novo.');
}
