import { Spinner } from '../components/Button';
import { LogoCompleta } from '../components/Logo';

export function SplashScreen() {
  return (
    <main role="status" aria-label="Carregando" className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-azul px-8">
      <LogoCompleta width={220} />
      <Spinner className="size-6 text-verde" />
    </main>
  );
}
