import { useState, useRef, useCallback, useEffect } from "react";
import { SHOP_CARDS, LEVELS, difficultyLabel } from "./game/data";
import type { CardType, Enemy } from "./game/data";
import { verifyCode } from "./game/codes";
import { sound } from "./game/sound";
import GameCard, { EnemyCard, Icon3D } from "./game/GameCard";

type Screen = "shop" | "inventory" | "levels" | "battle" | "settings" | "achievements" | "quests" | "endless";

interface BattleLog { text: string; side: "you" | "ai" | "info" | "special"; }
interface Settings { playerName: string; music: boolean; sfx: boolean; }

interface Achievements {
  totalDamageDealt: number; totalDamageReceived: number;
  battlesWon: number; battlesLost: number; specialMovesUsed: number;
  bossesDefeated: number; highestLevelReached: number; totalGemsEarned: number;
}

interface GemState { balance: number; pending: number; lastUpdated: number; }

interface LoginStreakState {
  streak: number; bestStreak: number; lastClaimDate: string | null;
  pendingSpins: number; pendingAttackBoosts: number; pendingGoldenChests: number;
}

interface DailyRewardConfig {
  day: number; gems: number; spins?: number; attackBoosts?: number; goldenChests?: number;
  icon: string; title: string; desc: string;
}

interface ResolvedDailyReward {
  day: number; week: number; streakNumber: number; multiplier: number;
  gems: number; spins: number; attackBoosts: number; goldenChests: number;
  icon: string; title: string; desc: string;
}

interface LoginStreakStatus {
  todayKey: string; claimable: boolean; reset: boolean; missedDays: number;
  nextStreak: number; reward: ResolvedDailyReward; tomorrowReward: ResolvedDailyReward;
}

// ===== سیستم ۲: مأموریت =====
interface QuestDef {
  id: string; title: string; desc: string; icon: string; target: number;
  reward: number; rewardType: "gems" | "spins" | "attackBoosts" | "goldenChests";
  type: "daily" | "weekly";
}

interface QuestProgress { [questId: string]: number; }
interface QuestClaimed { [questId: string]: boolean; }

interface QuestState {
  dailyDate: string | null; weeklyDate: string | null;
  progress: QuestProgress; claimed: QuestClaimed;
  allDailyBonusClaimed: boolean;
}

// ===== سیستم ۵: ارتقای کارت =====
interface CardLevels { [cardId: string]: number; }

// ===== سیستم ۶: رنک =====
interface RankDef { id: string; name: string; icon: string; minWins: number; reward: number; color: string; }

// ===== سیستم ۷: صندوق =====
interface ChestState {
  winsUntilBronze: number; winsUntilSilver: number;
  winsUntilGold: number; bossChestPending: number;
  pendingChests: { type: string; gems: number }[];
}

// ===== سیستم ۴: بی‌نهایت =====
interface EndlessState { bestWave: number; currentWave: number; currentHp: number; active: boolean; totalDamage: number; }

/* ===================== Constants ===================== */

const DEFAULT_SETTINGS: Settings = { playerName: "جنگجو", music: true, sfx: true };
const DEFAULT_ACHIEVEMENTS: Achievements = { totalDamageDealt: 0, totalDamageReceived: 0, battlesWon: 0, battlesLost: 0, specialMovesUsed: 0, bossesDefeated: 0, highestLevelReached: 0, totalGemsEarned: 0 };
const DEFAULT_GEMS: GemState = { balance: 0, pending: 0, lastUpdated: Date.now() };

const DEFAULT_LOGIN_STREAK: LoginStreakState = {
  streak: 0, bestStreak: 0, lastClaimDate: null,
  pendingSpins: 0, pendingAttackBoosts: 0, pendingGoldenChests: 0,
};

const DAILY_REWARD_TABLE: DailyRewardConfig[] = [
  { day: 1, gems: 2, icon: "🔥", title: "شروع داغ", desc: "۲ الماس برای شروع استریک" },
  { day: 2, gems: 5, icon: "💎", title: "ادامه مسیر", desc: "۵ الماس جایزه بازگشت" },
  { day: 3, gems: 10, icon: "⚡", title: "جنگجوی وفادار", desc: "۱۰ الماس برای حفظ استریک" },
  { day: 4, gems: 3, spins: 1, icon: "🎰", title: "اسپین رایگان", desc: "۳ الماس + ۱ اسپین رایگان" },
  { day: 5, gems: 15, icon: "👑", title: "بازگشت قدرتمند", desc: "۱۵ الماس برای روز پنجم" },
  { day: 6, gems: 20, attackBoosts: 1, icon: "🔥", title: "بوست نبرد", desc: "۲۰ الماس + ۱ بوست حمله" },
  { day: 7, gems: 50, goldenChests: 1, icon: "🎁", title: "صندوق طلایی", desc: "۵۰ الماس + ۱ صندوق طلایی" },
];

const QUEST_DEFS: QuestDef[] = [
  { id: "d_battles", title: "نبرد امروز", desc: "۳ نبرد انجام بده", icon: "⚔️", target: 3, reward: 5, rewardType: "gems", type: "daily" },
  { id: "d_damage", title: "آسیب‌رسان", desc: "۵۰۰ آسیب وارد کن", icon: "💥", target: 500, reward: 3, rewardType: "gems", type: "daily" },
  { id: "d_boss", title: "شکارچی باس", desc: "۱ باس رو شکست بده", icon: "💀", target: 1, reward: 10, rewardType: "gems", type: "daily" },
  { id: "d_special", title: "جادوگر", desc: "۳ بار از قدرت ویژه استفاده کن", icon: "✨", target: 3, reward: 4, rewardType: "gems", type: "daily" },
  { id: "d_wins", title: "شکست‌ناپذیر", desc: "۲ پیروزی بدون شکست", icon: "🏆", target: 2, reward: 8, rewardType: "gems", type: "daily" },
  { id: "w_levels", title: "فاتح مراحل", desc: "۱۵ مرحله رد کن", icon: "🗺️", target: 15, reward: 50, rewardType: "gems", type: "weekly" },
];

const RANK_DEFS: RankDef[] = [
  { id: "bronze", name: "برنزی", icon: "🥉", minWins: 0, reward: 0, color: "text-amber-600" },
  { id: "silver", name: "نقره‌ای", icon: "🥈", minWins: 10, reward: 10, color: "text-slate-300" },
  { id: "gold", name: "طلایی", icon: "🥇", minWins: 25, reward: 30, color: "text-yellow-400" },
  { id: "platinum", name: "پلاتینی", icon: "💠", minWins: 50, reward: 70, color: "text-cyan-300" },
  { id: "diamond", name: "الماسی", icon: "💎", minWins: 100, reward: 150, color: "text-blue-300" },
  { id: "legendary", name: "افسانه‌ای", icon: "👑", minWins: 200, reward: 300, color: "text-amber-300" },
  { id: "mythic", name: "اسطوره‌ای", icon: "⚜️", minWins: 500, reward: 1000, color: "text-red-300" },
];

const UPGRADE_COSTS = [0, 5, 12, 25, 50, 100, 180, 300, 450, 500];
const UPGRADE_BONUSES = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50];

const DEFAULT_QUEST_STATE: QuestState = { dailyDate: null, weeklyDate: null, progress: {}, claimed: {}, allDailyBonusClaimed: false };
const DEFAULT_CARD_LEVELS: CardLevels = {};
const DEFAULT_CHEST_STATE: ChestState = { winsUntilBronze: 5, winsUntilSilver: 15, winsUntilGold: 30, bossChestPending: 0, pendingChests: [] };
const DEFAULT_ENDLESS: EndlessState = { bestWave: 0, currentWave: 0, currentHp: 0, active: false, totalDamage: 0 };

const GEM_CAPACITY = 40;
const MIN_WITHDRAW = 3;
const MAX_WITHDRAW = 22;

/* ===================== Helpers ===================== */

function pad2(n: number) { return String(n).padStart(2, "0"); }
function getLocalDayKey(date = new Date()) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
function getLocalWeekKey(date = new Date()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff); return getLocalDayKey(d);
}
function parseDayKeyToUtc(dayKey: string): number | null {
  const parts = dayKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}
