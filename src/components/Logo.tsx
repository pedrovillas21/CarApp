/**
 * Logo CREFITO 11, versão Negativa 02 (símbolo colorido, texto branco): só sobre o azul #2E2F71.
 * Manual: logo completo nunca abaixo de 200 px de largura; abaixo disso, usar reduções.
 * Área de respiro X = altura da palavra "Crefito": mantenha esse espaço livre em volta.
 */
const FULL = { src: '/brand/crefito11-negativa.png', width: 709, height: 255 };
const WORDMARK = { src: '/brand/crefito11-texto-negativa.png', width: 505, height: 97 };
const FULL_MIN_WIDTH = 200;

export function LogoCompleta({ width = 240 }: { width?: number }) {
  const w = Math.max(FULL_MIN_WIDTH, width);
  return (
    <img
      src={FULL.src}
      width={w}
      height={Math.round((w * FULL.height) / FULL.width)}
      alt="Crefito 11 – Conselho Regional de Fisioterapia e Terapia Ocupacional da 11ª Região"
      draggable={false}
      className="block select-none"
    />
  );
}

/** Redução 2 do manual: só o texto "Crefito 11". Para cabeçalhos. */
export function LogoTexto({ height = 24 }: { height?: number }) {
  return (
    <img
      src={WORDMARK.src}
      height={height}
      width={Math.round((height * WORDMARK.width) / WORDMARK.height)}
      alt="Crefito 11"
      draggable={false}
      className="block select-none"
    />
  );
}
