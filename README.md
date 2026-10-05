# Controle de Frota · CREFITO 11

App web (mobile primeiro) para registrar a saída e o retorno dos carros do conselho.
O condutor escolhe o carro (o KM inicial vem do banco), um cronômetro conta a viagem e, na devolução, ele informa o KM final e assina com o dedo.

**Stack:** React 19 + Vite + Tailwind 4 + Motion, Supabase (Auth, Postgres, Storage). Deploy único na Vercel. Sem Next.js.
Identidade visual segue o manual em [.clauderules.md](.clauderules.md).

## 1. Configurar

```bash
npm install
cp .env.example .env.local   # preencha os valores
```

| Variável | Onde achar no Supabase | Usada por |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings › API | app e scripts |
| `VITE_SUPABASE_ANON_KEY` | Project Settings › API (anon / publishable) | app |
| `DATABASE_URL` | Connect › **Session pooler** (porta 5432) | migrações |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings › API (service_role, secreta) | cadastro de condutores |

Use o **Session pooler**: a conexão direta (`db.*.supabase.co`) só funciona em IPv6 e falha na Vercel.

## 2. Banco: migrações estilo Flyway

Os arquivos ficam em `supabase/migrations/`:

- `V1__estrutura_inicial.sql`, `V2__...sql`: rodam **uma vez**, em ordem de versão.
- `R__qualquer_nome.sql`: roda de novo sempre que o conteúdo muda (bom para views).

```bash
npm run db:migrate              # aplica o que falta
npm run db:info                 # estado de cada migração
npm run db:validate             # confere se o banco bate com os arquivos
npm run db:new -- "cadastrar frota"   # cria o próximo V<n>__cadastrar_frota.sql
npm run db:repair               # realinha checksum de migração editada (use com cuidado)
```

Regras:

- **Nunca edite uma migração já aplicada.** O script detecta e bloqueia. Crie outra.
- Cada migração roda numa transação: se der erro, nada dela fica no banco e o terminal mostra a linha do erro.
- Comandos que não aceitam transação (`create index concurrently`): coloque `-- migrate:no-transaction` no topo do arquivo.
- Duas execuções ao mesmo tempo não se atropelam (advisory lock).
- O histórico fica em `app_migrations.schema_history`, fora da API pública.

**Deploy:** na Vercel, o build roda `npm run vercel-build`, que aplica as migrações pendentes **só no deploy de produção** e só se `DATABASE_URL` estiver configurada lá. Preview deploys não mexem no banco.

### Cadastrar a frota

```bash
npm run db:new -- "frota inicial"
```

E no arquivo criado:

```sql
insert into public.vehicles (plate, model, current_km) values
  ('RTA2C14', 'Fiat Strada', 48215),
  ('QOE4F58', 'Volkswagen Gol', 35770);
```

Placa no padrão Mercosul, maiúscula e sem hífen. Depois rode `npm run db:migrate`.

## 3. Condutores (sem painel)

Só quem está na tabela `drivers` usa o app. Não há tela de cadastro nem de troca de senha.

```bash
npm run user:create -- --email ana@exemplo.org --name "Ana Souza"        # cria e mostra a senha uma vez
npm run user:create -- --email ana@exemplo.org --reset-password          # nova senha
npm run user:create -- --email ana@exemplo.org --disable                 # bloqueia (use --enable para liberar)
```

Recomendado, uma única vez no painel: **Authentication › Sign In / Providers › desligar "Allow new users to sign up"**.
Mesmo sem isso, quem se cadastrar por fora não acessa nada: o banco só libera quem está em `drivers`.

## 4. Sessão de 24 h

O login vale **24 h a partir da última vez que o app foi aberto**. Cada abertura (ou volta ao app) renova o prazo.
Exemplo: entrou às 9h e abriu de novo às 15h → pode entrar sem senha até 15h do dia seguinte. Se passar de 24 h sem abrir, pede login.

Fica em [src/lib/session.ts](src/lib/session.ts) e [src/auth/AuthProvider.tsx](src/auth/AuthProvider.tsx).
No plano Pro do Supabase dá para reforçar no servidor: Authentication › Sessions › Inactivity timeout = 24h.

## 5. Dados para o sistema administrativo

O app do condutor não mostra histórico. Tudo fica pronto em `public.trips`:

| Coluna | Conteúdo |
|---|---|
| `driver_id`, `vehicle_id` | quem e qual carro |
| `started_at`, `ended_at` | saída e retorno |
| `duration_seconds` | duração (calculada pelo banco) |
| `km_start`, `km_end`, `km_driven` | quilometragem (km rodados calculado pelo banco) |
| `destination` | destino ou motivo |
| `signature_path` | PNG da assinatura no bucket privado `signatures` |

## 6. Regras de segurança (no banco)

- Gravação só pelas funções `start_trip` e `finish_trip`; as tabelas são só leitura para o app.
- Um carro só tem uma viagem aberta por vez, e um condutor também (se dois tentarem pegar o mesmo carro, o segundo recebe o aviso "Este carro acabou de sair").
- KM final não pode ser menor que o inicial, nem mais de 5.000 km acima (trava contra dígito a mais).
- A viagem só fecha com a assinatura enviada para a pasta do próprio condutor; depois de fechada, a assinatura não pode ser trocada.

## Estrutura

```
scripts/            migrate.mjs (migrações), create-user.mjs (condutores)
supabase/migrations SQL versionado
src/auth            login e sessão de 24 h
src/lib             cliente Supabase, chamadas ao banco, formatação
src/screens         uma tela por arquivo (Login, Início, Iniciar viagem, Em viagem, KM, Assinatura, Concluído)
src/components      logo, placa, botões, painel inferior, assinatura
public/brand        logo negativa e redução "Crefito 11"
```

## Rodar

```bash
npm run dev       # http://localhost:5173
npm run build     # checa tipos e gera dist/
```
