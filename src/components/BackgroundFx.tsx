import { useEffect, useRef } from 'react';

export const BackgroundFx = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const fontSize = 14;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(0);
    const delays = Array.from({ length: cols }, () =>
      Math.floor(Math.random() * 100),
    );

    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/アイウエオカキクケコ神風火空力心技術';

    const specialWords = [
      'SUI',
      'WALRUS',
      'SEAL',
      'TRUST',
      'BLOCKCHAIN',
      'MOVE',
      'PTB',
      'VERIFY',
    ];

    const specialColumns: (null | {
      word: string;
      step: number;
      holdFrames: number;
      wordY: number;
    })[] = Array(cols).fill(null);

    const trails: { x: number; y: number; char: string; opacity: number }[] =
      [];

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        ctx.fillStyle = `rgba(0, 255, 0, ${trail.opacity})`;
        ctx.fillText(trail.char, trail.x * fontSize, trail.y * fontSize);
        trail.opacity -= 0.015;
        if (trail.opacity <= 0) trails.splice(i, 1);
      }

      for (let i = 0; i < cols; i++) {
        const x = i;
        const y = drops[i];

        if (delays[i] > 0) {
          delays[i]--;
          continue;
        }

        if (!specialColumns[i] && Math.random() < 0.001) {
          const word =
            specialWords[Math.floor(Math.random() * specialWords.length)];
          specialColumns[i] = {
            word,
            step: 0,
            holdFrames: 40,
            wordY: y,
          };
        }

        const spec = specialColumns[i];
        let skipRandom = false;

        if (spec) {
          const { word, step, holdFrames, wordY } = spec;

          if (step < word.length) {
            const chY = wordY + step;
            const ch = word[step];
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.font = `${fontSize}px monospace`;
            ctx.fillText(ch, x * fontSize, chY * fontSize);
            trails.push({ x, y: chY, char: ch, opacity: 0.5 });
            spec.step++;
            skipRandom = true;
          } else if (holdFrames > 0) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.font = `bold ${fontSize}px monospace`;
            for (let j = 0; j < word.length; j++) {
              const chY = wordY + j;
              ctx.fillText(word[j], x * fontSize, chY * fontSize);
            }
            spec.holdFrames--;
          } else {
            specialColumns[i] = null;
          }

          const wordBottom = spec.wordY + spec.word.length;
          if (y >= spec.wordY && y < wordBottom) {
            skipRandom = true;
          }
        }

        if (!skipRandom) {
          const char = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillStyle = `hsl(${(x / cols) * 360}, 100%, 60%)`;
          ctx.fillText(char, x * fontSize, y * fontSize);
          trails.push({ x, y, char, opacity: 0.4 });
        }

        drops[i] =
          y * fontSize > canvas.height && Math.random() > 0.975 ? 0 : y + 1;
      }
    };

    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full z-[1] pointer-events-none opacity-45 bg-white dark:bg-black"
    />
  );
};
