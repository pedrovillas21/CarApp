export const formatKm = (km: number) => km.toLocaleString('pt-BR');

export const formatTime = (value: string | number | Date) =>
  new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Tempo desde um horário, para leitura rápida: "há 5 min", "há 1h 05min". */
export function formatElapsed(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}min`;
}

export function todayLabel(date = new Date()) {
  const raw = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}
