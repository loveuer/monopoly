import type { CardId, Difficulty } from "./data";
export type Player = {
  id: number;
  name: string;
  color: string;
  human: boolean;
  difficulty: Difficulty;
  cash: number;
  position: number;
  bankrupt: boolean;
  jail: number;
  laps: number;
  cards: CardId[];
  shield: boolean;
};
export type Estate = {
  owner: number | null;
  level: number;
  mortgaged: boolean;
  boost: number;
};
export type Phase =
  | "roll"
  | "purchase"
  | "rent"
  | "market"
  | "auction"
  | "debt"
  | "end"
  | "gameover";
export type Log = {
  id: number;
  text: string;
  kind: "info" | "money" | "card" | "bad";
};
export type Auction = {
  tile: number;
  bid: number;
  leader: number | null;
  bidder: number;
  active: number[];
};
export type Debt = {
  amount: number;
  creditor: number | null;
  reason: string;
  next: "end" | "jailRoll" | "jailMove";
  fund: boolean;
};
export type Movement = {
  id: number;
  player: number;
  from: number;
  to: number;
  steps: number;
  teleport: boolean;
};
export type GameState = {
  version: 1;
  seed: number;
  players: Player[];
  estates: Estate[];
  current: number;
  phase: Phase;
  round: number;
  maxRounds: number;
  dice: [number, number];
  doubles: number;
  extraTurn: boolean;
  usedCards: number;
  rent: { amount: number; owner: number; tile: number } | null;
  auction: Auction | null;
  debt: Debt | null;
  market: CardId[];
  logs: Log[];
  logSerial: number;
  movement: Movement | null;
  movementSerial: number;
  fund: number;
  winner: number | null;
  endReason: string;
};
export type Settings = {
  name: string;
  npcDifficulties: Difficulty[];
  maxRounds: number;
};
export type Action =
  | { type: "ROLL" }
  | { type: "BUY" }
  | { type: "DECLINE" }
  | { type: "PAY_RENT" }
  | { type: "END_TURN" }
  | { type: "BAIL" }
  | { type: "BANKRUPT" }
  | { type: "SETTLE_DEBT" }
  | { type: "BID"; amount: number }
  | { type: "PASS_BID" }
  | { type: "BUY_CARD"; card: CardId }
  | { type: "LEAVE_MARKET" }
  | { type: "CARD"; card: CardId; target?: number }
  | { type: "BUILD" | "SELL_BUILDING" | "MORTGAGE" | "REDEEM"; tile: number }
  | {
      type: "TRADE";
      target: number;
      give: number | null;
      take: number | null;
      cash: number;
    };
