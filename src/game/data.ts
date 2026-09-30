export type Difficulty = "easy" | "medium" | "hard";
export type TileKind =
  | "start"
  | "property"
  | "station"
  | "utility"
  | "chance"
  | "tax"
  | "market"
  | "jail"
  | "parking"
  | "goJail";
export type Tile = {
  id: number;
  name: string;
  short: string;
  kind: TileKind;
  price?: number;
  group?: string;
  color: string;
  subtitle: string;
};
export const GROUPS: Record<
  string,
  { name: string; color: string; build: number }
> = {
  coral: { name: "老城街区", color: "#f78d77", build: 50 },
  mint: { name: "绿野街区", color: "#89c99a", build: 70 },
  blue: { name: "水岸街区", color: "#78b9dd", build: 90 },
  violet: { name: "艺术街区", color: "#b3a0de", build: 110 },
  pink: { name: "霓虹街区", color: "#e792b2", build: 130 },
  orange: { name: "港湾街区", color: "#eca669", build: 150 },
  teal: { name: "海岛街区", color: "#73c3bf", build: 170 },
  gold: { name: "云端街区", color: "#e9ca72", build: 190 },
};
const raw: Omit<Tile, "id">[] = [
  {
    name: "环游起点",
    short: "起点",
    kind: "start",
    color: "#c7f36b",
    subtitle: "经过领取 ₡200",
  },
  {
    name: "榕树老街",
    short: "老街",
    kind: "property",
    price: 100,
    group: "coral",
    color: "#f78d77",
    subtitle: "老城街区",
  },
  {
    name: "城市奇遇",
    short: "奇遇",
    kind: "chance",
    color: "#ecbb66",
    subtitle: "下一站，惊喜",
  },
  {
    name: "落日码头",
    short: "码头",
    kind: "property",
    price: 120,
    group: "coral",
    color: "#f78d77",
    subtitle: "老城街区",
  },
  {
    name: "道具商店",
    short: "商店",
    kind: "market",
    color: "#a8cb8e",
    subtitle: "每张道具 ₡90",
  },
  {
    name: "南方车站",
    short: "南站",
    kind: "station",
    price: 200,
    color: "#96a9b5",
    subtitle: "连锁车站",
  },
  {
    name: "花园大道",
    short: "花园",
    kind: "property",
    price: 140,
    group: "mint",
    color: "#89c99a",
    subtitle: "绿野街区",
  },
  {
    name: "森林公园",
    short: "森林",
    kind: "property",
    price: 160,
    group: "mint",
    color: "#89c99a",
    subtitle: "绿野街区",
  },
  {
    name: "城市拘留所",
    short: "拘留所",
    kind: "jail",
    color: "#c1a691",
    subtitle: "路过只是参观",
  },
  {
    name: "湖畔小筑",
    short: "湖畔",
    kind: "property",
    price: 180,
    group: "blue",
    color: "#78b9dd",
    subtitle: "水岸街区",
  },
  {
    name: "自来水公司",
    short: "水务",
    kind: "utility",
    price: 150,
    color: "#82bacf",
    subtitle: "公共事业",
  },
  {
    name: "运河新城",
    short: "运河",
    kind: "property",
    price: 200,
    group: "blue",
    color: "#78b9dd",
    subtitle: "水岸街区",
  },
  {
    name: "城市奇遇",
    short: "奇遇",
    kind: "chance",
    color: "#ecbb66",
    subtitle: "好运正在路上",
  },
  {
    name: "东方车站",
    short: "东站",
    kind: "station",
    price: 200,
    color: "#96a9b5",
    subtitle: "连锁车站",
  },
  {
    name: "艺术长廊",
    short: "艺术",
    kind: "property",
    price: 220,
    group: "violet",
    color: "#b3a0de",
    subtitle: "艺术街区",
  },
  {
    name: "星光博物馆",
    short: "博物馆",
    kind: "property",
    price: 240,
    group: "violet",
    color: "#b3a0de",
    subtitle: "艺术街区",
  },
  {
    name: "中央公园",
    short: "公园",
    kind: "parking",
    color: "#a7c8a0",
    subtitle: "领取城市奖池",
  },
  {
    name: "霓虹步行街",
    short: "霓虹",
    kind: "property",
    price: 260,
    group: "pink",
    color: "#e792b2",
    subtitle: "霓虹街区",
  },
  {
    name: "城市建设税",
    short: "税务",
    kind: "tax",
    color: "#bdaf92",
    subtitle: "缴纳 ₡120",
  },
  {
    name: "繁华商业街",
    short: "商业",
    kind: "property",
    price: 280,
    group: "pink",
    color: "#e792b2",
    subtitle: "霓虹街区",
  },
  {
    name: "道具商店",
    short: "商店",
    kind: "market",
    color: "#a8cb8e",
    subtitle: "每张道具 ₡90",
  },
  {
    name: "北方车站",
    short: "北站",
    kind: "station",
    price: 200,
    color: "#96a9b5",
    subtitle: "连锁车站",
  },
  {
    name: "天空之港",
    short: "天港",
    kind: "property",
    price: 300,
    group: "orange",
    color: "#eca669",
    subtitle: "港湾街区",
  },
  {
    name: "远洋中心",
    short: "远洋",
    kind: "property",
    price: 320,
    group: "orange",
    color: "#eca669",
    subtitle: "港湾街区",
  },
  {
    name: "前往拘留所",
    short: "拘留令",
    kind: "goJail",
    color: "#d88c82",
    subtitle: "直达拘留所",
  },
  {
    name: "珊瑚海岛",
    short: "海岛",
    kind: "property",
    price: 340,
    group: "teal",
    color: "#73c3bf",
    subtitle: "海岛街区",
  },
  {
    name: "新能源公司",
    short: "能源",
    kind: "utility",
    price: 150,
    color: "#bdd574",
    subtitle: "公共事业",
  },
  {
    name: "翡翠海湾",
    short: "海湾",
    kind: "property",
    price: 360,
    group: "teal",
    color: "#73c3bf",
    subtitle: "海岛街区",
  },
  {
    name: "城市奇遇",
    short: "奇遇",
    kind: "chance",
    color: "#ecbb66",
    subtitle: "命运掷下骰子",
  },
  {
    name: "西方车站",
    short: "西站",
    kind: "station",
    price: 200,
    color: "#96a9b5",
    subtitle: "连锁车站",
  },
  {
    name: "皇冠广场",
    short: "皇冠",
    kind: "property",
    price: 380,
    group: "gold",
    color: "#e9ca72",
    subtitle: "云端街区",
  },
  {
    name: "云上天际线",
    short: "云端",
    kind: "property",
    price: 400,
    group: "gold",
    color: "#e9ca72",
    subtitle: "云端街区",
  },
];
export const BOARD: Tile[] = raw.map((t, id) => ({ ...t, id }));
export const COLORS = [
  "#c7f36b",
  "#8ab9f1",
  "#e89baf",
  "#bc9ceb",
  "#efb778",
  "#7ac9bd",
];
export const NPC_NAMES = ["阿岚", "桃桃", "阿洛", "小橘", "沐沐"];
export const DIFFICULTIES: Record<
  Difficulty,
  { label: string; description: string }
