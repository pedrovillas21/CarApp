#!/usr/bin/env node
/**
 * Migrações no estilo Flyway para o Postgres do Supabase.
 *
 *   supabase/migrations/V<versão>__<descrição>.sql  roda uma única vez, em ordem de versão
 *   supabase/migrations/R__<descrição>.sql          roda de novo sempre que o conteúdo muda
 *
 * Cada migração roda numa transação: se falhar, nada dela fica no banco.
 * Para comandos que não aceitam transação (ex.: create index concurrently),
 * coloque "-- migrate:no-transaction" nas primeiras linhas do arquivo.
 *
 * O histórico fica em app_migrations.schema_history, fora da API pública do Supabase.
 *
 * Comandos:
 *   migrate            aplica as pendentes
 *   info               lista o estado de cada migração
 *   validate           confere se o banco bate com os arquivos (sai com erro se não bater)
 *   repair             realinha checksums de migrações aplicadas que foram editadas
 *   new "<descrição>"  cria o próximo arquivo V<n>__<descrição>.sql
 *
 * Opções:
 *   --on-deploy        usado no build da Vercel: só roda em produção e se DATABASE_URL existir
 *   --out-of-order     permite aplicar uma versão menor que a última já aplicada
 *   --remove-missing   (repair) apaga do histórico migrações cujo arquivo não existe mais
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import postgres from 'postgres';
import { loadEnv } from './lib/env.mjs';

loadEnv();

const MIGRATIONS_DIR = path.resolve('supabase/migrations');
const LOCK_ID = 2_011_110_011; // mesmo número em todos os processos: serializa execuções paralelas
const VERSIONED = /^V(\d+(?:[._]\d+)*)__(.+)\.sql$/;
const REPEATABLE = /^R__(.+)\.sql$/;

const HISTORY_DDL = `
  create schema if not exists app_migrations;
  create table if not exists app_migrations.schema_history (
    installed_rank    serial primary key,
    version           text,
    description       text not null,
    type              text not null check (type in ('versioned', 'repeatable')),
    script            text not null,
    checksum          text not null,
    installed_by      text not null default current_user,
    installed_on      timestamptz not null default now(),
    execution_time_ms integer not null
  );
  create unique index if not exists schema_history_version_key
    on app_migrations.schema_history (version) where version is not null;
`;

const color = (code) => (text) => (process.stdout.isTTY ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = color('32');
const red = color('31');
const yellow = color('33');
const dim = color('2');

class MigrationError extends Error {}
const fail = (message) => {
  throw new MigrationError(message);
};

// ---------------------------------------------------------------------------
// Arquivos locais

function parseVersion(raw) {
  return raw.split(/[._]/).map(Number);
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function loadLocalMigrations() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.toLowerCase().endsWith('.sql')).sort();
  const versions = new Map();
  const migrations = [];

  for (const file of files) {
    const raw = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const sql = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const header = sql.split('\n').slice(0, 5).join('\n');
    const noTransaction = /^\s*--\s*migrate:no-transaction\b/m.test(header);

    let match;
    if ((match = VERSIONED.exec(file))) {
      const version = parseVersion(match[1]).join('.');
      if (versions.has(version)) fail(`Versão ${version} repetida em ${versions.get(version)} e ${file}.`);
      versions.set(version, file);
      migrations.push({ type: 'versioned', version, description: match[2].replace(/_/g, ' '), file, sql, checksum, noTransaction });
    } else if ((match = REPEATABLE.exec(file))) {
      migrations.push({ type: 'repeatable', version: null, description: match[1].replace(/_/g, ' '), file, sql, checksum, noTransaction });
    } else {
      fail(`Nome de arquivo inválido: ${file}\nUse V<versão>__<descrição>.sql ou R__<descrição>.sql (dois sublinhados).`);
    }
  }

  const versioned = migrations.filter((m) => m.type === 'versioned').sort((a, b) => compareVersions(a.version, b.version));
  const repeatable = migrations.filter((m) => m.type === 'repeatable').sort((a, b) => a.file.localeCompare(b.file));
  return [...versioned, ...repeatable];
}

// ---------------------------------------------------------------------------
// Banco

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL não definida. Copie .env.example para .env.local e preencha a connection string do Supabase.');

  let host = '';
  let port = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port;
  } catch {
    // senha com caracteres especiais pode quebrar o URL; o driver ainda consegue ler
  }
  if (port === '6543') {
    console.log(yellow('Aviso: porta 6543 é o Transaction pooler. Funciona, mas prefira o Session pooler (porta 5432).'));
  }
  if (/^db\..+\.supabase\.co$/.test(host)) {
    console.log(dim('Conexão direta (db.*.supabase.co) só funciona em IPv6. Se falhar, use o Session pooler.'));
  }

  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: isLocal || /sslmode=/.test(url) ? undefined : 'require',
    connect_timeout: 20,
    idle_timeout: 5,
    onnotice: () => {},
  });
}

async function historyExists(sql) {
  const [row] = await sql`select to_regclass('app_migrations.schema_history') is not null as exists`;
  return row.exists;
}

async function ensureHistory(sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
    await tx.unsafe(HISTORY_DDL);
  });
}

async function loadApplied(sql) {
  if (!(await historyExists(sql))) return [];
  return sql`
    select installed_rank, version, description, type, script, checksum, installed_on, execution_time_ms
    from app_migrations.schema_history
    order by installed_rank
  `;
}

// ---------------------------------------------------------------------------
// Análise: compara arquivos com o histórico

function analyze(local, applied, { outOfOrder = false } = {}) {
  const appliedByVersion = new Map(applied.filter((a) => a.type === 'versioned').map((a) => [a.version, a]));
  const lastRepeatable = new Map();
  for (const a of applied) if (a.type === 'repeatable') lastRepeatable.set(a.script, a);

  const maxApplied = [...appliedByVersion.keys()].sort(compareVersions).at(-1) ?? null;
  const rows = [];
  const problems = [];
  const pending = [];

  for (const m of local) {
    if (m.type === 'versioned') {
      const a = appliedByVersion.get(m.version);
      if (a) {
        if (a.checksum !== m.checksum) {
          rows.push({ m, state: 'Alterada', applied: a });
          problems.push(`${m.file} foi editada depois de aplicada. Desfaça a edição e crie uma nova migração (ou rode "repair" se a mudança não afeta o banco).`);
        } else {
          rows.push({ m, state: 'Aplicada', applied: a });
        }
      } else if (maxApplied && compareVersions(m.version, maxApplied) < 0 && !outOfOrder) {
        rows.push({ m, state: 'Fora de ordem' });
        problems.push(`${m.file} tem versão menor que a última aplicada (${maxApplied}). Renomeie para uma versão maior ou use --out-of-order.`);
      } else {
        rows.push({ m, state: 'Pendente' });
        pending.push(m);
      }
    } else {
      const a = lastRepeatable.get(m.file);
      if (!a) {
        rows.push({ m, state: 'Pendente' });
        pending.push(m);
      } else if (a.checksum !== m.checksum) {
        rows.push({ m, state: 'Pendente (alterada)', applied: a });
        pending.push(m);
      } else {
        rows.push({ m, state: 'Aplicada', applied: a });
      }
    }
  }

  const localVersions = new Set(local.filter((m) => m.type === 'versioned').map((m) => m.version));
  for (const a of appliedByVersion.values()) {
    if (!localVersions.has(a.version)) {
      rows.push({ m: { type: 'versioned', version: a.version, description: a.description, file: a.script }, state: 'Sem arquivo', applied: a });
      problems.push(`${a.script} está aplicada no banco mas o arquivo não existe mais. Restaure o arquivo ou rode "repair --remove-missing".`);
    }
  }

  rows.sort((x, y) => {
    if (x.m.type !== y.m.type) return x.m.type === 'versioned' ? -1 : 1;
    return x.m.type === 'versioned' ? compareVersions(x.m.version, y.m.version) : x.m.file.localeCompare(y.m.file);
  });
  return { rows, problems, pending };
}

// ---------------------------------------------------------------------------
// Execução

function lineOf(sqlText, position) {
  if (!position) return null;
  const before = sqlText.slice(0, Number(position) - 1);
  const line = before.split('\n').length;
  return { line, text: sqlText.split('\n')[line - 1]?.trim() ?? '' };
}

async function recordAndRun(q, m) {
  if (m.type === 'versioned') {
    const done = await q`select 1 from app_migrations.schema_history where version = ${m.version}`;
    if (done.length) return null; // outro processo aplicou enquanto esperávamos o lock
  } else {
    const [last] = await q`
      select checksum from app_migrations.schema_history
      where script = ${m.file} order by installed_rank desc limit 1`;
    if (last?.checksum === m.checksum) return null;
  }
  const started = performance.now();
  await q.unsafe(m.sql);
  const ms = Math.round(performance.now() - started);
  await q`
    insert into app_migrations.schema_history (version, description, type, script, checksum, execution_time_ms)
    values (${m.version}, ${m.description}, ${m.type}, ${m.file}, ${m.checksum}, ${ms})`;
  return ms;
}

async function applyOne(sql, m) {
  if (!m.noTransaction) {
    return sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
      return recordAndRun(tx, m);
    });
  }
  const conn = await sql.reserve();
  try {
    await conn`select pg_advisory_lock(${LOCK_ID})`;
    return await recordAndRun(conn, m);
  } finally {
    await conn`select pg_advisory_unlock(${LOCK_ID})`.catch(() => {});
    conn.release();
  }
}

function label(m) {
  return m.type === 'versioned' ? `V${m.version} ${m.description}` : `R ${m.description}`;
}

async function cmdMigrate(sql, flags) {
  const local = await loadLocalMigrations();
  await ensureHistory(sql);
  const applied = await loadApplied(sql);
  const { problems, pending } = analyze(local, applied, { outOfOrder: flags.has('--out-of-order') });

  if (problems.length) {
    console.log(red('✖ O banco não bate com os arquivos de migração:'));
    for (const p of problems) console.log(`  • ${p}`);
    process.exitCode = 1;
    return;
  }
  if (!pending.length) {
    console.log(green('✔ Banco atualizado. Nenhuma migração pendente.'));
    return;
  }

  console.log(`${pending.length} migração(ões) pendente(s):`);
  let count = 0;
  for (const m of pending) {
    try {
      const ms = await applyOne(sql, m);
      if (ms === null) {
        console.log(dim(`  - ${label(m)} (já aplicada por outro processo)`));
      } else {
        count++;
        console.log(green(`  ✔ ${label(m)}`) + dim(` ${ms} ms`));
      }
    } catch (err) {
      console.log(red(`  ✖ ${label(m)}  (${m.file})`));
      console.log(`    erro: ${err.message}`);
      const where = lineOf(m.sql, err.position);
      if (where) console.log(`    linha ${where.line}: ${where.text}`);
      if (err.detail) console.log(`    detalhe: ${err.detail}`);
      if (err.hint) console.log(`    dica: ${err.hint}`);
      console.log(m.noTransaction ? yellow('    Esta migração roda sem transação: confira o que ficou aplicado.') : dim('    Nada desta migração foi aplicado (transação desfeita).'));
      process.exitCode = 1;
      return;
    }
  }
  console.log(green(`✔ ${count} migração(ões) aplicada(s).`));
}

async function cmdInfo(sql) {
  const local = await loadLocalMigrations();
  const applied = await loadApplied(sql);
  const { rows, problems } = analyze(local, applied);
  if (!rows.length) {
    console.log('Nenhuma migração encontrada em supabase/migrations.');
    return;
  }
  const table = rows.map((r) => ({
    Versão: r.m.type === 'versioned' ? r.m.version : 'R',
    Descrição: r.m.description,
    Estado: r.state,
    'Aplicada em': r.applied ? new Date(r.applied.installed_on).toLocaleString('pt-BR') : '',
  }));
  console.table(table);
  for (const p of problems) console.log(yellow(`• ${p}`));
}

async function cmdValidate(sql) {
  const local = await loadLocalMigrations();
  const applied = await loadApplied(sql);
  const { problems, pending } = analyze(local, applied);
  if (problems.length) {
    console.log(red('✖ Validação falhou:'));
    for (const p of problems) console.log(`  • ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(green(`✔ Tudo certo. ${pending.length} pendente(s).`));
}

async function cmdRepair(sql, flags) {
  const local = await loadLocalMigrations();
  await ensureHistory(sql);
  const applied = await loadApplied(sql);
  const { rows } = analyze(local, applied);
  let changes = 0;
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${LOCK_ID})`;
    for (const r of rows) {
      if (r.state === 'Alterada') {
        await tx`
          update app_migrations.schema_history
          set checksum = ${r.m.checksum}, description = ${r.m.description}, script = ${r.m.file}
          where version = ${r.m.version}`;
        console.log(yellow(`  ↻ checksum realinhado: ${r.m.file}`));
        changes++;
      }
      if (r.state === 'Sem arquivo' && flags.has('--remove-missing')) {
        await tx`delete from app_migrations.schema_history where version = ${r.m.version}`;
        console.log(yellow(`  − removida do histórico: ${r.m.file}`));
        changes++;
      }
    }
  });
  console.log(changes ? green(`✔ ${changes} ajuste(s) no histórico.`) : green('✔ Nada para reparar.'));
}

async function cmdNew(args) {
  const description = args.join(' ').trim();
  if (!description) fail('Informe a descrição: npm run db:new -- "cadastrar frota"');
  const slug = description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const local = await loadLocalMigrations();
  const last = local.filter((m) => m.type === 'versioned').at(-1);
  const next = last ? parseVersion(last.version)[0] + 1 : 1;
  const file = `V${next}__${slug}.sql`;
  await mkdir(MIGRATIONS_DIR, { recursive: true });
  const target = path.join(MIGRATIONS_DIR, file);
  if (existsSync(target)) fail(`${file} já existe.`);
  await writeFile(target, `-- ${description}\n-- Criada em ${new Date().toISOString().slice(0, 10)}. Depois de aplicada, não edite: crie outra migração.\n\n`);
  console.log(green(`✔ Criado supabase/migrations/${file}`));
}

// ---------------------------------------------------------------------------

async function main() {
  const [command = 'migrate', ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const args = rest.filter((a) => !a.startsWith('--'));

  if (command === 'new') return cmdNew(args);

  if (flags.has('--on-deploy')) {
    const env = process.env.VERCEL_ENV;
    if (env && env !== 'production') {
      console.log(`Migrações puladas: ambiente "${env}" (só rodam no deploy de produção).`);
      return;
    }
    if (!process.env.DATABASE_URL) {
      console.log(yellow('Migrações puladas: DATABASE_URL não está definida nas variáveis de ambiente.'));
      return;
    }
  }

  const commands = { migrate: cmdMigrate, info: cmdInfo, validate: cmdValidate, repair: cmdRepair };
  const run = commands[command];
  if (!run) fail(`Comando desconhecido: ${command}. Use migrate, info, validate, repair ou new.`);

  const sql = connect();
  try {
    await run(sql, flags);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  if (err instanceof MigrationError) {
    console.error(red(`✖ ${err.message}`));
  } else {
    console.error(red(`✖ ${err.message ?? err}`));
    if (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error(dim('  Não foi possível conectar. Confira DATABASE_URL (use o Session pooler do Supabase).'));
    }
  }
  process.exitCode = 1;
});
