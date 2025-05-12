import { useEffect, useRef } from 'react';

export const BackgroundFx = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const columns = Math.floor(canvas.width / 20);
    const drops = Array(columns).fill(0);
    const delays = Array(columns)
      .fill(0)
      .map(() => Math.floor(Math.random() * 100));

    let tick = 0;
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px monospace';

      drops.forEach((y, i) => {
        if (delays[i] > 0) {
          delays[i]--;
          return;
        }

        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 20;
        const hue = ((x / canvas.width) * 360 + tick) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 75%)`;

        ctx.fillText(text, x, y * 20);
        drops[i] = y * 20 > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      });

      tick += 2.5;
    };

    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full z-[1] pointer-events-none opacity-45"
    />
  );
};
