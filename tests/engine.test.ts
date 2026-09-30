import { describe, expect, it } from "vitest";
import { CARDS, type CardId } from "../src/game/data";
import {
  acceptsTrade,
  canBuild,
  canMortgage,
  canUseCard,
  gameReducer,
  minBid,
  netWorth,
  newGame,
  random,
  rentFor,
} from "../src/game/engine";
import { aiAction } from "../src/game/ai";
import { validSave } from "../src/game/storage";
import type { Action, GameState } from "../src/game/types";
const create = (seed = 12345, maxRounds = 30) =>
  newGame(
    {
      name: "测试玩家",
      npcDifficulties: ["easy", "medium", "hard"],
      maxRounds,
    },
    seed,
  );
function step(s: GameState, action: Action): GameState {
  const next = gameReducer(s, action);
  expect(next, `rejected ${JSON.stringify(action)} in ${s.phase}`).not.toBe(s);
  return next;
}
function diceSeed(s: GameState, a: number, b: number) {
  for (let seed = 1; seed < 500000; seed++) {
    const clone = { seed } as GameState;
    if (
      1 + Math.floor(random(clone) * 6) === a &&
      1 + Math.floor(random(clone) * 6) === b
    ) {
      s.seed = seed;
      return;
    }
  }
  throw Error("dice seed missing");
}
function giveCard(s: GameState, card: CardId) {
  s.players[0].cards = [card];
  s.usedCards = 0;
}
describe("traditional game rules", () => {
  it("starts with 1 human, 3–5 individually configured NPCs and equal resources", () => {
    const s = newGame(
      {
        name: "  玩家  ",
        npcDifficulties: ["easy", "hard", "medium", "hard", "easy"],
        maxRounds: 20,
      },
      42,
    );
    expect(s.players).toHaveLength(6);
    expect(s.players.map((p) => p.difficulty)).toEqual([
      "medium",
      "easy",
      "hard",
      "medium",
      "hard",
      "easy",
    ]);
    expect(
      s.players.every((p) => p.cash === 1600 && p.cards.length === 2),
    ).toBe(true);
    expect(s.players.filter((p) => p.human)).toHaveLength(1);
    expect(validSave(s)).toBe(true);
  });
  it("moves, buys and collects salary plus a card for crossing start", () => {
    let s = create();
    s.players[0].position = 30;
    s.players[0].cards = [];
    diceSeed(s, 1, 2);
    s = step(s, { type: "ROLL" });
    expect(s.players[0].position).toBe(1);
    expect(s.players[0].cash).toBe(1800);
    expect(s.players[0].cards).toHaveLength(1);
    expect(s.phase).toBe("purchase");
    s = step(s, { type: "BUY" });
    expect(s.players[0].cash).toBe(1700);
    expect(s.estates[1].owner).toBe(0);
    expect(s.phase).toBe("end");
  });
  it("rejects illegal actions without mutating the original state", () => {
    const s = create(),
      before = structuredClone(s);
    expect(gameReducer(s, { type: "BUY" })).toBe(s);
    expect(gameReducer(s, { type: "BUILD", tile: 1 })).toBe(s);
    expect(gameReducer(s, { type: "CARD", card: "freeRent" })).toBe(s);
    expect(s).toEqual(before);
  });
  it("doubles base group rent, builds evenly, upgrades to a hotel, and sells evenly", () => {
    let s = create();
    s.players[0].cash = 10000;
    s.estates[1].owner = 0;
    s.estates[3].owner = 0;
    expect(rentFor(s, 1)).toBe(20);
    expect(canBuild(s, 0, 1)).toBe(true);
    s = step(s, { type: "BUILD", tile: 1 });
    expect(canBuild(s, 0, 1)).toBe(false);
    expect(rentFor(s, 1)).toBe(50);
    s = step(s, { type: "BUILD", tile: 3 });
    for (let level = 2; level <= 5; level++) {
      s = step(s, { type: "BUILD", tile: 1 });
      s = step(s, { type: "BUILD", tile: 3 });
    }
    expect(rentFor(s, 1)).toBe(650);
    expect(canBuild(s, 0, 1)).toBe(false);
    expect(canMortgage(s, 0, 1)).toBe(false);
    const cash = s.players[0].cash;
    s = step(s, { type: "SELL_BUILDING", tile: 1 });
    expect(s.players[0].cash).toBe(cash + 25);
    expect(gameReducer(s, { type: "SELL_BUILDING", tile: 1 })).toBe(s);
  });
  it("mortgages at 50%, redeems at 55%, and suppresses rent", () => {
    let s = create();
    s.estates[1].owner = 0;
    const before = s.players[0].cash;
    s = step(s, { type: "MORTGAGE", tile: 1 });
    expect(s.players[0].cash).toBe(before + 50);
    expect(rentFor(s, 1)).toBe(0);
    s = step(s, { type: "REDEEM", tile: 1 });
    expect(s.players[0].cash).toBe(before - 5);
    expect(rentFor(s, 1)).toBe(10);
  });
  it("calculates station networks and utility dice rent", () => {
    const s = create();
    [5, 13, 21, 29].forEach((id) => (s.estates[id].owner = 1));
    expect(rentFor(s, 5)).toBe(200);
    s.estates[10].owner = 1;
    expect(rentFor(s, 10, 9)).toBe(36);
    s.estates[26].owner = 1;
    expect(rentFor(s, 10, 9)).toBe(90);
  });
  it("auctions rejected property to the last bidder, including the declining player", () => {
    let s = create();
    s.players[0].position = 1;
    s.phase = "purchase";
    s = step(s, { type: "DECLINE" });
    expect(s.auction!.active).toEqual([0, 1, 2, 3]);
    expect(minBid(s)).toBe(40);
    s = step(s, { type: "BID", amount: 40 });
    s = step(s, { type: "PASS_BID" });
    s = step(s, { type: "PASS_BID" });
    s = step(s, { type: "PASS_BID" });
    expect(s.estates[1].owner).toBe(0);
    expect(s.players[0].cash).toBe(1560);
    expect(s.phase).toBe("end");
  });
  it("finishes a no-bid auction and disallows unaffordable or under-minimum bids", () => {
    let s = create();
    s.players[0].position = 1;
    s.phase = "purchase";
    s = step(s, { type: "DECLINE" });
    expect(gameReducer(s, { type: "BID", amount: 39 })).toBe(s);
    expect(gameReducer(s, { type: "BID", amount: 2000 })).toBe(s);
    for (let i = 0; i < 4; i++) s = step(s, { type: "PASS_BID" });
    expect(s.phase).toBe("end");
    expect(s.estates[1].owner).toBeNull();
  });
  it("gives an extra roll for doubles and jails on three consecutive doubles", () => {
    let s = create();
    s.players[0].cards = [];
    s.estates[6].owner = 0;
    diceSeed(s, 3, 3);
    s = step(s, { type: "ROLL" });
    expect(s.extraTurn).toBe(true);
    expect(s.phase).toBe("end");
    s = step(s, { type: "END_TURN" });
    expect(s.current).toBe(0);
    expect(s.phase).toBe("roll");
    s.doubles = 2;
    diceSeed(s, 2, 2);
    s = step(s, { type: "ROLL" });
    expect(s.players[0].position).toBe(8);
    expect(s.players[0].jail).toBe(1);
    expect(s.extraTurn).toBe(false);
  });
  it("releases jail doubles without extra turns; waits after a failed attempt", () => {
    let s = create();
    s.players[0].jail = 1;
    s.players[0].position = 8;
    diceSeed(s, 1, 2);
    s = step(s, { type: "ROLL" });
    expect(s.phase).toBe("end");
    expect(s.players[0].jail).toBe(2);
    expect(s.players[0].position).toBe(8);
    s.phase = "roll";
    diceSeed(s, 1, 1);
    s = step(s, { type: "ROLL" });
    expect(s.players[0].jail).toBe(0);
    expect(s.extraTurn).toBe(false);
    expect(s.players[0].position).toBe(10);
  });
  it("pauses forced jail release for debt and then uses the already-rolled dice", () => {
    let s = create();
    s.players[0].cash = 0;
    s.players[0].jail = 3;
    s.players[0].position = 8;
    s.estates[1].owner = 0;
    diceSeed(s, 1, 2);
    s = step(s, { type: "ROLL" });
    expect(s.debt!.next).toBe("jailMove");
    s = step(s, { type: "MORTGAGE", tile: 1 });
    s = step(s, { type: "SETTLE_DEBT" });
    expect(s.players[0].position).toBe(11);
    expect(s.players[0].jail).toBe(0);
    expect(s.fund).toBe(50);
    expect(s.phase).toBe("purchase");
  });
  it("enters rent debt, liquidates assets and pays the creditor exactly once", () => {
    let s = create();
    s.phase = "rent";
    s.rent = { amount: 120, owner: 1, tile: 3 };
    s.players[0].cash = 20;
    s.estates[5].owner = 0;
    s = step(s, { type: "PAY_RENT" });
    expect(s.phase).toBe("debt");
    expect(s.players[1].cash).toBe(1600);
    s = step(s, { type: "MORTGAGE", tile: 5 });
    s = step(s, { type: "SETTLE_DEBT" });
    expect(s.players[0].cash).toBe(0);
    expect(s.players[1].cash).toBe(1720);
    expect(s.phase).toBe("end");
  });
  it("transfers cash, buildings, mortgages and cards to a bankruptcy creditor", () => {
    let s = create();
    s.phase = "debt";
    s.debt = {
      amount: 500,
      creditor: 1,
      reason: "rent",
      next: "end",
      fund: false,
    };
    s.players[0].cash = 40;
    s.estates[1] = { owner: 0, level: 3, mortgaged: false, boost: 2 };
    s.estates[5] = { owner: 0, level: 0, mortgaged: true, boost: 0 };
    s = step(s, { type: "BANKRUPT" });
    expect(s.players[0].bankrupt).toBe(true);
    expect(s.players[1].cash).toBe(1640);
    expect(s.estates[1]).toEqual({
      owner: 1,
      level: 3,
      mortgaged: false,
      boost: 0,
    });
    expect(s.estates[5].owner).toBe(1);
    expect(s.players[1].cards).toHaveLength(4);
    s = step(s, { type: "END_TURN" });
    expect(s.current).toBe(1);
  });
  it("returns bankrupt bank debt estates to the bank and ends at the last survivor", () => {
    let s = create();
    s.players[1].bankrupt = true;
    s.players[2].bankrupt = true;
    s.phase = "debt";
    s.debt = {
      amount: 500,
      creditor: null,
      reason: "tax",
      next: "end",
      fund: true,
    };
    s.estates[1].owner = 0;
    s = step(s, { type: "BANKRUPT" });
    expect(s.estates[1].owner).toBeNull();
    expect(s.phase).toBe("gameover");
    expect(s.winner).toBe(3);
  });
  it("finishes a configured round limit using total assets", () => {
    let s = create(123, 20);
    s.round = 20;
    s.current = 3;
    s.phase = "end";
    s.estates[31].owner = 2;
    s = step(s, { type: "END_TURN" });
    expect(s.round).toBe(20);
    expect(s.phase).toBe("gameover");
    expect(s.winner).toBe(2);
    expect(netWorth(s, 2)).toBe(2000);
  });
  it("uses independently valued NPC trades and transfers agreed cash and property", () => {
    let s = create();
    s.estates[1].owner = 1;
    expect(acceptsTrade(s, 0, 1, null, 1, 10)).toBe(false);
    expect(acceptsTrade(s, 0, 1, null, 1, 100)).toBe(true);
    s = step(s, { type: "TRADE", target: 1, give: null, take: 1, cash: 100 });
    expect(s.estates[1].owner).toBe(0);
    expect(s.players[1].cash).toBe(1700);
    expect(s.players[0].cash).toBe(1500);
  });
});
describe("all nine cards, acquisition and timing", () => {
  it("remote dice replaces a roll, grants crossing salary and never gives doubles", () => {
    let s = create();
    giveCard(s, "remote");
    s.players[0].position = 30;
    s = step(s, { type: "CARD", card: "remote", target: 3 });
    expect(s.players[0].position).toBe(1);
    expect(s.dice[0] + s.dice[1]).toBe(3);
    expect(s.extraTurn).toBe(false);
    expect(s.players[0].cash).toBe(1800);
    expect(s.phase).toBe("purchase");
  });
  it("portal resolves the selected tile but does not award passing salary", () => {
    let s = create();
    giveCard(s, "portal");
    s.players[0].position = 31;
    s = step(s, { type: "CARD", card: "portal", target: 1 });
    expect(s.players[0].cash).toBe(1600);
    expect(s.players[0].position).toBe(1);
    expect(s.phase).toBe("purchase");
    s = create();
    giveCard(s, "portal");
    expect(gameReducer(s, { type: "CARD", card: "portal", target: 24 })).toBe(
      s,
    );
  });
  it("shield halves exactly one rent and does not stack", () => {
    let s = create();
    giveCard(s, "shield");
    s = step(s, { type: "CARD", card: "shield" });
    s.players[0].cards.push("shield");
    expect(canUseCard(s, "shield")).toBe(false);
    s.phase = "rent";
    s.rent = { amount: 101, owner: 1, tile: 1 };
    s = step(s, { type: "PAY_RENT" });
    expect(s.players[0].cash).toBe(1549);
    expect(s.players[1].cash).toBe(1651);
    expect(s.players[0].shield).toBe(false);
  });
  it("free rent prevents the payment instead of crediting the landlord", () => {
    let s = create();
    giveCard(s, "freeRent");
    expect(canUseCard(s, "freeRent")).toBe(false);
    s.phase = "rent";
    s.rent = { amount: 900, owner: 1, tile: 1 };
    s = step(s, { type: "CARD", card: "freeRent" });
    expect(s.players[0].cash).toBe(1600);
    expect(s.players[1].cash).toBe(1600);
    expect(s.phase).toBe("end");
  });
  it("boost doubles rent and expires on the second future owner turn", () => {
    let s = create();
    giveCard(s, "boost");
    s.estates[1].owner = 0;
    s = step(s, { type: "CARD", card: "boost", target: 1 });
    expect(rentFor(s, 1)).toBe(20);
    for (let i = 0; i < 4; i++) {
      s.phase = "end";
      s = step(s, { type: "END_TURN" });
    }
    expect(s.estates[1].boost).toBe(1);
    for (let i = 0; i < 4; i++) {
      s.phase = "end";
      s = step(s, { type: "END_TURN" });
    }
    expect(s.estates[1].boost).toBe(0);
    expect(rentFor(s, 1)).toBe(10);
  });
  it("demolishes one enemy level, including hotels, without refund", () => {
    let s = create();
    giveCard(s, "demolish");
    s.estates[1].owner = 1;
    s.estates[1].level = 5;
    s = step(s, { type: "CARD", card: "demolish", target: 1 });
    expect(s.estates[1].level).toBe(4);
    expect(s.players[1].cash).toBe(1600);
  });
  it("grants 150 cash, transfers up to 100 available enemy cash, and releases jail", () => {
    let s = create();
    giveCard(s, "grant");
    s = step(s, { type: "CARD", card: "grant" });
    expect(s.players[0].cash).toBe(1750);
    giveCard(s, "steal");
    s.players[1].cash = 70;
    s = step(s, { type: "CARD", card: "steal", target: 1 });
    expect(s.players[0].cash).toBe(1820);
    expect(s.players[1].cash).toBe(0);
    expect(s.players[1].bankrupt).toBe(false);
    giveCard(s, "escape");
    s.players[0].jail = 1;
    s = step(s, { type: "CARD", card: "escape" });
    expect(s.players[0].jail).toBe(0);
    expect(s.phase).toBe("roll");
  });
  it("enforces two cards per complete turn including extra rolls", () => {
    let s = create();
    s.players[0].cards = ["grant", "grant", "grant"];
    s = step(s, { type: "CARD", card: "grant" });
    s = step(s, { type: "CARD", card: "grant" });
    expect(canUseCard(s, "grant")).toBe(false);
    s.phase = "end";
    s.extraTurn = true;
    s = step(s, { type: "END_TURN" });
    expect(s.usedCards).toBe(2);
    expect(canUseCard(s, "grant")).toBe(false);
  });
  it("converts a full hand free draw to 30 cash and limits shop to one purchase", () => {
    let s = create();
    s.players[0].cards = Array(6).fill("grant");
    s.players[0].position = 30;
    diceSeed(s, 1, 2);
    s = step(s, { type: "ROLL" });
    expect(s.players[0].cards).toHaveLength(6);
    expect(s.players[0].cash).toBe(1830);
    s = create();
    s.players[0].position = 1;
    diceSeed(s, 1, 2);
    s = step(s, { type: "ROLL" });
    expect(s.phase).toBe("market");
    expect(new Set(s.market).size).toBe(3);
    const c = s.market[0];
    s = step(s, { type: "BUY_CARD", card: c });
    expect(s.players[0].cards).toHaveLength(3);
    expect(s.players[0].cash).toBe(1510);
    expect(s.phase).toBe("end");
  });
  it("defines a real effect and usage rules for every card", () => {
    expect(CARDS).toHaveLength(9);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(9);
    expect(CARDS.every((c) => c.description && c.timing)).toBe(true);
  });
});
describe("save safety and full automated games", () => {
  it("rejects malformed, outdated or invalid saves", () => {
    expect(validSave(null)).toBe(false);
    expect(validSave({ version: 1 })).toBe(false);
    const s = create();
    expect(validSave(JSON.parse(JSON.stringify(s)))).toBe(true);
    s.players[0].cash = -10;
    expect(validSave(s)).toBe(false);
    const bad = create();
    bad.estates[1].owner = 99;
    expect(validSave(bad)).toBe(false);
    const phase = create();
    phase.phase = "rent";
    expect(validSave(phase)).toBe(false);
    const noSurvivor = create();
    noSurvivor.players.forEach((p) => (p.bankrupt = true));
    noSurvivor.phase = "end";
    expect(validSave(noSurvivor)).toBe(false);
    const auction = create();
    auction.phase = "auction";
    auction.auction = { tile: 1, bid: 50, leader: 0, bidder: 0, active: [0] };
    expect(validSave(auction)).toBe(false);
  });
  it("runs 90 seeded 4–6 player games through settlement with no invalid or stuck actions", () => {
    const phases = new Set<string>(),
      effects = new Set<string>();
    for (let count = 3; count <= 5; count++)
      for (let seed = 1; seed <= 30; seed++) {
        let s = newGame(
          {
            name: "旅行家",
            npcDifficulties: Array.from(
              { length: count },
              (_, i) =>
                ["easy", "medium", "hard"][(i + seed) % 3] as
                  | "easy"
                  | "medium"
                  | "hard",
            ),
            maxRounds: 30,
          },
          (seed * 982451653) % 4294967295 || 1,
        );
        let steps = 0;
        while (s.phase !== "gameover" && steps++ < 12000) {
          phases.add(s.phase);
          const action = aiAction(s);
          expect(action, `seed ${seed} ${s.phase}`).not.toBeNull();
          effects.add(action!.type);
          s = step(s, action!);
          expect(
            validSave(s),
            `invalid save seed ${seed} step ${steps} phase ${s.phase}`,
          ).toBe(true);
          expect(
            s.players.every(
              (p) =>
                Number.isInteger(p.cash) && p.cash >= 0 && p.cards.length <= 6,
            ),
          ).toBe(true);
          expect(
            s.estates.every(
              (e) => e.owner === null || !s.players[e.owner].bankrupt,
            ),
          ).toBe(true);
        }
        expect(
          s.phase,
          `unfinished ${count + 1}-player game seed ${seed}`,
        ).toBe("gameover");
        expect(s.winner).not.toBeNull();
      }
    expect(phases.has("auction")).toBe(true);
    expect(phases.has("debt")).toBe(true);
    expect(effects.has("BUILD")).toBe(true);
    expect(effects.has("TRADE")).toBe(true);
    expect(effects.has("MORTGAGE")).toBe(true);
    expect(effects.has("CARD")).toBe(true);
    expect(effects.has("BANKRUPT")).toBe(true);
  }, 60000);
  it("finishes an unlimited all-hard game by last-survivor victory", () => {
    let s = newGame(
      { name: "玩家", npcDifficulties: ["hard", "hard", "hard"], maxRounds: 0 },
      654321,
    );
    s.players[0].difficulty = "hard";
    let steps = 0;
    while (s.phase !== "gameover" && steps++ < 60000) {
      const action = aiAction(s);
      expect(action).not.toBeNull();
      s = step(s, action!);
    }
    expect(s.phase).toBe("gameover");
    expect(s.players.filter((p) => !p.bankrupt)).toHaveLength(1);
    expect(s.endReason).toBe("其他玩家均已破产");
  }, 60000);
});
