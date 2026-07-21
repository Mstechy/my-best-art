import { useEffect, useState } from "react";

interface FlashDealCountdownProps {
  endAt: string;
  className?: string;
}

export default function FlashDealCountdown({ endAt, className }: FlashDealCountdownProps) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const target = new Date(endAt).getTime();
    if (!Number.isFinite(target)) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setRemaining({ d, h, m, s });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  if (!remaining) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const cls = ["inline-flex", "items-center", "gap-1", "text-[10px]", "font-bold"];
  if (className) cls.push(className);

  return (
    <span className={cls.join(" ")}>
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">{pad(remaining.d)}d</span>
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">{pad(remaining.h)}h</span>
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">{pad(remaining.m)}m</span>
      <span className="rounded bg-red-600 px-1.5 py-0.5 text-white">{pad(remaining.s)}s</span>
    </span>
  );
}
