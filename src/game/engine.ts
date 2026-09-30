import {
  BOARD,
  CARDS,
  CARD_MAP,
  COLORS,
  GROUPS,
  MAX_HAND,
  NPC_NAMES,
  type CardId,
} from "./data";
import type { Action, Debt, GameState, Player, Settings } from "./types";

export function random(s: GameState): number {
  let x = s.seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.seed = x >>> 0;
  return s.seed / 4294967296;
}
function log(
  s: GameState,
  text: string,
  kind: "info" | "money" | "card" | "bad" = "info",
) {
  s.logs.push({ id: ++s.logSerial, text, kind });
  if (s.logs.length > 80) s.logs.shift();
}
export const currentPlayer = (s: GameState) => s.players[s.current];
export const ownedTiles = (s: GameState, id: number) =>
  BOARD.filter((t) => s.estates[t.id].owner === id);
export const redemptionCost = (tile: number) =>
  Math.ceil((BOARD[tile].price! * 55) / 100);
export function hasGroup(s: GameState, player: number, group: string): boolean {
  return BOARD.filter((t) => t.group === group).every(
    (t) => s.estates[t.id].owner === player,
  );
}
export function netWorth(s: GameState, id: number): number {
  return (
    s.players[id].cash +
    ownedTiles(s, id).reduce((total, t) => {
      const e = s.estates[t.id];
      return (
        total +
        (e.mortgaged ? Math.floor(t.price! / 2) : t.price!) +
        (t.group ? e.level * GROUPS[t.group].build : 0)
      );
    }, 0)
  );
}
export function rentFor(
  s: GameState,
  tile: number,
  dice = s.dice[0] + s.dice[1],
): number {
  const t = BOARD[tile],
    e = s.estates[tile];
  if (e.owner === null || e.mortgaged) return 0;
  let rent = 0;
  if (t.kind === "station") {
    const count = ownedTiles(s, e.owner).filter(
      (x) => x.kind === "station",
    ).length;
    rent = 25 * 2 ** (count - 1);
  } else if (t.kind === "utility") {
    const count = ownedTiles(s, e.owner).filter(
      (x) => x.kind === "utility",
    ).length;
    rent = dice * (count === 2 ? 10 : 4);
  } else if (t.kind === "property") {
    const multiplier = [1, 5, 14, 32, 48, 65][e.level];
    rent = Math.floor(t.price! / 10) * multiplier;
    if (e.level === 0 && hasGroup(s, e.owner, t.group!)) rent *= 2;
  }
  return rent * (e.boost ? 2 : 1);
}
function drawCard(s: GameState, p: Player) {
  if (p.cards.length >= MAX_HAND) {
    p.cash += 30;
    log(s, `${p.name}的卡包已满，获得 ₡30 替代奖励`, "money");
    return;
  }
  const card = CARDS[Math.floor(random(s) * CARDS.length)].id;
  p.cards.push(card);
  log(s, `${p.name}获得「${CARD_MAP[card].name}」`, "card");
}
export function newGame(
  settings: Settings,
  seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1,
): GameState {
  const players: Player[] = [
    {
      id: 0,
      name: settings.name.trim().slice(0, 12) || "旅行家",
      color: COLORS[0],
      human: true,
      difficulty: "medium",
      cash: 1600,
      position: 0,
      bankrupt: false,
      jail: 0,
      laps: 0,
      cards: [],
      shield: false,
    },
  ];
  const difficulties = settings.npcDifficulties.slice(0, 5);
  while (difficulties.length < 3) difficulties.push("medium");
  difficulties.forEach((difficulty, i) =>
    players.push({
      id: i + 1,
      name: NPC_NAMES[i],
      color: COLORS[i + 1],
      human: false,
      difficulty,
      cash: 1600,
      position: 0,
      bankrupt: false,
      jail: 0,
      laps: 0,
      cards: [],
      shield: false,
    }),
  );
  const s: GameState = {
    version: 1,
    seed: seed >>> 0 || 1,
    players,
    estates: BOARD.map(() => ({
      owner: null,
      level: 0,
      mortgaged: false,
      boost: 0,
    })),
    current: 0,
    phase: "roll",
    round: 1,
    maxRounds: settings.maxRounds,
    dice: [1, 1],
    doubles: 0,
    extraTurn: false,
    usedCards: 0,
    rent: null,
    auction: null,
    debt: null,
    market: [],
    logs: [],
    logSerial: 0,
    movement: null,
    movementSerial: 0,
    fund: 0,
    winner: null,
    endReason: "",
  };
  players.forEach((p) => {
    drawCard(s, p);
    drawCard(s, p);
  });
  log(s, `城市开放！${players.length} 位旅行家携带 ₡1,600 出发。`);
  return s;
}
function gameover(s: GameState, reason: string) {
  const live = s.players
    .filter((p) => !p.bankrupt)
    .sort(
      (a, b) =>
        netWorth(s, b.id) - netWorth(s, a.id) || b.cash - a.cash || a.id - b.id,
    );
  s.winner = live[0]?.id ?? s.current;
  s.phase = "gameover";
  s.endReason = reason;
  log(s, `${s.players[s.winner].name}成为城市之王！${reason}`, "money");
}
function checkWinner(s: GameState) {
  if (s.players.filter((p) => !p.bankrupt).length <= 1)
    gameover(s, "其他玩家均已破产");
}
function bankruptcy(s: GameState) {
  const p = currentPlayer(s),
    creditor = s.debt?.creditor ?? null;
  if (creditor !== null) {
    const receiver = s.players[creditor];
    receiver.cash += p.cash;
    receiver.cards.push(...p.cards.slice(0, MAX_HAND - receiver.cards.length));
  }
  ownedTiles(s, p.id).forEach((t) => {
    s.estates[t.id] =
      creditor === null
        ? { owner: null, level: 0, mortgaged: false, boost: 0 }
        : { ...s.estates[t.id], owner: creditor, boost: 0 };
  });
  p.cash = 0;
  p.bankrupt = true;
  p.cards = [];
  p.shield = false;
  s.extraTurn = false;
  s.debt = null;
  s.rent = null;
  s.phase = "end";
  log(
    s,
    `${p.name}宣告破产${creditor !== null ? `，资产移交给${s.players[creditor].name}` : "，地产归还银行"}`,
    "bad",
  );
  checkWinner(s);
}
function transfer(
  s: GameState,
  amount: number,
  creditor: number | null,
  fund: boolean,
) {
  const p = currentPlayer(s);
  p.cash -= amount;
  if (creditor !== null) s.players[creditor].cash += amount;
  if (fund) s.fund += amount;
}
function pay(
  s: GameState,
  amount: number,
  creditor: number | null,
  reason: string,
  fund = false,
  next: Debt["next"] = "end",
): boolean {
  if (currentPlayer(s).cash < amount) {
    s.debt = { amount, creditor, reason, fund, next };
    s.phase = "debt";
    s.extraTurn = next === "end" ? s.extraTurn : false;
    log(s, `${currentPlayer(s).name}需要筹集 ₡${amount}：${reason}`, "bad");
    return false;
  }
  transfer(s, amount, creditor, fund);
  log(s, `${currentPlayer(s).name}支付 ₡${amount} · ${reason}`, "money");
  return true;
}
function jail(s: GameState) {
  const p = currentPlayer(s),
    from = p.position;
  p.position = 8;
  p.jail = 1;
  s.movement = {
    id: ++s.movementSerial,
    player: p.id,
    from,
    to: 8,
    steps: 0,
    teleport: true,
  };
  s.extraTurn = false;
  s.doubles = 0;
  s.phase = "end";
  log(s, `${p.name}进入拘留所；可支付 ₡50、使用通行证或掷出双骰离开`, "bad");
}
function move(s: GameState, steps: number, target?: number) {
  const p = currentPlayer(s),
    from = p.position;
  if (target === undefined && from + steps >= BOARD.length) {
    p.cash += 200;
    p.laps++;
    log(s, `${p.name}经过起点，领取 ₡200 与一张道具卡`, "money");
    drawCard(s, p);
  }
  p.position = target ?? (from + steps) % BOARD.length;
  s.movement = {
    id: ++s.movementSerial,
    player: p.id,
    from,
    to: p.position,
    steps: target !== undefined ? 0 : steps,
    teleport: target !== undefined,
  };
  log(s, `${p.name}来到${BOARD[p.position].name}`);
  land(s);
}
function chance(s: GameState) {
  const p = currentPlayer(s),
    event = Math.floor(random(s) * 9);
  if (event === 0 || event === 1) {
    const amount = event === 0 ? 120 : 200;
    p.cash += amount;
    log(
      s,
      `城市奇遇 · ${event === 0 ? "创业奖金" : "投资分红"}！${p.name}领取 ₡${amount}`,
      "money",
    );
  } else if (event === 2) {
    log(s, "城市奇遇 · 道路维护，支付 ₡80", "bad");
    if (!pay(s, 80, null, "道路维护", true)) return;
  } else if (event === 3) {
    log(s, "城市奇遇 · 回到起点，领取奖励！", "card");
    p.cash += 200;
    p.laps++;
    drawCard(s, p);
    move(s, 0, 0);
    return;
  } else if (event === 4) {
    log(s, "城市奇遇 · 临时拘留令", "bad");
    jail(s);
    return;
  } else if (event === 5) {
    log(s, "城市奇遇 · 发现神秘卡包", "card");
    drawCard(s, p);
    drawCard(s, p);
  } else if (event === 6) {
    const cost = ownedTiles(s, p.id).reduce(
      (sum, t) => sum + s.estates[t.id].level * 25,
      0,
    );
    log(s, `城市奇遇 · 建筑修缮费 ₡${cost}`, "bad");
    if (!pay(s, cost, null, "建筑修缮", true)) return;
  } else if (event === 7) {
    let total = 0;
    s.players
      .filter((x) => x.id !== p.id && !x.bankrupt)
      .forEach((x) => {
        const amount = Math.min(30, x.cash);
        x.cash -= amount;
        total += amount;
      });
    p.cash += total;
    log(s, `城市奇遇 · 生日快乐！${p.name}收到 ₡${total} 礼金`, "money");
  } else {
    log(s, "城市奇遇 · 免费顺风车，前进 3 格");
    move(s, 3);
    return;
  }
  s.phase = "end";
}
function land(s: GameState) {
  const p = currentPlayer(s),
    t = BOARD[p.position],
    e = s.estates[t.id];
  s.rent = null;
  s.market = [];
  if (t.price) {
    if (e.owner === null) {
      s.phase = "purchase";
      return;
    }
    if (e.owner !== p.id && !e.mortgaged) {
      s.rent = { amount: rentFor(s, t.id), owner: e.owner, tile: t.id };
      s.phase = "rent";
      return;
    }
  } else if (t.kind === "goJail") {
    jail(s);
    return;
  } else if (t.kind === "chance") {
    chance(s);
    return;
  } else if (t.kind === "tax") {
    if (!pay(s, 120, null, "城市建设税", true)) return;
  } else if (t.kind === "parking") {
    p.cash += s.fund;
    log(s, `${p.name}领取中央公园奖池 ₡${s.fund}`, "money");
    s.fund = 0;
  } else if (t.kind === "market") {
    const pool = [...CARDS];
    while (s.market.length < 3)
      s.market.push(pool.splice(Math.floor(random(s) * pool.length), 1)[0].id);
    s.phase = "market";
    return;
  }
  s.phase = "end";
}
function roll(s: GameState) {
  const p = currentPlayer(s);
  s.dice = [1 + Math.floor(random(s) * 6), 1 + Math.floor(random(s) * 6)];
  const double = s.dice[0] === s.dice[1];
  log(
    s,
    `${p.name}掷出 ${s.dice[0]} + ${s.dice[1]}${double ? " · 双骰！" : ""}`,
  );
  if (p.jail) {
    s.extraTurn = false;
    if (double) {
      p.jail = 0;
      log(s, `${p.name}掷出双骰，自由了！`);
    } else {
      p.jail++;
      if (p.jail < 4) {
        log(s, `${p.name}未能离开拘留所（第 ${p.jail - 1}/3 次尝试）`, "bad");
        s.phase = "end";
        return;
      }
      if (!pay(s, 50, null, "拘留满 3 次，强制保释", true, "jailMove")) return;
      p.jail = 0;
    }
  } else {
    s.doubles = double ? s.doubles + 1 : 0;
    s.extraTurn = double;
    if (s.doubles >= 3) {
      log(s, "连续三次双骰，触发拘留令！", "bad");
      jail(s);
      return;
    }
  }
  move(s, s.dice[0] + s.dice[1]);
}
function nextTurn(s: GameState) {
  if (s.extraTurn && !currentPlayer(s).bankrupt) {
    s.phase = "roll";
    s.extraTurn = false;
    s.rent = null;
    log(s, `${currentPlayer(s).name}获得双骰奖励，再掷一次！`);
    return;
  }
  const previous = s.current;
  do {
    s.current = (s.current + 1) % s.players.length;
  } while (currentPlayer(s).bankrupt);
  if (s.current <= previous) {
    if (s.maxRounds > 0 && s.round >= s.maxRounds) {
      gameover(s, `完成 ${s.maxRounds} 轮，按总资产排名`);
      return;
    }
    s.round++;
  }
  s.estates.forEach((e) => {
    if (e.owner === s.current && e.boost) e.boost--;
  });
  s.doubles = 0;
  s.extraTurn = false;
  s.usedCards = 0;
  s.rent = null;
  s.debt = null;
  s.market = [];
  s.phase = "roll";
  log(s, `第 ${s.round} 轮 · ${currentPlayer(s).name}的回合`);
}
export function canBuild(s: GameState, player: number, tile: number): boolean {
  const t = BOARD[tile],
    e = s.estates[tile];
  if (!t?.group || e.owner !== player || e.mortgaged || e.level >= 5)
    return false;
  const group = BOARD.filter((x) => x.group === t.group);
  return (
    hasGroup(s, player, t.group) &&
    group.every((x) => !s.estates[x.id].mortgaged) &&
    e.level <= Math.min(...group.map((x) => s.estates[x.id].level))
  );
}
export function canSellBuilding(
  s: GameState,
  player: number,
  tile: number,
): boolean {
  const t = BOARD[tile],
    e = s.estates[tile];
  return (
    !!t?.group &&
    e.owner === player &&
    e.level > 0 &&
    e.level >=
      Math.max(
        ...BOARD.filter((x) => x.group === t.group).map(
          (x) => s.estates[x.id].level,
        ),
      )
  );
}
export function canMortgage(
  s: GameState,
  player: number,
  tile: number,
): boolean {
  const t = BOARD[tile],
    e = s.estates[tile];
  return (
    !!t?.price &&
    e.owner === player &&
    !e.mortgaged &&
    (!t.group ||
      BOARD.filter((x) => x.group === t.group).every(
        (x) => !s.estates[x.id].level,
      ))
  );
}
export function cardTargets(s: GameState, card: CardId): number[] {
  const p = currentPlayer(s);
  switch (CARD_MAP[card].target) {
    case "dice":
      return Array.from({ length: 11 }, (_, i) => i + 2);
    case "tile":
      return BOARD.filter(
        (t) => t.kind !== "goJail" && t.id !== p.position,
      ).map((t) => t.id);
    case "ownProperty":
      return ownedTiles(s, p.id)
        .filter((t) => !s.estates[t.id].mortgaged && !s.estates[t.id].boost)
        .map((t) => t.id);
    case "enemyBuilding":
      return BOARD.filter(
        (t) =>
          s.estates[t.id].owner !== null &&
          s.estates[t.id].owner !== p.id &&
          s.estates[t.id].level > 0,
      ).map((t) => t.id);
    case "player":
      return s.players
        .filter((x) => x.id !== p.id && !x.bankrupt && x.cash > 0)
        .map((x) => x.id);
    default:
      return [];
  }
}
export function canUseCard(s: GameState, card: CardId): boolean {
  const p = currentPlayer(s);
  if (!p.cards.includes(card) || s.usedCards >= 2 || p.bankrupt) return false;
  if (card === "freeRent") return s.phase === "rent";
  if (card === "shield")
    return !p.shield && (s.phase === "roll" || s.phase === "rent");
  if (card === "escape") return s.phase === "roll" && p.jail > 0;
  if (card === "remote" || card === "portal")
    return s.phase === "roll" && !p.jail && cardTargets(s, card).length > 0;
  if (s.phase !== "roll" && s.phase !== "end") return false;
  return !CARD_MAP[card].target || cardTargets(s, card).length > 0;
}
function useCard(s: GameState, card: CardId, target?: number): boolean {
  if (!canUseCard(s, card)) return false;
  if (
    CARD_MAP[card].target &&
    (target === undefined || !cardTargets(s, card).includes(target))
  )
    return false;
  const p = currentPlayer(s);
  p.cards.splice(p.cards.indexOf(card), 1);
  s.usedCards++;
  log(
    s,
    `${p.name}使用「${CARD_MAP[card].name}」${target !== undefined && !["remote", "steal"].includes(card) ? ` · ${BOARD[target].name}` : ""}`,
    "card",
  );
  if (card === "grant") p.cash += 150;
  if (card === "shield") p.shield = true;
  if (card === "freeRent") {
    s.rent = null;
    s.phase = "end";
  }
  if (card === "escape") {
    p.jail = 0;
    log(s, `${p.name}免费离开拘留所`);
  }
  if (card === "boost") s.estates[target!].boost = 2;
  if (card === "demolish") s.estates[target!].level--;
  if (card === "steal") {
    const amount = Math.min(100, s.players[target!].cash);
    s.players[target!].cash -= amount;
    p.cash += amount;
    log(s, `${p.name}从${s.players[target!].name}转移 ₡${amount}`, "money");
  }
  if (card === "remote") {
    s.dice = [Math.min(6, target! - 1), target! - Math.min(6, target! - 1)];
    s.extraTurn = false;
    s.doubles = 0;
    move(s, target!);
  }
  if (card === "portal") {
    s.extraTurn = false;
    s.doubles = 0;
    move(s, 0, target!);
  }
  return true;
}
function startAuction(s: GameState) {
  const active = s.players
    .filter(
      (p) =>
        !p.bankrupt &&
        p.cash >= Math.floor(BOARD[currentPlayer(s).position].price! * 0.4),
    )
    .map((p) => p.id);
  if (!active.length) {
    s.phase = "end";
    return;
  }
  s.auction = {
    tile: currentPlayer(s).position,
    bid: 0,
    leader: null,
    bidder: active.includes(s.current) ? s.current : active[0],
    active,
  };
  s.phase = "auction";
  log(s, `${BOARD[s.auction.tile].name}进入公开拍卖，底价为原价的 40%`);
}
export function minBid(s: GameState): number {
  return s.auction
    ? Math.max(
        Math.floor(BOARD[s.auction.tile].price! * 0.4),
        s.auction.bid + 10,
      )
    : 0;
}
function advanceAuction(s: GameState) {
  const a = s.auction!;
  if (!a.active.length || (a.active.length === 1 && a.leader !== null)) {
    if (a.leader !== null) {
      s.players[a.leader].cash -= a.bid;
      s.estates[a.tile].owner = a.leader;
      log(
        s,
        `${s.players[a.leader].name}以 ₡${a.bid} 拍得${BOARD[a.tile].name}`,
        "money",
      );
    } else log(s, "无人出价，地产暂留银行");
    s.auction = null;
    s.phase = "end";
    return;
  }
  let candidate = a.bidder;
  do {
    candidate = (candidate + 1) % s.players.length;
  } while (!a.active.includes(candidate) || candidate === a.leader);
  a.bidder = candidate;
}
export function tradeValue(s: GameState, player: number, tile: number): number {
  const t = BOARD[tile],
    e = s.estates[tile],
    difficulty = s.players[player].difficulty;
  let value = t.price! * (e.mortgaged ? 0.45 : 1);
  if (t.group) {
    const others = BOARD.filter((x) => x.group === t.group && x.id !== tile);
    if (others.some((x) => s.estates[x.id].owner === player))
      value *= difficulty === "hard" ? 1.8 : 1.45;
  }
  if (
    t.kind === "station" &&
    ownedTiles(s, player).some((x) => x.kind === "station")
  )
    value *= 1.3;
  return Math.round(value);
}
export function tradeAllowed(
  s: GameState,
  tile: number | null,
  owner: number,
): boolean {
  return (
    tile === null ||
    (!!BOARD[tile]?.price &&
      s.estates[tile].owner === owner &&
      (!BOARD[tile].group ||
        BOARD.filter((x) => x.group === BOARD[tile].group).every(
          (x) => s.estates[x.id].level === 0,
        )))
  );
}
export function acceptsTrade(
  s: GameState,
  from: number,
  target: number,
  give: number | null,
  take: number | null,
  cash: number,
): boolean {
  const npc = s.players[target];
  if (
    !npc ||
    npc.bankrupt ||
    npc.human ||
    target === from ||
    !Number.isInteger(cash) ||
    (give === null && take === null)
  )
    return false;
  if (!tradeAllowed(s, give, from) || !tradeAllowed(s, take, target))
    return false;
  if (
    s.players[from].cash < Math.max(0, cash) ||
    npc.cash < Math.max(0, -cash) + 100
  )
    return false;
  const offered = (give !== null ? tradeValue(s, target, give) : 0) + cash;
  const requested = take !== null ? tradeValue(s, target, take) : 0;
  const threshold =
    npc.difficulty === "easy" ? 0.85 : npc.difficulty === "hard" ? 1.12 : 1;
  return offered >= requested * threshold && offered >= 0;
}
export function gameReducer(state: GameState, action: Action): GameState {
  if (state.phase === "gameover") return state;
  const s: GameState = structuredClone(state),
    p = currentPlayer(s);
  let valid = false;
  const manage = ["roll", "end", "debt"].includes(s.phase) && !p.bankrupt;
  switch (action.type) {
    case "ROLL":
      if (s.phase === "roll") {
        roll(s);
        valid = true;
      }
      break;
    case "BUY":
      if (s.phase === "purchase" && p.cash >= BOARD[p.position].price!) {
        p.cash -= BOARD[p.position].price!;
        s.estates[p.position].owner = p.id;
        s.phase = "end";
        log(
          s,
          `${p.name}购入${BOARD[p.position].name} · ₡${BOARD[p.position].price}`,
          "money",
        );
        valid = true;
      }
      break;
    case "DECLINE":
      if (s.phase === "purchase") {
        startAuction(s);
        valid = true;
      }
      break;
    case "PAY_RENT":
      if (s.phase === "rent" && s.rent) {
        let amount = s.rent.amount;
        if (p.shield) {
          amount = Math.ceil(amount / 2);
          p.shield = false;
          log(s, "租金护盾生效，租金减半", "card");
        }
        const owner = s.rent.owner;
        if (pay(s, amount, owner, `向${s.players[owner].name}支付租金`))
          s.phase = "end";
        s.rent = null;
        valid = true;
      }
      break;
    case "END_TURN":
      if (s.phase === "end") {
        nextTurn(s);
        valid = true;
      }
      break;
    case "BAIL":
      if (s.phase === "roll" && p.jail) {
        if (pay(s, 50, null, "保释", true, "jailRoll")) {
          p.jail = 0;
        }
        valid = true;
      }
      break;
    case "SETTLE_DEBT":
      if (s.phase === "debt" && s.debt && p.cash >= s.debt.amount) {
        const debt = s.debt;
        transfer(s, debt.amount, debt.creditor, debt.fund);
        s.debt = null;
        log(s, `${p.name}偿付 ₡${debt.amount} · ${debt.reason}`, "money");
        if (debt.next === "jailRoll") {
          p.jail = 0;
          s.phase = "roll";
        } else if (debt.next === "jailMove") {
          p.jail = 0;
          move(s, s.dice[0] + s.dice[1]);
        } else s.phase = "end";
        valid = true;
      }
      break;
    case "BANKRUPT":
      if (s.phase === "debt") {
        bankruptcy(s);
        valid = true;
      }
      break;
    case "BID":
      if (
        s.phase === "auction" &&
        s.auction &&
        Number.isInteger(action.amount) &&
        action.amount >= minBid(s) &&
        s.players[s.auction.bidder].cash >= action.amount
      ) {
        s.auction.bid = action.amount;
        s.auction.leader = s.auction.bidder;
        log(s, `${s.players[s.auction.bidder].name}出价 ₡${action.amount}`);
        advanceAuction(s);
        valid = true;
      }
      break;
    case "PASS_BID":
      if (s.phase === "auction" && s.auction) {
        s.auction.active = s.auction.active.filter(
          (id) => id !== s.auction!.bidder,
        );
        advanceAuction(s);
        valid = true;
      }
      break;
    case "BUY_CARD":
      if (
        s.phase === "market" &&
        s.market.includes(action.card) &&
        p.cash >= 90 &&
        p.cards.length < MAX_HAND
      ) {
        p.cash -= 90;
        p.cards.push(action.card);
        log(
          s,
          `${p.name}花费 ₡90 购买「${CARD_MAP[action.card].name}」`,
          "card",
        );
        s.market = [];
        s.phase = "end";
        valid = true;
      }
      break;
    case "LEAVE_MARKET":
      if (s.phase === "market") {
        s.phase = "end";
        valid = true;
      }
      break;
    case "CARD":
      valid = useCard(s, action.card, action.target);
      break;
    case "BUILD":
      if (
        manage &&
        s.phase !== "debt" &&
        canBuild(s, p.id, action.tile) &&
        p.cash >= GROUPS[BOARD[action.tile].group!].build
      ) {
        p.cash -= GROUPS[BOARD[action.tile].group!].build;
        s.estates[action.tile].level++;
        log(
          s,
          `${p.name}在${BOARD[action.tile].name}${s.estates[action.tile].level === 5 ? "建成酒店" : "建造房屋"}`,
          "money",
        );
        valid = true;
      }
      break;
    case "SELL_BUILDING":
      if (manage && canSellBuilding(s, p.id, action.tile)) {
        s.estates[action.tile].level--;
        p.cash += Math.floor(GROUPS[BOARD[action.tile].group!].build / 2);
        log(s, `${p.name}出售${BOARD[action.tile].name}的一级建筑`, "money");
        valid = true;
      }
      break;
    case "MORTGAGE":
      if (manage && canMortgage(s, p.id, action.tile)) {
        s.estates[action.tile].mortgaged = true;
        s.estates[action.tile].boost = 0;
        p.cash += Math.floor(BOARD[action.tile].price! / 2);
        log(s, `${p.name}抵押${BOARD[action.tile].name}`, "money");
        valid = true;
      }
      break;
    case "REDEEM":
      if (
        manage &&
        s.phase !== "debt" &&
        s.estates[action.tile]?.owner === p.id &&
        s.estates[action.tile].mortgaged &&
        p.cash >= redemptionCost(action.tile)
      ) {
        p.cash -= redemptionCost(action.tile);
        s.estates[action.tile].mortgaged = false;
        log(s, `${p.name}赎回${BOARD[action.tile].name}`, "money");
        valid = true;
      }
      break;
    case "TRADE":
      if (
        manage &&
        s.phase !== "debt" &&
        acceptsTrade(
          s,
          p.id,
          action.target,
          action.give,
          action.take,
          action.cash,
        )
      ) {
        if (action.give !== null) {
          s.estates[action.give].owner = action.target;
          s.estates[action.give].boost = 0;
        }
        if (action.take !== null) {
          s.estates[action.take].owner = p.id;
          s.estates[action.take].boost = 0;
        }
        p.cash -= action.cash;
        s.players[action.target].cash += action.cash;
        log(
          s,
          `${p.name}与${s.players[action.target].name}完成地产交易`,
          "money",
        );
        valid = true;
      }
      break;
  }
  return valid ? s : state;
}