> = {
  easy: { label: "简单", description: "随性购地，较少使用道具" },
  medium: { label: "中等", description: "控制现金，主动建房和交易" },
  hard: { label: "困难", description: "争夺街区，计算租金，策略用卡" },
};
export type CardId =
  | "remote"
  | "portal"
  | "shield"
  | "freeRent"
  | "boost"
  | "demolish"
  | "grant"
  | "steal"
  | "escape";
export type Card = {
  id: CardId;
  name: string;
  icon: string;
  description: string;
  timing: string;
  color: string;
  target?: "tile" | "ownProperty" | "enemyBuilding" | "player" | "dice";
};
export const CARDS: Card[] = [
  {
    id: "remote",
    name: "遥控骰子",
    icon: "Dices",
    description: "指定 2–12 步，代替本次掷骰。不会触发双骰奖励。",
    timing: "掷骰前",
    color: "#8ab9f1",
    target: "dice",
  },
  {
    id: "portal",
    name: "任意门",
    icon: "Orbit",
    description:
      "传送到任意普通格并结算落点。不领取经过起点的奖励，代替本次掷骰。",
    timing: "掷骰前",
    color: "#bc9ceb",
    target: "tile",
  },
  {
    id: "shield",
    name: "租金护盾",
    icon: "ShieldHalf",
    description: "获得一层护盾，下次租金减半。护盾持续到生效，不能叠加。",
    timing: "掷骰前 / 支付租金时",
    color: "#7ac9bd",
  },
  {
    id: "freeRent",
    name: "免租券",
    icon: "Ticket",
    description: "免除本次全部租金。支付前使用，房东不会收到这笔租金。",
    timing: "支付租金时",
    color: "#c7f36b",
  },
  {
    id: "boost",
    name: "租金翻倍",
    icon: "TrendingUp",
    description:
      "使一块自己的地产租金翻倍，持续到自己接下来的第 2 次回合开始。",
    timing: "掷骰前 / 回合结束前",
    color: "#efb778",
    target: "ownProperty",
  },
  {
    id: "demolish",
    name: "拆迁许可",
    icon: "Hammer",
    description: "拆除对手地产的一级建筑，对手不获得退款。酒店降为四栋房屋。",
    timing: "掷骰前 / 回合结束前",
    color: "#e89baf",
    target: "enemyBuilding",
  },
  {
    id: "grant",
    name: "城市补助",
    icon: "HandCoins",
    description: "立即领取 ₡150 城市发展补助。",
    timing: "掷骰前 / 回合结束前",
    color: "#c7f36b",
  },
  {
    id: "steal",
    name: "资金转移",
    icon: "ArrowLeftRight",
    description: "从一名对手现金中转移至多 ₡100；不会强制出售对手的地产。",
    timing: "掷骰前 / 回合结束前",
    color: "#eca669",
    target: "player",
  },
  {
    id: "escape",
    name: "出狱通行证",
    icon: "KeyRound",
    description: "立即免费离开拘留所，本回合可正常掷骰。",
    timing: "被拘留时、掷骰前",
    color: "#e9ca72",
  },
];
export const CARD_MAP = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
) as Record<CardId, Card>;
export const MAX_HAND = 6;
