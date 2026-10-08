import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'motion/react';
import '../index.css';
import type { Format } from './roteiro';
import { Player } from './Video';

/**
 * Vídeo de apresentação do app. Com `npm run dev`, abra /apresentacao.html.
 * ?formato=16x9 (padrão) | 9x16 | 1x1 · ?legendas (narração escrita) · ?render (usado na gravação)
 */
const params = new URLSearchParams(window.location.search);
const format = (['16x9', '9x16', '1x1'] as Format[]).find((f) => f === params.get('formato')) ?? '16x9';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <Player render={params.has('render')} format={format} subtitles={params.has('legendas')} />
    </LazyMotion>
  </StrictMode>,
);