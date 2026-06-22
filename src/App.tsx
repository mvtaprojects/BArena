import { useState, useRef, useCallback, useEffect } from "react";
import { SHOP_CARDS, LEVELS, difficultyLabel } from "./game/data";
import type { CardType, Enemy } from "./game/data";
import { verifyCode } from "./game/codes";
import { sound } from "./game/sound";
import GameCard, { EnemyCard, Icon3D } from "./game/GameCard";

type Screen = "shop" | "inventory" | "levels" | "battle" | "settings" | "achievements";

interface BattleLog {
  text: string;
  side: "you" | "ai" | "info" | "special";
}

interface Settings {
  playerName: string;
  music: boolean;
  sfx: boolean;
}

interface Achievements {
  totalDamageDealt: number;
  totalDamageReceived: number;
  battlesWon: number;
  battlesLost: number;
  specialMovesUsed: number;
  bossesDefeated: number;
  highestLevelReached: number;
  totalGemsEarned: number;
}

interface GemState {
  balance: number;
  pending: number;
  lastUpdated: number;
}

interface LoginStreakState {
  streak: number;
  bestStreak: number;
  lastClaimDate: string | null;
  pendingSpins: number;
  pendingAttackBoosts: number;
  pendingGoldenChests: number;
}

interface DailyRewardConfig {
  day: number;
  gems: number;
  spins?: number;
  attackBoosts?: number;
  goldenChests?: number;
  icon: string;
  title: string;
  desc: string;
}

interface ResolvedDailyReward {
  day: number;
  week: number;
  streakNumber: number;
  multiplier: number;
  gems: number;
  spins: number;
  attackBoosts: number;
  goldenChests: number;
  icon: string;
  title: string;
  desc: string;
}

interface LoginStreakStatus {
  todayKey: string;
  claimable: boolean;
  reset: boolean;
  missedDays: number;
  nextStreak: number;
  reward: ResolvedDailyReward;
  tomorrowReward: ResolvedDailyReward;
}

const DEFAULT_SETTINGS: Settings = {
  playerName: "جنگجو",
  music: true,
  sfx: true,
};

const DEFAULT_ACHIEVEMENTS: Achievements = {
  totalDamageDealt: 0,
  totalDamageReceived: 0,
  battlesWon: 0,
  battlesLost: 0,
  specialMovesUsed: 0,
  bossesDefeated: 0,
  highestLevelReached: 0,
  totalGemsEarned: 0,
};

const DEFAULT_GEMS: GemState = {
  balance: 0,
  pending: 0,
  lastUpdated: Date.now(),
};

const DEFAULT_LOGIN_STREAK: LoginStreakState = {
  streak: 0,
  bestStreak: 0,
  lastClaimDate: null,
  pendingSpins: 0,
  pendingAttackBoosts: 0,
  pendingGoldenChests: 0,
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

const GEM_CAPACITY = 40;
const MIN_WITHDRAW = 3;
const MAX_WITHDRAW = 22;

/* ===================== Helpers ===================== */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getLocalDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDayKeyToUtc(dayKey: string): number | null {
  const parts = dayKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) return null;
  const [y, m, d] = parts;
  return Date.UTC(y, m - 1, d);
}

function diffDayKeys(fromKey: string, toKey: string): number | null {
  const from = parseDayKeyToUtc(fromKey);
  const to = parseDayKeyToUtc(toKey);
  if (from === null || to === null) return null;
  return Math.floor((to - from) / 86400000);
}

function resolveDailyReward(streakNumber: number): ResolvedDailyReward {
  const safeStreak = Math.max(1, streakNumber);
  const day = ((safeStreak - 1) % 7) + 1;
  const week = Math.floor((safeStreak - 1) / 7) + 1;
  const weekBonusSteps = Math.floor((safeStreak - 1) / 7);
  const multiplier = 1 + weekBonusSteps * 0.25;
  const base = DAILY_REWARD_TABLE.find((r) => r.day === day)!;
  return {
    day, week, streakNumber: safeStreak, multiplier,
    gems: Math.ceil(base.gems * multiplier),
    spins: base.spins ?? 0,
    attackBoosts: base.attackBoosts ?? 0,
    goldenChests: base.goldenChests ?? 0,
    icon: base.icon, title: base.title, desc: base.desc,
  };
}

