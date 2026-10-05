export function MissingConfig() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">Falta configurar o Supabase</h1>
      <p className="leading-normal">
        Copie <code className="font-bold">.env.example</code> para <code className="font-bold">.env.local</code>, preencha{' '}
        <code className="font-bold">VITE_SUPABASE_URL</code> e <code className="font-bold">VITE_SUPABASE_ANON_KEY</code> e reinicie o{' '}
        <code className="font-bold">npm run dev</code>.
      </p>
      <p className="leading-normal text-azul/80">Na Vercel, cadastre as mesmas variáveis em Settings › Environment Variables.</p>
    </main>
  );
}
