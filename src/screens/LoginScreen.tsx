import { useState, type FormEvent } from 'react';
import { m } from 'motion/react';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { IconArrowRight, IconCar, IconEye, IconEyeOff, IconLock, IconShield, IconUser } from '../components/Icons';
import { LogoCompleta } from '../components/Logo';
import { Notice } from '../components/Notice';

const inputClass =
  'h-[54px] w-full rounded-[14px] border-[1.5px] border-cinza bg-white pl-12 text-base text-azul outline-none transition-[border-color,box-shadow] focus:border-azul focus:shadow-[0_0_0_3px_rgb(50_208_176/0.35)]';

export function LoginScreen({ notice }: { notice?: string }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setBusy(true);
    setError(null);
    const message = await signIn(email, password);
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <section className="flex flex-col gap-10 rounded-b-[32px] bg-azul px-7 pt-[max(48px,env(safe-area-inset-top))] pb-24">
        <LogoCompleta width={240} />
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-verde/15 px-3 py-1.5 text-[13px] font-bold tracking-[0.6px] text-verde uppercase">
            <IconCar size={16} />
            Frota oficial
          </span>
          <h1 className="text-[34px] leading-[1.1] font-bold text-white">Controle de Frota</h1>
          <p className="max-w-[290px] text-base leading-[1.45] text-white/80">Registre a saída e o retorno dos carros do conselho.</p>
        </div>
      </section>

      <m.form
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: 'easeOut' }}
        className="mx-5 -mt-16 flex flex-col gap-[18px] rounded-3xl bg-white p-6 shadow-[0_14px_36px_rgb(46_47_113/0.16)]"
      >
        <h2 className="text-[22px] font-bold">Entrar</h2>

        {notice && !error && <Notice tone="info">{notice}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <div className="relative flex items-center">
            <IconUser className="pointer-events-none absolute left-4 text-azul/60" />
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="seu e-mail institucional"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} pr-4`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="senha" className="text-sm font-medium">
            Senha
          </label>
          <div className="relative flex items-center">
            <IconLock className="pointer-events-none absolute left-4 text-azul/60" />
            <input
              id="senha"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-14`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              className="absolute right-1 flex size-[46px] items-center justify-center rounded-xl"
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
        </div>

        <Button type="submit" loading={busy} loadingLabel="Entrando…" className="mt-1.5">
          <span className="inline-flex items-center gap-2.5">
            Entrar <IconArrowRight />
          </span>
        </Button>
      </m.form>

      <p className="mx-7 mt-auto flex items-start gap-2.5 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] text-[13px] leading-normal text-azul/80">
        <IconShield size={18} className="mt-px shrink-0" />
        <span>Acesso só para condutores cadastrados. Esqueceu a senha? Fale com a administração.</span>
      </p>
    </main>
  );
}