function getLoginStreakStatus(state: LoginStreakState): LoginStreakStatus {
  const todayKey = getLocalDayKey();
  if (!state.lastClaimDate) {
    return { todayKey, claimable: true, reset: false, missedDays: 0, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
  }
  const diff = diffDayKeys(state.lastClaimDate, todayKey);
  if (diff === null) {
    return { todayKey, claimable: true, reset: state.streak > 0, missedDays: 0, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
  }
  if (diff <= 0) {
    const currentReward = resolveDailyReward(Math.max(1, state.streak));
    return { todayKey, claimable: false, reset: false, missedDays: 0, nextStreak: state.streak, reward: currentReward, tomorrowReward: resolveDailyReward(state.streak + 1) };
  }
  if (diff === 1) {
    const nextStreak = state.streak + 1;
    return { todayKey, claimable: true, reset: false, missedDays: 0, nextStreak, reward: resolveDailyReward(nextStreak), tomorrowReward: resolveDailyReward(nextStreak + 1) };
  }
  return { todayKey, claimable: true, reset: true, missedDays: diff - 1, nextStreak: 1, reward: resolveDailyReward(1), tomorrowReward: resolveDailyReward(2) };
}

function loginStreakLabel(n: number) {
  return n <= 0 ? "0 روز" : `${n} روز`;
}

/* ===================== Load / Save ===================== */

function loadSettings(): Settings {
  try { const raw = localStorage.getItem("ba_settings_v3"); if (!raw) return DEFAULT_SETTINGS; return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; } catch { return DEFAULT_SETTINGS; }
}
function loadOwned(): string[] {
  try { const raw = localStorage.getItem("ba_owned_v3"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function loadCleared(): number[] {
  try { const raw = localStorage.getItem("ba_cleared_v3"); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function loadAchievements(): Achievements {
  try { const raw = localStorage.getItem("ba_achievements_v3"); if (!raw) return DEFAULT_ACHIEVEMENTS; return { ...DEFAULT_ACHIEVEMENTS, ...JSON.parse(raw) }; } catch { return DEFAULT_ACHIEVEMENTS; }
}
function loadGems(): GemState {
  try { const raw = localStorage.getItem("ba_gems_v1"); if (!raw) return DEFAULT_GEMS; return { ...DEFAULT_GEMS, ...JSON.parse(raw) }; } catch { return DEFAULT_GEMS; }
}
function loadLoginStreak(): LoginStreakState {
  try {
    const raw = localStorage.getItem("ba_login_streak_v1");
    if (!raw) return DEFAULT_LOGIN_STREAK;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LOGIN_STREAK, ...parsed, lastClaimDate: typeof parsed?.lastClaimDate === "string" ? parsed.lastClaimDate : null };
  } catch { return DEFAULT_LOGIN_STREAK; }
}
function saveOwned(owned: string[]) { try { localStorage.setItem("ba_owned_v3", JSON.stringify(owned)); } catch {} }
function saveCleared(cleared: number[]) { try { localStorage.setItem("ba_cleared_v3", JSON.stringify(cleared)); } catch {} }
function saveAchievements(ach: Achievements) { try { localStorage.setItem("ba_achievements_v3", JSON.stringify(ach)); } catch {} }
function saveGems(gems: GemState) { try { localStorage.setItem("ba_gems_v1", JSON.stringify(gems)); } catch {} }
function saveLoginStreak(data: LoginStreakState) { try { localStorage.setItem("ba_login_streak_v1", JSON.stringify(data)); } catch {} }

/* ===================== App ===================== */

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

  const gemPrices: Record<string, number> = {
    fire_dragon: 13, frost_mage: 26, thunder_god: 50, nature_guardian: 79,
    void_assassin: 236, demon_lord: 420, phoenix_king: 790, crystal_golem: 2745, blood_knight: 4000,
  };

  const ownedCount = owned.length;
  const productionRatePerHour = Math.max(0, ownedCount);

  useEffect(() => {
    const tick = () => {
      setGems((prev) => {
        const now = Date.now();
        const elapsed = now - prev.lastUpdated;
        const currentRate = owned.length / (60 * 60 * 1000);
        if (currentRate <= 0) return { ...prev, lastUpdated: now };
        const produced = elapsed * currentRate;
        if (produced < 0.001) return { ...prev, lastUpdated: now };
        const newPending = Math.min(GEM_CAPACITY, prev.pending + produced);
        if (Math.abs(newPending - prev.pending) < 0.001) return { ...prev, lastUpdated: now };
        const next = { ...prev, pending: newPending, lastUpdated: now };
        saveGems(next);
        return next;
      });
    };
    tick();
    const interval = setInterval(tick, 5000);
    return () => clearInterval(interval);
  }, [owned.length]);

  const withdrawGems = () => {
    const available = Math.floor(gems.pending);
    if (available < MIN_WITHDRAW) { showToast(`حداقل برداشت ${MIN_WITHDRAW} الماس`, "error"); return; }
    const amount = Math.min(available, MAX_WITHDRAW);
    const newGems = { ...gems, balance: gems.balance + amount, pending: gems.pending - amount };
    setGems(newGems); saveGems(newGems);
    setAchievements((prev) => { const next = { ...prev, totalGemsEarned: prev.totalGemsEarned + amount }; saveAchievements(next); return next; });
    sound.play("levelup"); showToast(`+${amount} الماس برداشت شد`, "success");
  };

  const buyCardWithGems = (card: CardType) => {
    const price = gemPrices[card.id];
    if (!price) { showToast("این کارت با الماس خریدنی نیست", "error"); return; }
    if (owned.includes(card.id)) { showToast("کارت قبلا خریداری شده", "info"); return; }
    if (gems.balance < price) { showToast(`موجودی الماس کافی نیست (${gems.balance}/${price})`, "error"); return; }
    const newGems = { ...gems, balance: gems.balance - price }; setGems(newGems); saveGems(newGems);
    const newOwned = [...owned, card.id]; setOwned(newOwned); saveOwned(newOwned);
    sound.play("code_ok"); showToast(`${card.name} با الماس خریداری شد`, "success");
  };

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

  useEffect(() => {
    const visited = localStorage.getItem("ba_visited_v3");
    if (!visited) { setShowWelcome(true); localStorage.setItem("ba_visited_v3", "1"); }
  }, []);

  const [slide, setSlide] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);
  const streakAutoOpenedRef = useRef(false);
  const dailyStreakStatus = getLoginStreakStatus(loginStreak);

  useEffect(() => {
    if (showWelcome || streakAutoOpenedRef.current) return;
    if (dailyStreakStatus.claimable) { setShowStreakModal(true); streakAutoOpenedRef.current = true; }
  }, [showWelcome, dailyStreakStatus.claimable]);

  const [codeModal, setCodeModal] = useState<{ card: CardType; showCode: boolean } | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState(false);
  const [storyCard, setStoryCard] = useState<CardType | null>(null);
  const [showGemPopup, setShowGemPopup] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [playerCard, setPlayerCard] = useState<CardType | null>(null);
  const [playerHp, setPlayerHp] = useState(0);
  const [playerMaxHp, setPlayerMaxHp] = useState(0);
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyMaxHp, setEnemyMaxHp] = useState(0);
  const [logs, setLogs] = useState<BattleLog[]>([]);
  const [turn, setTurn] = useState<"you" | "ai">("you");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"win" | "lose" | null>(null);
  const [hitFx, setHitFx] = useState<"you" | "ai" | null>(null);
  const [attacker, setAttacker] = useState<"you" | "ai" | null>(null);
  const [specialFx, setSpecialFx] = useState(false);
  const [popups, setPopups] = useState<{ id: number; text: string; side: "you" | "ai"; special?: boolean }[]>([]);
  const [specialCooldown, setSpecialCooldown] = useState(0);
  const [enemyFrozen, setEnemyFrozen] = useState(false);
  const [enemySpecialCd, setEnemySpecialCd] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [battleDamageDealt, setBattleDamageDealt] = useState(0);
  const [phoenixRevived, setPhoenixRevived] = useState(false);
  const [crystalShield, setCrystalShield] = useState(0);

  const ownedCards = SHOP_CARDS.filter((c) => owned.includes(c.id));

  const getUnlockedCards = () => {
    const unlocked: CardType[] = [];
    for (const card of SHOP_CARDS) {
      if (card.unlockIndex === 0 || owned.some((id) => {
        const prevCard = SHOP_CARDS.find((c) => c.id === id);
        return prevCard && prevCard.unlockIndex === card.unlockIndex - 1;
      })) { unlocked.push(card); }
    }
    return unlocked;
  };
  const unlockedCards = getUnlockedCards();

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2500);
  }, []);

  const onScroll = useCallback(() => {
    const el = sliderRef.current; if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== slide) { setSlide(idx); sound.play("slide"); }
  }, [slide]);

  const openCodeModal = (card: CardType) => {
    setCodeModal({ card, showCode: false }); setCodeInput(""); setCodeError(""); setCodeSuccess(false); sound.play("click");
  };

  const submitCode = () => {
    if (!codeModal) return;
    const clean = codeInput.trim().toUpperCase();
    if (clean.length < 8) { setCodeError("کد معتبر نیست - حداقل ۸ کاراکتر"); sound.play("code_bad"); return; }
    const ok = verifyCode(codeModal.card.id, clean);
    if (ok) {
      setCodeSuccess(true); sound.play("code_ok");
      if (!owned.includes(codeModal.card.id)) { const newOwned = [...owned, codeModal.card.id]; setOwned(newOwned); saveOwned(newOwned); showToast("کارت فعال شد!", "success"); }
      setTimeout(() => setCodeModal(null), 2000);
    } else { setCodeError("کد اشتباه است"); sound.play("code_bad"); }
  };

  const openStreakModal = () => { setShowStreakModal(true); sound.play("click"); };

  const claimDailyStreakReward = () => {
    if (!dailyStreakStatus.claimable) { setShowStreakModal(false); return; }
    const reward = dailyStreakStatus.reward;
    setLoginStreak((prev) => {
      const next: LoginStreakState = {
        ...prev, streak: dailyStreakStatus.nextStreak,
        bestStreak: Math.max(prev.bestStreak, dailyStreakStatus.nextStreak),
        lastClaimDate: dailyStreakStatus.todayKey,
        pendingSpins: prev.pendingSpins + reward.spins,
        pendingAttackBoosts: prev.pendingAttackBoosts + reward.attackBoosts,
        pendingGoldenChests: prev.pendingGoldenChests + reward.goldenChests,
      };
      saveLoginStreak(next); return next;
    });
    setGems((prev) => { const next = { ...prev, balance: prev.balance + reward.gems }; saveGems(next); return next; });
    const parts = [
      reward.gems > 0 ? `${reward.gems} الماس` : null,
      reward.spins > 0 ? `${reward.spins} اسپین رایگان` : null,
      reward.attackBoosts > 0 ? `${reward.attackBoosts} بوست حمله` : null,
      reward.goldenChests > 0 ? `${reward.goldenChests} صندوق طلایی` : null,
    ].filter(Boolean);
    sound.play("levelup"); showToast(`جایزه روز ${reward.day} دریافت شد: ${parts.join(" + ")}`, "success"); setShowStreakModal(false);
  };

  const calcDamage = (atk: number, def: number, ignoreDefense = false) => {
    const base = ignoreDefense ? Math.max(10, atk) : Math.max(8, atk - Math.floor(def * 0.4));
    return base + Math.floor(Math.random() * (base * 0.25));
  };

  const startBattle = (lvl: Enemy, card: CardType) => {
    setEnemy(lvl); setPlayerCard(card); setPlayerHp(card.health); setPlayerMaxHp(card.health);
    setEnemyHp(lvl.health); setEnemyMaxHp(lvl.health);
    setLogs([{ text: `⚔️ نبرد آغاز شد!`, side: "info" }]);
    setTurn("you"); setResult(null); setBusy(false); setSpecialCooldown(0);
    setEnemyFrozen(false); setEnemySpecialCd(0); setTurnCount(0); setCombo(0);
    setBattleDamageDealt(0); setPhoenixRevived(false); setCrystalShield(0);
    setAttacker(null); setSpecialFx(false); setHitFx(null);
    sound.play("battle_start"); setScreen("battle");
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
      if (frozen) {
        setLogs((l) => [{ text: `❄️ ${en.name} منجمد است!`, side: "info" }, ...l]);
        setEnemyFrozen(false); setTurn("you"); setBusy(false); return;
      }
      const useSpecial = specCd <= 0 && Math.random() < en.specialChance;
      let dmg: number; let logText: string;
      const effectiveDefense = crystalShield > 0 ? card.defense * 2 : card.defense;
      if (crystalShield > 0) {
        setCrystalShield((s) => { const next = s - 1; if (next === 0) { setLogs((l) => [{ text: "💎 سپر کریستالی شکست!", side: "info" }, ...l]); } return next; });
      }
      if (useSpecial && en.specialMultiplier >= 1) {
        dmg = Math.floor(calcDamage(en.attack, effectiveDefense) * en.specialMultiplier);
        logText = `💀 ${en.name} از "${en.specialName}" استفاده کرد! ${dmg} آسیب!`;
        sound.play("special"); setEnemySpecialCd(en.specialCooldown);
      } else if (useSpecial && en.specialMultiplier < 1) {
        setLogs((l) => [{ text: `🛡️ ${en.name} دفاع را تقویت کرد!`, side: "info" }, ...l]);
        setEnemySpecialCd(en.specialCooldown); setTurn("you"); setBusy(false); return;
      } else {
        dmg = calcDamage(en.attack, effectiveDefense);
        logText = `${en.name} حمله کرد! ${dmg} آسیب.`;
        sound.play("hit"); setEnemySpecialCd((c) => Math.max(0, c - 1));
      }
      setAttacker("ai"); if (useSpecial) setSpecialFx(true);
      setTimeout(() => { setHitFx("you"); showPopup(`-${dmg}`, "you", !!useSpecial); }, 230);
      setTimeout(() => { setHitFx(null); setAttacker(null); setSpecialFx(false); }, 650);
      const newHp = Math.max(0, curPlayerHp - dmg);
      setPlayerHp(newHp);
      updateAchievements({ totalDamageReceived: achievements.totalDamageReceived + dmg });
      setLogs((l) => [{ text: logText, side: "ai" }, ...l]);
      if (newHp <= 0) {
        if (card.id === "phoenix_king" && !phoenixRevived) {
          const reviveHp = Math.floor(card.health * 0.5);
          setPlayerHp(reviveHp); setPhoenixRevived(true);
          setLogs((l) => [{ text: `🔥 ${card.name} از خاکستر برخاست! ❤️ ${reviveHp} HP`, side: "special" }, ...l]);
          sound.play("levelup"); showPopup(`🔥 تولد دوباره!`, "you", true);
          setTurn("you"); setBusy(false); return;
        }
        setResult("lose"); setLogs((l) => [{ text: "💀 شکست خوردی...", side: "info" }, ...l]);
        sound.play("lose"); updateAchievements({ battlesLost: achievements.battlesLost + 1 });
        setBusy(false); return;
      }
      setTurn("you"); setBusy(false);
    },
    [achievements.battlesLost, achievements.totalDamageReceived, crystalShield, phoenixRevived]
  );

  const attack = () => {
    if (!enemy || !playerCard || busy || turn !== "you" || result) return;
    setBusy(true); setTurnCount((t) => t + 1);
    const dmg = calcDamage(playerCard.attack, enemy.defense);
    setAttacker("you"); sound.play("attack");
    setTimeout(() => { setHitFx("ai"); showPopup(`-${dmg}`, "ai"); }, 230);
    setTimeout(() => { setHitFx(null); setAttacker(null); }, 650);
    const newEnemyHp = Math.max(0, enemyHp - dmg);
    setEnemyHp(newEnemyHp); setBattleDamageDealt((d) => d + dmg); setCombo((c) => c + 1);
    const comboBonus = combo >= 2 ? ` 🔥x${combo + 1}` : "";
    setLogs((l) => [{ text: `⚔️ ${playerCard.name} حمله کرد! ${dmg}${comboBonus}`, side: "you" }, ...l]);
    setSpecialCooldown((c) => Math.max(0, c - 1));
    if (newEnemyHp <= 0) { handleWin(dmg); return; }
    setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard, enemy, enemyFrozen, enemySpecialCd), 1000);
  };

  const handleWin = (finishingDamage = 0) => {
    setResult("win"); setLogs((l) => [{ text: "🏆 پیروزی!", side: "info" }, ...l]); sound.play("win");
    const newTotalDamage = achievements.totalDamageDealt + battleDamageDealt + finishingDamage;
    const newBossesDefeated = enemy!.isBoss ? achievements.bossesDefeated + 1 : achievements.bossesDefeated;
    updateAchievements({ battlesWon: achievements.battlesWon + 1, totalDamageDealt: newTotalDamage, bossesDefeated: newBossesDefeated, highestLevelReached: Math.max(achievements.highestLevelReached, enemy!.level) });
    if (!clearedLevels.includes(enemy!.level)) { const newCleared = [...clearedLevels, enemy!.level]; setClearedLevels(newCleared); saveCleared(newCleared); sound.play("levelup"); }
    setBusy(false);
  };

  const useSpecialAbility = () => {
    if (!enemy || !playerCard || busy || turn !== "you" || result || specialCooldown > 0) return;
    setBusy(true); setCombo(0); setSpecialCooldown(playerCard.specialCooldown);
    sound.play("special"); updateAchievements({ specialMovesUsed: achievements.specialMovesUsed + 1 });
    const special = playerCard.special;
    let damageHandled = false;

    if (special === "بازیابی") {
      const healAmt = 50; setPlayerHp((h) => Math.min(playerMaxHp, h + healAmt));
      setLogs((l) => [{ text: `✨ ${playerCard.name} خود را شفا داد! +${healAmt} HP`, side: "special" }, ...l]);
      showPopup(`+${healAmt}`, "you", true); sound.play("heal");
    } else if (special === "تولد دوباره" && !phoenixRevived) {
      setPhoenixRevived(true);
      setLogs((l) => [{ text: `🔥 ${playerCard.name} توانایی تولد دوباره را فعال کرد! اگر بمیری زنده میشی`, side: "special" }, ...l]);
      sound.play("levelup"); showPopup("🔥 آماده تولد دوباره!", "you", true);
    } else if (special === "طوفان یخ") {
      setEnemyFrozen(true); const dmg = Math.floor(calcDamage(playerCard.attack, enemy.defense) * 1.5);
      applySpecialDamage(dmg); damageHandled = true;
    } else if (special === "ضربه از بُعد دیگر") {
      const dmg = calcDamage(playerCard.attack, 0, true); applySpecialDamage(dmg); damageHandled = true;
    } else if (special === "ضربه مرگبار") {
      const dmg = Math.floor(calcDamage(playerCard.attack, enemy.defense) * 2); applySpecialDamage(dmg); damageHandled = true;
    } else if (special === "طوفان آتش" || special === "صاعقه مقدس") {
      let totalDmg = 0; const hits = special === "طوفان آتش" ? 3 : 1;
      const multiplier = special === "صاعقه مقدس" ? 2.8 : 1;
      for (let i = 0; i < hits; i++) { totalDmg += calcDamage(playerCard.attack, enemy.defense); }
      totalDmg = Math.floor(totalDmg * multiplier); applySpecialDamage(totalDmg); damageHandled = true;
    } else if (special === "خشم جهنمی") {
      const missingHpPercent = (playerMaxHp - playerHp) / playerMaxHp;
      const multiplier = 1.5 + missingHpPercent * 1.5;
      const dmg = Math.floor(calcDamage(playerCard.attack, enemy.defense) * multiplier);
      applySpecialDamage(dmg); damageHandled = true;
    } else if (special === "جذب خون") {
      const dmg = calcDamage(playerCard.attack, enemy.defense);
      const heal = Math.floor(dmg * 0.3);
      setPlayerHp((h) => Math.min(playerMaxHp, h + heal));
      showPopup(`+${heal} HP`, "you", true); sound.play("heal");
      applySpecialDamage(dmg); damageHandled = true;
    } else if (special === "سپر کریستالی") {
      setCrystalShield(2);
      setLogs((l) => [{ text: `💎 ${playerCard.name} سپر کریستالی فعال کرد! دفاع ۲ برابر برای ۲ نوبت`, side: "special" }, ...l]);
      showPopup("💎 سپر فعال!", "you", true);
    }
    if (!damageHandled) { setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard!, enemy, enemyFrozen, enemySpecialCd), 1000); }
  };

  const applySpecialDamage = (dmg: number) => {
    if (!playerCard || !enemy) return;
    setAttacker("you"); setSpecialFx(true);
    setTimeout(() => { setHitFx("ai"); showPopup(`-${dmg} ✨`, "ai", true); }, 230);
    setTimeout(() => { setHitFx(null); setAttacker(null); setSpecialFx(false); }, 700);
    const newEnemyHp = Math.max(0, enemyHp - dmg);
    setEnemyHp(newEnemyHp); setBattleDamageDealt((d) => d + dmg);
    setLogs((l) => [{ text: `✨ ${playerCard.name} از قدرت ویژه استفاده کرد! ${dmg} آسیب!`, side: "special" }, ...l]);
    if (newEnemyHp <= 0) { handleWin(dmg); return; }
    setTurn("ai"); setTimeout(() => aiTurn(playerHp, playerCard!, enemy, enemyFrozen, enemySpecialCd), 1000);
  };

  const isLevelUnlocked = (lvl: number) => lvl === 1 || clearedLevels.includes(lvl - 1);
  const updateSettings = (patch: Partial<Settings>) => { setSettings((s) => ({ ...s, ...patch })); };
  const goToScreen = (s: Screen) => { setScreen(s); sound.play("click"); };
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
          <div className="flex items-center gap-2">
            {/* Streak button */}
            <button onClick={openStreakModal}
              className="relative flex items-center gap-1.5 rounded-full border border-orange-500/40 bg-gradient-to-r from-orange-900/50 to-red-900/50 px-3 py-1.5 backdrop-blur-sm active:scale-95 transition hover:border-orange-400/70">
              <span className="text-sm">🔥</span>
              <span className="text-xs font-black text-orange-200">{loginStreak.streak}</span>
              {dailyStreakStatus.claimable && (
                <>
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 animate-ping rounded-full bg-emerald-300" />
                </>
              )}
            </button>
            {/* Gem button */}
            <button onClick={() => { setShowGemPopup(true); sound.play("click"); }}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-red-900/50 px-3 py-1.5 backdrop-blur-sm active:scale-95 transition hover:border-amber-400/70">
              <Icon3D icon="GEM" className="h-6 min-w-6 px-1 text-[9px]" />
              <span className="text-xs font-black text-amber-200">{gems.balance}</span>
            </button>
            <button onClick={() => goToScreen("achievements")}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-base transition ${screen === "achievements" ? "border-red-400 bg-red-500/25 text-red-300" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
              <Icon3D icon="ACH" className="h-7 min-w-7 px-1 text-[8px]" />
            </button>
            <button onClick={() => goToScreen("settings")}
              className={`flex h-9 w-9 items-center justify-center rounded-full border text-base transition ${screen === "settings" ? "border-red-400 bg-red-500/25 text-red-300" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}>
              <Icon3D icon="SET" className="h-7 min-w-7 px-1 text-[8px]" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {screen === "shop" && (
            <ShopView slide={slide} sliderRef={sliderRef} onScroll={onScroll} owned={owned} unlockedCards={unlockedCards}
              onBuy={openCodeModal} onStory={setStoryCard} setSlide={setSlide} gems={gems} onBuyWithGems={buyCardWithGems} gemPrices={gemPrices} />
          )}
          {screen === "inventory" && <InventoryView ownedCards={ownedCards} goShop={() => goToScreen("shop")} />}
          {screen === "levels" && (
            <LevelsView ownedCards={ownedCards} clearedLevels={clearedLevels} isUnlocked={isLevelUnlocked} onStart={startBattle} goShop={() => goToScreen("shop")} />
          )}
          {screen === "settings" && (
            <SettingsView settings={settings} update={updateSettings} onBack={() => goToScreen("shop")}
              onReset={() => {
                if (window.confirm("تمام پیشرفت پاک می‌شود. مطمئن هستید؟")) {
                  setOwned([]); setClearedLevels([]); setAchievements(DEFAULT_ACHIEVEMENTS);
                  setLoginStreak(DEFAULT_LOGIN_STREAK); setShowStreakModal(false);
                  saveOwned([]); saveCleared([]); saveAchievements(DEFAULT_ACHIEVEMENTS); saveLoginStreak(DEFAULT_LOGIN_STREAK);
                  streakAutoOpenedRef.current = false; showToast("پیشرفت پاک شد", "info");
                }
              }} />
          )}
          {screen === "achievements" && (
            <AchievementsView achievements={achievements} totalLevels={LEVELS.length} clearedLevels={clearedLevels.length}
              ownedCount={ownedCards.length} totalCards={SHOP_CARDS.length} onBack={() => goToScreen("shop")} />
          )}
          {screen === "battle" && enemy && playerCard && (
            <BattleView enemy={enemy} playerCard={playerCard} playerHp={playerHp} playerMaxHp={playerMaxHp}
              enemyHp={enemyHp} enemyMaxHp={enemyMaxHp} logs={logs} turn={turn} busy={busy} result={result}
              hitFx={hitFx} attacker={attacker} specialFx={specialFx} popups={popups} specialCooldown={specialCooldown}
              enemyFrozen={enemyFrozen} turnCount={turnCount} combo={combo} battleDamageDealt={battleDamageDealt}
              phoenixRevived={phoenixRevived} crystalShield={crystalShield}
              onAttack={attack} onSpecial={useSpecialAbility} onExit={() => goToScreen("levels")}
              onRetry={() => playerCard && enemy && startBattle(enemy, playerCard)} />
          )}
        </main>

        {/* Bottom nav */}
        {screen !== "battle" && screen !== "settings" && screen !== "achievements" && (
          <nav className="grid grid-cols-3 gap-1 border-t border-red-900/50 bg-black/60 px-2 py-2 backdrop-blur-xl">
            <NavBtn label="فروشگاه" icon="🛒" active={screen === "shop"} onClick={() => goToScreen("shop")} />
            <NavBtn label="کارت‌ها" icon="🎴" active={screen === "inventory"} onClick={() => goToScreen("inventory")} badge={ownedCards.length} />
            <NavBtn label="مراحل" icon="⚔️" active={screen === "levels"} onClick={() => goToScreen("levels")} badge={clearedLevels.length > 0 ? Math.min(99, clearedLevels.length) : undefined} badgeColor="bg-red-600" />
          </nav>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-md ${
          toast.type === "success" ? "border-red-500/50 bg-red-900/80 text-red-200"
          : toast.type === "error" ? "border-rose-600/50 bg-rose-950/80 text-rose-200"
          : "border-white/20 bg-black/80 text-white"}`}
          style={{ animation: "slideInUp 0.3s" }}>{toast.msg}</div>
      )}

      {/* Code modal */}
      {codeModal && (
        <CodeModal card={codeModal.card} codeInput={codeInput} codeError={codeError} codeSuccess={codeSuccess}
          setCodeInput={setCodeInput} setCodeError={setCodeError} submitCode={submitCode}
          onClose={() => !codeSuccess && setCodeModal(null)} />
      )}

      {/* Story modal */}
      {storyCard && <StoryModal card={storyCard} onClose={() => setStoryCard(null)} />}

      {/* Welcome modal */}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* Gem popup */}
      {showGemPopup && (
        <GemPopup gems={gems} productionRatePerHour={productionRatePerHour} totalGemsEarned={achievements.totalGemsEarned}
          ownedCount={owned.length} onWithdraw={withdrawGems} onClose={() => setShowGemPopup(false)} />
      )}

      {/* Streak modal */}
      {showStreakModal && (
        <DailyStreakModal streak={loginStreak} status={dailyStreakStatus} onClaim={claimDailyStreakReward} onClose={() => setShowStreakModal(false)} />
      )}
    </div>
  );
}

