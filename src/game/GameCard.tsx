import type { CardType, Enemy } from "./data";

const RARITY_STYLES: Record<string, { frame: string; glow: string; label: string }> = {
  common: { frame: "from-stone-500 via-zinc-800 to-black", glow: "rgba(120,113,108,0.5)", label: "معمولی" },
  rare: { frame: "from-white via-red-900 to-black", glow: "rgba(255,255,255,0.55)", label: "نادر" },
  epic: { frame: "from-red-500 via-red-950 to-black", glow: "rgba(239,68,68,0.7)", label: "حماسی" },
  legendary: { frame: "from-orange-400 via-red-700 to-black", glow: "rgba(251,146,60,0.78)", label: "افسانه‌ای" },
  mythic: { frame: "from-white via-red-600 to-black", glow: "rgba(255,255,255,0.82)", label: "اسطوره‌ای" },
};

interface GameCardProps {
  card: CardType;
  float?: boolean;
  compact?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function Icon3D({ icon, className = "" }: { icon: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-white/20 via-red-950/70 to-black font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_18px_rgba(0,0,0,0.7)] ${className}`}
      style={{ textShadow: "0 2px 0 #000, 0 0 12px rgba(255,255,255,0.55)" }}
    >
      {icon}
    </span>
  );
}

export default function GameCard({ card, float, compact, selected, onClick }: GameCardProps) {
  const rarity = RARITY_STYLES[card.rarity] ?? RARITY_STYLES.common;
  const size = compact ? "h-40 w-28 rounded-2xl" : "h-[360px] w-[210px] rounded-[1.65rem]";

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden border border-white/20 bg-black ${size} ${onClick ? "cursor-pointer active:scale-95" : ""} ${selected ? "scale-105" : ""}`}
      style={{
        boxShadow: `${selected ? "0 0 28px rgba(255,255,255,0.75), " : ""}0 0 34px ${rarity.glow}, 0 22px 70px rgba(0,0,0,0.85)`,
        animation: float ? "float 4s ease-in-out infinite" : "cardReveal 0.5s ease-out both",
        transformStyle: "preserve-3d",
      }}
    >
      <div className={`absolute inset-0 rounded-[inherit] bg-gradient-to-br ${rarity.frame} p-[2px]`}>
        <div className="h-full w-full rounded-[inherit] bg-black" />
      </div>

      <img
        src={card.image}
        alt={card.name}
        className="absolute inset-[4px] h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-[inherit] object-cover transition duration-700 group-hover:scale-105"
        loading="lazy"
      />

      <div className="absolute inset-[4px] rounded-[inherit] bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(to_top,rgba(0,0,0,0.96)_0%,rgba(0,0,0,0.35)_38%,transparent_68%)]" />
      <div className="absolute inset-x-4 top-4 flex items-start justify-between">
        <span className="rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
          {rarity.label}
        </span>
        <Icon3D icon={card.element} className={compact ? "h-7 min-w-7 px-1 text-[10px]" : "h-9 min-w-9 px-1.5 text-xs"} />
      </div>

      <div className="absolute inset-x-3 bottom-3">
        <div className="mb-2 rounded-2xl border border-white/15 bg-black/65 p-2 backdrop-blur-md">
          <h3 className={`${compact ? "text-[10px]" : "text-sm"} text-center font-black text-white`}>
            {card.name}
          </h3>
          {!compact && <p className="mt-1 line-clamp-2 text-center text-[10px] leading-relaxed text-zinc-300">{card.desc}</p>}
        </div>

        <div className="grid grid-cols-3 gap-1 text-center">
          <StatPill icon="ATK" label="قدرت" value={card.attack} compact={compact} />
          <StatPill icon="HP" label="جان" value={card.health} compact={compact} />
          <StatPill icon="DEF" label="دفاع" value={card.defense} compact={compact} />
        </div>

        {!compact && (
          <div className="mt-2 rounded-xl border border-red-500/35 bg-red-950/55 px-2 py-1.5 text-center">
            <div className="text-[10px] font-black text-white">{card.special}</div>
            <div className="mt-0.5 text-[9px] text-zinc-400">{card.specialDesc}</div>
          </div>
        )}
      </div>

      {float && <div className="card-shine pointer-events-none absolute inset-0 rounded-[inherit]" />}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/10" />
    </div>
  );
}

export function EnemyCard({ enemy, compact, active }: { enemy: Enemy; compact?: boolean; active?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden border border-red-800/60 bg-black ${compact ? "h-36 w-24 rounded-2xl" : "h-52 w-36 rounded-3xl"}`}
      style={{
        boxShadow: `${active ? "0 0 26px rgba(239,68,68,0.7), " : ""}0 16px 40px rgba(0,0,0,0.75)`,
        animation: active ? "enemyEnter 0.55s ease-out both" : "cardReveal 0.35s ease-out both",
      }}
    >
      <img src={enemy.image} alt={enemy.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.96),rgba(0,0,0,0.35),transparent)]" />
      <div className="absolute right-2 top-2">
        <Icon3D icon={enemy.isBoss ? "BOSS" : enemy.gender === "female" ? "F" : enemy.gender === "male" ? "M" : "X"} className="h-7 min-w-7 px-1 text-[9px]" />
      </div>
      <div className="absolute inset-x-2 bottom-2 rounded-xl border border-white/10 bg-black/70 p-2 text-center backdrop-blur-sm">
        <div className="text-[10px] font-black text-white">{enemy.name}</div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[8px] font-bold text-zinc-300">
          <span>{enemy.attack}</span>
          <span>{enemy.health}</span>
          <span>{enemy.defense}</span>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, label, value, compact }: { icon: string; label: string; value: number; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/70 py-1">
      <div className={`${compact ? "text-[7px]" : "text-[8px]"} font-black text-red-300`}>{icon}</div>
      <div className={`${compact ? "text-[10px]" : "text-sm"} font-black text-white`}>{value}</div>
      {!compact && <div className="text-[8px] text-zinc-500">{label}</div>}
    </div>
  );
}