import { BOARD, GROUPS, type CardId } from "./data";
import {
  acceptsTrade,
  canBuild,
  canMortgage,
  canSellBuilding,
  canUseCard,
  cardTargets,
  currentPlayer,
  hasGroup,
  minBid,
  netWorth,
  ownedTiles,
  redemptionCost,
  rentFor,
  tradeValue,
} from "./engine";
import type { Action, GameState } from "./types";

function reserve(s: GameState): number {
  const p = currentPlayer(s);
  if (p.difficulty === "easy") return 60;
  if (p.difficulty === "medium") return 200;
  const threats = BOARD.filter(
    (t) => s.estates[t.id].owner !== null && s.estates[t.id].owner !== p.id,
  ).map((t) => rentFor(s, t.id, 7));
  return Math.min(
    650,
    Math.max(180, Math.round(Math.max(0, ...threats) * 0.4)),
  );
}
function tileScore(s: GameState, tile: number): number {
  const p = currentPlayer(s),
    t = BOARD[tile],
    e = s.estates[tile];
  if (e.owner !== null && e.owner !== p.id && !e.mortgaged)
    return (
      -rentFor(s, tile, 7) *
      (p.cards.includes("freeRent") ? 0.25 : p.shield ? 0.5 : 1)
    );
  if (t.price && e.owner === null && p.cash > t.price + 50) {
    const match =
      t.group &&
      BOARD.some(
        (x) =>
          x.group === t.group &&
          x.id !== tile &&
          s.estates[x.id].owner === p.id,
      );
    return match ? 250 : t.kind === "station" ? 90 : 60;
  }
  if (t.kind === "parking") return s.fund;
  if (t.kind === "goJail") return -120;
  if (t.kind === "tax") return -120;
  if (t.kind === "chance") return 20;
  if (t.kind === "market" && p.cards.length < 4) return 30;
  return 0;
}
function playCard(s: GameState): Action | null {
  const p = currentPlayer(s);
  if (p.difficulty === "easy" && s.seed % 4 !== 0) return null;
  const play = (card: CardId, target?: number): Action => ({
    type: "CARD",
    card,
    target,
  });
  if (canUseCard(s, "escape")) return play("escape");
  if (canUseCard(s, "grant")) return play("grant");
  if (canUseCard(s, "steal")) {
    const target = cardTargets(s, "steal").sort(
      (a, b) => s.players[b].cash - s.players[a].cash,
    )[0];
    return play("steal", target);
  }
  if (canUseCard(s, "demolish")) {
    const target = cardTargets(s, "demolish").sort(
      (a, b) => rentFor(s, b, 7) - rentFor(s, a, 7),
    )[0];
    return play("demolish", target);
  }
  if (canUseCard(s, "boost")) {
    const target = cardTargets(s, "boost").sort(
      (a, b) => rentFor(s, b, 7) - rentFor(s, a, 7),
    )[0];
    if (rentFor(s, target, 7) >= 40) return play("boost", target);
  }
  if (p.difficulty === "hard") {
    if (canUseCard(s, "remote")) {
      const best = cardTargets(s, "remote")
        .map((steps) => ({
          steps,
          score:
            tileScore(s, (p.position + steps) % 32) +
            (p.position + steps >= 32 ? 200 : 0),
        }))
        .sort((a, b) => b.score - a.score)[0];
      if (best.score >= 60) return play("remote", best.steps);
    }
    if (canUseCard(s, "portal")) {
      const best = cardTargets(s, "portal")
        .map((tile) => ({ tile, score: tileScore(s, tile) }))
        .sort((a, b) => b.score - a.score)[0];
      if (best.score >= 90) return play("portal", best.tile);
    }
  } else if (p.difficulty === "medium" && canUseCard(s, "shield"))
    return play("shield");
  return null;
}
function manage(s: GameState): Action | null {
  const p = currentPlayer(s),
    cashReserve = reserve(s);
  const redemption = ownedTiles(s, p.id).find(
    (t) =>
      s.estates[t.id].mortgaged &&
      p.cash > redemptionCost(t.id) + cashReserve + 100,
  );
  if (redemption && p.difficulty !== "easy")
    return { type: "REDEEM", tile: redemption.id };
  const build = ownedTiles(s, p.id).filter(
    (t) =>
      canBuild(s, p.id, t.id) &&
      p.cash >= GROUPS[t.group!].build + cashReserve &&
      s.estates[t.id].level <
        (p.difficulty === "easy" ? 1 : p.difficulty === "medium" ? 3 : 5),
  );
  build.sort(
    (a, b) =>
      b.price! / GROUPS[b.group!].build - a.price! / GROUPS[a.group!].build,
  );
  if (build.length) return { type: "BUILD", tile: build[0].id };
  if (p.difficulty !== "easy") {
    for (const t of BOARD.filter(
      (t) =>
        t.group &&
        s.estates[t.id].owner !== null &&
        s.estates[t.id].owner !== p.id,
    )) {
      const target = s.estates[t.id].owner!;
      if (
        s.players[target].human ||
        !BOARD.some(
          (x) => x.group === t.group && s.estates[x.id].owner === p.id,
        )
      )
        continue;
      const cash = Math.ceil(
        tradeValue(s, target, t.id) *
          (s.players[target].difficulty === "hard" ? 1.12 : 1),
      );
      if (
        p.cash > cash + cashReserve &&
        acceptsTrade(s, p.id, target, null, t.id, cash)
      )
        return { type: "TRADE", target, give: null, take: t.id, cash };
    }
  }
  return null;
}
export function aiAction(s: GameState): Action | null {
  if (s.phase === "gameover") return null;
  const p = currentPlayer(s);
  if (s.phase === "auction" && s.auction) {
    const bidder = s.players[s.auction.bidder],
      t = BOARD[s.auction.tile];
    const value =
      tradeValue(s, bidder.id, t.id) *
      (bidder.difficulty === "easy"
        ? 0.7
        : bidder.difficulty === "medium"
          ? 1
          : 1.1);
    const budget = bidder.cash - (bidder.difficulty === "easy" ? 50 : 150);
    return minBid(s) <= Math.min(value, budget)
      ? { type: "BID", amount: minBid(s) }
      : { type: "PASS_BID" };
  }
  if (s.phase === "debt") {
    if (p.cash >= s.debt!.amount) return { type: "SETTLE_DEBT" };
    const building = ownedTiles(s, p.id)
      .filter((t) => canSellBuilding(s, p.id, t.id))
      .sort((a, b) => rentFor(s, a.id) - rentFor(s, b.id))[0];
    if (building) return { type: "SELL_BUILDING", tile: building.id };
    const mortgage = ownedTiles(s, p.id)
      .filter((t) => canMortgage(s, p.id, t.id))
      .sort(
        (a, b) =>
          Number(!!a.group && hasGroup(s, p.id, a.group)) -
            Number(!!b.group && hasGroup(s, p.id, b.group)) ||
          a.price! - b.price!,
      )[0];
    if (mortgage) return { type: "MORTGAGE", tile: mortgage.id };
    return { type: "BANKRUPT" };
  }
  if (s.phase === "rent") {
    const amount = s.rent!.amount;
    if (
      canUseCard(s, "freeRent") &&
      (amount >= (p.difficulty === "hard" ? 100 : 40) || p.cash < amount)
    )
      return { type: "CARD", card: "freeRent" };
    if (canUseCard(s, "shield") && amount >= 40)
      return { type: "CARD", card: "shield" };
    return { type: "PAY_RENT" };
  }
  if (s.phase === "purchase") {
    const t = BOARD[p.position],
      important =
        t.group &&
        BOARD.some(
          (x) => x.group === t.group && s.estates[x.id].owner === p.id,
        );
    return p.cash >= t.price! + (important ? 50 : reserve(s))
      ? { type: "BUY" }
      : { type: "DECLINE" };
  }
  if (s.phase === "market") {
    const scores: Record<CardId, number> = {
      grant: 10,
      freeRent: 9,
      shield: 7,
      remote: 8,
      portal: 8,
      boost: 6,
      steal: 6,
      demolish: 5,
      escape: 4,
    };
    const card = [...s.market].sort((a, b) => scores[b] - scores[a])[0];
    return p.cards.length < 5 &&
      p.cash > reserve(s) + 180 &&
      p.difficulty !== "easy"
      ? { type: "BUY_CARD", card }
      : { type: "LEAVE_MARKET" };
  }
  if (s.phase === "roll" || s.phase === "end") {
    if (p.bankrupt) return { type: "END_TURN" };
    const card = playCard(s);
    if (card) return card;
    const management = manage(s);
    if (management) return management;
    if (s.phase === "end") return { type: "END_TURN" };
    if (
      p.jail &&
      p.cash > reserve(s) + 50 &&
      (s.round < 10 || ownedTiles(s, p.id).length < 3)
    )
      return { type: "BAIL" };
    return { type: "ROLL" };
  }
  return null;
}
export const ranking = (s: GameState) =>
  [...s.players].sort(
    (a, b) =>
      Number(a.bankrupt) - Number(b.bankrupt) ||
      netWorth(s, b.id) - netWorth(s, a.id),
  );