/* ===================== Gem Popup ===================== */
function GemPopup({ gems, productionRatePerHour, totalGemsEarned, ownedCount, onWithdraw, onClose }: {
  gems: GemState; productionRatePerHour: number; totalGemsEarned: number; ownedCount: number; onWithdraw: () => void; onClose: () => void;
}) {
  const pendingFloor = Math.floor(gems.pending);
  const withdrawAmount = Math.min(MAX_WITHDRAW, Math.max(MIN_WITHDRAW, pendingFloor));
  const canWithdraw = pendingFloor >= MIN_WITHDRAW;
  const pct = Math.min(100, (gems.pending / GEM_CAPACITY) * 100);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950 via-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.35s ease-out" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon3D icon="GEM" className="h-10 min-w-10 px-1 text-[10px]" />
            <div>
              <div className="text-[11px] text-amber-300">موجودی الماس</div>
              <div className="text-2xl font-black text-amber-200">{gems.balance}</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-amber-300 active:scale-90 transition">✕</button>
        </div>
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-black/40 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-white">ظرفیت تولید</span>
            <span className="text-sm font-black text-amber-200">{gems.pending.toFixed(1)} / {GEM_CAPACITY}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-black/60 border border-amber-500/20">
            <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 transition-all duration-700" style={{ width: pct + "%" }} />
          </div>
          {gems.pending >= GEM_CAPACITY && <div className="mt-2 text-center text-[10px] font-bold text-red-300">ظرفیت پر شده! برداشت کن تا تولید ادامه پیدا کنه</div>}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-center">
            <div className="text-[10px] text-slate-400">نرخ تولید</div>
            <div className="text-lg font-black text-white">{productionRatePerHour}</div>
            <div className="text-[9px] text-amber-300">الماس در ساعت</div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-black/40 p-3 text-center">
            <div className="text-[10px] text-slate-400">کارت‌های فعال</div>
            <div className="text-lg font-black text-white">{ownedCount}</div>
            <div className="text-[9px] text-amber-300">منبع تولید</div>
          </div>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/20 bg-black/40 px-4 py-3">
          <span className="text-xs font-bold text-slate-300">کل الماس تولید شده</span>
          <span className="text-lg font-black text-amber-200">{totalGemsEarned}</span>
        </div>
        <button onClick={onWithdraw} disabled={!canWithdraw}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 py-3.5 text-sm font-black text-black shadow-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ boxShadow: canWithdraw ? "0 0 22px rgba(245,158,11,0.5)" : undefined }}>
          <Icon3D icon="GEM" className="h-7 min-w-7 px-1 text-[9px]" />
          <span>برداشت {withdrawAmount} الماس</span>
        </button>
        <div className="mt-2 text-center text-[10px] text-slate-400">حداقل {MIN_WITHDRAW} • حداکثر {MAX_WITHDRAW} الماس در هر برداشت</div>
      </div>
    </div>
  );
}

