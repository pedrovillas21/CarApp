import { useEffect, useImperativeHandle, useRef, type PointerEvent as ReactPointerEvent, type Ref } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  /** PNG com fundo branco, pronto para o Storage. */
  toBlob: () => Promise<Blob>;
};

type Point = { x: number; y: number };

const INK = '#2E2F71';
const LINE_WIDTH = 3;
const MAX_DPR = 2;

function prepare(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawDot(ctx: CanvasRenderingContext2D, p: Point) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, LINE_WIDTH / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length === 1) return drawDot(ctx, points[0]);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  // curvas pelos pontos médios deixam o traço suave
  for (let i = 1; i < points.length - 1; i++) {
    const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function SignaturePad({ ref, onChange }: { ref?: Ref<SignaturePadHandle>; onChange?: (empty: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const context = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    prepare(ctx);
    return ctx;
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = context();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  };

  // Ajusta a resolução ao tamanho real e redesenha (ex.: girar o celular não apaga a assinatura).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        strokes.current = [];
        redraw();
        onChangeRef.current?.(true);
      },
      isEmpty: () => strokes.current.length === 0,
      toBlob() {
        const canvas = canvasRef.current;
        if (!canvas) return Promise.reject(new Error('Assinatura indisponível'));
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(canvas, 0, 0);
        return new Promise((resolve, reject) =>
          out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a assinatura'))), 'image/png'),
        );
      },
    }),
    [],
  );

  const pointFrom = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pointFrom(e);
    const wasEmpty = strokes.current.length === 0;
    strokes.current.push([p]);
    const ctx = context();
    if (ctx) drawDot(ctx, p);
    if (wasEmpty) onChangeRef.current?.(false);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const stroke = strokes.current[strokes.current.length - 1];
    const ctx = context();
    if (!stroke || !ctx) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = pointFrom(ev);
      const prev = stroke[stroke.length - 1];
      stroke.push(p);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    redraw(); // troca os segmentos retos pela versão suavizada
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Área de assinatura. Assine com o dedo."
      className="absolute inset-0 size-full touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    />
  );
}
