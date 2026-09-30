import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Dices,
  Flag,
  Hammer,
  HandCoins,
  KeyRound,
  Landmark,
  MapPin,
  Orbit,
  Pause,
  Play,
  Settings2,
  ShieldHalf,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrainFront,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
export const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Dices,
  Flag,
  Hammer,
  HandCoins,
  KeyRound,
  Landmark,
  MapPin,
  Orbit,
  Pause,
  Play,
  Settings2,
  ShieldHalf,
  ShoppingBag,
  Sparkles,
  Ticket,
  TrainFront,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  X,
};
export function Icon({
  name,
  size = 20,
  ...props
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const I = ICONS[name] || Sparkles;
  return <I size={size} strokeWidth={1.7} {...props} />;
}
export const money = (n: number) => `₡${n.toLocaleString("zh-CN")}`;
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, a[href], [tabindex="0"]',
        );
        if (!items?.length) {
          event.preventDefault();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <Icon name="X" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Dice({
  value,
  rolling = false,
}: {
  value: number;
  rolling?: boolean;
}) {
  const dots: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return (
    <div
      className={`dice ${rolling ? "rolling" : ""}`}
      aria-label={`${value} 点`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={dots[value].includes(i) ? "dot" : ""} />
      ))}
    </div>
  );
}