/* ===================== Welcome Modal ===================== */
function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6 backdrop-blur-md" dir="rtl">
      <div className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.5s" }}>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-5xl" style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)", boxShadow: "0 0 40px rgba(220,38,38,0.8)", animation: "heartbeat 1.5s infinite" }}>⚔️</div>
          <h2 className="text-2xl font-black bg-gradient-to-r from-red-400 via-white to-red-400 bg-clip-text text-transparent">BATTLE ARENA</h2>
          <p className="mt-2 text-sm text-slate-400">نبرد افسانه‌ای تو آغاز می‌شود...</p>
        </div>
        <div className="mb-6 space-y-3 text-sm">
          <div className="flex items-center gap-3 rounded-xl bg-red-950/50 p-3 border border-red-900/50">
            <span className="text-2xl">🛒</span>
            <div><div className="font-bold text-white">کارت‌های قدرتمند</div><div className="text-xs text-slate-500">با کد فعال‌سازی کارت‌ها را باز کن</div></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-red-950/50 p-3 border border-red-900/50">
            <span className="text-2xl">⚔️</span>
            <div><div className="font-bold text-white">۲۰۸ مرحله نبرد</div><div className="text-xs text-slate-500">هر ۸ مرحله یک باس فایت</div></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-red-950/50 p-3 border border-red-900/50">
            <span className="text-2xl">🏆</span>
            <div><div className="font-bold text-white">دستاورد‌ها</div><div className="text-xs text-slate-500">آمار نبردهای خود را ببین</div></div>
          </div>
        </div>
        <button onClick={onClose} className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-800 py-4 font-black text-white active:scale-95" style={{ boxShadow: "0 0 30px rgba(220,38,38,0.6)" }}>شروع نبرد! 🔥</button>
      </div>
    </div>
  );
}

