import { CSSProperties } from "react";

type AnimType = "bounce" | "pulse" | "float" | "glow" | "shake" | "spin" | "none";

interface Icon8BitProps {
  name: string;
  size?: number;
  anim?: AnimType;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

// ===== پیکسل‌های ۸ بیتی با SVG =====
// هر آیکون یه تابع هست که SVG string برمیگردونه

const PIXEL = (x: number, y: number, color: string, s = 1) =>
  `<rect x='${x * s}' y='${y * s}' width='${s}' height='${s}' fill='${color}'/>`;

function buildSvg(size: number, pixels: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}' shape-rendering='crispEdges'>${pixels}</svg>`
  )}`;
}

// ===== رنگ‌های ثابت =====
const C = {
  red: "#dc2626",
  darkRed: "#991b1b",
  deepRed: "#7f1d1d",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#fbbf24",
  gold: "#d4a017",
  white: "#ffffff",
  lightGray: "#d1d5db",
  gray: "#6b7280",
  darkGray: "#374151",
  black: "#000000",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  lightCyan: "#67e8f9",
  purple: "#a855f7",
  pink: "#ec4899",
  green: "#22c55e",
  emerald: "#10b981",
  brown: "#92400e",
  steel: "#64748b",
  crimson: "#be123c",
};

// ===== آیکون‌ها =====
const ICONS: Record<string, () => string> = {

  // ========== نبرد ==========
  sword: () => {
    const p: string[] = [];
    // تیغه
    [[7,1],[6,2],[5,3],[4,4],[3,5]].forEach(([x,y]) => { p.push(PIXEL(x,y,C.white,2)); p.push(PIXEL(x+1,y+1,C.lightGray,2)); });
    // دسته
    [[2,6],[1,7],[0,8]].forEach(([x,y]) => { p.push(PIXEL(x,y,C.brown,2)); });
    // محافظ دسته
    [[1,5],[3,7]].forEach(([x,y]) => { p.push(PIXEL(x,y,C.gold,2)); });
    // درخشش
    p.push(PIXEL(8,0,C.yellow,2));
    return buildSvg(20, p.join(""));
  },

  shield: () => {
    const p: string[] = [];
    // فریم
    for (let x = 2; x <= 6; x++) p.push(PIXEL(x, 0, C.darkGray, 2));
    for (let y = 0; y <= 7; y++) { p.push(PIXEL(1, y, C.darkGray, 2)); p.push(PIXEL(7, y, C.darkGray, 2)); }
    for (let x = 2; x <= 6; x++) p.push(PIXEL(x, 8, C.darkGray, 2));
    p.push(PIXEL(4, 9, C.darkGray, 2));
    // بدنه
    for (let y = 1; y <= 7; y++) for (let x = 2; x <= 6; x++) p.push(PIXEL(x, y, C.darkRed, 2));
    // نشان مرکز
    [[4,2],[3,3],[4,3],[5,3],[4,4],[4,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    return buildSvg(20, p.join(""));
  },

  heart: () => {
    const p: string[] = [];
    const shape = [
      [1,0],[2,0],[4,0],[5,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
      [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],
      [1,3],[2,3],[3,3],[4,3],[5,3],
      [2,4],[3,4],[4,4],
      [3,5],
    ];
    shape.forEach(([x,y]) => p.push(PIXEL(x, y, C.red, 2)));
    // هایلایت
    [[1,1],[2,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.pink,2)));
    return buildSvg(14, p.join(""));
  },

  skull: () => {
    const p: string[] = [];
    // جمجمه
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 0, C.white, 2));
    for (let y = 1; y <= 3; y++) { for (let x = 1; x <= 6; x++) p.push(PIXEL(x, y, C.white, 2)); }
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 4, C.white, 2));
    // چشم‌ها
    [[2,2],[5,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.black,2)));
    [[3,2],[4,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    // دماغ
    p.push(PIXEL(3, 3, C.darkGray, 2)); p.push(PIXEL(4, 3, C.darkGray, 2));
    // دندان‌ها
    [[2,4],[3,4],[4,4],[5,4]].forEach(([x,y],i) => p.push(PIXEL(x,y, i%2===0 ? C.white : C.darkGray, 2)));
    // فک
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 5, C.lightGray, 2));
    return buildSvg(16, p.join(""));
  },

  crown: () => {
    const p: string[] = [];
    // نقاط بالا
    [[1,0],[4,0],[7,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    [[1,1],[4,1],[7,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    // بدنه
    for (let y = 2; y <= 4; y++) for (let x = 0; x <= 8; x++) p.push(PIXEL(x, y, C.gold, 2));
    // جواهرات
    [[2,3],[4,3],[6,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // هایلایت
    for (let x = 0; x <= 8; x++) p.push(PIXEL(x, 2, C.yellow, 2));
    return buildSvg(18, p.join(""));
  },

  star: () => {
    const p: string[] = [];
    const shape = [
      [3,0],[3,1],[2,2],[3,2],[4,2],
      [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],
      [1,4],[2,4],[4,4],[5,4],
      [1,5],[5,5],[0,6],[6,6],
    ];
    shape.forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    // مرکز درخشان
    p.push(PIXEL(3,3,C.white,2));
    return buildSvg(14, p.join(""));
  },

  trophy: () => {
    const p: string[] = [];
    // دسته‌ها
    [[0,1],[0,2],[0,3],[6,1],[6,2],[6,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    // بدنه جام
    for (let y = 0; y <= 3; y++) for (let x = 1; x <= 5; x++) p.push(PIXEL(x, y, C.gold, 2));
    for (let x = 2; x <= 4; x++) p.push(PIXEL(x, 4, C.gold, 2));
    // پایه
    p.push(PIXEL(3, 5, C.gold, 2));
    for (let x = 2; x <= 4; x++) p.push(PIXEL(x, 6, C.brown, 2));
    // هایلایت
    [[2,1],[3,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    // ستاره مرکز
    p.push(PIXEL(3, 2, C.white, 2));
    return buildSvg(14, p.join(""));
  },

  // ========== عناصر ==========
  fire: () => {
    const p: string[] = [];
    // شعله بیرونی
    [[3,0],[2,1],[4,1],[1,2],[3,2],[5,2],[1,3],[2,3],[3,3],[4,3],[5,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5],[3,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // شعله داخلی
    [[3,1],[2,2],[4,2],[2,3],[3,3],[4,3],[3,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.orange,2)));
    // مرکز
    [[3,2],[3,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    return buildSvg(14, p.join(""));
  },

  ice: () => {
    const p: string[] = [];
    // ستاره یخ
    [[3,0],[3,1],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[3,5],[3,6],[1,1],[5,1],[1,5],[5,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.cyan,2)));
    // مرکز
    [[3,2],[2,3],[4,3],[3,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    p.push(PIXEL(3,3,C.lightCyan,2));
    return buildSvg(14, p.join(""));
  },

  thunder: () => {
    const p: string[] = [];
    [[3,0],[4,0],[2,1],[3,1],[1,2],[2,2],[3,2],[4,2],[5,2],[3,3],[4,3],[2,4],[3,4],[1,5],[2,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    // هایلایت
    [[3,1],[2,2],[3,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    return buildSvg(14, p.join(""));
  },

  nature: () => {
    const p: string[] = [];
    // برگ
    [[3,0],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[4,2],[5,2],[2,3],[3,3],[4,3],[3,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.green,2)));
    // رگبرگ
    [[3,1],[3,2],[3,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.emerald,2)));
    // ساقه
    [[3,5],[3,6],[2,7]].forEach(([x,y]) => p.push(PIXEL(x,y,C.brown,2)));
    return buildSvg(14, p.join(""));
  },

  shadow: () => {
    const p: string[] = [];
    // سایه دایره‌ای
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) p.push(PIXEL(x, y, C.deepRed, 2));
    // حاشیه
    for (let x = 2; x <= 4; x++) { p.push(PIXEL(x, 0, C.darkRed, 2)); p.push(PIXEL(x, 6, C.darkRed, 2)); }
    for (let y = 2; y <= 4; y++) { p.push(PIXEL(0, y, C.darkRed, 2)); p.push(PIXEL(6, y, C.darkRed, 2)); }
    // چشم‌ها
    [[2,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    p.push(PIXEL(3,3,C.black,2));
    return buildSvg(14, p.join(""));
  },

  blood: () => {
    const p: string[] = [];
    // قطره خون
    [[3,0],[2,1],[4,1],[1,2],[2,2],[3,2],[4,2],[5,2],[1,3],[2,3],[3,3],[4,3],[5,3],[1,4],[2,4],[3,4],[4,4],[5,4],[2,5],[3,5],[4,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // هایلایت
    [[2,2],[2,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.crimson,2)));
    p.push(PIXEL(4,2,C.pink,2));
    return buildSvg(14, p.join(""));
  },

  // ========== UI ==========
  gem: () => {
    const p: string[] = [];
    // بالا
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 0, C.cyan, 2));
    // بدنه
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 1, C.blue, 2));
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 2, C.cyan, 2));
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 3, C.blue, 2));
    for (let x = 3; x <= 4; x++) p.push(PIXEL(x, 4, C.blue, 2));
    // هایلایت
    [[2,1],[3,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.lightCyan,2)));
    p.push(PIXEL(2, 2, C.white, 2));
    return buildSvg(16, p.join(""));
  },

  diamond: () => {
    const p: string[] = [];
    // الماس
    for (let x = 3; x <= 4; x++) p.push(PIXEL(x, 0, C.amber, 2));
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 1, C.amber, 2));
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 2, C.gold, 2));
    for (let x = 2; x <= 5; x++) p.push(PIXEL(x, 3, C.amber, 2));
    for (let x = 3; x <= 4; x++) p.push(PIXEL(x, 4, C.gold, 2));
    // هایلایت
    [[2,1],[3,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    p.push(PIXEL(3, 2, C.white, 2));
    return buildSvg(16, p.join(""));
  },

  chest: () => {
    const p: string[] = [];
    // بدنه
    for (let y = 2; y <= 6; y++) for (let x = 0; x <= 7; x++) p.push(PIXEL(x, y, C.brown, 2));
    // درب
    for (let x = 0; x <= 7; x++) p.push(PIXEL(x, 0, C.brown, 2));
    for (let x = 0; x <= 7; x++) p.push(PIXEL(x, 1, C.brown, 2));
    // قفل
    [[3,3],[4,3],[3,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    // لبه‌ها
    for (let y = 0; y <= 6; y++) { p.push(PIXEL(0, y, C.darkGray, 2)); p.push(PIXEL(7, y, C.darkGray, 2)); }
    // هایلایت
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 0, "#a0522d", 2));
    return buildSvg(16, p.join(""));
  },

  gear: () => {
    const p: string[] = [];
    // دندانه‌ها
    [[3,0],[0,3],[6,3],[3,6],[1,1],[5,1],[1,5],[5,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.steel,2)));
    // بدنه
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
      const dx = Math.abs(x - 3), dy = Math.abs(y - 3);
      if (dx + dy <= 3) p.push(PIXEL(x, y, C.steel, 2));
    }
    // مرکز
    [[2,2],[3,2],[4,2],[2,3],[4,3],[2,4],[3,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.darkGray,2)));
    p.push(PIXEL(3, 3, C.gray, 2));
    return buildSvg(14, p.join(""));
  },

  lock: () => {
    const p: string[] = [];
    // حلقه بالا
    [[2,0],[3,0],[4,0],[1,1],[5,1],[1,2],[5,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gray,2)));
    // بدنه
    for (let y = 3; y <= 6; y++) for (let x = 1; x <= 5; x++) p.push(PIXEL(x, y, C.gold, 2));
    // سوراخ کلید
    [[3,4],[3,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.black,2)));
    return buildSvg(14, p.join(""));
  },

  check: () => {
    const p: string[] = [];
    [[5,0],[4,1],[5,1],[3,2],[4,2],[0,3],[2,3],[3,3],[0,4],[1,4],[2,4],[1,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.emerald,2)));
    return buildSvg(14, p.join(""));
  },

  cross: () => {
    const p: string[] = [];
    [[0,0],[5,0],[1,1],[4,1],[2,2],[3,2],[2,3],[3,3],[1,4],[4,4],[0,5],[5,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    return buildSvg(14, p.join(""));
  },
    // ========== مأموریت و پاداش ==========
  target: () => {
    const p: string[] = [];
    // دایره بیرونی
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 0, C.red, 2)); p.push(PIXEL(x, 7, C.red, 2)); }
    for (let y = 2; y <= 5; y++) { p.push(PIXEL(0, y, C.red, 2)); p.push(PIXEL(7, y, C.red, 2)); }
    [[1,1],[6,1],[1,6],[6,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // دایره وسط
    for (let x = 3; x <= 4; x++) for (let y = 2; y <= 5; y++) p.push(PIXEL(x, y, C.white, 2));
    for (let y = 3; y <= 4; y++) for (let x = 2; x <= 5; x++) p.push(PIXEL(x, y, C.white, 2));
    // مرکز قرمز
    [[3,3],[4,3],[3,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    return buildSvg(16, p.join(""));
  },

  medal: () => {
    const p: string[] = [];
    // ریبون
    [[1,0],[2,0],[5,0],[6,0],[2,1],[3,1],[4,1],[5,1],[3,2],[4,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // مدال
    for (let x = 2; x <= 5; x++) for (let y = 3; y <= 6; y++) p.push(PIXEL(x, y, C.gold, 2));
    [[1,4],[1,5],[6,4],[6,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    // ستاره مرکز
    [[3,4],[4,4],[3,5],[4,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    return buildSvg(16, p.join(""));
  },

  scroll: () => {
    const p: string[] = [];
    // لوله بالا
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 0, C.brown, 2));
    // بدنه
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 6; x++) p.push(PIXEL(x, y, C.yellow, 2));
    // لوله پایین
    for (let x = 1; x <= 6; x++) p.push(PIXEL(x, 7, C.brown, 2));
    // متن (خطوط)
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 2, C.darkGray, 2)); p.push(PIXEL(x, 4, C.darkGray, 2)); }
    for (let x = 2; x <= 4; x++) p.push(PIXEL(x, 6, C.darkGray, 2));
    return buildSvg(16, p.join(""));
  },

  potion: () => {
    const p: string[] = [];
    // درب
    [[3,0],[4,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.brown,2)));
    // گردن
    [[3,1],[4,1],[3,2],[4,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.lightGray,2)));
    // بدنه
    for (let y = 3; y <= 6; y++) for (let x = 1; x <= 6; x++) p.push(PIXEL(x, y, C.lightGray, 2));
    // مایع
    for (let y = 4; y <= 6; y++) for (let x = 2; x <= 5; x++) p.push(PIXEL(x, y, C.red, 2));
    // هایلایت
    p.push(PIXEL(2, 4, C.pink, 2));
    return buildSvg(16, p.join(""));
  },

  // ========== رنک ==========
  rank_bronze: () => {
    const p: string[] = [];
    for (let x = 2; x <= 5; x++) for (let y = 1; y <= 5; y++) p.push(PIXEL(x, y, "#cd7f32", 2));
    [[1,2],[1,3],[1,4],[6,2],[6,3],[6,4]].forEach(([x,y]) => p.push(PIXEL(x,y,"#cd7f32",2)));
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 0, "#a0522d", 2)); p.push(PIXEL(x, 6, "#a0522d", 2)); }
    [[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,"#daa520",2)));
    return buildSvg(16, p.join(""));
  },

  rank_silver: () => {
    const p: string[] = [];
    for (let x = 2; x <= 5; x++) for (let y = 1; y <= 5; y++) p.push(PIXEL(x, y, C.lightGray, 2));
    [[1,2],[1,3],[1,4],[6,2],[6,3],[6,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.lightGray,2)));
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 0, C.gray, 2)); p.push(PIXEL(x, 6, C.gray, 2)); }
    [[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    return buildSvg(16, p.join(""));
  },

  rank_gold: () => {
    const p: string[] = [];
    for (let x = 2; x <= 5; x++) for (let y = 1; y <= 5; y++) p.push(PIXEL(x, y, C.gold, 2));
    [[1,2],[1,3],[1,4],[6,2],[6,3],[6,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 0, C.amber, 2)); p.push(PIXEL(x, 6, C.amber, 2)); }
    [[3,2],[4,2],[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    return buildSvg(16, p.join(""));
  },

  rank_platinum: () => {
    const p: string[] = [];
    for (let x = 2; x <= 5; x++) for (let y = 1; y <= 5; y++) p.push(PIXEL(x, y, C.cyan, 2));
    [[1,2],[1,3],[1,4],[6,2],[6,3],[6,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.cyan,2)));
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 0, C.blue, 2)); p.push(PIXEL(x, 6, C.blue, 2)); }
    [[3,2],[4,2],[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    return buildSvg(16, p.join(""));
  },

  rank_diamond: () => {
    const p: string[] = [];
    // الماس شکل
    [[3,0],[4,0],[2,1],[3,1],[4,1],[5,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[2,3],[3,3],[4,3],[5,3],[3,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.lightCyan,2)));
    [[3,1],[4,1],[3,2],[4,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    return buildSvg(16, p.join(""));
  },

  rank_legendary: () => {
    const p: string[] = [];
    // تاج طلایی بزرگ
    [[0,0],[3,0],[6,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    [[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    for (let y = 2; y <= 4; y++) for (let x = 0; x <= 6; x++) p.push(PIXEL(x, y, C.gold, 2));
    [[1,3],[3,3],[5,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    for (let x = 0; x <= 6; x++) p.push(PIXEL(x, 2, C.yellow, 2));
    return buildSvg(14, p.join(""));
  },

  rank_mythic: () => {
    const p: string[] = [];
    // نماد اسطوره‌ای
    [[3,0],[2,1],[4,1],[1,2],[3,2],[5,2],[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    [[3,4],[2,5],[4,5],[1,6],[5,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // مرکز درخشان
    [[3,2],[3,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    [[2,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    return buildSvg(14, p.join(""));
  },

  // ========== اضافی ==========
  cart: () => {
    const p: string[] = [];
    // بدنه
    for (let x = 1; x <= 6; x++) for (let y = 1; y <= 4; y++) p.push(PIXEL(x, y, C.steel, 2));
    // دسته
    [[0,0],[0,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gray,2)));
    // چرخ‌ها
    [[2,5],[5,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.darkGray,2)));
    // محصول داخل
    [[2,2],[3,2],[4,2],[5,2],[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.amber,2)));
    return buildSvg(16, p.join(""));
  },

  cards: () => {
    const p: string[] = [];
    // کارت عقب
    for (let x = 2; x <= 6; x++) for (let y = 0; y <= 6; y++) p.push(PIXEL(x, y, C.darkRed, 2));
    // کارت جلو
    for (let x = 0; x <= 4; x++) for (let y = 1; y <= 7; y++) p.push(PIXEL(x, y, C.red, 2));
    // حاشیه
    for (let x = 0; x <= 4; x++) { p.push(PIXEL(x, 1, C.crimson, 2)); p.push(PIXEL(x, 7, C.crimson, 2)); }
    for (let y = 1; y <= 7; y++) { p.push(PIXEL(0, y, C.crimson, 2)); p.push(PIXEL(4, y, C.crimson, 2)); }
    // نماد مرکز
    [[2,3],[1,4],[2,4],[3,4],[2,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    return buildSvg(16, p.join(""));
  },

  infinity: () => {
    const p: string[] = [];
    [[1,1],[2,0],[3,1],[4,2],[5,1],[6,0],[7,1],[1,2],[3,2],[5,2],[7,2],[2,3],[6,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.purple,2)));
    // هایلایت
    [[2,0],[6,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.pink,2)));
    return buildSvg(16, p.join(""));
  },

  quest: () => {
    const p: string[] = [];
    // کلیپ‌بورد
    [[2,0],[3,0],[4,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gray,2)));
    for (let y = 1; y <= 7; y++) for (let x = 0; x <= 6; x++) p.push(PIXEL(x, y, C.amber, 2));
    for (let y = 1; y <= 7; y++) { p.push(PIXEL(0, y, C.brown, 2)); p.push(PIXEL(6, y, C.brown, 2)); }
    p.push(PIXEL(0, 1, C.brown, 2)); p.push(PIXEL(6, 1, C.brown, 2));
    // خطوط لیست
    for (let x = 2; x <= 5; x++) { p.push(PIXEL(x, 3, C.darkGray, 2)); p.push(PIXEL(x, 5, C.darkGray, 2)); }
    // تیک‌ها
    p.push(PIXEL(1, 3, C.emerald, 2)); p.push(PIXEL(1, 5, C.emerald, 2));
    return buildSvg(14, p.join(""));
  },

  spin: () => {
    const p: string[] = [];
    // چرخ
    for (let x = 1; x <= 5; x++) { p.push(PIXEL(x, 0, C.gold, 2)); p.push(PIXEL(x, 6, C.gold, 2)); }
    for (let y = 1; y <= 5; y++) { p.push(PIXEL(0, y, C.gold, 2)); p.push(PIXEL(6, y, C.gold, 2)); }
    // بخش‌ها
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 5; x++) {
      const isRed = (x + y) % 2 === 0;
      p.push(PIXEL(x, y, isRed ? C.red : C.darkRed, 2));
    }
    // مرکز
    p.push(PIXEL(3, 3, C.gold, 2));
    // فلش بالا
    p.push(PIXEL(3, -1, C.white, 2));
    return buildSvg(14, p.join(""));
  },

  boost: () => {
    const p: string[] = [];
    // فلش بالا
    [[3,0],[2,1],[3,1],[4,1],[1,2],[2,2],[3,2],[4,2],[5,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.orange,2)));
    // بدنه
    [[3,3],[3,4],[3,5],[3,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    [[2,3],[4,3],[2,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.orange,2)));
    // درخشش
    p.push(PIXEL(3, 0, C.yellow, 2));
    return buildSvg(14, p.join(""));
  },

  arrow_left: () => {
    const p: string[] = [];
    [[4,0],[3,1],[2,2],[1,3],[0,3],[2,4],[3,5],[4,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    for (let x = 1; x <= 5; x++) p.push(PIXEL(x, 3, C.white, 2));
    return buildSvg(12, p.join(""));
  },

  male: () => {
    const p: string[] = [];
    // دایره
    for (let x = 1; x <= 3; x++) for (let y = 2; y <= 4; y++) p.push(PIXEL(x, y, C.blue, 2));
    [[0,3],[4,3],[2,1],[2,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.blue,2)));
    // فلش
    [[4,0],[5,0],[5,1],[4,1],[3,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.blue,2)));
    return buildSvg(12, p.join(""));
  },

  female: () => {
    const p: string[] = [];
    // دایره
    for (let x = 1; x <= 3; x++) for (let y = 0; y <= 2; y++) p.push(PIXEL(x, y, C.pink, 2));
    [[0,1],[4,1]].forEach(([x,y]) => p.push(PIXEL(x,y,C.pink,2)));
    // صلیب
    [[2,3],[2,4],[2,5],[1,4],[3,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.pink,2)));
    return buildSvg(12, p.join(""));
  },

  boss: () => {
    const p: string[] = [];
    // جمجمه بزرگ‌تر با تاج
    [[2,0],[3,0],[4,0]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 4; y++) p.push(PIXEL(x, y, C.white, 2));
    [[0,2],[0,3],[6,2],[6,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    // چشم‌ها
    [[2,2],[4,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // دندان
    [[2,4],[3,4],[4,4]].forEach(([x,y],i) => p.push(PIXEL(x,y, i%2===0 ? C.white : C.darkGray,2)));
    // فک
    for (let x = 2; x <= 4; x++) p.push(PIXEL(x, 5, C.lightGray, 2));
    return buildSvg(14, p.join(""));
  },

  damage: () => {
    const p: string[] = [];
    // انفجار
    [[3,0],[1,1],[3,1],[5,1],[0,2],[2,2],[4,2],[6,2],[1,3],[3,3],[5,3],[0,4],[2,4],[4,4],[6,4],[1,5],[3,5],[5,5],[3,6]].forEach(([x,y]) => p.push(PIXEL(x,y,C.orange,2)));
    // مرکز
    [[2,2],[3,2],[4,2],[2,3],[3,3],[4,3],[2,4],[3,4],[4,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.yellow,2)));
    p.push(PIXEL(3, 3, C.white, 2));
    return buildSvg(14, p.join(""));
  },

  wave: () => {
    const p: string[] = [];
    [[0,2],[1,1],[2,0],[3,1],[4,2],[5,1],[6,0],[7,1],[0,4],[1,3],[2,2],[3,3],[4,4],[5,3],[6,2],[7,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.purple,2)));
    return buildSvg(16, p.join(""));
  },

  hp: () => {
    const p: string[] = [];
    // H
    [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,0],[2,1],[2,2],[2,3],[2,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    // P
    [[4,0],[4,1],[4,2],[4,3],[4,4],[5,0],[6,0],[6,1],[5,2]].forEach(([x,y]) => p.push(PIXEL(x,y,C.red,2)));
    return buildSvg(14, p.join(""));
  },

  atk: () => {
    const p: string[] = [];
    // شمشیر ساده
    [[3,0],[3,1],[3,2],[3,3],[3,4],[2,5],[4,5],[1,4],[5,4]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
    p.push(PIXEL(3, 0, C.yellow, 2));
    [[2,5],[4,5]].forEach(([x,y]) => p.push(PIXEL(x,y,C.brown,2)));
    return buildSvg(14, p.join(""));
  },

  def: () => {
    const p: string[] = [];
    // سپر کوچک
    for (let x = 1; x <= 5; x++) p.push(PIXEL(x, 0, C.steel, 2));
    for (let y = 1; y <= 4; y++) for (let x = 0; x <= 6; x++) p.push(PIXEL(x, y, C.steel, 2));
    for (let x = 1; x <= 5; x++) p.push(PIXEL(x, 5, C.steel, 2));
    p.push(PIXEL(3, 6, C.steel, 2));
    [[3,2],[2,3],[3,3],[4,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.gold,2)));
    return buildSvg(14, p.join(""));
  },
};

// ========== Fallback ==========
const fallbackIcon = () => {
  const p: string[] = [];
  for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) p.push(PIXEL(x, y, C.gray, 2));
  [[3,2],[3,3]].forEach(([x,y]) => p.push(PIXEL(x,y,C.white,2)));
  p.push(PIXEL(3, 5, C.white, 2));
  return buildSvg(14, p.join(""));
};

// ========== کش ==========
const iconCache: Record<string, string> = {};

function getIconSrc(name: string): string {
  if (iconCache[name]) return iconCache[name];
  const fn = ICONS[name];
  const src = fn ? fn() : fallbackIcon();
  iconCache[name] = src;
  return src;
}

// ========== انیمیشن CSS ==========
const ANIM_STYLES: Record<AnimType, string> = {
  bounce: "icon8bit-bounce",
  pulse: "icon8bit-pulse",
  float: "icon8bit-float",
  glow: "icon8bit-glow",
  shake: "icon8bit-shake",
  spin: "icon8bit-spin",
  none: "",
};

// ========== کامپوننت اصلی ==========
export default function Icon8Bit({ name, size = 24, anim = "none", className = "", style, onClick }: Icon8BitProps) {
  const src = getIconSrc(name);
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onClick={onClick}
      className={`inline-block ${ANIM_STYLES[anim]} ${onClick ? "cursor-pointer active:scale-90" : ""} ${className}`}
      style={{ imageRendering: "pixelated", ...style }}
      draggable={false}
    />
  );
}

// ========== هلپر: لیست همه آیکون‌ها ==========
export function getAllIconNames(): string[] {
  return Object.keys(ICONS);
}

// ========== ایموجی به آیکون مپینگ ==========
export const EMOJI_TO_ICON: Record<string, string> = {
  "⚔️": "sword",
  "🛡️": "shield",
  "❤️": "heart",
  "💀": "skull",
  "👑": "crown",
  "⭐": "star",
  "🏆": "trophy",
  "🔥": "fire",
  "❄️": "ice",
  "⚡": "thunder",
  "🌿": "nature",
  "🗡️": "sword",
  "👹": "shadow",
  "🩸": "blood",
  "💎": "gem",
  "💠": "rank_platinum",
  "📦": "chest",
  "⚙️": "gear",
  "🔒": "lock",
  "✅": "check",
  "❌": "cross",
  "🎯": "target",
  "🥇": "rank_gold",
  "🥈": "rank_silver",
  "🥉": "rank_bronze",
  "🛒": "cart",
  "🎴": "cards",
  "♾️": "infinity",
  "📋": "quest",
  "🎰": "spin",
  "🎁": "chest",
  "✨": "star",
  "💥": "damage",
  "💔": "heart",
  "🔄": "spin",
  "⚜️": "medal",
  "🗺️": "scroll",
  "📊": "boost",
  "←": "arrow_left",
  "✓": "check",
  "✕": "cross",
  "⏳": "gear",
  "💳": "gem",
  "🔐": "lock",
  "⚖️": "target",
  "⬆️": "boost",
  "🦅": "fire",
  "💎💎": "gem",
  "💎💎💎": "gem",
  "⭐⭐": "star",
  "⭐⭐⭐": "star",
};