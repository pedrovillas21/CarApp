# Controle de Frota · CREFITO 11

App web (mobile primeiro) para registrar a saída e o retorno dos carros do conselho.
O condutor escolhe o carro (o KM inicial vem do banco), um cronômetro conta a viagem e, na devolução, ele informa o KM final e assina com o dedo.

**Stack:** React 19 + Vite + Tailwind 4 + Motion, Supabase (Auth, Postgres, Storage). Deploy único na Vercel. Sem Next.js.
Identidade visual segue o manual em [.clauderules.md](.clauderules.md).

Todos os comandos abaixo rodam no terminal, dentro da pasta do projeto.

---

## Sumário

1. [Configurar o projeto](#1-configurar-o-projeto)
2. [Chaves e segurança](#2-chaves-e-segurança)
3. [Banco de dados: migrações](#3-banco-de-dados-migrações)
4. [Condutores (usuários)](#4-condutores-usuários)
5. [Veículos](#5-veículos)
6. [Testar e limpar antes de usar de verdade](#6-testar-e-limpar-antes-de-usar-de-verdade)
7. [Sessão de 24 h](#7-sessão-de-24-h)
8. [Deploy na Vercel](#8-deploy-na-vercel)
9. [Dados para o sistema administrativo](#9-dados-para-o-sistema-administrativo)
10. [Regras de segurança do banco](#10-regras-de-segurança-do-banco)
11. [Estrutura do código](#11-estrutura-do-código)

---

## 1. Configurar o projeto

```bash
npm install
cp .env.example .env.local
```

Preencha o `.env.local`:

| Variável | Onde achar no Supabase | Usada por |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings › API | app e scripts |
| `VITE_SUPABASE_ANON_KEY` | Project Settings › API (anon / publishable) | app |
| `DATABASE_URL` | Connect › **Session pooler** (porta 5432) | migrações |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings › API (service_role / secret) | cadastro de condutores |

Use o **Session pooler**. A conexão direta (`db.*.supabase.co`) só funciona em IPv6 e falha na Vercel.

Para rodar o app no computador:

```bash
npm run dev       # abre em http://localhost:5173
npm run build     # checa os tipos e gera a pasta dist/
npm start         # serve a pasta dist/ em http://localhost:4173 (rode o build antes)
```

---

## 2. Chaves e segurança

| Chave | Pode ficar pública? | Onde guardar |
|---|---|---|
| `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` | **Sim.** Vão para o navegador de propósito. | `.env.local` e Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | **Não.** Ignora todas as regras do banco (acesso total). | Só no `.env.local` do seu computador. **Não coloque na Vercel.** |
| `DATABASE_URL` | **Não.** É a senha do banco (acesso total). | `.env.local`. Na Vercel só se quiser migração automática (ver [seção 8](#8-deploy-na-vercel)). |

- **A anon key sozinha não libera nada.** O banco bloqueia quem não está logado e quem está logado mas não é condutor cadastrado.
- Só variáveis com prefixo `VITE_` vão para o navegador. A service role e a `DATABASE_URL` nunca entram no app.
- O `.env.local` está no `.gitignore` e não vai para o git.
- **Se a service role vazar**, gere outra no painel do Supabase. Se o projeto mostrar as chaves novas (`sb_publishable_...` e `sb_secret_...`), prefira essas: a secreta pode ser revogada sozinha.

---

## 3. Banco de dados: migrações

Funciona no estilo do Flyway. Os arquivos ficam em `supabase/migrations/`:

- `V1__estrutura_inicial.sql`, `V2__...sql`, ...: rodam **uma única vez**, em ordem de versão.
- `R__qualquer_nome.sql`: roda de novo sempre que o conteúdo muda (bom para views).

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | aplica as migrações que faltam |
| `npm run db:info` | mostra o estado de cada uma (Aplicada, Pendente...) |
| `npm run db:validate` | confere se o banco bate com os arquivos |
| `npm run db:new -- "descrição"` | cria o próximo arquivo `V<n>__descricao.sql` |
| `npm run db:repair` | aceita uma migração aplicada que foi editada (use com cuidado) |

Regras:

- **Nunca edite uma migração já aplicada.** O script detecta e bloqueia. Para corrigir, crie outra.
- Cada migração roda numa transação: se der erro, nada dela fica no banco e o terminal mostra a linha do erro.
- Comandos que não aceitam transação (como `create index concurrently`): coloque `-- migrate:no-transaction` nas primeiras linhas do arquivo.
- Duas execuções ao mesmo tempo não se atropelam.
- O histórico fica em `app_migrations.schema_history`, fora da API pública.

**Migração V6 (rota das viagens):** está aplicada no banco, mas a funcionalidade de GPS/rotas foi pausada e o código dela está na branch `feature/mapa-de-rotas`. As tabelas e colunas da V6 (`trip_points`, `trips.route_*`, `drivers.location_consent_at`) ficam sem uso e não afetam o app. Não apague o arquivo da V6: o `db:migrate` (e o deploy na Vercel) acusa erro se uma migração aplicada não tiver arquivo.

**Primeira vez:** rode `npm run db:migrate` para criar as tabelas, as regras de segurança e o local das assinaturas.

---

## 4. Condutores (usuários)

Só quem está cadastrado como condutor usa o app. Não há tela de cadastro nem de troca de senha: tudo é feito pelo comando abaixo, no seu computador (precisa da service role no `.env.local`).

**Por que não pela migração:** a senha ficaria salva no git, e a tabela interna de login do Supabase pode mudar entre versões. O comando usa a API oficial.

### Criar um condutor

Com senha escolhida por você:

```bash
npm run user:create -- --email illario@exemplo.org --name "Illario" --password "senha-escolhida"
```

Sem `--password`, o comando gera uma senha forte e mostra uma única vez no terminal.

### Trocar a senha

O mesmo comando, com o mesmo e-mail e a senha nova. O nome e as viagens não mudam.

```bash
npm run user:create -- --email illario@exemplo.org --password "nova-senha"
```

Ou, para gerar uma senha nova automaticamente:

```bash
npm run user:create -- --email illario@exemplo.org --reset-password
```

### Trocar o nome

```bash
npm run user:create -- --email illario@exemplo.org --name "Illario Sobrenome"
```

### Bloquear e liberar

```bash
npm run user:create -- --email illario@exemplo.org --disable
npm run user:create -- --email illario@exemplo.org --enable
```

O condutor bloqueado não entra, mas as viagens dele continuam no banco.

### Observações

- **"Lembrar meu e-mail":** na tela de login, se marcado, o app guarda só o e-mail no aparelho (nunca a senha). Ele é salvo depois de um login que deu certo. Desmarcando e entrando de novo, o e-mail é apagado do aparelho.
- **Senha mínima:** 6 caracteres (padrão do Supabase). Dá para mudar em Authentication › Policies › Password.
- **Histórico do terminal:** o comando com `--password` fica salvo nele, com a senha junto. Para um app interno isso costuma ser aceitável.
- **Quem já estava logado:** continua logado depois da troca de senha até completar 24 h sem abrir o app. A senha nova vale no próximo login.
- **Recomendado, uma única vez:** no painel, Authentication › Sign In / Providers › desligue **"Allow new users to sign up"**. Mesmo sem isso, quem se cadastrar por fora não acessa nada.

---

## 5. Veículos

### Cadastrar (recomendado: por migração)

Fica registrado no histórico, junto com o resto do banco.

1. Crie o arquivo:
   ```bash
   npm run db:new -- "cadastrar veiculos"
   ```
2. No arquivo criado em `supabase/migrations/` (por exemplo `V2__cadastrar_veiculos.sql`), escreva:
   ```sql
   insert into public.vehicles (plate, model, current_km) values
     ('RTA2C14', 'Fiat Strada', 48215),
     ('QOE4F58', 'Volkswagen Gol', 35770);
   ```
3. Aplique:
   ```bash
   npm run db:migrate
   ```

Regras:

- **Placa:** padrão Mercosul, letras maiúsculas e sem hífen (`RTA2C14`). O banco recusa formato errado e placa repetida.
- **KM:** o `current_km` é o que está no hodômetro hoje. Ele vira o KM inicial da primeira viagem e depois é atualizado sozinho a cada devolução.
- **Depois de aplicada, não edite a migração.** Para corrigir, crie outra.

### Foto do carro

Na escolha do carro e no início aparece uma foto do modelo (estilo app de corrida), com a placa embaixo do nome. Sem foto, aparece só a placa.

1. Coloque a imagem em `public/vehicles/` (fundo transparente, de preferência WebP com uns 320 px de largura). Exemplo: `public/vehicles/byd-king.webp`.
2. Aponte o carro para ela numa migração:
   ```sql
   update public.vehicles set image_url = '/vehicles/byd-king.webp' where model = 'BYD King';
   ```
   Ou já no cadastro: `insert into public.vehicles (plate, model, current_km, image_url) values (...)`.

A foto atual do BYD King veio do site oficial da BYD Brasil e é só ilustrativa.

### Cadastrar pelo painel (alternativa)

Supabase › Table Editor › `vehicles` › Insert row: preencha `plate`, `model` e `current_km`. Funciona na hora, mas não fica no histórico de migrações.

### Tirar um carro da frota

Sem apagar as viagens dele (crie uma migração com):

```sql
update public.vehicles set active = false where plate = 'RTA2C14';
```

Para voltar a usar, troque `false` por `true`.

### Corrigir o KM de um carro

Se o KM do banco estiver errado (crie uma migração com):

```sql
update public.vehicles set current_km = 48300 where plate = 'RTA2C14';
```

---

## 6. Testar e limpar antes de usar de verdade

Para testar, **não use migração**: ela fica para sempre no histórico e roda de novo em qualquer banco novo. Use o painel e depois apague.

### 1. Criar um carro de teste

Supabase › SQL Editor:

```sql
insert into public.vehicles (plate, model, current_km) values ('TST1A23', 'Carro de teste', 1000);
```

### 2. Testar à vontade

Fazer viagens, assinar e devolver.

### 3. Apagar as assinaturas de teste (antes das viagens)

**Faça isto primeiro.** O nome do arquivo da assinatura só diz o condutor e a viagem (`<id do condutor>/<id da viagem>.png`). Depois que as viagens são apagadas, não dá mais para saber de qual carro cada assinatura era.

Liste os arquivos das viagens do carro de teste:

```sql
select signature_path from public.trips
where vehicle_id = (select id from public.vehicles where plate = 'TST1A23')
  and signature_path is not null;
```

Apague esses arquivos em Storage › `signatures` (uma pasta por condutor, com o id dele).

### 4. Apagar o carro de teste e as viagens dele

As viagens precisam sair antes do carro (o banco não deixa apagar um carro que tem viagens):

```sql
delete from public.trips
where vehicle_id = (select id from public.vehicles where plate = 'TST1A23');

delete from public.vehicles where plate = 'TST1A23';
```

### 5. Se testaram com carros reais

Antes de começar a usar de verdade, apague **todas** as assinaturas em Storage › `signatures` e só depois **todas** as viagens:

```sql
delete from public.trips;
```

Depois, acerte o `current_km` de cada carro (cada devolução de teste atualiza o KM).

### 6. Cadastrar os carros reais

Por migração, como na [seção 5](#5-veículos).

---

## 7. Sessão de 24 h

O login vale **24 h a partir da última vez que o app foi aberto**. Cada abertura (ou volta ao app) renova o prazo.

> Exemplo: entrou às 9h e abriu de novo às 15h → pode entrar sem senha até 15h do dia seguinte.
> Se passar de 24 h sem abrir, pede login de novo.

- A regra fica em [src/lib/session.ts](src/lib/session.ts) e [src/auth/AuthProvider.tsx](src/auth/AuthProvider.tsx).
- No plano Pro do Supabase dá para reforçar no servidor: Authentication › Sessions › Inactivity timeout = 24h.
- Se a sessão expirar no meio de uma viagem, a viagem continua registrada e o cronômetro não para. Depois do login, o app volta direto para ela.

---

## 8. Deploy na Vercel

1. Importe o repositório na Vercel. O `vercel.json` já configura tudo.
2. Em Settings › Environment Variables, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. **Não** cadastre a `SUPABASE_SERVICE_ROLE_KEY`.
4. Escolha como rodar as migrações:

| Opção | Como | Quando usar |
|---|---|---|
| **Automática** | Cadastre também a `DATABASE_URL` na Vercel. Cada deploy de produção aplica as migrações pendentes. Deploys de preview não mexem no banco. | Equipe da Vercel pequena e de confiança |
| **Manual** (mais restrita) | Não cadastre a `DATABASE_URL`. Rode `npm run db:migrate` do seu computador antes de cada deploy. O build pula as migrações sozinho. | Mais gente com acesso à Vercel |

Atenção: quem tem acesso ao projeto na Vercel consegue ver a `DATABASE_URL` se ela estiver cadastrada lá.

---

## 9. Dados para o sistema administrativo

O app do condutor não mostra histórico. Tudo fica pronto na tabela `public.trips`:

| Coluna | Conteúdo |
|---|---|
| `driver_id`, `vehicle_id` | quem e qual carro |
| `started_at`, `ended_at` | saída e retorno |
| `duration_seconds` | duração da viagem (calculada pelo banco) |
| `km_start`, `km_end`, `km_driven` | quilometragem (km rodados calculado pelo banco) |
| `destination` | destino ou motivo |
| `signature_path` | PNG da assinatura no bucket privado `signatures` |

Nomes dos condutores: tabela `public.drivers`. Dados dos carros: tabela `public.vehicles`.

### Painel administrativo

O painel (projeto `admCarApp`) lê esses dados e gera o relatório em PDF. Só quem está na tabela `public.admins` (e ativo) consegue ler as viagens de todos e as assinaturas; a regra está em `V4__painel_administrativo.sql`.

```bash
npm run admin:create -- --email fulano@crefito11.org --name "Fulano de Tal"
npm run admin:create -- --email fulano@crefito11.org --reset-password
npm run admin:create -- --email fulano@crefito11.org --disable   # tira o acesso ao painel
```

Se o e-mail já for de um condutor, ele só ganha o acesso ao painel e continua usando o app normalmente. `--disable` tira só o acesso ao painel.

---

## 10. Regras de segurança do banco

- Gravação só pelas funções `start_trip` e `finish_trip`. As tabelas são só leitura para o app.
- Um carro só tem uma viagem aberta por vez, e um condutor também. Se dois tentarem pegar o mesmo carro, o segundo recebe o aviso "Este carro acabou de sair".
- O KM final não pode ser menor que o inicial, nem mais de 5.000 km acima (trava contra dígito a mais). Acima de 1.000 km o app só pede para conferir.
- A viagem só fecha com a assinatura enviada para a pasta do próprio condutor. Depois de fechada, a assinatura não pode ser trocada.
- Cada condutor só vê as próprias viagens. Administradores (tabela `admins`) leem todas, sem poder alterar.

---

## 11. Estrutura do código

```
scripts/              migrate.mjs (migrações), create-user.mjs (condutores), create-admin.mjs (painel)
supabase/migrations/  SQL versionado
src/auth/             login e sessão de 24 h
src/lib/              cliente Supabase, chamadas ao banco, formatação
src/screens/          uma tela por arquivo (Login, Início, Iniciar viagem, Em viagem, KM, Assinatura, Concluído)
src/components/       logo, placa, botões, painel inferior, assinatura
public/brand/         logo negativa e redução "Crefito 11"
```