/* ===================== Story Modal ===================== */
function StoryModal({ card, onClose }: { card: CardType; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.4s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <Icon3D icon={card.element} className="h-14 min-w-14 px-2 text-sm" />
          <div><h3 className="text-lg font-black text-white">{card.name}</h3><div className="text-xs text-red-400 font-bold">{card.special}</div></div>
        </div>
        <div className="mb-6 rounded-2xl border border-red-900/50 bg-black/40 p-4">
          <p className="text-sm leading-relaxed text-slate-300">{card.story}</p>
        </div>
        <button onClick={onClose} className="w-full rounded-xl border border-red-500/40 bg-red-500/10 py-3 font-bold text-red-400 active:scale-95 hover:bg-red-500/20 transition">بستن</button>
      </div>
    </div>
  );
}

/* ===================== Code Modal ===================== */
function CodeModal({ card, codeInput, codeError, codeSuccess, setCodeInput, setCodeError, submitCode, onClose }: {
  card: CardType; codeInput: string; codeError: string; codeSuccess: boolean;
  setCodeInput: (v: string) => void; setCodeError: (v: string) => void; submitCode: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 p-5 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950 to-black p-6 shadow-2xl" style={{ animation: "popIn 0.3s" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-white">🔐 فعال‌سازی کارت</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/50 text-slate-400 hover:text-white transition">✕</button>
        </div>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-900/50 bg-black/50 p-3">
          <div className="relative h-16 w-12 overflow-hidden rounded-xl border border-red-700/50">
            <img src={card.image} alt={card.name} className="h-full w-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="font-black text-white">{card.name}</div>
            <div className="mt-0.5 flex gap-2 text-xs">
              <span className="text-red-400">⚔️ {card.attack}</span>
              <span className="text-white">❤️ {card.health}</span>
              <span className="text-slate-400">🛡️ {card.defense}</span>
            </div>
          </div>
        </div>
        {codeSuccess ? (
          <div className="py-8 text-center" style={{ animation: "popIn 0.4s" }}>
            <div className="mb-3 text-6xl">✅</div>
            <div className="text-lg font-black text-red-300">کارت فعال شد!</div>
            <div className="mt-1 text-xs text-slate-400">به کلکسیون اضافه شد 🔥</div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">کد فعال‌سازی را وارد کنید. این کد پس از خرید به شما داده می‌شود.</p>
            <input type="text" value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value.toUpperCase().slice(0, 12)); setCodeError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="کد را وارد کنید"
              className="mb-2 w-full rounded-xl border border-red-900/50 bg-black/60 px-4 py-3 text-center text-lg font-mono font-black tracking-[0.3em] text-white outline-none transition focus:border-red-500 focus:shadow-[0_0_20px_rgba(220,38,38,0.4)]"
              maxLength={12} autoFocus />
            {codeError && <p className="mb-2 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs text-red-400" style={{ animation: "shake 0.3s" }}>❌ {codeError}</p>}
            <button onClick={submitCode} className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 font-black text-white shadow-lg active:scale-95" style={{ boxShadow: "0 0 20px rgba(220,38,38,0.5)" }}>فعال‌سازی ✨</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== Daily Streak Modal ===================== */
function DailyStreakModal({ streak, status, onClaim, onClose }: {
  streak: LoginStreakState; status: LoginStreakStatus; onClaim: () => void; onClose: () => void;
}) {
  const claimedBefore = status.claimable
    ? status.reset ? 0 : streak.streak % 7
    : streak.streak === 0 ? 0 : ((streak.streak - 1) % 7) + 1;
  const activeReward = status.claimable ? status.reward : status.tomorrowReward;
  const bonusPercent = Math.max(0, Math.round((activeReward.multiplier - 1) * 100));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-5 backdrop-blur-md" dir="rtl" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-orange-500/40 bg-gradient-to-br from-orange-950 via-red-950 to-black p-5 shadow-2xl" style={{ animation: "popIn 0.35s ease-out" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: "linear-gradient(135deg, #f97316, #7f1d1d)", boxShadow: "0 0 24px rgba(249,115,22,0.45)" }}>🔥</div>
            <div>
              <div className="text-sm font-black text-white">استریک ورود روزانه</div>
              <div className="text-[11px] text-orange-300">استریک فعلی: {loginStreakLabel(streak.streak)} • بهترین: {loginStreakLabel(streak.bestStreak)}</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-orange-300 active:scale-90 transition">✕</button>
        </div>

        {/* Reset warning */}
        {status.reset && (
          <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3">
            <div className="text-sm font-black text-rose-300">استریک قطع شده!</div>
            <div className="mt-1 text-[11px] leading-5 text-rose-200/80">
              {status.missedDays > 0 ? `تو ${status.missedDays} روز وارد بازی نشدی، پس استریک از اول شروع می‌شود.` : "به خاطر وقفه در ورود، استریک از اول شروع می‌شود."}
            </div>
          </div>
        )}

        {/* Week bonus */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-orange-500/25 bg-black/35 px-4 py-3">
          <div><div className="text-[10px] text-slate-400">هفته استریک</div><div className="text-lg font-black text-white">هفته {activeReward.week}</div></div>
          <div className="text-left"><div className="text-[10px] text-slate-400">بونوس چرخه</div><div className="text-lg font-black text-orange-300">{bonusPercent > 0 ? `+${bonusPercent}%` : "—"}</div></div>
        </div>

        {/* 7 days */}
        <div className="mb-4 grid grid-cols-7 gap-2">
          {DAILY_REWARD_TABLE.map((dayReward) => {
            const isClaimed = dayReward.day <= claimedBefore;
            const isCurrent = status.claimable
              ? dayReward.day === status.reward.day
              : dayReward.day === (((streak.streak - 1) % 7) + 1 || 1);
            return (
              <div key={dayReward.day}
                className={`rounded-2xl border p-2 text-center transition ${isClaimed ? "border-emerald-400/40 bg-emerald-500/10" : isCurrent ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/30"}`}
                style={{ boxShadow: isCurrent && status.claimable ? "0 0 18px rgba(251,146,60,0.25)" : undefined, animation: isCurrent && status.claimable ? "glowPulse 1.8s infinite" : undefined }}>
                <div className="mb-1 text-[9px] font-black text-slate-400">روز {dayReward.day}</div>
                <div className="text-lg">{dayReward.icon}</div>
                <div className="mt-1 text-[9px] font-black text-white">{dayReward.gems}💎</div>
                {dayReward.spins ? <div className="text-[8px] text-amber-300">🎰</div> : null}
                {dayReward.attackBoosts ? <div className="text-[8px] text-red-300">🔥</div> : null}
                {dayReward.goldenChests ? <div className="text-[8px] text-yellow-300">🎁</div> : null}
                {isClaimed && <div className="mt-1 text-[8px] font-black text-emerald-300">✓</div>}
              </div>
            );
          })}
        </div>

        {/* Active reward */}
        <div className="mb-4 rounded-2xl border border-orange-500/25 bg-black/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">{status.claimable ? status.reward.icon : status.tomorrowReward.icon}</span>
            <div>
              <div className="text-sm font-black text-white">{status.claimable ? status.reward.title : `جایزه فردا: ${status.tomorrowReward.title}`}</div>
              <div className="text-[11px] text-slate-400">{status.claimable ? status.reward.desc : status.tomorrowReward.desc}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center">
              <div className="text-slate-400">الماس</div>
              <div className="text-base font-black text-orange-200">{status.claimable ? status.reward.gems : status.tomorrowReward.gems}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center">
              <div className="text-slate-400">شماره استریک</div>
              <div className="text-base font-black text-white">{status.claimable ? status.nextStreak : streak.streak}</div>
            </div>
          </div>
          {status.claimable && (
            <div className="mt-3 flex flex-wrap gap-2">
              {status.reward.spins > 0 && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-200">🎰 {status.reward.spins} اسپین رایگان</span>}
              {status.reward.attackBoosts > 0 && <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[10px] font-bold text-red-200">🔥 {status.reward.attackBoosts} بوست حمله</span>}
              {status.reward.goldenChests > 0 && <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-[10px] font-bold text-yellow-200">🎁 {status.reward.goldenChests} صندوق طلایی</span>}
            </div>
          )}
        </div>

        {/* Stored rewards */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center">
            <div className="text-[9px] text-slate-400">اسپین ذخیره</div>
            <div className="text-base font-black text-amber-300">{streak.pendingSpins}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center">
            <div className="text-[9px] text-slate-400">بوست حمله</div>
            <div className="text-base font-black text-red-300">{streak.pendingAttackBoosts}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2 text-center">
            <div className="text-[9px] text-slate-400">صندوق طلایی</div>
            <div className="text-base font-black text-yellow-300">{streak.pendingGoldenChests}</div>
          </div>
        </div>

        <div className="mb-4 text-center text-[10px] text-slate-500">جوایز غیرالماسی برای سیستم‌های بعدی ذخیره می‌شوند و از بین نمی‌روند.</div>

        {/* Actions */}
        {status.claimable ? (
          <button onClick={onClaim}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-700 py-3.5 text-sm font-black text-white shadow-lg active:scale-95 transition"
            style={{ boxShadow: "0 0 24px rgba(249,115,22,0.35)" }}>دریافت جایزه امروز</button>
        ) : (
          <div className="space-y-2">
            <div className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-center text-sm font-black text-emerald-300">جایزه امروز دریافت شده ✅</div>
            <div className="text-center text-[11px] text-slate-400">فردا برگرد تا جایزه روز بعد را از دست ندهی</div>
          </div>
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
  const goTo = (i: number) => {
    const el = sliderRef.current; if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setSlide(i); sound.play("slide");
  };
  return (
    <div className="flex h-full flex-col">
      <div ref={sliderRef} onScroll={onScroll} className="scrollbar-hide flex flex-1 overflow-x-auto" style={{ scrollSnapType: "x mandatory" }}>
        {SHOP_CARDS.map((card, index) => {
          const isOwned = owned.includes(card.id);
          const isUnlocked = unlockedCards.some((c) => c.id === card.id);
          const gemPrice = gemPrices[card.id];
          if (!isUnlocked) {
            return (
              <div key={card.id} className="flex h-full w-full shrink-0 flex-col items-center justify-center px-5" style={{ scrollSnapAlign: "center" }}>
                <div className="relative flex h-[340px] w-[200px] flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-slate-700 bg-gradient-to-b from-slate-900 to-black opacity-50" style={{ filter: "grayscale(100%)" }}>
                  <span className="text-6xl opacity-20">🔒</span>
                  <div className="absolute bottom-8 text-center">
                    <h3 className="text-lg font-black text-slate-500">{card.name}</h3>
                    <p className="text-xs text-slate-600 mt-1">کارت قبلی را باز کنید</p>
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div key={card.id} className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-3 px-5" style={{ scrollSnapAlign: "center" }}>
              <div style={{ perspective: "900px" }}><GameCard card={card} float={slide === index} /></div>
              <div className="w-full max-w-[280px] rounded-2xl border border-red-900/50 bg-black/60 p-3 backdrop-blur-md">
                <div className="space-y-2">
                  <button onClick={() => onStory(card)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white active:scale-95 hover:bg-white/10 transition">
                    <Icon3D icon="ST" className="h-6 min-w-6 px-1 text-[9px]" /><span>درباره‌ی قهرمان</span>
                  </button>
                  {isOwned ? (
                    <div className="flex items-center justify-center rounded-xl bg-red-900/30 py-3 text-sm font-bold text-red-300" style={{ border: "1px solid rgba(220,38,38,0.3)" }}><span>خریداری شده</span></div>
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
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-900/50 to-red-900/50 py-3 text-sm font-bold text-amber-200 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed">
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
        {SHOP_CARDS.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className={`rounded-full transition-all duration-300 ${slide === i ? "w-6 h-2 bg-red-500" : "w-2 h-2 bg-white/20 hover:bg-white/40"}`} />
        ))}
      </div>
    </div>
  );
}

/* ===================== Inventory ===================== */
function InventoryView({ ownedCards, goShop }: { ownedCards: CardType[]; goShop: () => void }) {
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
        <EmptyState icon="📭" title="کارتی نداری" desc="برو به فروشگاه و اولین کارتت رو بخر" btnLabel="فروشگاه" onBtn={goShop} />
      ) : (
        <div className="grid grid-cols-2 gap-4 pb-4">
          {ownedCards.map((c, i) => (
            <div key={c.id} className="flex justify-center" style={{ perspective: "800px", animationDelay: `${i * 0.1}s` }}>
              <GameCard card={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== Levels ===================== */
function LevelsView({ ownedCards, clearedLevels, isUnlocked, onStart, goShop }: {
  ownedCards: CardType[]; clearedLevels: number[];
  isUnlocked: (l: number) => boolean; onStart: (e: Enemy, c: CardType) => void; goShop: () => void;
}) {
  const [selected, setSelected] = useState<Enemy | null>(null);
  if (ownedCards.length === 0) {
    return (<div className="flex h-full items-center justify-center px-6"><EmptyState icon="🃏" title="کارت نداری!" desc="برای نبرد حداقل یک کارت لازمه" btnLabel="فروشگاه" onBtn={goShop} /></div>);
  }
  const totalCleared = clearedLevels.length;
  const progress = (totalCleared / LEVELS.length) * 100;
  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="px-4 py-2">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-black">⚔️ مراحل نبرد</h2>
          <span className="text-xs text-slate-500">{totalCleared}/{LEVELS.length}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-red-900/50">
          <div className="h-full rounded-full bg-gradient-to-r from-red-600 to-white transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {LEVELS.map((lvl, i) => {
          const unlocked = isUnlocked(lvl.level);
          const cleared = clearedLevels.includes(lvl.level);
          const diff = difficultyLabel(lvl.level);
          return (
            <button key={lvl.level} disabled={!unlocked} onClick={() => { setSelected(lvl); sound.play("click"); }}
              className={`relative overflow-hidden rounded-2xl border p-3 text-right transition active:scale-95 ${
                cleared ? "border-red-500/40 bg-gradient-to-br from-red-900/30 to-black"
                : unlocked ? "border-red-900/50 bg-gradient-to-br from-red-950/50 to-black hover:border-red-500/50"
                : "border-slate-800 bg-black/60 opacity-40 cursor-not-allowed"}`}
              style={{ animation: unlocked ? `slideInUp 0.4s ease-out ${Math.min(i * 0.03, 0.5)}s both` : undefined }}>
              <img src={lvl.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/25" />
              {cleared && <span className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px]">✓</span>}
              {!unlocked && <span className="absolute left-2 top-2 z-10 text-sm opacity-60">🔒</span>}
              {lvl.isBoss && <div className="absolute right-2 top-2 z-10 rounded-full bg-gradient-to-r from-red-600 to-black px-2 py-0.5 text-[8px] font-black text-white border border-red-500">BOSS</div>}
              <div className="relative z-10 mb-2 mt-1 flex items-center gap-2">
                <Icon3D icon={lvl.isBoss ? "B" : lvl.gender === "female" ? "F" : "M"} className="h-10 min-w-10 px-1 text-xs" />
                <div>
                  <div className="text-[9px] text-slate-500">مرحله {lvl.level}</div>
                  <div className="text-xs font-black text-white">{lvl.name}</div>
                </div>
              </div>
              <div className={`relative z-10 mb-1 text-[10px] font-black ${diff.color}`}>{diff.text}</div>
              <div className="relative z-10 flex gap-2 text-[9px] text-slate-400">
                <span>ATK {lvl.attack}</span><span>HP {lvl.health}</span><span>DEF {lvl.defense}</span>
              </div>
              <div className="relative z-10 mt-1.5 text-right text-sm">{lvl.reward}</div>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/80 backdrop-blur-sm" dir="rtl" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[440px] rounded-t-3xl border-t border-red-900/50 bg-gradient-to-b from-red-950 to-black p-5 pb-6" style={{ animation: "slideInUp 0.3s" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-red-900/50" />
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-black text-white">کارت نبرد</h3>
              <button onClick={() => setSelected(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/50 text-slate-400 hover:text-white transition">✕</button>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-900/50 bg-black/40 p-3">
              <EnemyCard enemy={selected} compact />
              <div>
                <div className="text-xs text-slate-500">حریف</div>
                <div className="font-black text-white">{selected.name}</div>
                <div className="flex gap-2 text-xs text-slate-500 mt-0.5">
                  <span>⚔️ {selected.attack}</span><span>❤️ {selected.health}</span><span>🛡️ {selected.defense}</span>
                </div>
              </div>
              {selected.isBoss && <div className="mr-auto text-right"><div className="text-[9px] text-red-400 font-black">💀 BOSS</div></div>}
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {ownedCards.map((c) => (
                <button key={c.id} onClick={() => { onStart(selected, c); setSelected(null); }} className="shrink-0 hover:scale-105 transition-transform">
                  <GameCard card={c} compact />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Settings ===================== */
function SettingsView({ settings, update, onBack, onReset }: {
  settings: Settings; update: (patch: Partial<Settings>) => void; onBack: () => void; onReset: () => void;
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
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value.slice(0, 16))}
            onKeyDown={(e) => { if (e.key === "Enter") { const t = nameInput.trim(); if (t) { update({ playerName: t }); sound.play("click"); } } }}
            placeholder="نام" className="flex-1 rounded-xl border border-red-900/50 bg-black/60 px-4 py-2.5 text-sm text-white outline-none transition focus:border-red-500" maxLength={16} />
          <button onClick={() => { const t = nameInput.trim(); if (t) { update({ playerName: t }); sound.play("click"); } }}
            className="rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-4 py-2.5 text-sm font-bold active:scale-95">ذخیره</button>
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
function AchievementsView({ achievements, totalLevels, clearedLevels, ownedCount, totalCards, onBack }: {
  achievements: Achievements; totalLevels: number; clearedLevels: number;
  ownedCount: number; totalCards: number; onBack: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-3 scrollbar-hide" dir="rtl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black">🏆 دستاوردها</h2>
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-1.5 text-sm active:scale-95 hover:bg-red-900/50 transition"><span>←</span><span>بازگشت</span></button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <AchievementBox icon="CARD" label="کارت‌ها" value={`${ownedCount}/${totalCards}`} color="text-white" />
        <AchievementBox icon="LVL" label="مراحل رد شده" value={`${clearedLevels}/${totalLevels}`} color="text-red-300" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AchievementBox icon="⚔️" label="کل آسیب وارد شده" value={achievements.totalDamageDealt.toLocaleString()} color="text-red-400" />
        <AchievementBox icon="💔" label="کل آسیب دریافت شده" value={achievements.totalDamageReceived.toLocaleString()} color="text-slate-400" />
        <AchievementBox icon="🏆" label="پیروزی‌ها" value={achievements.battlesWon.toString()} color="text-white" />
        <AchievementBox icon="💀" label="شکست‌ها" value={achievements.battlesLost.toString()} color="text-slate-500" />
        <AchievementBox icon="✨" label="حرکت‌های ویژه" value={achievements.specialMovesUsed.toString()} color="text-fuchsia-400" />
        <AchievementBox icon="👑" label="باس‌های شکست داده" value={achievements.bossesDefeated.toString()} color="text-amber-400" />
        <AchievementBox icon="📊" label="بالاترین مرحله" value={achievements.highestLevelReached.toString()} color="text-sky-400" />
        <AchievementBox icon="🗺️" label="مراحل باقی‌مانده" value={(totalLevels - clearedLevels).toString()} color="text-emerald-400" />
        <AchievementBox icon="GEM" label="کل الماس تولید شده" value={achievements.totalGemsEarned.toString()} color="text-amber-300" />
      </div>
      <WinRatioBox won={achievements.battlesWon} lost={achievements.battlesLost} />
      <div className="mb-4 rounded-2xl border border-red-900/50 bg-red-950/30 p-4">
        <h3 className="mb-2 text-sm font-black text-white">پیشرفت کلی</h3>
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-slate-400">مراحل کامل شده</span>
          <span className="text-white font-bold">{clearedLevels}/{totalLevels}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-black/60">
          <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-white to-red-600 transition-all duration-700" style={{ width: `${(clearedLevels / totalLevels) * 100}%` }} />
        </div>
        <div className="mt-2 text-center text-xs text-slate-500">{((clearedLevels / totalLevels) * 100).toFixed(1)}% کامل شده</div>
      </div>
    </div>
  );
}

function AchievementBox({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-red-900/30 bg-black/40 p-3 text-center">
      <Icon3D icon={icon} className="mx-auto mb-2 h-9 min-w-9 px-1 text-[10px]" />
      <div className={`text-lg font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function WinRatioBox({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const ratio = total > 0 ? (won / total) * 100 : 0;
  const ratioColor = total === 0 ? "text-slate-500" : ratio >= 75 ? "text-emerald-400" : ratio >= 50 ? "text-amber-400" : "text-rose-400";
  const barColor = total === 0 ? "bg-slate-700" : ratio >= 75 ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : ratio >= 50 ? "bg-gradient-to-r from-amber-600 to-amber-400" : "bg-gradient-to-r from-rose-700 to-rose-500";
  return (
    <div className="mb-4 rounded-2xl border border-red-900/50 bg-gradient-to-br from-red-950/60 to-black p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black text-white">⚖️ نسبت پیروزی</h3>
        <span className={`text-xl font-black ${ratioColor}`}>{total === 0 ? "—" : `${ratio.toFixed(1)}٪`}</span>
      </div>
      <div className="relative mb-3 h-4 overflow-hidden rounded-full border border-white/10 bg-black/60">
        <div className={`h-full ${barColor} transition-all duration-700`} style={{ width: `${total === 0 ? 0 : ratio}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">{total === 0 ? "هنوز نبردی نداشته‌ای" : `${won}W / ${lost}L`}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-white/5 bg-black/30 p-2"><div className="text-[9px] text-slate-500">کل نبردها</div><div className="text-base font-black text-white">{total}</div></div>
        <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-2"><div className="text-[9px] text-red-300">پیروزی</div><div className="text-base font-black text-white">{won}</div></div>
        <div className="rounded-xl border border-white/5 bg-black/30 p-2"><div className="text-[9px] text-slate-500">شکست</div><div className="text-base font-black text-white">{lost}</div></div>
      </div>
      <div className="mt-3 text-center text-[10px] text-slate-500">
        {total === 0 ? "اولین نبرد خود را شروع کن" : ratio >= 75 ? "رکورد درخشان" : ratio >= 50 ? "عملکرد خوب" : "💀 نیاز به تمرین بیشتر"}
      </div>
    </div>
  );
}

/* ===================== Battle ===================== */
function BattleView({
  enemy, playerCard, playerHp, playerMaxHp, enemyHp, enemyMaxHp,
  logs, turn, busy, result, hitFx, attacker, specialFx, popups,
  specialCooldown, enemyFrozen, turnCount, combo, battleDamageDealt,
  phoenixRevived, crystalShield, onAttack, onSpecial, onExit, onRetry,
}: {
  enemy: Enemy; playerCard: CardType; playerHp: number; playerMaxHp: number;
  enemyHp: number; enemyMaxHp: number; logs: BattleLog[]; turn: "you" | "ai";
  busy: boolean; result: "win" | "lose" | null; hitFx: "you" | "ai" | null;
  attacker: "you" | "ai" | null; specialFx: boolean;
  popups: { id: number; text: string; side: "you" | "ai"; special?: boolean }[];
  specialCooldown: number; enemyFrozen: boolean; turnCount: number;
  combo: number; battleDamageDealt: number; phoenixRevived: boolean;
  crystalShield: number; onAttack: () => void; onSpecial: () => void; onExit: () => void; onRetry: () => void;
}) {
  return (
    <div className="relative flex h-full flex-col" style={{ background: "linear-gradient(180deg, #000 0%, #1a0505 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(220,38,38,0.4), transparent 70%)" }} />
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${turn === "you" ? "bg-white" : "bg-red-500"}`} style={{ animation: "heartbeat 1s infinite" }} />
          <span className="text-[10px] text-slate-400">{turn === "you" ? "نوبت تو" : "نوبت دشمن"}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span>نوبت {turnCount}</span>
          {combo >= 2 && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-red-400 font-bold">🔥 x{combo}</span>}
          {crystalShield > 0 && <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-300 font-bold">💎 سپر {crystalShield}</span>}
        </div>
      </div>

      {/* Enemy */}
      <div className="battle-stage relative mx-4 flex flex-col items-center rounded-2xl border border-red-900/50 bg-black/40 p-3">
        <HpBar name={enemy.name} hp={enemyHp} max={enemyMaxHp} color="from-red-600 to-red-800" />
        <div className="relative mt-2 flex items-center gap-3">
          <div className={`relative ${attacker === "ai" ? "fx-lunge-down" : ""} ${hitFx === "ai" ? "fx-hit3d" : ""} ${specialFx && attacker === "ai" ? "fx-aura rounded-2xl" : ""}`}
            style={{ filter: enemyFrozen ? "hue-rotate(180deg)" : undefined }}>
            <EnemyCard enemy={enemy} compact active />
            {hitFx === "ai" && (
              <>
                <div className="fx-dmg-flash pointer-events-none absolute inset-0 rounded-2xl bg-red-500/70 mix-blend-screen" />
                <div className="fx-shockwave pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 rounded-full border-2 border-white/80" />
                <div className="fx-slash pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-28 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
                <Sparks />
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-white">{enemy.name}</div>
            <div className="text-[10px] text-slate-500">مرحله {enemy.level}</div>
            {enemy.isBoss && <div className="mt-1 rounded-lg bg-red-600/20 px-2 py-0.5 text-[9px] text-red-400 font-black">💀 BOSS</div>}
            {enemyFrozen && <div className="mt-1 rounded-lg bg-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-400 font-bold animate-pulse">❄️ منجمد</div>}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0">
          {popups.filter((p) => p.side === "ai").map((p) => (
            <span key={p.id} className={`absolute left-1/2 top-4 -translate-x-1/2 font-black ${p.special ? "text-2xl text-white" : "text-xl text-red-400"}`} style={{ animation: "floatUp 0.9s forwards" }}>{p.text}</span>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="scrollbar-hide mx-4 my-2 flex-1 overflow-y-auto rounded-xl border border-red-900/50 bg-black/50 p-2" style={{ maxHeight: "100px" }}>
        {logs.map((l, i) => (
          <p key={i} className={`text-[10px] leading-relaxed ${l.side === "you" ? "text-white" : l.side === "ai" ? "text-red-400" : l.side === "special" ? "text-white font-bold" : "text-amber-400"}`}
            style={i === 0 ? { animation: "slideInRight 0.3s" } : undefined}>{l.text}</p>
        ))}
      </div>

      {/* Player */}
      <div className="battle-stage relative mx-4 mb-2 flex items-center gap-3 rounded-2xl border border-red-900/50 bg-black/40 p-3">
        <div className={`relative shrink-0 scale-75 ${attacker === "you" ? "fx-lunge-up" : ""} ${hitFx === "you" ? "fx-hit3d" : ""} ${specialFx && attacker === "you" ? "fx-aura rounded-2xl" : ""}`}>
          <GameCard card={playerCard} compact />
          {hitFx === "you" && (
            <>
              <div className="fx-dmg-flash pointer-events-none absolute inset-0 rounded-2xl bg-red-500/70 mix-blend-screen" />
              <div className="fx-shockwave pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 rounded-full border-2 border-white/80" />
              <div className="fx-slash pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-24 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
              <Sparks />
            </>
          )}
        </div>
        <div className="flex-1">
          <HpBar name={playerCard.name} hp={playerHp} max={playerMaxHp} color="from-white to-slate-400" />
          <div className="mt-1 flex gap-2 text-[9px] text-slate-500">
            <span>⚔️ {playerCard.attack}</span><span>❤️ {playerCard.health}</span><span>🛡️ {playerCard.defense}</span>
          </div>
          {phoenixRevived && <div className="mt-1 text-[9px] text-amber-400 font-bold">🔥 زنده شد!</div>}
          {crystalShield > 0 && <div className="mt-1 text-[9px] text-cyan-300 font-bold animate-pulse">💎 سپر کریستالی ({crystalShield} نوبت)</div>}
        </div>
        <div className="pointer-events-none absolute inset-0">
          {popups.filter((p) => p.side === "you").map((p) => (
            <span key={p.id} className={`absolute left-1/2 top-4 -translate-x-1/2 font-black ${p.special ? "text-2xl text-white" : "text-xl text-red-400"}`} style={{ animation: "floatUp 0.9s forwards" }}>{p.text}</span>
          ))}
        </div>
      </div>

      {/* Actions */}
      {!result && (
        <div className="grid grid-cols-2 gap-2 px-4 pb-3">
          <button onClick={onAttack} disabled={busy || turn !== "you"}
            className="rounded-2xl bg-gradient-to-r from-red-600 to-red-800 py-3.5 text-sm font-black shadow-lg active:scale-95 disabled:opacity-50 transition-all"
            style={{ boxShadow: turn === "you" && !busy ? "0 0 20px rgba(220,38,38,0.6)" : undefined, animation: turn === "you" && !busy ? "glowPulse 1.8s infinite" : undefined }}>
            {turn === "you" ? "⚔️ حمله" : "⏳ صبر"}
          </button>
          <button onClick={onSpecial} disabled={busy || turn !== "you" || specialCooldown > 0}
            className="relative rounded-2xl bg-gradient-to-r from-white to-slate-400 py-3.5 text-sm font-black text-black shadow-lg active:scale-95 disabled:opacity-40 transition-all"
            style={{ boxShadow: specialCooldown === 0 && turn === "you" && !busy ? "0 0 20px rgba(255,255,255,0.6)" : undefined }}>
            {specialCooldown > 0 ? <span>✨ ویژه ({specialCooldown})</span> : <span>✨ قدرت ویژه</span>}
            {specialCooldown === 0 && turn === "you" && !busy && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3 rounded-full bg-white">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              </span>
            )}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm" style={{ animation: "fadeIn 0.4s" }}>
          <div style={{ animation: "winBurst 0.6s ease-out" }}>
            <div className="text-8xl mb-2 text-center">{result === "win" ? "🏆" : "💀"}</div>
          </div>
          <h2 className={`text-3xl font-black ${result === "win" ? "text-white" : "text-red-400"}`}
            style={{ animation: "popIn 0.5s 0.2s both", textShadow: result === "win" ? "0 0 20px white" : undefined }}>
            {result === "win" ? "پیروزی!" : "شکست"}
          </h2>
          <div className="flex gap-4 text-center" style={{ animation: "slideInUp 0.4s 0.4s both" }}>
            <div className="rounded-xl bg-red-900/30 px-4 py-2"><div className="text-xs text-slate-400">آسیب کل</div><div className="text-lg font-black text-red-400">{battleDamageDealt}</div></div>
            <div className="rounded-xl bg-red-900/30 px-4 py-2"><div className="text-xs text-slate-400">نوبت‌ها</div><div className="text-lg font-black text-white">{turnCount}</div></div>
          </div>
          <div className="flex gap-3" style={{ animation: "slideInUp 0.4s 0.6s both" }}>
            <button onClick={onRetry} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-bold active:scale-95 hover:bg-white/20 transition">🔄 دوباره</button>
            <button onClick={onExit} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-800 px-5 py-3 font-bold active:scale-95" style={{ boxShadow: "0 0 20px rgba(220,38,38,0.5)" }}>🗺️ مراحل</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sparks() {
  const sparks = Array.from({ length: 10 });
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2">
      {sparks.map((_, i) => {
        const angle = (i / sparks.length) * Math.PI * 2;
        const dist = 38 + (i % 3) * 14;
        const sx = Math.cos(angle) * dist; const sy = Math.sin(angle) * dist;
        return (
          <span key={i} className="fx-spark absolute h-1.5 w-1.5 rounded-full"
            style={{ ["--sx" as string]: `${sx}px`, ["--sy" as string]: `${sy}px`, background: i % 2 === 0 ? "#fde68a" : "#ef4444", boxShadow: "0 0 6px currentColor" }} />
        );
      })}
    </div>
  );
}

function HpBar({ name, hp, max, color }: { name: string; hp: number; max: number; color: string }) {
  const pct = Math.max(0, (hp / max) * 100);
  const isLow = pct < 25;
  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="font-black text-white truncate max-w-[120px]">{name}</span>
        <span className={`font-bold ${isLow ? "text-red-400" : "text-slate-300"}`}>{hp}/{max}</span>
      </div>
      <div className="h-3.5 overflow-hidden rounded-full border border-red-900/50 bg-black/60">
        <div className={`h-full rounded-full bg-gradient-to-r ${isLow ? "from-red-600 to-red-400" : color} transition-all duration-600`}
          style={{ width: `${pct}%`, boxShadow: isLow ? "0 0 10px rgba(220,38,38,0.6)" : undefined }} />
      </div>
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
      <button onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-all duration-300 ${value ? "bg-red-600" : "bg-slate-700"}`}
        style={{ boxShadow: value ? "0 0 12px rgba(220,38,38,0.5)" : undefined }}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${value ? "right-0.5" : "right-5"}`} />
      </button>
    </div>
  );
}

function NavBtn({ label, icon, active, onClick, badge, badgeColor = "bg-red-600" }: {
  label: string; icon: string; active: boolean; onClick: () => void; badge?: number; badgeColor?: string;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-col items-center gap-0.5 rounded-xl py-2 transition-all duration-200 ${active ? "bg-red-900/40 text-white" : "text-slate-600 hover:text-slate-400"}`}>
      <Icon3D icon={icon} className="h-8 min-w-8 px-1 text-[10px]" />
      <span className="text-[11px] font-bold">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`absolute right-3 top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${badgeColor} text-[9px] font-black text-white shadow`}>{badge > 9 ? "9+" : badge}</span>
      )}
      {active && <span className="absolute -top-0.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gradient-to-r from-red-500 to-white" />}
    </button>
  );
}