// Secure code verification system
// Each card has a unique activation code
const VALID_CODES: Record<string, string> = {
  shadow_knight: "S1H4D7W9",
  fire_dragon: "F1R3D8N2",
  frost_mage: "F2R0S7T9",
  thunder_god: "T4H7N1D5",
  nature_guardian: "N8T2R7G3",
  void_assassin: "V01D4S9N",
  demon_lord: "D3M6N8L2",
  phoenix_king: "P5H0N1X7",
  crystal_golem: "C3R7Y2S8",
  blood_knight: "B4L0D9K2",
};

export function verifyCode(cardId: string, code: string): boolean {
  const validCode = VALID_CODES[cardId];
  if (!validCode) return false;
  return validCode === code.trim().toUpperCase();
}

export function getCardCode(cardId: string): string {
  return VALID_CODES[cardId] || "";
}

export function getAllCodes(): Record<string, string> {
  return { ...VALID_CODES };
}
