import { BOARD, CARDS } from "./data";
import type { GameState } from "./types";
const KEY = "city-circuit-save-v1";
const integer = (
  n: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object";
const ids = CARDS.map((c) => c.id);
export function validSave(v: unknown): v is GameState {
  if (
    !object(v) ||
    v.version !== 1 ||
    !Array.isArray(v.players) ||
    v.players.length < 4 ||
    v.players.length > 6 ||
    !Array.isArray(v.estates) ||
    v.estates.length !== BOARD.length
  )
    return false;
  const count = v.players.length;
  if (
    !v.players.every(
      (p, i) =>
        object(p) &&
        p.id === i &&
        typeof p.name === "string" &&
        p.name.length <= 12 &&
        /^#[\da-f]{6}$/i.test(String(p.color)) &&
        typeof p.human === "boolean" &&
        p.human === (i === 0) &&
        ["easy", "medium", "hard"].includes(String(p.difficulty)) &&
        integer(p.cash) &&
        integer(p.position, 0, 31) &&
        typeof p.bankrupt === "boolean" &&
        integer(p.jail, 0, 4) &&
        integer(p.laps) &&
        typeof p.shield === "boolean" &&
        Array.isArray(p.cards) &&
        p.cards.length <= 6 &&
        p.cards.every((c) => ids.includes(c)),
    )
  )
    return false;
  if (
    !v.estates.every(
      (e, i) =>
        object(e) &&
        (e.owner === null || integer(e.owner, 0, count - 1)) &&
        integer(e.level, 0, BOARD[i].group ? 5 : 0) &&
        typeof e.mortgaged === "boolean" &&
        integer(e.boost, 0, 2) &&
        (BOARD[i].price || (e.owner === null && !e.level && !e.mortgaged)),
    )
  )
    return false;
  if (
    !integer(v.current, 0, count - 1) ||
    !integer(v.seed, 1, 4294967295) ||
    !integer(v.round, 1) ||
    !integer(v.maxRounds, 0, 100) ||
    !integer(v.fund) ||
    !integer(v.logSerial) ||
    !integer(v.movementSerial) ||
    !integer(v.doubles, 0, 3) ||
    !integer(v.usedCards, 0, 2) ||
    typeof v.extraTurn !== "boolean" ||
    typeof v.endReason !== "string"
  )
    return false;
  if (
    ![
      "roll",
      "purchase",
      "rent",
      "market",
      "auction",
      "debt",
      "end",
      "gameover",
    ].includes(String(v.phase)) ||
    !Array.isArray(v.dice) ||
    v.dice.length !== 2 ||
    !v.dice.every((d) => integer(d, 1, 6))
  )
    return false;
  if (
    !Array.isArray(v.logs) ||
    !v.logs.every(
      (l) =>
        object(l) &&
        integer(l.id) &&
        typeof l.text === "string" &&
        ["info", "money", "card", "bad"].includes(String(l.kind)),
    )
  )
    return false;
  if (
    v.rent !== null &&
    (!object(v.rent) ||
      !integer(v.rent.amount) ||
      !integer(v.rent.owner, 0, count - 1) ||
      !integer(v.rent.tile, 0, 31))
  )
    return false;
  if (
    v.debt !== null &&
    (!object(v.debt) ||
      !integer(v.debt.amount) ||
      (v.debt.creditor !== null && !integer(v.debt.creditor, 0, count - 1)) ||
      typeof v.debt.reason !== "string" ||
      typeof v.debt.fund !== "boolean" ||
      !["end", "jailRoll", "jailMove"].includes(String(v.debt.next)))
  )
    return false;
  if (
    v.auction !== null &&
    (!object(v.auction) ||
      !integer(v.auction.tile, 0, 31) ||
      !BOARD[v.auction.tile].price ||
      !integer(v.auction.bid) ||
      (v.auction.leader !== null && !integer(v.auction.leader, 0, count - 1)) ||
      !integer(v.auction.bidder, 0, count - 1) ||
      !Array.isArray(v.auction.active) ||
      !v.auction.active.every((id) => integer(id, 0, count - 1)) ||
      !v.auction.active.includes(v.auction.bidder))
  )
    return false;
  if (
    v.movement !== null &&
    (!object(v.movement) ||
      !integer(v.movement.id) ||
      !integer(v.movement.player, 0, count - 1) ||
      !integer(v.movement.from, 0, 31) ||
      !integer(v.movement.to, 0, 31) ||
      !integer(v.movement.steps, 0, 12) ||
      typeof v.movement.teleport !== "boolean")
  )
    return false;
  if (
    !Array.isArray(v.market) ||
    v.market.length > 3 ||
    !v.market.every((c) => ids.includes(c))
  )
    return false;
  if (v.winner !== null && !integer(v.winner, 0, count - 1)) return false;
  if (
    (v.phase === "rent" && !v.rent) ||
    (v.phase === "debt" && !v.debt) ||
    (v.phase === "auction" && !v.auction) ||
    (v.phase === "gameover" && v.winner === null)
  )
    return false;
  // Validate relationships as well as field types so a damaged save cannot
  // resume into an endless turn or an auction with no eligible bidder.
  const s = v as unknown as GameState;
  const alive = s.players.filter((p) => !p.bankrupt);
  if (!alive.length || (s.phase !== "gameover" && alive.length < 2))
    return false;
  if (s.players[s.current].bankrupt && !["end", "gameover"].includes(s.phase))
    return false;
  if (s.players.some((p) => p.jail > 0 && p.position !== 8)) return false;
  if (
    s.estates.some(
      (e) =>
        (e.owner !== null && s.players[e.owner].bankrupt) ||
        (e.owner === null && (e.level > 0 || e.mortgaged || e.boost > 0)) ||
        (e.mortgaged && e.level > 0),
    )
  )
    return false;
  if (
    s.phase === "purchase" &&
    (!BOARD[s.players[s.current].position].price ||
      s.estates[s.players[s.current].position].owner !== null)
  )
    return false;
  if (
    s.rent &&
    (s.rent.owner === s.current ||
      s.players[s.rent.owner].bankrupt ||
      s.estates[s.rent.tile].owner !== s.rent.owner ||
      s.rent.tile !== s.players[s.current].position)
  )
    return false;
  if (
    s.debt?.creditor !== null &&
    s.debt?.creditor !== undefined &&
    (s.debt.creditor === s.current || s.players[s.debt.creditor].bankrupt)
  )
    return false;
  if (
    s.auction &&
    (new Set(s.auction.active).size !== s.auction.active.length ||
      s.auction.active.some((id) => s.players[id].bankrupt) ||
      s.auction.leader === s.auction.bidder ||
      (s.auction.leader !== null &&
        !s.auction.active.includes(s.auction.leader)) ||
      s.estates[s.auction.tile].owner !== null)
  )
    return false;
  if (
    new Set(s.market).size !== s.market.length ||
    (s.phase === "market" && s.market.length !== 3)
  )
    return false;
  if (s.phase === "gameover" && s.players[s.winner!].bankrupt) return false;
  return true;
}
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return validSave(v) ? v : null;
  } catch {
    return null;
  }
}
export function saveGame(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