function diffDayKeys(fromKey: string, toKey: string): number | null {
  const from = parseDayKeyToUtc(fromKey); const to = parseDayKeyToUtc(toKey);
  if (from === null || to === null) return null;
  return Math.floor((to - from) / 86400000);
}
function resolveDailyReward(streakNumber: number): ResolvedDailyReward {
  const safeStreak = Math.max(1, streakNumber);
  const day = ((safeStreak - 1) % 7) + 1;
  const week = Math.floor((safeStreak - 1) / 7) + 1;
  const multiplier = 1 + Math.floor((safeStreak - 1) / 7) * 0.25;
  const base = DAILY_REWARD_TABLE.find((r) => r.day === day)!;
  return { day, week, streakNumber: safeStreak, multiplier, gems: Math.ceil(base.gems * multiplier), spins: base.spins ?? 0, attackBoosts: base.attackBoosts ?? 0, goldenChests: base.goldenChests ?? 0, icon: base.icon, title: base.title, desc: base.desc };
}
function getLoginStreakStatus(state: LoginStreakState): LoginStreakStatus {
  const todayKey = getLocalDayKey();
  if (!state.lastClaimDate) return { todayKey, claimable: true, reset: false, missedDays: 0, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
  const diff = diffDayKeys(state.lastClaimDate, todayKey);
  if (diff === null) return { todayKey, claimable: true, reset: state.streak > 0, missedDays: 0, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
  if (diff <= 0) { const cr = resolveDailyReward(Math.max(1, state.streak)); return { todayKey, claimable: false, reset: false, missedDays: 0, nextStreak: state.streak, reward: cr, tomorrowReward: resolveDailyReward(state.streak + 1) }; }
  if (diff === 1) { const ns = state.streak + 1; return { todayKey, claimable: true, reset: false, missedDays: 0, nextStreak: ns, reward: resolveDailyReward(ns), tomorrowReward: resolveDailyReward(ns + 1) }; }
  return { todayKey, claimable: true, reset: true, missedDays: diff - 1, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
}
function loginStreakLabel(n: number) { return n <= 0 ? "0 روز" : `${n} روز`; }

function getCurrentRank(wins: number): RankDef { let r = RANK_DEFS[0]; for (const rank of RANK_DEFS) { if (wins >= rank.minWins) r = rank; } return r; }
function getNextRank(wins: number): RankDef | null { for (const rank of RANK_DEFS) { if (wins < rank.minWins) return rank; } return null; }

function getCardLevel(levels: CardLevels, cardId: string) { return levels[cardId] ?? 1; }
function getUpgradeCost(level: number) { return level >= 10 ? 0 : UPGRADE_COSTS[level] ?? 999; }
function getCardBonus(level: number) { return level >= 10 ? UPGRADE_BONUSES[9] : UPGRADE_BONUSES[level - 1] ?? 0; }
function applyCardBonus(card: CardType, level: number): CardType {
  if (level <= 1) return card;
  const bonus = getCardBonus(level);
  return { ...card, attack: Math.floor(card.attack * (1 + bonus)), health: Math.floor(card.health * (1 + bonus)), defense: Math.floor(card.defense * (1 + bonus)) };
}

function generateEndlessEnemy(wave: number): Enemy {
  const scaling = 1 + (wave / 10) * 1.5;
  const isBoss = wave % 10 === 0;
  const isMini = wave % 5 === 0 && !isBoss;
  const names = isBoss ? ["اژدهای ابدی", "شیطان تاریکی", "پادشاه خلأ", "ارباب مرگ"] : isMini ? ["نگهبان سایه", "جنگجوی آتش", "شوالیه یخ"] : ["سرباز تاریک", "شمشیرزن", "کمینگر", "جادوگر"];
  const name = names[wave % names.length];
  return {
    level: wave, name, emoji: isBoss ? "💀" : isMini ? "⚜️" : "🛡️",
    image: "", gender: wave % 2 === 0 ? "male" : "female",
    attack: Math.floor((isBoss ? 80 : isMini ? 55 : 40) * scaling),
    defense: Math.floor((isBoss ? 50 : isMini ? 35 : 22) * scaling),
    health: Math.floor((isBoss ? 350 : isMini ? 200 : 130) * scaling),
    reward: isBoss ? "💎💎💎" : isMini ? "💎💎" : "💎",
    specialChance: isBoss ? 0.4 : 0.15, specialName: isBoss ? "حمله سلطنتی" : "ضربه سنگین",
    specialMultiplier: isBoss ? 2.5 : 1.5, specialDesc: "آسیب ویژه", specialCooldown: 3,
    bg: "from-red-950 to-black", isBoss,
  };
}

function generateChestReward(type: string): number {
  const ranges: Record<string, [number, number]> = { bronze: [3, 8], silver: [10, 25], gold: [30, 70], legendary: [50, 150] };
  const [min, max] = ranges[type] ?? [3, 8];
  return min + Math.floor(Math.random() * (max - min + 1));
}

/* ===================== Load / Save ===================== */

function loadSettings(): Settings { try { const r = localStorage.getItem("ba_settings_v3"); if (!r) return DEFAULT_SETTINGS; return { ...DEFAULT_SETTINGS, ...JSON.parse(r) }; } catch { return DEFAULT_SETTINGS; } }
function loadOwned(): string[] { try { const r = localStorage.getItem("ba_owned_v3"); return r ? JSON.parse(r) : []; } catch { return []; } }
function loadCleared(): number[] { try { const r = localStorage.getItem("ba_cleared_v3"); return r ? JSON.parse(r) : []; } catch { return []; } }
function loadAchievements(): Achievements { try { const r = localStorage.getItem("ba_achievements_v3"); if (!r) return DEFAULT_ACHIEVEMENTS; return { ...DEFAULT_ACHIEVEMENTS, ...JSON.parse(r) }; } catch { return DEFAULT_ACHIEVEMENTS; } }
function loadGems(): GemState { try { const r = localStorage.getItem("ba_gems_v1"); if (!r) return DEFAULT_GEMS; return { ...DEFAULT_GEMS, ...JSON.parse(r) }; } catch { return DEFAULT_GEMS; } }
function loadLoginStreak(): LoginStreakState { try { const r = localStorage.getItem("ba_login_streak_v1"); if (!r) return DEFAULT_LOGIN_STREAK; const p = JSON.parse(r); return { ...DEFAULT_LOGIN_STREAK, ...p, lastClaimDate: typeof p?.lastClaimDate === "string" ? p.lastClaimDate : null }; } catch { return DEFAULT_LOGIN_STREAK; } }
function loadQuests(): QuestState { try { const r = localStorage.getItem("ba_quests_v1"); if (!r) return DEFAULT_QUEST_STATE; return { ...DEFAULT_QUEST_STATE, ...JSON.parse(r) }; } catch { return DEFAULT_QUEST_STATE; } }
function loadCardLevels(): CardLevels { try { const r = localStorage.getItem("ba_card_levels_v1"); if (!r) return DEFAULT_CARD_LEVELS; return JSON.parse(r); } catch { return DEFAULT_CARD_LEVELS; } }
function loadChests(): ChestState { try { const r = localStorage.getItem("ba_chests_v1"); if (!r) return DEFAULT_CHEST_STATE; return { ...DEFAULT_CHEST_STATE, ...JSON.parse(r) }; } catch { return DEFAULT_CHEST_STATE; } }
function loadRankClaimed(): string[] { try { const r = localStorage.getItem("ba_rank_claimed_v1"); return r ? JSON.parse(r) : []; } catch { return []; } }
function loadEndless(): EndlessState { try { const r = localStorage.getItem("ba_endless_v1"); if (!r) return DEFAULT_ENDLESS; return { ...DEFAULT_ENDLESS, ...JSON.parse(r) }; } catch { return DEFAULT_ENDLESS; } }

function saveOwned(v: string[]) { try { localStorage.setItem("ba_owned_v3", JSON.stringify(v)); } catch {} }
function saveCleared(v: number[]) { try { localStorage.setItem("ba_cleared_v3", JSON.stringify(v)); } catch {} }
function saveAchievements(v: Achievements) { try { localStorage.setItem("ba_achievements_v3", JSON.stringify(v)); } catch {} }
function saveGems(v: GemState) { try { localStorage.setItem("ba_gems_v1", JSON.stringify(v)); } catch {} }
function saveLoginStreak(v: LoginStreakState) { try { localStorage.setItem("ba_login_streak_v1", JSON.stringify(v)); } catch {} }
function saveQuests(v: QuestState) { try { localStorage.setItem("ba_quests_v1", JSON.stringify(v)); } catch {} }
function saveCardLevels(v: CardLevels) { try { localStorage.setItem("ba_card_levels_v1", JSON.stringify(v)); } catch {} }
function saveChests(v: ChestState) { try { localStorage.setItem("ba_chests_v1", JSON.stringify(v)); } catch {} }
function saveRankClaimed(v: string[]) { try { localStorage.setItem("ba_rank_claimed_v1", JSON.stringify(v)); } catch {} }
function saveEndless(v: EndlessState) { try { localStorage.setItem("ba_endless_v1", JSON.stringify(v)); } catch {} }
export default function App() {
  const [screen, setScreen] = useState<Screen>("shop");
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [owned, setOwned] = useState<string[]>(() => loadOwned());
  const [clearedLevels, setClearedLevels] = useState<number[]>(() => loadCleared());
  const [achievements, setAchievements] = useState<Achievements>(() => loadAchievements());
  const [gems, setGems] = useState<GemState>(() => loadGems());
  const [showWelcome, setShowWelcome] = useState(false);
  const [loginStreak, setLoginStreak] = useState<LoginStreakState>(() => loadLoginStreak());
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [quests, setQuests] = useState<QuestState>(() => loadQuests());
  const [cardLevels, setCardLevels] = useState<CardLevels>(() => loadCardLevels());
  const [chests, setChests] = useState<ChestState>(() => loadChests());
  const [rankClaimed, setRankClaimed] = useState<string[]>(() => loadRankClaimed());
  const [endless, setEndless] = useState<EndlessState>(() => loadEndless());
  const [showChestOpen, setShowChestOpen] = useState<{ type: string; gems: number } | null>(null);
  const [showRankUp, setShowRankUp] = useState<RankDef | null>(null);

  const gemPrices: Record<string, number> = {
    fire_dragon: 13, frost_mage: 26, thunder_god: 50, nature_guardian: 79,
    void_assassin: 236, demon_lord: 420, phoenix_king: 790, crystal_golem: 2745, blood_knight: 4000,
  };

  const ownedCount = owned.length;
  const productionRatePerHour = Math.max(0, ownedCount);
  const currentRank = getCurrentRank(achievements.battlesWon);
  const nextRank = getNextRank(achievements.battlesWon);

  // ===== Gem production =====
  useEffect(() => {
    const tick = () => {
      setGems((prev) => {
        const now = Date.now(); const elapsed = now - prev.lastUpdated;
        const currentRate = owned.length / (60 * 60 * 1000);
        if (currentRate <= 0) return { ...prev, lastUpdated: now };
        const produced = elapsed * currentRate;
        if (produced < 0.001) return { ...prev, lastUpdated: now };
        const newPending = Math.min(GEM_CAPACITY, prev.pending + produced);
        if (Math.abs(newPending - prev.pending) < 0.001) return { ...prev, lastUpdated: now };
        const next = { ...prev, pending: newPending, lastUpdated: now }; saveGems(next); return next;
      });
    };
    tick(); const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [owned.length]);

  // ===== Quest reset =====
  useEffect(() => {
    const todayKey = getLocalDayKey(); const weekKey = getLocalWeekKey();
    setQuests((prev) => {
      let changed = false; let next = { ...prev };
      if (prev.dailyDate !== todayKey) {
        const newProgress = { ...prev.progress }; const newClaimed = { ...prev.claimed };
        QUEST_DEFS.filter((q) => q.type === "daily").forEach((q) => { newProgress[q.id] = 0; newClaimed[q.id] = false; });
        next = { ...next, dailyDate: todayKey, progress: newProgress, claimed: newClaimed, allDailyBonusClaimed: false }; changed = true;
      }
      if (prev.weeklyDate !== weekKey) {
        const newProgress = { ...next.progress }; const newClaimed = { ...next.claimed };
        QUEST_DEFS.filter((q) => q.type === "weekly").forEach((q) => { newProgress[q.id] = 0; newClaimed[q.id] = false; });
        next = { ...next, weeklyDate: weekKey, progress: newProgress, claimed: newClaimed }; changed = true;
      }
      if (changed) { saveQuests(next); return next; }
      return prev;
    });
  }, []);

  // ===== Settings effects =====
  useEffect(() => {
    sound.setMusic(settings.music); sound.setSfx(settings.sfx);
    if (settings.music) sound.startMusic();
    try { localStorage.setItem("ba_settings_v3", JSON.stringify(settings)); } catch {}
  }, [settings]);

  useEffect(() => {
    const handler = () => { sound.resume(); if (settings.music) sound.startMusic(); window.removeEventListener("pointerdown", handler); window.removeEventListener("keydown", handler); };
    window.addEventListener("pointerdown", handler); window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("pointerdown", handler); window.removeEventListener("keydown", handler); };
  }, [settings.music]);

  useEffect(() => { const v = localStorage.getItem("ba_visited_v3"); if (!v) { setShowWelcome(true); localStorage.setItem("ba_visited_v3", "1"); } }, []);

  const [slide, setSlide] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const streakAutoOpenedRef = useRef(false);
  const dailyStreakStatus = getLoginStreakStatus(loginStreak);

  useEffect(() => {
    if (showWelcome || streakAutoOpenedRef.current) return;
    if (dailyStreakStatus.claimable) { setShowStreakModal(true); streakAutoOpenedRef.current = true; }
  }, [showWelcome, dailyStreakStatus.claimable]);

  const [codeModal, setCodeModal] = useState<{ card: CardType; showCode: boolean } | null>(null);
  const [codeInput, setCodeInput] = useState(""); const [codeError, setCodeError] = useState(""); const [codeSuccess, setCodeSuccess] = useState(false);
  const [storyCard, setStoryCard] = useState<CardType | null>(null);
  const [showGemPopup, setShowGemPopup] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // Battle state
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [playerCard, setPlayerCard] = useState<CardType | null>(null);
  const [playerHp, setPlayerHp] = useState(0); const [playerMaxHp, setPlayerMaxHp] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0); const [enemyMaxHp, setEnemyMaxHp] = useState(0);
  const [logs, setLogs] = useState<BattleLog[]>([]); const [turn, setTurn] = useState<"you" | "ai">("you");
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [hitFx, setHitFx] = useState<"you" | "ai" | null>(null); const [attacker, setAttacker] = useState<"you" | "ai" | null>(null);
  const [specialFx, setSpecialFx] = useState(false);
  const [popups, setPopups] = useState<{ id: number; text: string; side: "you" | "ai"; special?: boolean }[]>([]);
  const [specialCooldown, setSpecialCooldown] = useState(0); const [enemyFrozen, setEnemyFrozen] = useState(false);
  const [enemySpecialCd, setEnemySpecialCd] = useState(0); const [turnCount, setTurnCount] = useState(0);
  const [combo, setCombo] = useState(0); const [battleDamageDealt, setBattleDamageDealt] = useState(0);
  const [phoenixRevived, setPhoenixRevived] = useState(false); const [crystalShield, setCrystalShield] = useState(0);
  const [isEndlessBattle, setIsEndlessBattle] = useState(false);

  const ownedCards = SHOP_CARDS.filter((c) => owned.includes(c.id));

  const getUnlockedCards = () => {
    const unlocked: CardType[] = [];
    for (const card of SHOP_CARDS) {
      if (card.unlockIndex === 0 || owned.some((id) => { const p = SHOP_CARDS.find((c) => c.id === id); return p && p.unlockIndex === card.unlockIndex - 1; }))
        unlocked.push(card);
    }
    return unlocked;
  };
  const unlockedCards = getUnlockedCards();

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  }, []);

  const addGems = useCallback((amount: number) => {
    setGems((prev) => { const next = { ...prev, balance: prev.balance + amount }; saveGems(next); return next; });
  }, []);

  const onScroll = useCallback(() => {
    const el = sliderRef.current; if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== slide) { setSlide(idx); sound.play("slide"); }
  }, [slide]);

  // ===== Quest progress helper =====
  const addQuestProgress = useCallback((questId: string, amount: number) => {
    setQuests((prev) => {
      const def = QUEST_DEFS.find((q) => q.id === questId); if (!def) return prev;
      const cur = prev.progress[questId] ?? 0;
      const next = { ...prev, progress: { ...prev.progress, [questId]: Math.min(def.target, cur + amount) } };
      saveQuests(next); return next;
    });
  }, []);

  const claimQuestReward = useCallback((questId: string) => {
    const def = QUEST_DEFS.find((q) => q.id === questId); if (!def) return;
    setQuests((prev) => {
      if (prev.claimed[questId]) return prev;
      const cur = prev.progress[questId] ?? 0;
      if (cur < def.target) return prev;
      const next = { ...prev, claimed: { ...prev.claimed, [questId]: true } };
      saveQuests(next); return next;
    });
    if (def.rewardType === "gems") addGems(def.reward);
    else if (def.rewardType === "spins") setLoginStreak((p) => { const n = { ...p, pendingSpins: p.pendingSpins + def.reward }; saveLoginStreak(n); return n; });
    sound.play("code_ok"); showToast(`جایزه مأموریت: ${def.reward} ${def.rewardType === "gems" ? "الماس" : def.rewardType}`, "success");
  }, [addGems, showToast]);

  const claimAllDailyBonus = useCallback(() => {
    const dailyQuests = QUEST_DEFS.filter((q) => q.type === "daily");
    const allDone = dailyQuests.every((q) => quests.claimed[q.id]);
    if (!allDone || quests.allDailyBonusClaimed) return;
    setQuests((prev) => { const next = { ...prev, allDailyBonusClaimed: true }; saveQuests(next); return next; });
    setLoginStreak((p) => { const n = { ...p, pendingSpins: p.pendingSpins + 1 }; saveLoginStreak(n); return n; });
    sound.play("levelup"); showToast("پاداش تکمیل همه مأموریت‌ها: ۱ اسپین رایگان! 🎰", "success");
  }, [quests, showToast]);

  // ===== Card upgrade =====
  const upgradeCard = useCallback((cardId: string) => {
    const level = getCardLevel(cardLevels, cardId);
    if (level >= 10) { showToast("کارت در حداکثر سطح است", "info"); return; }
    const cost = getUpgradeCost(level);
    if (gems.balance < cost) { showToast(`الماس کافی نیست (${gems.balance}/${cost})`, "error"); return; }
    setGems((p) => { const n = { ...p, balance: p.balance - cost }; saveGems(n); return n; });
    setCardLevels((p) => { const n = { ...p, [cardId]: level + 1 }; saveCardLevels(n); return n; });
    sound.play("levelup"); showToast(`کارت به سطح ${level + 1} ارتقا یافت! 🌟`, "success");
  }, [cardLevels, gems.balance, showToast]);

  // ===== Rank check =====
  const checkRankUp = useCallback((wins: number) => {
    const rank = getCurrentRank(wins);
    if (rank.reward > 0 && !rankClaimed.includes(rank.id)) {
      setRankClaimed((p) => { const n = [...p, rank.id]; saveRankClaimed(n); return n; });
      addGems(rank.reward); setShowRankUp(rank);
      sound.play("levelup");
    }
  }, [rankClaimed, addGems]);

  // ===== Chest check =====
  const checkChests = useCallback((isBossWin: boolean) => {
    setChests((prev) => {
      const next = { ...prev };
      next.winsUntilBronze--; next.winsUntilSilver--; next.winsUntilGold--;
      if (isBossWin) next.bossChestPending++;
      const newChests = [...prev.pendingChests];
      if (next.winsUntilBronze <= 0) { newChests.push({ type: "bronze", gems: generateChestReward("bronze") }); next.winsUntilBronze = 5; }
      if (next.winsUntilSilver <= 0) { newChests.push({ type: "silver", gems: generateChestReward("silver") }); next.winsUntilSilver = 15; }
      if (next.winsUntilGold <= 0) { newChests.push({ type: "gold", gems: generateChestReward("gold") }); next.winsUntilGold = 30; }
      if (next.bossChestPending > 0) { newChests.push({ type: "legendary", gems: generateChestReward("legendary") }); next.bossChestPending = 0; }
      next.pendingChests = newChests; saveChests(next); return next;
    });
  }, []);

  const openNextChest = useCallback(() => {
    setChests((prev) => {
      if (prev.pendingChests.length === 0) return prev;
      const [chest, ...rest] = prev.pendingChests;
      setShowChestOpen(chest); addGems(chest.gems);
      sound.play("code_ok");
      const next = { ...prev, pendingChests: rest }; saveChests(next); return next;
    });
  }, [addGems]);

  // ===== Standard helpers =====
  const withdrawGems = () => {
    const available = Math.floor(gems.pending);
    if (available < MIN_WITHDRAW) { showToast(`حداقل برداشت ${MIN_WITHDRAW} الماس`, "error"); return; }
    const amount = Math.min(available, MAX_WITHDRAW);
    const newGems = { ...gems, balance: gems.balance + amount, pending: gems.pending - amount }; setGems(newGems); saveGems(newGems);
    setAchievements((p) => { const n = { ...p, totalGemsEarned: p.totalGemsEarned + amount }; saveAchievements(n); return n; });
    sound.play("levelup"); showToast(`+${amount} الماس برداشت شد`, "success");
  };

  const buyCardWithGems = (card: CardType) => {
    const price = gemPrices[card.id]; if (!price) { showToast("این کارت با الماس خریدنی نیست", "error"); return; }
    if (owned.includes(card.id)) { showToast("کارت قبلا خریداری شده", "info"); return; }
    if (gems.balance < price) { showToast(`موجودی کافی نیست (${gems.balance}/${price})`, "error"); return; }
    const ng = { ...gems, balance: gems.balance - price }; setGems(ng); saveGems(ng);
    const no = [...owned, card.id]; setOwned(no); saveOwned(no);
    sound.play("code_ok"); showToast(`${card.name} با الماس خریداری شد`, "success");
  };

  const openCodeModal = (card: CardType) => { setCodeModal({ card, showCode: false }); setCodeInput(""); setCodeError(""); setCodeSuccess(false); sound.play("click"); };
  const submitCode = () => {
    if (!codeModal) return; const clean = codeInput.trim().toUpperCase();
    if (clean.length < 8) { setCodeError("کد معتبر نیست"); sound.play("code_bad"); return; }
    if (verifyCode(codeModal.card.id, clean)) {
      setCodeSuccess(true); sound.play("code_ok");
      if (!owned.includes(codeModal.card.id)) { const no = [...owned, codeModal.card.id]; setOwned(no); saveOwned(no); showToast("کارت فعال شد!", "success"); }
      setTimeout(() => setCodeModal(null), 2000);
    } else { setCodeError("کد اشتباه است"); sound.play("code_bad"); }
  };

  const openStreakModal = () => { setShowStreakModal(true); sound.play("click"); };
  const claimDailyStreakReward = () => {
    if (!dailyStreakStatus.claimable) { setShowStreakModal(false); return; }
    const reward = dailyStreakStatus.reward;
    setLoginStreak((p) => { const n: LoginStreakState = { ...p, streak: dailyStreakStatus.nextStreak, bestStreak: Math.max(p.bestStreak, dailyStreakStatus.nextStreak), lastClaimDate: dailyStreakStatus.todayKey, pendingSpins: p.pendingSpins + reward.spins, pendingAttackBoosts: p.pendingAttackBoosts + reward.attackBoosts, pendingGoldenChests: p.pendingGoldenChests + reward.goldenChests }; saveLoginStreak(n); return n; });
    addGems(reward.gems);
    const parts = [reward.gems > 0 ? `${reward.gems} الماس` : null, reward.spins > 0 ? `${reward.spins} اسپین` : null, reward.attackBoosts > 0 ? `${reward.attackBoosts} بوست` : null, reward.goldenChests > 0 ? `${reward.goldenChests} صندوق` : null].filter(Boolean);
    sound.play("levelup"); showToast(`جایزه روز ${reward.day}: ${parts.join(" + ")}`, "success"); setShowStreakModal(false);
  };

  const calcDamage = (atk: number, def: number, ignoreDefense = false) => {
    const base = ignoreDefense ? Math.max(10, atk) : Math.max(8, atk - Math.floor(def * 0.4));
    return base + Math.floor(Math.random() * (base * 0.25));
  };

  const startBattle = (lvl: Enemy, card: CardType, isEndless = false) => {
    const boostedCard = applyCardBonus(card, getCardLevel(cardLevels, card.id));
    setEnemy(lvl); setPlayerCard(boostedCard); setPlayerHp(boostedCard.health); setPlayerMaxHp(boostedCard.health);
    setEnemyHp(lvl.health); setEnemyMaxHp(lvl.health);
    setLogs([{ text: `⚔️ نبرد آغاز شد!`, side: "info" }]);
    setTurn("you"); setResult(null); setBusy(false); setSpecialCooldown(0);
    setEnemyFrozen(false); setEnemySpecialCd(0); setTurnCount(0); setCombo(0);
    setBattleDamageDealt(0); setPhoenixRevived(false); setCrystalShield(0);
    setAttacker(null); setSpecialFx(false); setHitFx(null); setIsEndlessBattle(isEndless);
    sound.play("battle_start"); setScreen("battle");
  };

  const startEndlessWave = (card: CardType) => {
    const wave = endless.currentWave + 1;
    const en = generateEndlessEnemy(wave);
    setEndless((p) => { const n = { ...p, currentWave: wave, active: true }; saveEndless(n); return n; });
    startBattle(en, card, true);
  };

  const showPopup = (text: string, side: "you" | "ai", special = false) => {
    const id = Date.now() + Math.random();
    setPopups((p) => [...p, { id, text, side, special }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 950);
  };

  const updateAchievements = (updates: Partial<Achievements>) => {
    const newAch = { ...achievements, ...updates }; setAchievements(newAch); saveAchievements(newAch);
  };

  const aiTurn = useCallback(
    (curPlayerHp: number, card: CardType, en: Enemy, frozen: boolean, specCd: number) => {
      if (frozen) { setLogs((l) => [{ text: `❄️ ${en.name} منجمد است!`, side: "info" }, ...l]); setEnemyFrozen(false); setTurn("you"); setBusy(false); return; }
      const useSpecial = specCd <= 0 && Math.random() < en.specialChance;
      let dmg: number; let logText: string;
      const effectiveDefense = crystalShield > 0 ? card.defense * 2 : card.defense;
      if (crystalShield > 0) { setCrystalShield((s) => { const n = s - 1; if (n === 0) setLogs((l) => [{ text: "💎 سپر کریستالی شکست!", side: "info" }, ...l]); return n; }); }
      if (useSpecial && en.specialMultiplier >= 1) {
        dmg = Math.floor(calcDamage(en.attack, effectiveDefense) * en.specialMultiplier);
        logText = `💀 ${en.name} از "${en.specialName}" استفاده کرد! ${dmg} آسیب!`;
        sound.play("special"); setEnemySpecialCd(en.specialCooldown);
      } else if (useSpecial && en.specialMultiplier < 1) {
        setLogs((l) => [{ text: `🛡️ ${en.name} دفاع را تقویت کرد!`, side: "info" }, ...l]);
        setEnemySpecialCd(en.specialCooldown); setTurn("you"); setBusy(false); return;
      } else {
        dmg = calcDamage(en.attack, effectiveDefense);
        logText = `${en.name} حمله کرد! ${dmg} آسیب.`; sound.play("hit"); setEnemySpecialCd((c) => Math.max(0, c - 1));
      }
      setAttacker("ai"); if (useSpecial) setSpecialFx(true);
      setTimeout(() => { setHitFx("you"); showPopup(`-${dmg}`, "you", !!useSpecial); }, 230);
      setTimeout(() => { setHitFx(null); setAttacker(null); setSpecialFx(false); }, 650);
      const newHp = Math.max(0, curPlayerHp - dmg); setPlayerHp(newHp);
      updateAchievements({ totalDamageReceived: achievements.totalDamageReceived + dmg });
      setLogs((l) => [{ text: logText, side: "ai" }, ...l]);
      if (newHp <= 0) {
        if (card.id === "phoenix_king" && !phoenixRevived) {
          const rHp = Math.floor(card.health * 0.5); setPlayerHp(rHp); setPhoenixRevived(true);
          setLogs((l) => [{ text: `🔥 ${card.name} از خاکستر برخاست! ❤️ ${rHp} HP`, side: "special" }, ...l]);
          sound.play("levelup"); showPopup(`🔥 تولد دوباره!`, "you", true); setTurn("you"); setBusy(false); return;
        }
        setResult("lose"); setLogs((l) => [{ text: "💀 شکست خوردی...", side: "info" }, ...l]); sound.play("lose");
        updateAchievements({ battlesLost: achievements.battlesLost + 1 });
        if (isEndlessBattle) { setEndless((p) => { const n = { ...p, active: false, bestWave: Math.max(p.bestWave, p.currentWave - 1), currentWave: 0 }; saveEndless(n); return n; }); }
        setBusy(false); return;
      }
      setTurn("you"); setBusy(false);
    },
    [achievements.battlesLost, achievements.totalDamageReceived, crystalShield, phoenixRevived, isEndlessBattle]
  );

  const attack = () => {
    if (!enemy || !playerCard || busy || turn !== "you" || result) return;
    setBusy(true); setTurnCount((t) => t + 1);
    const dmg = calcDamage(playerCard.attack, enemy.defense);
    setAttacker("you"); sound.play("attack");
    setTimeout(() => { setHitFx("ai"); showPopup(`-${dmg}`, "ai"); }, 230);
    setTimeout(() => { setHitFx(null); setAttacker(null); }, 650);
    const newEnemyHp = Math.max(0, enemyHp - dmg); setEnemyHp(newEnemyHp);
    setBattleDamageDealt((d) => d + dmg); setCombo((c) => c + 1);
    const comboBonus = combo >= 2 ? ` 🔥x${combo + 1}` : "";
    setLogs((l) => [{ text: `⚔️ ${playerCard.name} حمله کرد! ${dmg}${comboBonus}`, side: "you" }, ...l]);
    setSpecialCooldown((c) => Math.max(0, c - 1));
    if (newEnemyHp <= 0) { handleWin(dmg); return; }
    setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard, enemy, enemyFrozen, enemySpecialCd), 1000);
  };

  const handleWin = (finishingDamage = 0) => {
    setResult("win"); setLogs((l) => [{ text: "🏆 پیروزی!", side: "info" }, ...l]); sound.play("win");
    const totalDmg = battleDamageDealt + finishingDamage;
    const newWins = achievements.battlesWon + 1;
    const newBosses = enemy!.isBoss ? achievements.bossesDefeated + 1 : achievements.bossesDefeated;
    updateAchievements({ battlesWon: newWins, totalDamageDealt: achievements.totalDamageDealt + totalDmg, bossesDefeated: newBosses, highestLevelReached: Math.max(achievements.highestLevelReached, enemy!.level) });

    // Quest progress
    addQuestProgress("d_battles", 1); addQuestProgress("d_damage", totalDmg); addQuestProgress("d_wins", 1);
    if (enemy!.isBoss) addQuestProgress("d_boss", 1);
    addQuestProgress("w_levels", 1);

    // Chest check
    checkChests(enemy!.isBoss);

    // Rank check
    checkRankUp(newWins);

    if (!isEndlessBattle && !clearedLevels.includes(enemy!.level)) {
      const nc = [...clearedLevels, enemy!.level]; setClearedLevels(nc); saveCleared(nc); sound.play("levelup");
    }

    // Endless: HP carries over with 15% heal
    if (isEndlessBattle) {
      const healAmount = Math.floor(playerMaxHp * 0.15);
      setEndless((p) => {
        const gemReward = p.currentWave % 10 === 0 ? 15 : p.currentWave % 5 === 0 ? 5 : 1;
        addGems(gemReward);
        const n = { ...p, totalDamage: p.totalDamage + totalDmg, bestWave: Math.max(p.bestWave, p.currentWave) };
        saveEndless(n); return n;
      });
      setPlayerHp((h) => Math.min(playerMaxHp, h + healAmount));
    }
    setBusy(false);
  };

  const useSpecialAbility = () => {
    if (!enemy || !playerCard || busy || turn !== "you" || result || specialCooldown > 0) return;
    setBusy(true); setCombo(0); setSpecialCooldown(playerCard.specialCooldown);
    sound.play("special"); updateAchievements({ specialMovesUsed: achievements.specialMovesUsed + 1 });
    addQuestProgress("d_special", 1);
    const special = playerCard.special; let damageHandled = false;

    if (special === "بازیابی") {
      const h = 50; setPlayerHp((hp) => Math.min(playerMaxHp, hp + h));
      setLogs((l) => [{ text: `✨ ${playerCard.name} خود را شفا داد! +${h} HP`, side: "special" }, ...l]);
      showPopup(`+${h}`, "you", true); sound.play("heal");
    } else if (special === "تولد دوباره" && !phoenixRevived) {
      setPhoenixRevived(true);
      setLogs((l) => [{ text: `🔥 ${playerCard.name} توانایی تولد دوباره فعال شد!`, side: "special" }, ...l]);
      sound.play("levelup"); showPopup("🔥 آماده!", "you", true);
    } else if (special === "طوفان یخ") { setEnemyFrozen(true); const d = Math.floor(calcDamage(playerCard.attack, enemy.defense) * 1.5); applySpecialDamage(d); damageHandled = true;
    } else if (special === "ضربه از بُعد دیگر") { const d = calcDamage(playerCard.attack, 0, true); applySpecialDamage(d); damageHandled = true;
    } else if (special === "ضربه مرگبار") { const d = Math.floor(calcDamage(playerCard.attack, enemy.defense) * 2); applySpecialDamage(d); damageHandled = true;
    } else if (special === "طوفان آتش" || special === "صاعقه مقدس") {
      let t = 0; const hits = special === "طوفان آتش" ? 3 : 1; const m = special === "صاعقه مقدس" ? 2.8 : 1;
      for (let i = 0; i < hits; i++) t += calcDamage(playerCard.attack, enemy.defense);
      applySpecialDamage(Math.floor(t * m)); damageHandled = true;
    } else if (special === "خشم جهنمی") {
      const mp = (playerMaxHp - playerHp) / playerMaxHp; const d = Math.floor(calcDamage(playerCard.attack, enemy.defense) * (1.5 + mp * 1.5));
      applySpecialDamage(d); damageHandled = true;
    } else if (special === "جذب خون") {
      const d = calcDamage(playerCard.attack, enemy.defense); const h = Math.floor(d * 0.3);
      setPlayerHp((hp) => Math.min(playerMaxHp, hp + h)); showPopup(`+${h} HP`, "you", true); sound.play("heal");
      applySpecialDamage(d); damageHandled = true;
    } else if (special === "سپر کریستالی") {
      setCrystalShield(2);
      setLogs((l) => [{ text: `💎 سپر کریستالی فعال! دفاع ۲ برابر برای ۲ نوبت`, side: "special" }, ...l]);
      showPopup("💎 سپر!", "you", true);
    }
    if (!damageHandled) { setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard!, enemy, enemyFrozen, enemySpecialCd), 1000); }
  };

  const applySpecialDamage = (dmg: number) => {
    if (!playerCard || !enemy) return;
    setAttacker("you"); setSpecialFx(true);
    setTimeout(() => { setHitFx("ai"); showPopup(`-${dmg} ✨`, "ai", true); }, 230);
    setTimeout(() => { setHitFx(null); setAttacker(null); setSpecialFx(false); }, 700);
    const nh = Math.max(0, enemyHp - dmg); setEnemyHp(nh); setBattleDamageDealt((d) => d + dmg);
    setLogs((l) => [{ text: `✨ ${playerCard.name} قدرت ویژه! ${dmg} آسیب!`, side: "special" }, ...l]);
    if (nh <= 0) { handleWin(dmg); return; }
    setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard!, enemy, enemyFrozen, enemySpecialCd), 1000);
  };

  const isLevelUnlocked = (lvl: number) => lvl === 1 || clearedLevels.includes(lvl - 1);
  const updateSettings = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const goToScreen = (s: Screen) => { setScreen(s); sound.play("click"); };

  const resetAll = () => {
    if (!window.confirm("تمام پیشرفت پاک می‌شود. مطمئن هستید؟")) return;
    setOwned([]); setClearedLevels([]); setAchievements(DEFAULT_ACHIEVEMENTS);
    setLoginStreak(DEFAULT_LOGIN_STREAK); setShowStreakModal(false);
    setQuests(DEFAULT_QUEST_STATE); setCardLevels(DEFAULT_CARD_LEVELS);
    setChests(DEFAULT_CHEST_STATE); setRankClaimed([]); setEndless(DEFAULT_ENDLESS);
    saveOwned([]); saveCleared([]); saveAchievements(DEFAULT_ACHIEVEMENTS);
    saveLoginStreak(DEFAULT_LOGIN_STREAK); saveQuests(DEFAULT_QUEST_STATE);
    saveCardLevels(DEFAULT_CARD_LEVELS); saveChests(DEFAULT_CHEST_STATE);
    saveRankClaimed([]); saveEndless(DEFAULT_ENDLESS);
    streakAutoOpenedRef.current = false; showToast("پیشرفت پاک شد", "info");
  };

  // pending quest count for badge
  const pendingQuestCount = QUEST_DEFS.filter((q) => {
    const cur = quests.progress[q.id] ?? 0; return cur >= q.target && !quests.claimed[q.id];
  }).length;
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-black via-red-950 to-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-transparent to-transparent animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-30" />
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-gradient-to-t from-red-500 to-transparent"
            style={{ width: Math.random() * 4 + 2, height: Math.random() * 20 + 10, left: `${Math.random() * 100}%`, bottom: `${Math.random() * 100}%`, opacity: Math.random() * 0.5 + 0.1, animation: `floatUp ${Math.random() * 3 + 2}s linear infinite`, animationDelay: `${Math.random() * 2}s` }} />
        ))}
      </div>

      <div className="relative mx-auto flex h-full max-w-[440px] flex-col" dir="rtl">
        {/* Header */}
        <header className="flex items-center justify-between px-4 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Icon3D icon="BA" className="h-10 min-w-10 px-1 text-xs" />
            <h1 className="text-lg font-black tracking-tighter">
              <span className="bg-gradient-to-r from-red-400 via-white to-red-400 bg-clip-text text-transparent" style={{ animation: "shimmer 3s infinite", backgroundSize: "200% 100%" }}>BATTLE</span>{" "}
              <span className="text-white">ARENA</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Rank badge */}
            <span className={`text-sm ${currentRank.color}`} title={currentRank.name}>{currentRank.icon}</span>
            {/* Streak */}
            <button onClick={openStreakModal} className="relative flex items-center gap-1 rounded-full border border-orange-500/40 bg-gradient-to-r from-orange-900/50 to-red-900/50 px-2 py-1 backdrop-blur-sm active:scale-95 transition hover:border-orange-400/70">
              <span className="text-xs">🔥</span>
              <span className="text-[10px] font-black text-orange-200">{loginStreak.streak}</span>
              {dailyStreakStatus.claimable && (<><span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-300" /></>)}
            </button>
            {/* Gems */}
            <button onClick={() => { setShowGemPopup(true); sound.play("click"); }} className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-red-900/50 px-2 py-1 backdrop-blur-sm active:scale-95 transition hover:border-amber-400/70">
              <Icon3D icon="GEM" className="h-5 min-w-5 px-0.5 text-[8px]" />
              <span className="text-[10px] font-black text-amber-200">{gems.balance}</span>
            </button>
            {/* Chests */}
            {chests.pendingChests.length > 0 && (
              <button onClick={openNextChest} className="relative flex items-center gap-1 rounded-full border border-yellow-500/40 bg-gradient-to-r from-yellow-900/50 to-red-900/50 px-2 py-1 active:scale-95 transition animate-pulse">
                <span className="text-xs">📦</span>
                <span className="text-[10px] font-black text-yellow-200">{chests.pendingChests.length}</span>
              </button>
            )}
            <button onClick={() => goToScreen("achievements")} className={`flex h-8 w-8 items-center justify-center rounded-full border text-base transition ${screen === "achievements" ? "border-red-400 bg-red-500/25 text-red-300" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
              <Icon3D icon="ACH" className="h-6 min-w-6 px-0.5 text-[7px]" />
            </button>
            <button onClick={() => goToScreen("settings")} className={`flex h-8 w-8 items-center justify-center rounded-full border text-base transition ${screen === "settings" ? "border-red-400 bg-red-500/25 text-red-300" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
              <Icon3D icon="SET" className="h-6 min-w-6 px-0.5 text-[7px]" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {screen === "shop" && <ShopView slide={slide} sliderRef={sliderRef} onScroll={onScroll} owned={owned} unlockedCards={unlockedCards} onBuy={openCodeModal} onStory={setStoryCard} setSlide={setSlide} gems={gems} onBuyWithGems={buyCardWithGems} gemPrices={gemPrices} />}
          {screen === "inventory" && <InventoryView ownedCards={ownedCards} cardLevels={cardLevels} gems={gems} onUpgrade={upgradeCard} goShop={() => goToScreen("shop")} />}
          {screen === "levels" && <LevelsView ownedCards={ownedCards} clearedLevels={clearedLevels} isUnlocked={isLevelUnlocked} onStart={startBattle} goShop={() => goToScreen("shop")} cardLevels={cardLevels} />}
          {screen === "quests" && <QuestsView quests={quests} onClaim={claimQuestReward} onClaimBonus={claimAllDailyBonus} />}
          {screen === "endless" && <EndlessView endless={endless} ownedCards={ownedCards} cardLevels={cardLevels} onStart={startEndlessWave} goShop={() => goToScreen("shop")} />}
          {screen === "settings" && <SettingsView settings={settings} update={updateSettings} onBack={() => goToScreen("shop")} onReset={resetAll} />}
          {screen === "achievements" && <AchievementsView achievements={achievements} totalLevels={LEVELS.length} clearedLevels={clearedLevels.length} ownedCount={ownedCards.length} totalCards={SHOP_CARDS.length} currentRank={currentRank} nextRank={nextRank} endless={endless} onBack={() => goToScreen("shop")} />}
          {screen === "battle" && enemy && playerCard && (
            <BattleView enemy={enemy} playerCard={playerCard} playerHp={playerHp} playerMaxHp={playerMaxHp} enemyHp={enemyHp} enemyMaxHp={enemyMaxHp} logs={logs} turn={turn} busy={busy} result={result} hitFx={hitFx} attacker={attacker} specialFx={specialFx} popups={popups} specialCooldown={specialCooldown} enemyFrozen={enemyFrozen} turnCount={turnCount} combo={combo} battleDamageDealt={battleDamageDealt} phoenixRevived={phoenixRevived} crystalShield={crystalShield} isEndless={isEndlessBattle} endlessWave={endless.currentWave}
              onAttack={attack} onSpecial={useSpecialAbility}
              onExit={() => goToScreen(isEndlessBattle ? "endless" : "levels")}
              onRetry={() => playerCard && enemy && startBattle(enemy, playerCard, isEndlessBattle)}
              onNextWave={() => playerCard && startEndlessWave(playerCard)} />
          )}
        </main>

        {/* Bottom nav */}
        {!["battle", "settings", "achievements"].includes(screen) && (
          <nav className="grid grid-cols-5 gap-0.5 border-t border-red-900/50 bg-black/60 px-1 py-1.5 backdrop-blur-xl">
            <NavBtn label="فروشگاه" icon="🛒" active={screen === "shop"} onClick={() => goToScreen("shop")} />
            <NavBtn label="کارت‌ها" icon="🎴" active={screen === "inventory"} onClick={() => goToScreen("inventory")} badge={ownedCards.length} />
            <NavBtn label="مراحل" icon="⚔️" active={screen === "levels"} onClick={() => goToScreen("levels")} badge={clearedLevels.length > 0 ? Math.min(99, clearedLevels.length) : undefined} badgeColor="bg-red-600" />
            <NavBtn label="مأموریت" icon="📋" active={screen === "quests"} onClick={() => goToScreen("quests")} badge={pendingQuestCount > 0 ? pendingQuestCount : undefined} badgeColor="bg-emerald-600" />
            <NavBtn label="بی‌نهایت" icon="♾️" active={screen === "endless"} onClick={() => goToScreen("endless")} badge={endless.bestWave > 0 ? endless.bestWave : undefined} badgeColor="bg-purple-600" />
          </nav>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-md ${toast.type === "success" ? "border-red-500/50 bg-red-900/80 text-red-200" : toast.type === "error" ? "border-rose-600/50 bg-rose-950/80 text-rose-200" : "border-white/20 bg-black/80 text-white"}`} style={{ animation: "slideInUp 0.3s" }}>{toast.msg}</div>
      )}
      {codeModal && <CodeModal card={codeModal.card} codeInput={codeInput} codeError={codeError} codeSuccess={codeSuccess} setCodeInput={setCodeInput} setCodeError={setCodeError} submitCode={submitCode} onClose={() => !codeSuccess && setCodeModal(null)} />}
      {storyCard && <StoryModal card={storyCard} onClose={() => setStoryCard(null)} />}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}
      {showGemPopup && <GemPopup gems={gems} productionRatePerHour={productionRatePerHour} totalGemsEarned={achievements.totalGemsEarned} ownedCount={owned.length} onWithdraw={withdrawGems} onClose={() => setShowGemPopup(false)} />}
      {showStreakModal && <DailyStreakModal streak={loginStreak} status={dailyStreakStatus} onClaim={claimDailyStreakReward} onClose={() => setShowStreakModal(false)} />}
      {showChestOpen && <ChestOpenModal chest={showChestOpen} onClose={() => setShowChestOpen(null)} />}
      {showRankUp && <RankUpModal rank={showRankUp} onClose={() => setShowRankUp(null)} />}
    </div>
  );
}

/* ===================== Chest Open Modal ===================== */
function ChestOpenModal({ chest, onClose }: { chest: { type: string; gems: number }; onClose: () => void }) {
  const names: Record<string, string> = { bronze: "صندوق برنزی", silver: "صندوق نقره‌ای", gold: "صندوق طلایی", legendary: "صندوق افسانه‌ای" };
  const icons: Record<string, string> = { bronze: "📦", silver: "🥈", gold: "🥇", legendary: "👑" };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-yellow-500/40 bg-gradient-to-br from-yellow-950 via-red-950 to-black p-6 shadow-2xl text-center" style={{ animation: "popIn 0.4s" }} onClick={(e) => e.stopPropagation()}>
        <div className="text-6xl mb-4" style={{ animation: "winBurst 0.6s ease-out" }}>{icons[chest.type] ?? "📦"}</div>
        <h3 className="text-xl font-black text-yellow-200 mb-2">{names[chest.type] ?? "صندوق"}</h3>
        <div className="text-3xl font-black text-amber-300 mb-4" style={{ animation: "popIn 0.5s 0.2s both" }}>+{chest.gems} 💎</div>
        <button onClick={onClose} className="w-full rounded-2xl bg-gradient-to-r from-yellow-600 to-orange-700 py-3 font-black text-black active:scale-95">عالی! 🎉</button>
      </div>
    </div>
  );
}

/* ===================== Rank Up Modal ===================== */
function RankUpModal({ rank, onClose }: { rank: RankDef; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950 via-red-950 to-black p-6 shadow-2xl text-center" style={{ animation: "popIn 0.4s" }} onClick={(e) => e.stopPropagation()}>
        <div className="text-6xl mb-4" style={{ animation: "winBurst 0.6s ease-out" }}>{rank.icon}</div>
        <h3 className="text-xl font-black text-amber-200 mb-1">ارتقای رنک!</h3>
        <p className={`text-2xl font-black mb-2 ${rank.color}`}>{rank.name}</p>
        <div className="text-xl font-black text-amber-300 mb-4">+{rank.reward} 💎</div>
        <button onClick={onClose} className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-red-700 py-3 font-black text-black active:scale-95">ادامه نبرد! ⚔️</button>
      </div>
    </div>
  );
}

/* ===================== Gem Popup ===================== */
function GemPopup({ gems, productionRatePerHour, totalGemsEarned, ownedCount, onWithdraw, onClose }: { gems: GemState; productionRatePerHour: number; totalGemsEarned: number; ownedCount: number; onWithdraw: () => void; onClose: () => void; }) {
  const pendingFloor = Math.floor(gems.pending); const withdrawAmount = Math.min(MAX_WITHDRAW, Math.max(MIN_WITHDRAW, pendingFloor));
  const canWithdraw = pendingFloor >= MIN_WITHDRAW; const pct = Math.min(100, (gems.pending / GEM_CAPACITY) * 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950 via-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.35s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2"><Icon3D icon="GEM" className="h-10 min-w-10 px-1 text-[10px]" /><div><div className="text-[11px] text-amber-300">موجودی</div><div className="text-2xl font-black text-amber-200">{gems.balance}</div></div></div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-amber-300 active:scale-90">✕</button>
        </div>
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-black/40 p-4">
          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-white">ظرفیت</span><span className="text-sm font-black text-amber-200">{gems.pending.toFixed(1)}/{GEM_CAPACITY}</span></div>
          <div className="h-3 overflow-hidden rounded-full bg-black/60 border border-amber-500/20"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-700" style={{ width: pct + "%" }} /></div>
          {gems.pending >= GEM_CAPACITY && <div className="mt-2 text-center text-[10px] font-bold text-red-300">ظرفیت پر!</div>}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-center"><div className="text-[10px] text-slate-400">نرخ</div><div className="text-lg font-black text-white">{productionRatePerHour}</div><div className="text-[9px] text-amber-300">در ساعت</div></div>
          <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-center"><div className="text-[10px] text-slate-400">کارت‌ها</div><div className="text-lg font-black text-white">{ownedCount}</div><div className="text-[9px] text-amber-300">منبع</div></div>
        </div>
        <button onClick={onWithdraw} disabled={!canWithdraw} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-black shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed" style={{ boxShadow: canWithdraw ? "0 0 22px rgba(245,158,11,0.5)" : undefined }}>
          <Icon3D icon="GEM" className="h-7 min-w-7 px-1 text-[9px]" /><span>برداشت {withdrawAmount}</span>
        </button>
      </div>
    </div>
  );
}

/* ===================== Welcome ===================== */
function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 backdrop-blur-md" dir="rtl">
      <div className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.5s" }}>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-5xl" style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)", boxShadow: "0 0 40px rgba(220,38,38,0.8)", animation: "heartbeat 1.5s infinite" }}>⚔️</div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-red-400 via-white to-red-400 bg-clip-text text-transparent">BATTLE ARENA</h2>
        </div>
        <div className="mb-6 space-y-2 text-sm">
          {[["🛒","کارت‌های قدرتمند","کد فعال‌سازی یا الماس"],["⚔️","۱۴۵۰ مرحله","هر ۸ مرحله باس"],["♾️","حالت بی‌نهایت","چالش بدون پایان"],["📋","مأموریت‌ها","جوایز روزانه و هفتگی"],["🔥","استریک ورود","هر روز بیا، بیشتر ببر"]].map(([ic, t, d]) => (
            <div key={t} className="flex items-center gap-3 rounded-xl bg-red-950/50 p-2.5 border border-red-900/50">
              <span className="text-xl">{ic}</span><div><div className="font-bold text-white text-xs">{t}</div><div className="text-[10px] text-slate-500">{d}</div></div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-800 py-4 font-black text-white active:scale-95" style={{ boxShadow: "0 0 30px rgba(220,38,38,0.6)" }}>شروع نبرد! 🔥</button>
      </div>
    </div>
  );
}

/* ===================== Story ===================== */
function StoryModal({ card, onClose }: { card: CardType; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.4s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3"><Icon3D icon={card.element} className="h-14 min-w-14 px-2 text-sm" /><div><h3 className="text-lg font-black text-white">{card.name}</h3><div className="text-xs text-red-400 font-bold">{card.special}</div></div></div>
        <div className="mb-6 rounded-2xl border border-red-900/50 bg-black/40 p-4"><p className="text-sm leading-relaxed text-slate-300">{card.story}</p></div>
        <button onClick={onClose} className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 font-bold text-red-400 active:scale-95 hover:bg-red-500/20 transition">بستن</button>
      </div>
    </div>
  );
}

/* ===================== Code ===================== */
function CodeModal({ card, codeInput, codeError, codeSuccess, setCodeInput, setCodeError, submitCode, onClose }: { card: CardType; codeInput: string; codeError: string; codeSuccess: boolean; setCodeInput: (v: string) => void; setCodeError: (v: string) => void; submitCode: () => void; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-5 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.3s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-black text-white">🔐 فعال‌سازی</h3><button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/50 text-slate-400 hover:text-white">✕</button></div>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-900/50 bg-black/50 p-3">
          <div className="relative h-16 w-12 overflow-hidden rounded-xl border border-red-700/50"><img src={card.image} alt={card.name} className="h-full w-full object-cover" /></div>
          <div className="flex-1"><div className="font-black text-white">{card.name}</div><div className="mt-0.5 flex gap-2 text-xs"><span className="text-red-400">⚔️ {card.attack}</span><span className="text-white">❤️ {card.health}</span><span className="text-slate-400">🛡️ {card.defense}</span></div></div>
        </div>
        {codeSuccess ? (
          <div className="py-8 text-center" style={{ animation: "popIn 0.4s" }}><div className="mb-3 text-6xl">✅</div><div className="text-lg font-black text-red-300">فعال شد!</div></div>
        ) : (
          <>
            <input type="text" value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase().slice(0, 12)); setCodeError(""); }} onKeyDown={(e) => e.key === "Enter" && submitCode()} placeholder="کد را وارد کنید" className="mb-2 w-full rounded-xl border border-red-900/50 bg-black/60 px-4 py-3 text-center text-lg font-mono font-black tracking-[0.3em] text-white outline-none transition focus:border-red-500" maxLength={12} autoFocus />
            {codeError && <p className="mb-2 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-400" style={{ animation: "shake 0.3s" }}>❌ {codeError}</p>}
            <button onClick={submitCode} className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 font-black text-white shadow-lg active:scale-95" style={{ boxShadow: "0 0 20px rgba(220,38,38,0.5)" }}>فعال‌سازی ✨</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== Daily Streak ===================== */
function DailyStreakModal({ streak, status, onClaim, onClose }: { streak: LoginStreakState; status: LoginStreakStatus; onClaim: () => void; onClose: () => void; }) {
  const claimedBefore = status.claimable ? (status.reset ? 0 : streak.streak % 7) : streak.streak === 0 ? 0 : ((streak.streak - 1) % 7) + 1;
  const activeReward = status.claimable ? status.reward : status.tomorrowReward;
  const bonusPercent = Math.max(0, Math.round((activeReward.multiplier - 1) * 100));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-5 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-orange-500/40 bg-gradient-to-br from-orange-950 via-red-950 to-black p-5 shadow-2xl" style={{ animation: "popIn 0.35s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg, #f97316, #7f1d1d)", boxShadow: "0 0 24px rgba(249,115,22,0.45)" }}>🔥</div>
            <div><div className="text-sm font-black text-white">استریک ورود</div><div className="text-[11px] text-orange-300">{loginStreakLabel(streak.streak)} • بهترین: {loginStreakLabel(streak.bestStreak)}</div></div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-orange-300 active:scale-90">✕</button>
        </div>
        {status.reset && <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3"><div className="text-sm font-black text-rose-300">استریک قطع شده!</div><div className="mt-1 text-[11px] text-rose-200/80">{status.missedDays > 0 ? `${status.missedDays} روز غیبت` : "استریک ریست شد"}</div></div>}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-orange-500/25 bg-black/35 px-4 py-3">
          <div><div className="text-[10px] text-slate-400">هفته</div><div className="text-lg font-black text-white">{activeReward.week}</div></div>
          <div className="text-left"><div className="text-[10px] text-slate-400">بونوس</div><div className="text-lg font-black text-orange-300">{bonusPercent > 0 ? `+${bonusPercent}%` : "—"}</div></div>
        </div>
        <div className="mb-4 grid grid-cols-7 gap-1.5">
          {DAILY_REWARD_TABLE.map((dr) => {
            const cl = dr.day <= claimedBefore; const cur = status.claimable ? dr.day === status.reward.day : dr.day === (((streak.streak - 1) % 7) + 1 || 1);
            return (<div key={dr.day} className={`rounded-xl border p-1.5 text-center transition ${cl ? "border-emerald-400/40 bg-emerald-500/10" : cur ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/30"}`} style={cur && status.claimable ? { boxShadow: "0 0 12px rgba(251,146,60,0.25)", animation: "glowPulse 1.8s infinite" } : undefined}>
              <div className="text-[8px] font-black text-slate-400">{dr.day}</div><div className="text-base">{dr.icon}</div><div className="text-[8px] font-black text-white">{dr.gems}💎</div>
              {cl && <div className="text-[7px] text-emerald-300">✓</div>}
            </div>);
          })}
        </div>
        {status.claimable ? (
          <button onClick={onClaim} className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-700 py-3.5 text-sm font-black text-white shadow-lg active:scale-95" style={{ boxShadow: "0 0 24px rgba(249,115,22,0.35)" }}>دریافت جایزه</button>
        ) : (
          <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-center text-sm font-black text-emerald-300">دریافت شده ✅</div>
        )}
      </div>
    </div>
  );
}
/* ===================== Shop ===================== */
function ShopView({ slide, sliderRef, onScroll, owned, unlockedCards, onBuy, onStory, setSlide, gems, onBuyWithGems, gemPrices }: {
  slide: number; sliderRef: React.RefObject<HTMLDivElement | null>; onScroll: () => void;
  owned: string[]; unlockedCards: CardType[]; onBuy: (c: CardType) => void;
  onStory: (c: CardType) => void; setSlide: (n: number) => void;
  gems: GemState; onBuyWithGems: (c: CardType) => void; gemPrices: Record<string, number>;
}) {
  const goTo = (i: number) => { const el = sliderRef.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" }); setSlide(i); sound.play("slide"); };
  return (
    <div className="flex h-full flex-col">
      <div ref={sliderRef} onScroll={onScroll} className="scrollbar-hide flex flex-1 overflow-x-auto" style={{ scrollSnapType: "x mandatory" }}>
        {SHOP_CARDS.map((card, index) => {
          const isOwned = owned.includes(card.id);
          const isUnlocked = unlockedCards.some((c) => c.id === card.id);
          const gemPrice = gemPrices[card.id];
          if (!isUnlocked) return (
            <div key={card.id} className="flex h-full w-full shrink-0 flex-col items-center justify-center px-5" style={{ scrollSnapAlign: "center" }}>
              <div className="relative flex h-[340px] w-[200px] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-slate-700 bg-gradient-to-b from-slate-900 to-black opacity-50" style={{ filter: "grayscale(100%)" }}>
                <span className="text-6xl opacity-20">🔒</span>
                <div className="absolute bottom-8 text-center"><h3 className="text-lg font-black text-slate-500">{card.name}</h3><p className="text-xs text-slate-600 mt-1">کارت قبلی را باز کنید</p></div>
              </div>
            </div>
          );
          return (
            <div key={card.id} className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-3 px-5" style={{ scrollSnapAlign: "center" }}>
              <div style={{ perspective: "900px" }}><GameCard card={card} float={slide === index} /></div>
              <div className="w-full max-w-[280px] rounded-2xl border border-red-900/50 bg-black/60 p-3 backdrop-blur-md">
                <div className="space-y-2">
                  <button onClick={() => onStory(card)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white active:scale-95 hover:bg-white/10 transition">
                    <Icon3D icon="ST" className="h-6 min-w-6 px-1 text-[9px]" /><span>درباره‌ی قهرمان</span>
                  </button>
                  {isOwned ? (
                    <div className="flex items-center justify-center rounded-xl bg-red-900/30 py-3 text-sm font-bold text-red-300" style={{ border: "1px solid rgba(220,38,38,0.3)" }}>خریداری شده</div>
                  ) : (
                    <>
                      <a href={card.buyUrl} target="_blank" rel="noreferrer" onClick={() => sound.play("buy")}
                        className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${card.gradient} py-3 text-sm font-black text-white shadow-lg active:scale-95`}
                        style={{ ["--glow" as string]: card.glow, boxShadow: `0 0 20px ${card.glow}`, animation: "glowPulse 2.5s infinite" }}>
                        <span>💳</span><span>خرید • ${card.price}</span>
                      </a>
                      <button onClick={() => onBuy(card)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-red-400 active:scale-95 hover:bg-red-500/20 transition">
                        <span>🔐</span><span>وارد کردن کد</span>
                      </button>
                      {gemPrice !== undefined && (
                        <button onClick={() => onBuyWithGems(card)} disabled={gems.balance < gemPrice}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-red-900/50 py-3 text-sm font-bold text-amber-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                          <Icon3D icon="GEM" className="h-6 min-w-6 px-1 text-[9px]" /><span>خرید با الماس</span><span className="text-amber-300 font-black">{gemPrice}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-2 px-4 pb-2 pt-1">
        {SHOP_CARDS.map((_, i) => (<button key={i} onClick={() => goTo(i)} className={`rounded-full transition-all duration-300 ${slide === i ? "w-6 h-2 bg-red-500" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`} />))}
      </div>
    </div>
  );
}

/* ===================== Inventory with Upgrade ===================== */
function InventoryView({ ownedCards, cardLevels, gems, onUpgrade, goShop }: {
  ownedCards: CardType[]; cardLevels: CardLevels; gems: GemState; onUpgrade: (id: string) => void; goShop: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-2 scrollbar-hide">
      <div className="mb-4 text-center">
        <h2 className="text-base font-black text-white">🎴 کلکسیون</h2>
        <p className="text-xs text-slate-500">{ownedCards.length} / {SHOP_CARDS.length}</p>
        <div className="mx-auto mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-red-900/50">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-white transition-all duration-500" style={{ width: `${(ownedCards.length / SHOP_CARDS.length) * 100}%` }} />
        </div>
      </div>
      {ownedCards.length === 0 ? (
        <EmptyState icon="📭" title="کارتی نداری" desc="برو فروشگاه" btnLabel="فروشگاه" onBtn={goShop} />
      ) : (
        <div className="space-y-4 pb-4">
          {ownedCards.map((c) => {
            const level = getCardLevel(cardLevels, c.id);
            const boosted = applyCardBonus(c, level);
            const cost = getUpgradeCost(level);
            const maxed = level >= 10;
            const canAfford = gems.balance >= cost;
            return (
              <div key={c.id} className="flex gap-3 rounded-2xl border border-red-900/50 bg-black/40 p-3">
                <div className="shrink-0" style={{ perspective: "800px" }}><GameCard card={c} compact /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-white text-sm truncate">{c.name}</span>
                    <span className="text-[10px] font-black text-amber-300">Lv.{level}</span>
                  </div>
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span key={i} className={`text-[10px] ${i < level ? "text-amber-400" : "text-slate-700"}`}>★</span>
                    ))}
                  </div>
                  {/* Stats */}
                  <div className="flex gap-2 text-[10px] mb-2">
                    <span className="text-red-400">⚔️ {boosted.attack}</span>
                    <span className="text-white">❤️ {boosted.health}</span>
                    <span className="text-slate-400">🛡️ {boosted.defense}</span>
                  </div>
                  {/* Bonus */}
                  {level > 1 && (
                    <div className="text-[9px] text-emerald-400 mb-2">
                      +{Math.round(getCardBonus(level) * 100)}% بونوس آمار
                    </div>
                  )}
                  {/* Upgrade button */}
                  {maxed ? (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-center text-[10px] font-black text-amber-300">⭐ حداکثر سطح</div>
                  ) : (
                    <button onClick={() => onUpgrade(c.id)} disabled={!canAfford}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-700 px-3 py-1.5 text-[10px] font-black text-black active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                      <span>⬆️ ارتقا</span>
                      <Icon3D icon="GEM" className="h-4 min-w-4 px-0.5 text-[6px]" />
                      <span>{cost}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===================== Levels ===================== */
function LevelsView({ ownedCards, clearedLevels, isUnlocked, onStart, goShop, cardLevels }: {
  ownedCards: CardType[]; clearedLevels: number[]; isUnlocked: (l: number) => boolean;
  onStart: (e: Enemy, c: CardType) => void; goShop: () => void; cardLevels: CardLevels;
}) {
  const [selected, setSelected] = useState<Enemy | null>(null);
  if (ownedCards.length === 0) return <div className="flex h-full items-center justify-center px-6"><EmptyState icon="🃏" title="کارت نداری!" desc="حداقل یک کارت لازمه" btnLabel="فروشگاه" onBtn={goShop} /></div>;
  const totalCleared = clearedLevels.length; const progress = (totalCleared / LEVELS.length) * 100;
  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 py-2">
        <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-black">⚔️ مراحل</h2><span className="text-xs text-slate-500">{totalCleared}/{LEVELS.length}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-red-900/50"><div className="h-full rounded-full bg-gradient-to-r from-red-600 to-white transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {LEVELS.map((lvl, i) => {
          const unlocked = isUnlocked(lvl.level); const cleared = clearedLevels.includes(lvl.level); const diff = difficultyLabel(lvl.level);
          return (
            <button key={lvl.level} disabled={!unlocked} onClick={() => { setSelected(lvl); sound.play("click"); }}
              className={`relative overflow-hidden rounded-2xl border p-3 text-right transition active:scale-95 ${cleared ? "border-red-500/40 bg-gradient-to-br from-red-900/30 to-black" : unlocked ? "border-red-900/50 bg-gradient-to-br from-red-950/50 to-black hover:border-red-500/50" : "border-slate-800 bg-black/60 opacity-40 cursor-not-allowed"}`}
              style={{ animation: unlocked ? `slideInUp 0.4s ease-out ${Math.min(i * 0.03, 0.5)}s both` : undefined }}>
              <img src={lvl.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/25" />
              {cleared && <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px]">✓</span>}
              {!unlocked && <span className="absolute left-2 top-2 z-10 text-sm opacity-60">🔒</span>}
              {lvl.isBoss && <div className="absolute right-2 top-2 z-10 rounded-full bg-gradient-to-r from-red-600 to-black px-2 py-0.5 text-[8px] font-black text-white border border-red-500">BOSS</div>}
              <div className="relative z-10 mb-2 mt-1 flex items-center gap-2">
                <Icon3D icon={lvl.isBoss ? "B" : lvl.gender === "female" ? "F" : "M"} className="h-10 min-w-10 px-1 text-xs" />
                <div><div className="text-[9px] text-slate-500">مرحله {lvl.level}</div><div className="text-xs font-black text-white">{lvl.name}</div></div>
              </div>
              <div className={`relative z-10 mb-1 text-[10px] font-black ${diff.color}`}>{diff.text}</div>
              <div className="relative z-10 flex gap-2 text-[9px] text-slate-400"><span>ATK {lvl.attack}</span><span>HP {lvl.health}</span><span>DEF {lvl.defense}</span></div>
              <div className="relative z-10 mt-1.5 text-right text-sm">{lvl.reward}</div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/80 backdrop-blur-sm" dir="rtl" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[440px] rounded-t-3xl border-t border-red-900/50 bg-gradient-to-b from-red-950 to-black p-5 pb-6" style={{ animation: "slideInUp 0.3s" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-red-900/50" />
            <div className="mb-1 flex items-center justify-between"><h3 className="font-black text-white">انتخاب کارت</h3><button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/50 text-slate-400 hover:text-white">✕</button></div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-900/50 bg-black/40 p-3">
              <EnemyCard enemy={selected} compact />
              <div><div className="text-xs text-slate-500">حریف</div><div className="font-black text-white">{selected.name}</div>
                <div className="flex gap-2 text-xs text-slate-500 mt-0.5"><span>⚔️ {selected.attack}</span><span>❤️ {selected.health}</span><span>🛡️ {selected.defense}</span></div>
              </div>
              {selected.isBoss && <div className="mr-auto"><div className="text-[9px] text-red-400 font-black">💀 BOSS</div></div>}
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {ownedCards.map((c) => {
                const lv = getCardLevel(cardLevels, c.id);
                return (
                  <button key={c.id} onClick={() => { onStart(selected, c); setSelected(null); }} className="shrink-0 hover:scale-105 transition-transform relative">
                    <GameCard card={c} compact />
                    {lv > 1 && <span className="absolute -top-1 -right-1 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-black">Lv.{lv}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Quests ===================== */
function QuestsView({ quests, onClaim, onClaimBonus }: { quests: QuestState; onClaim: (id: string) => void; onClaimBonus: () => void; }) {
  const dailyQuests = QUEST_DEFS.filter((q) => q.type === "daily");
  const weeklyQuests = QUEST_DEFS.filter((q) => q.type === "weekly");
  const allDailyDone = dailyQuests.every((q) => quests.claimed[q.id]);
  return (
    <div className="h-full overflow-y-auto px-4 py-2 scrollbar-hide" dir="rtl">
      <h2 className="text-base font-black text-white mb-3">📋 مأموریت‌ها</h2>

      {/* Daily */}
      <div className="mb-4">
        <h3 className="text-sm font-black text-slate-300 mb-2">روزانه</h3>
        <div className="space-y-2">
          {dailyQuests.map((q) => {
            const cur = quests.progress[q.id] ?? 0; const done = cur >= q.target; const claimed = quests.claimed[q.id];
            const pct = Math.min(100, (cur / q.target) * 100);
            return (
              <div key={q.id} className={`rounded-2xl border p-3 transition ${claimed ? "border-emerald-500/30 bg-emerald-500/5" : done ? "border-amber-500/40 bg-amber-500/5" : "border-red-900/50 bg-black/40"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{q.icon}</span>
                    <div><div className="text-xs font-black text-white">{q.title}</div><div className="text-[10px] text-slate-400">{q.desc}</div></div>
                  </div>
                  <div className="text-left">
                    {claimed ? (
                      <span className="text-[10px] font-black text-emerald-400">✅ دریافت شد</span>
                    ) : done ? (
                      <button onClick={() => onClaim(q.id)} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-[10px] font-black text-black active:scale-95" style={{ animation: "glowPulse 1.8s infinite" }}>
                        دریافت {q.reward}💎
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">{q.reward}💎</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-black/60 border border-white/10">
                    <div className={`h-full rounded-full transition-all duration-500 ${claimed ? "bg-emerald-500" : done ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">{cur}/{q.target}</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* All daily bonus */}
        <div className={`mt-3 rounded-2xl border p-3 text-center ${allDailyDone && !quests.allDailyBonusClaimed ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-black/30"}`}>
          {quests.allDailyBonusClaimed ? (
            <span className="text-xs font-black text-emerald-400">✅ پاداش تکمیل دریافت شد</span>
          ) : allDailyDone ? (
            <button onClick={onClaimBonus} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-black text-black active:scale-95" style={{ animation: "glowPulse 1.8s infinite" }}>
              🎰 دریافت ۱ اسپین رایگان
            </button>
          ) : (
            <span className="text-[10px] text-slate-500">همه مأموریت‌های روزانه را تکمیل کن → ۱ اسپین رایگان 🎰</span>
          )}
        </div>
      </div>

      {/* Weekly */}
      <div className="mb-4">
        <h3 className="text-sm font-black text-slate-300 mb-2">هفتگی</h3>
        <div className="space-y-2">
          {weeklyQuests.map((q) => {
            const cur = quests.progress[q.id] ?? 0; const done = cur >= q.target; const claimed = quests.claimed[q.id];
            const pct = Math.min(100, (cur / q.target) * 100);
            return (
              <div key={q.id} className={`rounded-2xl border p-3 ${claimed ? "border-emerald-500/30 bg-emerald-500/5" : done ? "border-amber-500/40 bg-amber-500/5" : "border-red-900/50 bg-black/40"}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{q.icon}</span>
                    <div><div className="text-xs font-black text-white">{q.title}</div><div className="text-[10px] text-slate-400">{q.desc}</div></div>
                  </div>
                  {claimed ? <span className="text-[10px] font-black text-emerald-400">✅</span>
                   : done ? <button onClick={() => onClaim(q.id)} className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-1 text-[10px] font-black text-black active:scale-95">{q.reward}💎</button>
                   : <span className="text-[10px] text-slate-500">{q.reward}💎</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-black/60 border border-white/10">
                    <div className={`h-full rounded-full transition-all duration-500 ${claimed ? "bg-emerald-500" : done ? "bg-amber-500" : "bg-red-600"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">{cur}/{q.target}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================== Endless ===================== */
function EndlessView({ endless, ownedCards, cardLevels, onStart, goShop }: {
  endless: EndlessState; ownedCards: CardType[]; cardLevels: CardLevels;
  onStart: (c: CardType) => void; goShop: () => void;
}) {
  if (ownedCards.length === 0) return <div className="flex h-full items-center justify-center px-6"><EmptyState icon="🃏" title="کارت نداری!" desc="حداقل یک کارت لازمه" btnLabel="فروشگاه" onBtn={goShop} /></div>;
  return (
    <div className="h-full overflow-y-auto px-4 py-2 scrollbar-hide" dir="rtl">
      <div className="mb-4 text-center">
        <h2 className="text-xl font-black text-white mb-1">♾️ حالت بی‌نهایت</h2>
        <p className="text-xs text-slate-400">تا کجا دووم میاری؟ HP بین موج‌ها ریست نمیشه!</p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 text-center">
          <div className="text-[10px] text-slate-400">بهترین رکورد</div>
          <div className="text-3xl font-black text-purple-300">{endless.bestWave}</div>
          <div className="text-[9px] text-slate-500">موج</div>
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-center">
          <div className="text-[10px] text-slate-400">کل آسیب</div>
          <div className="text-3xl font-black text-red-300">{endless.totalDamage.toLocaleString()}</div>
          <div className="text-[9px] text-slate-500">در بی‌نهایت</div>
        </div>
      </div>

      {/* Rewards info */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-black/40 p-3">
        <h3 className="text-xs font-black text-white mb-2">جوایز موج‌ها</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-[9px]">
          <div className="rounded-lg bg-black/30 p-2"><div className="text-slate-400">هر موج</div><div className="text-white font-black">۱ 💎</div></div>
          <div className="rounded-lg bg-black/30 p-2"><div className="text-slate-400">هر ۵ موج</div><div className="text-amber-300 font-black">۵ 💎</div></div>
          <div className="rounded-lg bg-black/30 p-2"><div className="text-slate-400">هر ۱۰ موج</div><div className="text-purple-300 font-black">۱۵ 💎</div></div>
        </div>
        <div className="mt-2 text-[9px] text-slate-500 text-center">بین موج‌ها فقط ۱۵٪ HP شفا دریافت می‌کنی</div>
      </div>

      {/* Card selection */}
      <h3 className="text-sm font-black text-white mb-2">انتخاب کارت</h3>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4">
        {ownedCards.map((c) => {
          const lv = getCardLevel(cardLevels, c.id);
          return (
            <button key={c.id} onClick={() => onStart(c)} className="shrink-0 hover:scale-105 transition-transform relative">
              <GameCard card={c} compact />
              {lv > 1 && <span className="absolute -top-1 -right-1 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-black">Lv.{lv}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
/* ===================== Settings ===================== */
function SettingsView({ settings, update, onBack, onReset }: {
  settings: Settings; update: (p: Partial<Settings>) => void; onBack: () => void; onReset: () => void;
}) {
  const [nameInput, setNameInput] = useState(settings.playerName);
  return (
    <div className="h-full overflow-y-auto px-4 py-3 scrollbar-hide" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black">⚙️ تنظیمات</h2>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-1.5 text-sm active:scale-95 hover:bg-red-900/50 transition"><span>←</span><span>بازگشت</span></button>
      </div>
      <section className="mb-4 rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/50 to-black p-4">
        <h3 className="mb-1 text-sm font-black text-slate-200">👤 نام</h3>
        <div className="flex gap-2">
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value.slice(0, 16))} onKeyDown={(e) => { if (e.key === "Enter") { const t = nameInput.trim(); if (t) { update({ playerName: t }); sound.play("click"); } } }} placeholder="نام" className="flex-1 rounded-xl border border-red-900/50 bg-black/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-red-500" maxLength={16} />
          <button onClick={() => { const t = nameInput.trim(); if (t) { update({ playerName: t }); sound.play("click"); } }} className="rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-4 py-2.5 text-sm font-bold active:scale-95">ذخیره</button>
        </div>
      </section>
      <section className="mb-4 rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/50 to-black p-4">
        <h3 className="mb-3 text-sm font-black text-slate-200">🔊 صدا</h3>
        <ToggleRow label="موزیک" value={settings.music} onChange={(v) => { update({ music: v }); sound.play("click"); }} />
        <div className="my-3 h-px bg-red-900/50" />
        <ToggleRow label="افکت‌ها" value={settings.sfx} onChange={(v) => { update({ sfx: v }); sound.play("click"); }} />
      </section>
      <section className="mb-6 rounded-2xl border border-red-600/30 bg-red-600/5 p-4">
        <h3 className="mb-1 text-sm font-black text-red-400">⚠️ خطر</h3>
        <p className="mb-3 text-xs text-slate-500">تمام پیشرفت پاک می‌شود</p>
        <button onClick={onReset} className="rounded-xl border border-red-600/40 bg-red-600/10 px-4 py-2 text-sm font-bold text-red-400 active:scale-95 hover:bg-red-600/20 transition">پاک کردن داده</button>
      </section>
    </div>
  );
}

/* ===================== Achievements ===================== */
function AchievementsView({ achievements, totalLevels, clearedLevels, ownedCount, totalCards, currentRank, nextRank, endless, onBack }: {
  achievements: Achievements; totalLevels: number; clearedLevels: number; ownedCount: number; totalCards: number;
  currentRank: RankDef; nextRank: RankDef | null; endless: EndlessState; onBack: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-3 scrollbar-hide" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black">🏆 دستاوردها</h2>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-1.5 text-sm active:scale-95 hover:bg-red-900/50 transition"><span>←</span><span>بازگشت</span></button>
      </div>

      {/* Rank */}
      <div className="mb-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-black p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{currentRank.icon}</span>
            <div><div className="text-[10px] text-slate-400">رنک فعلی</div><div className={`text-lg font-black ${currentRank.color}`}>{currentRank.name}</div></div>
          </div>
          {nextRank && (
            <div className="text-left"><div className="text-[10px] text-slate-400">بعدی</div><div className={`text-sm font-black ${nextRank.color}`}>{nextRank.icon} {nextRank.name}</div></div>
          )}
        </div>
        {nextRank && (
          <div>
            <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">{achievements.battlesWon} برد</span><span className="text-slate-400">{nextRank.minWins} برد</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60 border border-amber-500/20">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-700" style={{ width: `${Math.min(100, (achievements.battlesWon / nextRank.minWins) * 100)}%` }} />
            </div>
            <div className="mt-1 text-center text-[9px] text-amber-300">{nextRank.minWins - achievements.battlesWon} برد تا {nextRank.name} • جایزه: {nextRank.reward}💎</div>
          </div>
        )}
      </div>

      {/* Endless record */}
      <div className="mb-4 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-2xl">♾️</span><div><div className="text-[10px] text-slate-400">رکورد بی‌نهایت</div><div className="text-xl font-black text-purple-300">موج {endless.bestWave}</div></div></div>
          <div className="text-left"><div className="text-[10px] text-slate-400">کل آسیب</div><div className="text-base font-black text-red-300">{endless.totalDamage.toLocaleString()}</div></div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <AchievementBox icon="CARD" label="کارت‌ها" value={`${ownedCount}/${totalCards}`} color="text-white" />
        <AchievementBox icon="LVL" label="مراحل" value={`${clearedLevels}/${totalLevels}`} color="text-red-300" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AchievementBox icon="⚔️" label="آسیب وارده" value={achievements.totalDamageDealt.toLocaleString()} color="text-red-400" />
        <AchievementBox icon="💔" label="آسیب دریافتی" value={achievements.totalDamageReceived.toLocaleString()} color="text-slate-400" />
        <AchievementBox icon="🏆" label="پیروزی" value={achievements.battlesWon.toString()} color="text-white" />
        <AchievementBox icon="💀" label="شکست" value={achievements.battlesLost.toString()} color="text-slate-500" />
        <AchievementBox icon="✨" label="ویژه" value={achievements.specialMovesUsed.toString()} color="text-fuchsia-400" />
        <AchievementBox icon="👑" label="باس" value={achievements.bossesDefeated.toString()} color="text-amber-400" />
        <AchievementBox icon="📊" label="بالاترین" value={achievements.highestLevelReached.toString()} color="text-sky-400" />
        <AchievementBox icon="GEM" label="الماس کل" value={achievements.totalGemsEarned.toString()} color="text-amber-300" />
      </div>
      <WinRatioBox won={achievements.battlesWon} lost={achievements.battlesLost} />
      <div className="mb-4 rounded-2xl border border-red-900/50 bg-red-950/30 p-4">
        <h3 className="mb-2 text-sm font-black text-white">پیشرفت کلی</h3>
        <div className="mb-2 flex justify-between text-xs"><span className="text-slate-400">مراحل</span><span className="text-white font-bold">{clearedLevels}/{totalLevels}</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full bg-gradient-to-r from-red-600 via-white to-red-600 transition-all duration-700" style={{ width: `${(clearedLevels / totalLevels) * 100}%` }} /></div>
        <div className="mt-2 text-center text-xs text-slate-500">{((clearedLevels / totalLevels) * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

function AchievementBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (<div className="rounded-xl border border-red-900/30 bg-black/40 p-3 text-center"><Icon3D icon={icon} className="mx-auto mb-2 h-9 min-w-9 px-1 text-[10px]" /><div className={`text-lg font-black ${color}`}>{value}</div><div className="text-[9px] text-slate-500 mt-0.5">{label}</div></div>);
}

function WinRatioBox({ won, lost }: { won: number; lost: number }) {
  const total = won + lost; const ratio = total > 0 ? (won / total) * 100 : 0;
  const ratioColor = total === 0 ? "text-slate-500" : ratio >= 75 ? "text-emerald-400" : ratio >= 50 ? "text-amber-400" : "text-rose-400";
  const barColor = total === 0 ? "bg-slate-700" : ratio >= 75 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : ratio >= 50 ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-rose-700 to-rose-500";
  return (
    <div className="mb-4 rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/60 to-black p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black text-white">⚖️ نسبت پیروزی</h3><span className={`text-xl font-black ${ratioColor}`}>{total === 0 ? "—" : `${ratio.toFixed(1)}٪`}</span></div>
      <div className="relative mb-3 h-4 overflow-hidden rounded-full border border-white/10 bg-black/60">
        <div className={`h-full ${barColor} transition-all duration-700`} style={{ width: `${total === 0 ? 0 : ratio}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">{total === 0 ? "—" : `${won}W / ${lost}L`}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/5 bg-black/30 p-2"><div className="text-[9px] text-slate-500">کل</div><div className="text-base font-black text-white">{total}</div></div>
        <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-2"><div className="text-[9px] text-red-300">برد</div><div className="text-base font-black text-white">{won}</div></div>
        <div className="rounded-xl border border-white/5 bg-black/30 p-2"><div className="text-[9px] text-slate-500">باخت</div><div className="text-base font-black text-white">{lost}</div></div>
      </div>
    </div>
  );
}

/* ===================== Battle ===================== */
function BattleView({
  enemy, playerCard, playerHp, playerMaxHp, enemyHp, enemyMaxHp, logs, turn, busy, result, hitFx, attacker, specialFx, popups, specialCooldown, enemyFrozen, turnCount, combo, battleDamageDealt, phoenixRevived, crystalShield, isEndless, endlessWave, onAttack, onSpecial, onExit, onRetry, onNextWave,
}: {
  enemy: Enemy; playerCard: CardType; playerHp: number; playerMaxHp: number; enemyHp: number; enemyMaxHp: number; logs: BattleLog[]; turn: "you" | "ai"; busy: boolean; result: "win" | "lose" | null; hitFx: "you" | "ai" | null; attacker: "you" | "ai" | null; specialFx: boolean; popups: { id: number; text: string; side: "you" | "ai"; special?: boolean }[]; specialCooldown: number; enemyFrozen: boolean; turnCount: number; combo: number; battleDamageDealt: number; phoenixRevived: boolean; crystalShield: number; isEndless: boolean; endlessWave: number; onAttack: () => void; onSpecial: () => void; onExit: () => void; onRetry: () => void; onNextWave: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col" style={{ background: "linear-gradient(180deg, #000 0%, #1a0505 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(220,38,38,0.4), transparent 70%)" }} />
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${turn === "you" ? "bg-white" : "bg-red-500"}`} style={{ animation: "heartbeat 1s infinite" }} />
          <span className="text-[10px] text-slate-400">{turn === "you" ? "نوبت تو" : "نوبت دشمن"}</span>
          {isEndless && <span className="text-[10px] text-purple-400 font-bold">♾️ موج {endlessWave}</span>}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>نوبت {turnCount}</span>
          {combo >= 2 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400 font-bold">🔥 x{combo}</span>}
          {crystalShield > 0 && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-300 font-bold">💎 {crystalShield}</span>}
        </div>
      </div>

      {/* Enemy */}
      <div className="battle-stage relative mx-4 flex flex-col items-center rounded-2xl border border-red-900/50 bg-black/40 p-3">
        <HpBar name={enemy.name} hp={enemyHp} max={enemyMaxHp} color="from-red-600 to-red-800" />
        <div className="relative mt-2 flex items-center gap-3">
          <div className={`relative ${attacker === "ai" ? "fx-lunge-down" : ""} ${hitFx === "ai" ? "fx-hit3d" : ""} ${specialFx && attacker === "ai" ? "fx-aura rounded-2xl" : ""}`} style={{ filter: enemyFrozen ? "hue-rotate(180deg)" : undefined }}>
            <EnemyCard enemy={enemy} compact active />
            {hitFx === "ai" && (<><div className="fx-dmg-flash pointer-events-none absolute inset-0 rounded-2xl bg-red-500/70 mix-blend-screen" /><div className="fx-shockwave pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 rounded-full border-2 border-white/80" /><div className="fx-slash pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-28 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" /><Sparks /></>)}
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-white">{enemy.name}</div>
            <div className="text-[10px] text-slate-500">{isEndless ? `موج ${endlessWave}` : `مرحله ${enemy.level}`}</div>
            {enemy.isBoss && <div className="mt-1 rounded-lg bg-red-600/20 px-2 py-0.5 text-[9px] text-red-400 font-black">💀 BOSS</div>}
            {enemyFrozen && <div className="mt-1 rounded-lg bg-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-400 font-bold animate-pulse">❄️ منجمد</div>}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0">{popups.filter((p) => p.side === "ai").map((p) => (<span key={p.id} className={`absolute left-1/2 top-4 -translate-x-1/2 font-black ${p.special ? "text-2xl text-white" : "text-xl text-red-400"}`} style={{ animation: "floatUp 0.9s forwards" }}>{p.text}</span>))}</div>
      </div>

      {/* Log */}
      <div className="scrollbar-hide mx-4 my-2 flex-1 overflow-y-auto rounded-xl border border-red-900/50 bg-black/50 p-2" style={{ maxHeight: "100px" }}>
        {logs.map((l, i) => (<p key={i} className={`text-[10px] leading-relaxed ${l.side === "you" ? "text-white" : l.side === "ai" ? "text-red-400" : l.side === "special" ? "text-white font-bold" : "text-amber-400"}`} style={i === 0 ? { animation: "slideInRight 0.3s" } : undefined}>{l.text}</p>))}
      </div>

      {/* Player */}
      <div className="battle-stage relative mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-red-900/50 bg-black/40 p-3">
        <div className={`relative shrink-0 scale-75 ${attacker === "you" ? "fx-lunge-up" : ""} ${hitFx === "you" ? "fx-hit3d" : ""} ${specialFx && attacker === "you" ? "fx-aura rounded-2xl" : ""}`}>
          <GameCard card={playerCard} compact />
          {hitFx === "you" && (<><div className="fx-dmg-flash pointer-events-none absolute inset-0 rounded-2xl bg-red-500/70 mix-blend-screen" /><div className="fx-shockwave pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 rounded-full border-2 border-white/80" /><div className="fx-slash pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-24 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" /><Sparks /></>)}
        </div>
        <div className="flex-1">
          <HpBar name={playerCard.name} hp={playerHp} max={playerMaxHp} color="from-white to-slate-400" />
          <div className="mt-1 flex gap-2 text-[9px] text-slate-500"><span>⚔️ {playerCard.attack}</span><span>❤️ {playerCard.health}</span><span>🛡️ {playerCard.defense}</span></div>
          {phoenixRevived && <div className="mt-1 text-[9px] text-amber-400 font-bold">🔥 زنده شد!</div>}
          {crystalShield > 0 && <div className="mt-1 text-[9px] text-cyan-300 font-bold animate-pulse">💎 سپر ({crystalShield})</div>}
        </div>
        <div className="pointer-events-none absolute inset-0">{popups.filter((p) => p.side === "you").map((p) => (<span key={p.id} className={`absolute left-1/2 top-4 -translate-x-1/2 font-black ${p.special ? "text-2xl text-white" : "text-xl text-red-400"}`} style={{ animation: "floatUp 0.9s forwards" }}>{p.text}</span>))}</div>
      </div>

      {/* Actions */}
      {!result && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <button onClick={onAttack} disabled={busy || turn !== "you"} className="rounded-2xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 text-sm font-black shadow-lg active:scale-95 disabled:opacity-50 transition-all" style={{ boxShadow: turn === "you" && !busy ? "0 0 20px rgba(220,38,38,0.6)" : undefined, animation: turn === "you" && !busy ? "glowPulse 1.8s infinite" : undefined }}>
            {turn === "you" ? "⚔️ حمله" : "⏳ صبر"}
          </button>
          <button onClick={onSpecial} disabled={busy || turn !== "you" || specialCooldown > 0} className="relative rounded-2xl bg-gradient-to-r from-white to-slate-400 py-3.5 text-sm font-black text-black shadow-lg active:scale-95 disabled:opacity-40 transition-all" style={{ boxShadow: specialCooldown === 0 && turn === "you" && !busy ? "0 0 20px rgba(255,255,255,0.6)" : undefined }}>
            {specialCooldown > 0 ? <span>✨ ({specialCooldown})</span> : <span>✨ ویژه</span>}
            {specialCooldown === 0 && turn === "you" && !busy && (<span className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full bg-white"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /></span>)}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm" style={{ animation: "fadeIn 0.4s" }}>
          <div style={{ animation: "winBurst 0.6s ease-out" }}><div className="text-8xl mb-2 text-center">{result === "win" ? "🏆" : "💀"}</div></div>
          <h2 className={`text-3xl font-black ${result === "win" ? "text-white" : "text-red-400"}`} style={{ animation: "popIn 0.5s 0.2s both", textShadow: result === "win" ? "0 0 20px white" : undefined }}>
            {result === "win" ? (isEndless ? `موج ${endlessWave} فتح شد!` : "پیروزی!") : (isEndless ? `موج ${endlessWave} شکست!` : "شکست")}
          </h2>
          <div className="flex gap-4 text-center" style={{ animation: "slideInUp 0.4s 0.4s both" }}>
            <div className="rounded-xl bg-red-900/30 px-4 py-2"><div className="text-xs text-slate-400">آسیب</div><div className="text-lg font-black text-red-400">{battleDamageDealt}</div></div>
            <div className="rounded-xl bg-red-900/30 px-4 py-2"><div className="text-xs text-slate-400">نوبت</div><div className="text-lg font-black text-white">{turnCount}</div></div>
            {isEndless && <div className="rounded-xl bg-purple-900/30 px-4 py-2"><div className="text-xs text-slate-400">موج</div><div className="text-lg font-black text-purple-300">{endlessWave}</div></div>}
          </div>
          <div className="flex gap-3" style={{ animation: "slideInUp 0.4s 0.6s both" }}>
            {result === "win" && isEndless && (
              <button onClick={onNextWave} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 px-5 py-3 font-bold active:scale-95" style={{ boxShadow: "0 0 20px rgba(147,51,234,0.5)" }}>♾️ موج بعدی</button>
            )}
            <button onClick={onRetry} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-bold active:scale-95 hover:bg-white/20 transition">🔄 دوباره</button>
            <button onClick={onExit} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-5 py-3 font-bold active:scale-95" style={{ boxShadow: "0 0 20px rgba(220,38,38,0.5)" }}>{isEndless ? "♾️ برگرد" : "🗺️ مراحل"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparks() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2; const dist = 38 + (i % 3) * 14;
        return (<span key={i} className="fx-spark absolute h-1.5 w-1.5 rounded-full" style={{ ["--sx" as string]: `${Math.cos(angle) * dist}px`, ["--sy" as string]: `${Math.sin(angle) * dist}px`, background: i % 2 === 0 ? "#fde68a" : "#ef4444", boxShadow: "0 0 6px currentColor" }} />);
      })}
    </div>
  );
}

function HpBar({ name, hp, max, color }: { name: string; hp: number; max: number; color: string }) {
  const pct = Math.max(0, (hp / max) * 100); const isLow = pct < 25;
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-[11px]"><span className="font-black text-white truncate max-w-[120px]">{name}</span><span className={`font-bold ${isLow ? "text-red-400" : "text-slate-300"}`}>{hp}/{max}</span></div>
      <div className="h-3.5 overflow-hidden rounded-full border border-red-900/50 bg-black/60"><div className={`h-full rounded-full bg-gradient-to-r ${isLow ? "from-red-600 to-red-400" : color} transition-all duration-600`} style={{ width: `${pct}%`, boxShadow: isLow ? "0 0 10px rgba(220,38,38,0.6)" : undefined }} /></div>
    </div>
  );
}

/* ===================== Small Helpers ===================== */
function EmptyState({ icon, title, desc, btnLabel, onBtn }: { icon: string; title: string; desc: string; btnLabel: string; onBtn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 text-center" style={{ animation: "fadeIn 0.4s" }}>
      <div className="text-6xl opacity-50">{icon}</div>
      <div><p className="font-black text-white">{title}</p><p className="mt-1 text-xs text-slate-500">{desc}</p></div>
      <button onClick={onBtn} className="rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-6 py-2.5 font-bold active:scale-95" style={{ boxShadow: "0 0 20px rgba(220,38,38,0.5)" }}>{btnLabel}</button>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-bold text-white">{label}</div>
      <button onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-300 ${value ? "bg-red-600" : "bg-slate-700"}`} style={{ boxShadow: value ? "0 0 12px rgba(220,38,38,0.5)" : undefined }}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${value ? "right-0.5" : "right-5"}`} />
      </button>
    </div>
  );
}

function NavBtn({ label, icon, active, onClick, badge, badgeColor = "bg-red-600" }: { label: string; icon: string; active: boolean; onClick: () => void; badge?: number; badgeColor?: string; }) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-all duration-200 ${active ? "bg-red-900/40 text-white" : "text-slate-600 hover:text-slate-400"}`}>
      <Icon3D icon={icon} className="h-7 min-w-7 px-0.5 text-[9px]" />
      <span className="text-[9px] font-bold">{label}</span>
      {badge !== undefined && badge > 0 && (<span className={`absolute right-1 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ${badgeColor} text-[7px] font-black text-white shadow`}>{badge > 9 ? "9+" : badge}</span>)}
      {active && <span className="absolute -top-0.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-red-500 to-white" />}
    </button>
  );
}
