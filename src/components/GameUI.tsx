import { useEffect, useRef, useState } from "react";
import {
  BOARD,
  CARDS,
  CARD_MAP,
  DIFFICULTIES,
  GROUPS,
  MAX_HAND,
  type CardId,
} from "../game/data";
import {
  acceptsTrade,
  canBuild,
  canMortgage,
  canSellBuilding,
  canUseCard,
  cardTargets,
  currentPlayer,
  minBid,
  netWorth,
  ownedTiles,
  redemptionCost,
  rentFor,
  tradeAllowed,
} from "../game/engine";
import { ranking } from "../game/ai";
import type { Action, GameState } from "../game/types";
import { Icon, money } from "./UI";

export function PlayerList({ state }: { state: GameState }) {
  return (
    <section className="panel players-panel">
      <div className="panel-heading">
        <h2>城市旅行家</h2>
        <span>
          {state.players.filter((p) => !p.bankrupt).length} /{" "}
          {state.players.length} 在场
        </span>
      </div>
      <div className="player-list">
        {state.players.map((p) => (
          <div
            key={p.id}
            className={`player-row ${state.current === p.id && state.phase !== "gameover" ? "active" : ""} ${p.bankrupt ? "eliminated" : ""}`}
          >
            <div className="avatar" style={{ background: p.color }}>
              <span>{p.human ? "你" : p.name.slice(-1)}</span>
              {state.current === p.id && <i />}
            </div>
            <div className="player-detail">
              <div className="player-name">
                <strong>{p.name}</strong>
                <span>
                  {p.human ? "玩家" : DIFFICULTIES[p.difficulty].label}
                </span>
                {p.jail > 0 && !p.bankrupt && (
                  <Icon name="KeyRound" size={13} />
                )}
                {p.shield && <Icon name="ShieldHalf" size={13} />}
              </div>
              <div className="player-meta">
                {p.bankrupt ? (
                  "已破产"
                ) : (
                  <>
                    <span>{ownedTiles(state, p.id).length} 块地产</span>
                    <span>{p.cards.length} 张卡</span>
                  </>
                )}
              </div>
            </div>
            <div className="player-cash">
              <strong>{money(p.cash)}</strong>
              <span>资产 {money(netWorth(state, p.id))}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
export function GameLog({ state }: { state: GameState }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = end.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.logSerial]);
  return (
    <section className="panel log-panel">
      <div className="panel-heading">
        <h2>城市动态</h2>
        <span className="live-dot">实时</span>
      </div>
      <div className="log-list" aria-live="polite" aria-relevant="additions">
        {state.logs.slice(-20).map((l) => (
          <div className={`log-line ${l.kind}`} key={l.id}>
            <i />
            <p>{l.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
    </section>
  );
}
export function Hand({
  state,
  disabled,
  onCard,
  onLibrary,
}: {
  state: GameState;
  disabled: boolean;
  onCard: (card: CardId) => void;
  onLibrary: () => void;
}) {
  const human = state.players[0],
    active = state.current === 0;
  return (
    <section className="panel hand-panel">
      <div className="panel-heading">
        <div className="inline-heading">
          <Icon name="Sparkles" size={18} />
          <h2>你的道具卡</h2>
          <span>
            {human.cards.length} / {MAX_HAND}
          </span>
        </div>
        <button className="text-button" onClick={onLibrary}>
          查看图鉴 <Icon name="ArrowUpRight" size={14} />
        </button>
      </div>
      <div className="hand-list">
        {human.cards.map((card, i) => {
          const c = CARD_MAP[card],
            usable = active && canUseCard(state, card) && !disabled;
          return (
            <button
              key={`${card}-${i}`}
              className={`hand-card ${usable ? "usable" : ""}`}
              aria-label={`使用${c.name}`}
              onClick={() => onCard(card)}
              style={{ "--card-color": c.color } as React.CSSProperties}
            >
              <div className="card-icon">
                <Icon name={c.icon} size={23} />
              </div>
              <div>
                <strong>{c.name}</strong>
                <span>{c.timing}</span>
              </div>
              <Icon name="ArrowUpRight" size={15} />
              <small>{usable ? "点击使用" : "查看详情"}</small>
            </button>
          );
        })}
        {human.cards.length === 0 && (
          <div className="hand-empty">
            <Icon name="Ticket" />
            <span>
              下一次经过起点，领取一张新卡。
              <br />
              <small>也可以在道具商店选购。</small>
            </span>
          </div>
        )}
      </div>
      <p className="hand-footnote">
        <i />
        每个回合最多使用 2 张 · 经过起点获得 1 张 · 商店每张 ₡90
        {active && <> · 本回合已用 {state.usedCards}/2</>}
      </p>
    </section>
  );
}
export function TileInfo({
  state,
  tile,
  onClose,
}: {
  state: GameState | null;
  tile: number;
  onClose: () => void;
}) {
  const t = BOARD[tile],
    e = state?.estates[tile],
    owner =
      e?.owner !== null && e?.owner !== undefined
        ? state!.players[e.owner]
        : null;
  return (
    <div className="tile-info">
      <div className="tile-info-top">
        <i style={{ background: t.color }} />
        <div>
          <strong>{t.name}</strong>
          <span>{t.subtitle}</span>
        </div>
        <button
          className="icon-button small"
          aria-label="关闭格子详情"
          onClick={onClose}
        >
          <Icon name="X" size={16} />
        </button>
      </div>
      {t.price ? (
        <div className="tile-stats">
          <span>
            售价<strong>{money(t.price)}</strong>
          </span>
          <span>
            租金
            <strong>
              {state && e?.owner !== null
                ? money(rentFor(state, tile))
                : money(
                    t.kind === "station"
                      ? 25
                      : t.kind === "utility"
                        ? 28
                        : Math.floor(t.price / 10),
                  )}
            </strong>
          </span>
          <span>
            归属<strong>{owner?.name || "银行"}</strong>
          </span>
        </div>
      ) : (
        <p>
          {t.kind === "chance"
            ? "奖金、卡包、旅行或意外事件，落点立即触发。"
            : t.kind === "parking"
              ? `本次奖池 ${money(state?.fund ?? 0)}，停留即可领取。`
              : t.kind === "goJail"
                ? "进入拘留所且失去双骰奖励。"
                : t.kind === "jail"
                  ? "普通路过无需停留；被拘留后最多尝试 3 次双骰。"
                  : t.kind === "market"
                    ? "随机展示 3 张卡，本次可购买其中 1 张。"
                    : t.kind === "start"
                      ? "经过起点领取 ₡200 和 1 张道具卡。"
                      : "缴纳的税款计入中央公园奖池。"}
        </p>
      )}
      {e && (!!e.level || !!e.boost) && (
        <div className="tile-status">
          {e.level > 0 && (e.level === 5 ? "★ 酒店" : `${e.level} 栋房屋`)}
          {e.boost > 0 && `${e.level > 0 ? " · " : ""}租金翻倍中`}
        </div>
      )}
      {e?.mortgaged && <div className="tile-status">已抵押 · 暂停收取租金</div>}
    </div>
  );
}
type TurnProps = {
  state: GameState;
  busy: boolean;
  paused: boolean;
  dispatch: (a: Action) => void;
  onAssets: () => void;
  onResult: () => void;
};
export function TurnPanel({
  state: s,
  busy,
  paused,
  dispatch,
  onAssets,
  onResult,
}: TurnProps) {
  const p = currentPlayer(s),
    human = p.human && !p.bankrupt,
    t = BOARD[p.position];
  let title = `${p.name}的回合`,
    subtitle = "正在思考下一步…",
    icon = "Dices";
  let buttons: React.ReactNode = null;
  const button = (
    text: string,
    action: Action,
    primary = true,
    disabled = false,
  ) => (
    <button
      className={primary ? "button primary" : "button secondary"}
      disabled={busy || disabled}
      onClick={() => dispatch(action)}
    >
      {text}
      <Icon
        name={action.type === "ROLL" ? "Dices" : "ChevronRight"}
        size={18}
      />
    </button>
  );
  if (s.phase === "gameover") {
    title = `${s.players[s.winner!].name}赢得本局`;
    subtitle = s.endReason;
    icon = "Trophy";
    buttons = (
      <button className="button primary" onClick={onResult}>
        查看最终排名 <Icon name="Trophy" size={18} />
      </button>
    );
  } else if (s.phase === "auction" && s.auction) {
    const a = s.auction,
      bidder = s.players[a.bidder];
    title = `${BOARD[a.tile].name} · 公开拍卖`;
    subtitle = `当前出价 ${money(a.bid)} · ${bidder.name}出价`;
    icon = "Landmark";
    if (bidder.human)
      buttons = (
        <>
          {button(
            `出价 ${money(minBid(s))}`,
            { type: "BID", amount: minBid(s) },
            true,
            bidder.cash < minBid(s),
          )}
          {button("退出拍卖", { type: "PASS_BID" }, false)}
        </>
      );
  } else if (human) {
    if (s.phase === "roll") {
      title = p.jail ? "拘留所的一天" : "到你了，向城市出发";
      subtitle = p.jail
        ? `尝试双骰离开，或保释 ₡50 · 已尝试 ${p.jail - 1}/3 次`
        : "先用道具卡、管理地产，或直接掷骰。";
      buttons = (
        <>
          {p.jail > 0 && button("保释 ₡50", { type: "BAIL" }, false)}
          {button(p.jail ? "尝试双骰" : "掷骰出发", { type: "ROLL" })}
        </>
      );
    } else if (s.phase === "purchase") {
      title = `让${t.name}成为你的`;
      subtitle = `${t.subtitle} · ${money(t.price!)} · 放弃后进入全员拍卖`;
      icon = "Building2";
      buttons = (
        <>
          {button("放弃 / 拍卖", { type: "DECLINE" }, false)}
          {button(
            `购买 ${money(t.price!)}`,
            { type: "BUY" },
            true,
            p.cash < t.price!,
          )}
        </>
      );
    } else if (s.phase === "rent") {
      title = `抵达${t.name}`;
      subtitle = `向${s.players[s.rent!.owner].name}支付租金；可以先使用免租券或护盾。`;
      icon = "Coins";
      buttons = button(
        `支付 ${money(p.shield ? Math.ceil(s.rent!.amount / 2) : s.rent!.amount)}`,
        { type: "PAY_RENT" },
      );
    } else if (s.phase === "debt") {
      title = `需要筹集 ${money(s.debt!.amount)}`;
      subtitle = `现金 ${money(p.cash)} · 出售建筑或抵押地产来偿付`;
      icon = "Landmark";
      buttons = (
        <button className="button secondary" disabled={busy} onClick={onAssets}>
          管理资产
        </button>
      );
      if (p.cash >= s.debt!.amount)
        buttons = (
          <>
            {buttons}
            {button("偿付欠款", { type: "SETTLE_DEBT" })}
          </>
        );
      else
        buttons = (
          <>
            {buttons}
            {button("宣告破产", { type: "BANKRUPT" }, false)}
          </>
        );
    } else if (s.phase === "market") {
      title = "欢迎来到道具商店";
      subtitle = `本次可买 1 张 · 每张 ₡90 · 卡包 ${p.cards.length}/6`;
      icon = "ShoppingBag";
      buttons = button("离开商店", { type: "LEAVE_MARKET" }, false);
    } else if (s.phase === "end") {
      title = s.extraTurn ? "双骰奖励，再来一次" : "这一站，告一段落";
      subtitle = "可以使用道具或管理地产，然后继续。";
      buttons = button(s.extraTurn ? "继续掷骰" : "结束回合", {
        type: "END_TURN",
      });
    }
  }
  if (busy) subtitle = "骰子落定，正在前往下一站…";
  else if (
    !human &&
    s.phase !== "gameover" &&
    !(s.phase === "auction" && s.auction && s.players[s.auction.bidder].human)
  )
    subtitle = paused
      ? "自动回合已暂停，点击右上角继续。"
      : `${p.bankrupt ? "观战中" : `${p.name}正在行动`} · NPC 会自动购买、建造和使用道具`;
  return (
    <>
      <section className="turn-panel">
        <div className="turn-symbol">
          <Icon name={icon} size={25} />
        </div>
        <div className="turn-copy">
          <span>
            {s.phase === "gameover"
              ? "THE CITY HAS A WINNER"
              : human
                ? "YOUR MOVE"
                : "CITY IN MOTION"}
          </span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="turn-actions">
          {buttons || (
            <div className="npc-thinking">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      </section>
      {s.phase === "market" && human && (
        <div className="market-strip">
          {s.market.map((card) => (
            <button
              key={card}
              className="market-card"
              disabled={busy || p.cash < 90 || p.cards.length >= MAX_HAND}
              onClick={() => dispatch({ type: "BUY_CARD", card })}
            >
              <span style={{ color: CARD_MAP[card].color }}>
                <Icon name={CARD_MAP[card].icon} size={22} />
              </span>
              <div>
                <strong>{CARD_MAP[card].name}</strong>
                <small>{CARD_MAP[card].description}</small>
              </div>
              <b>₡90</b>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function Assets({
  state: s,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
}) {
  const p = s.players[0],
    tiles = ownedTiles(s, 0),
    active = s.current === 0 && ["roll", "end", "debt"].includes(s.phase);
  return (
    <>
      <div className="asset-summary">
        <div>
          <small>可用现金</small>
          <strong>{money(p.cash)}</strong>
        </div>
        <div>
          <small>总资产</small>
          <strong>{money(netWorth(s, 0))}</strong>
        </div>
        <div>
          <small>持有地产</small>
          <strong>{tiles.length} 块</strong>
        </div>
      </div>
      <p className="muted helper">
        集齐同色街区后可均衡建房（最多 4 栋 +
        酒店）。抵押前须出售整个街区的建筑。
        {!active && "请在你的掷骰前或回合结束前操作。"}
      </p>
      {tiles.length ? (
        <div className="asset-list">
          {tiles.map((t) => {
            const e = s.estates[t.id],
              buildPrice = t.group ? GROUPS[t.group].build : 0;
            return (
              <article className="asset-row" key={t.id}>
                <i style={{ background: t.color }} />
                <div className="asset-copy">
                  <strong>{t.name}</strong>
                  <span>
                    {e.mortgaged ? "已抵押" : `租金 ${money(rentFor(s, t.id))}`}{" "}
                    ·{" "}
                    {e.level === 5
                      ? "酒店"
                      : e.level
                        ? `${e.level} 栋房屋`
                        : t.subtitle}
                    {e.boost > 0 && " · 翻倍中"}
                  </span>
                </div>
                <div className="asset-buttons">
                  {t.group && (
                    <>
                      <button
                        disabled={
                          !active ||
                          s.phase === "debt" ||
                          !canBuild(s, 0, t.id) ||
                          p.cash < buildPrice
                        }
                        onClick={() => dispatch({ type: "BUILD", tile: t.id })}
                        title={`建造一级 ₡${buildPrice}`}
                      >
                        建造 {money(buildPrice)}
                      </button>
                      <button
                        disabled={!active || !canSellBuilding(s, 0, t.id)}
                        onClick={() =>
                          dispatch({ type: "SELL_BUILDING", tile: t.id })
                        }
                      >
                        卖楼 +{money(Math.floor(buildPrice / 2))}
                      </button>
                    </>
                  )}
                  {e.mortgaged ? (
                    <button
                      disabled={
                        !active ||
                        s.phase === "debt" ||
                        p.cash < redemptionCost(t.id)
                      }
                      onClick={() => dispatch({ type: "REDEEM", tile: t.id })}
                    >
                      赎回 {money(redemptionCost(t.id))}
                    </button>
                  ) : (
                    <button
                      disabled={!active || !canMortgage(s, 0, t.id)}
                      onClick={() => dispatch({ type: "MORTGAGE", tile: t.id })}
                    >
                      抵押 +{money(Math.floor(t.price! / 2))}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="Building2" size={38} />
          <h3>你的第一块地产，在下一站等你</h3>
          <p>落在无人拥有的地产上即可购买，也可以参与拍卖。</p>
        </div>
      )}
      {s.phase === "debt" && s.current === 0 && p.cash >= s.debt!.amount && (
        <button
          className="button primary full"
          onClick={() => dispatch({ type: "SETTLE_DEBT" })}
        >
          偿付欠款 {money(s.debt!.amount)}
        </button>
      )}
    </>
  );
}
export function Trade({
  state: s,
  dispatch,
}: {
  state: GameState;
  dispatch: (action: Action) => void;
}) {
  const opponents = s.players.filter((p) => !p.human && !p.bankrupt);
  const [target, setTarget] = useState(opponents[0]?.id ?? 1),
    [give, setGive] = useState<number | null>(null),
    [take, setTake] = useState<number | null>(null),
    [cash, setCash] = useState(0),
    [done, setDone] = useState(false);
  const giving = ownedTiles(s, 0).filter((t) => tradeAllowed(s, t.id, 0)),
    taking = ownedTiles(s, target).filter((t) => tradeAllowed(s, t.id, target));
  const accepts = acceptsTrade(s, 0, target, give, take, cash),
    active = s.current === 0 && ["roll", "end"].includes(s.phase);
  return (
    <div className="trade-form">
      <p className="muted">
        用地产和现金换取对手的地产，集齐你的街区。已建房街区须先出售全部建筑。
      </p>
      <label>
        交易对象
        <select
          value={target}
          onChange={(e) => {
            setTarget(Number(e.target.value));
            setTake(null);
            setDone(false);
          }}
        >
          {opponents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {DIFFICULTIES[p.difficulty].label} · 现金{" "}
              {money(p.cash)}
            </option>
          ))}
        </select>
      </label>
      <div className="trade-columns">
        <label>
          你交出的地产
          <select
            value={give ?? ""}
            onChange={(e) => {
              setGive(e.target.value === "" ? null : Number(e.target.value));
              setDone(false);
            }}
          >
            <option value="">不提供地产</option>
            {giving.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
                {s.estates[t.id].mortgaged ? "（已抵押）" : ""}
              </option>
            ))}
          </select>
        </label>
        <Icon name="ArrowLeftRight" />
        <label>
          你收到的地产
          <select
            value={take ?? ""}
            onChange={(e) => {
              setTake(e.target.value === "" ? null : Number(e.target.value));
              setDone(false);
            }}
          >
            <option value="">不索取地产</option>
            {taking.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
                {s.estates[t.id].mortgaged ? "（已抵押）" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        现金差额（正数为你支付，负数为对手支付）
        <input
          type="number"
          step="10"
          min={-s.players[target].cash}
          max={s.players[0].cash}
          value={cash}
          onChange={(e) => {
            setCash(Number(e.target.value));
            setDone(false);
          }}
        />
      </label>
      <div className={`trade-verdict ${accepts ? "accepted" : ""}`}>
        <Icon name={accepts ? "Check" : "CircleHelp"} />
        <span>
          {done
            ? "交易已完成，可以继续发起新的交易。"
            : accepts
              ? `${s.players[target].name}愿意接受这个方案`
              : "对手暂不接受。提高报价，或调整交换的地产。"}
        </span>
      </div>
      <button
        className="button primary full"
        disabled={!accepts || !active}
        onClick={() => {
          dispatch({ type: "TRADE", target, give, take, cash });
          setGive(null);
          setTake(null);
          setCash(0);
          setDone(true);
        }}
      >
        确认交易 <Icon name="ArrowLeftRight" size={18} />
      </button>
      {!active && (
        <p className="muted helper">请在你的掷骰前或回合结束前交易。</p>
      )}
    </div>
  );
}
export function CardDetail({
  state,
  card,
  disabled,
  onPlay,
}: {
  state: GameState;
  card: CardId;
  disabled: boolean;
  onPlay: (target?: number) => void;
}) {
  const c = CARD_MAP[card],
    targets = cardTargets({ ...state, current: 0 }, card),
    [target, setTarget] = useState(targets[0]);
  const usable = state.current === 0 && canUseCard(state, card) && !disabled;
  return (
    <div className="card-detail">
      <div className="card-detail-icon" style={{ background: c.color }}>
        <Icon name={c.icon} size={44} />
      </div>
      <p>{c.description}</p>
      <div className="card-timing">
        <Icon name="Flag" size={16} /> 使用时机：{c.timing}
      </div>
      {c.target && targets.length > 0 && (
        <label>
          {c.target === "dice" ? "选择前进步数" : "选择目标"}
          <select
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          >
            {targets.map((t) => (
              <option key={t} value={t}>
                {c.target === "dice"
                  ? `${t} 步 → ${BOARD[(state.players[0].position + t) % 32].name}`
                  : c.target === "player"
                    ? `${state.players[t].name} · ${money(state.players[t].cash)}`
                    : BOARD[t].name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="button primary full"
        disabled={!usable || (!!c.target && !targets.includes(target))}
        onClick={() => onPlay(target)}
      >
        使用{c.name} <Icon name="Sparkles" size={18} />
      </button>
      {!usable && (
        <p className="muted helper">
          {state.current !== 0
            ? "请等待你的回合。"
            : state.usedCards >= 2
              ? "本回合已使用 2 张道具卡。"
              : "当前阶段或目标不满足使用条件。"}
        </p>
      )}
    </div>
  );
}
export function BoardOverview({
  state,
  onSelect,
}: {
  state: GameState | null;
  onSelect: (id: number) => void;
}) {
  return (
    <>
      <p className="muted helper">
        点击街角查看详情。地产底色对应街区，圆点代表当前停留的旅行家。
      </p>
      <div className="board-overview">
        {BOARD.map((t) => {
          const e = state?.estates[t.id];
          const owner =
            e?.owner !== null && e?.owner !== undefined
              ? state!.players[e.owner]
              : null;
          return (
            <button
              key={t.id}
              style={{ borderLeftColor: t.color }}
              onClick={() => onSelect(t.id)}
            >
              <span className="map-index">{String(t.id).padStart(2, "0")}</span>
              <strong>{t.name}</strong>
              <small>
                {owner
                  ? `${owner.name}${e?.mortgaged ? " · 抵押" : ` · 租金 ${money(rentFor(state!, t.id))}`}`
                  : t.price
                    ? `银行 · ${money(t.price)}`
                    : t.subtitle}
              </small>
              <div className="map-pawns">
                {state?.players
                  .filter((p) => !p.bankrupt && p.position === t.id)
                  .map((p) => (
                    <i
                      key={p.id}
                      title={p.name}
                      style={{ background: p.color }}
                    />
                  ))}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
export function CardLibrary() {
  return (
    <>
      <p className="muted helper">
        开局每人 2 张；每次经过起点获得 1 张；奇遇可能赠送 2 张；商店每张
        ₡90。卡包上限 6 张，免费抽卡溢出时改领 ₡30。每回合最多使用 2
        张，双骰加掷仍属于同一回合。
      </p>
      <div className="card-library">
        {CARDS.map((c) => (
          <article key={c.id}>
            <div
              className="library-icon"
              style={{ background: `${c.color}40`, color: "#3b5146" }}
            >
              <Icon name={c.icon} size={25} />
            </div>
            <div>
              <h3>{c.name}</h3>
              <p>{c.description}</p>
              <span>{c.timing}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export function Rules() {
  return (
    <div className="rules-content">
      <p className="rules-intro">
        买下喜欢的街角，建起自己的天际线。运气决定落点，策略决定城市属于谁。
      </p>
      {[
        [
          "01",
          "出发与胜利",
          "你和 3–5 位 NPC 各携带 ₡1,600 与 2 张道具卡。每次经过起点获得 ₡200 与 1 张卡。选择限轮模式时，完成最后一轮后按总资产（现金 + 地产净值 + 建筑原价）排名，平局依现金、座位顺序决定；自由模式持续到只剩一人。",
        ],
        [
          "02",
          "买地、租金与拍卖",
          "落在空地上可按标价购买；放弃时，全体未破产玩家轮流竞拍，底价为原价的 40%，每次至少加价 ₡10，退出后不可再次加入。落在对手未抵押的地产上支付租金。车站越多租金越高（₡25/50/100/200）；公共事业租金为本次骰子总点数 × 4，集齐两家则 × 10。",
        ],
        [
          "03",
          "房屋、酒店与抵押",
          "集齐同色的 2 块地产，空地基础租金翻倍，可均衡建设：先让每块达到同一级，再继续升级。最多 4 栋房屋，第 5 级为酒店。租金倍率依次为基础的 1/5/14/32/48/65 倍。均衡出售建筑返还建造费的一半。街区没有建筑时，地产可按原价 50% 抵押，55% 赎回；抵押期间不收租。",
        ],
        [
          "04",
          "双骰与拘留所",
          "两个骰子相同，本次落点结算后再掷一次；连续 3 次双骰会立即被拘留。拘留时可支付 ₡50、使用出狱通行证或尝试双骰。最多尝试 3 次，第 3 次失败须支付 ₡50 后按该次点数移动。出狱双骰不会额外加掷。",
        ],
        [
          "05",
          "奇遇、商店与公园",
          "奇遇包含现金奖金、维修费、回到起点、拘留、卡包、生日礼金或顺风车。税款与保释金流入中央公园奖池，停在公园的玩家领取全部。商店随机展示 3 张卡，可选购 1 张。普通路过拘留所无需停留。",
        ],
        [
          "06",
          "道具与交易",
          "每回合可使用最多 2 张卡，所有卡的使用时机与效果可在图鉴查看。任意门和遥控骰子会代替本次掷骰。可以在掷骰前或结束回合前管理资产、与 NPC 交易；每个 NPC 会根据难度、地产价值和成套潜力判断报价。",
        ],
        [
          "07",
          "现金不足与破产",
          "无法支付时进入筹款阶段，可均衡卖楼或抵押地产。筹到现金后手动偿付，NPC 自动处理。宣告破产时，欠租玩家将剩余现金、地产和可容纳的道具移交债权人；欠银行则地产归还银行。玩家破产后可以继续观战。",
        ],
        [
          "08",
          "保存与操作",
          "每个动作后自动保存到本机浏览器，刷新后在首页选择继续旅程。拖动旋转棋盘，右键或 Shift + 拖动平移，滚轮缩放；触屏单指旋转、双指平移或缩放。切换视角会回到棋盘中心，点击格子查看详情。NPC 有相同初始资源和骰子规则，难度仅改变决策策略。",
        ],
      ].map(([number, title, text]) => (
        <article key={number}>
          <span>{number}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
export function Results({
  state,
  onNew,
}: {
  state: GameState;
  onNew: () => void;
}) {
  const winner = state.players[state.winner ?? ranking(state)[0].id];
  return (
    <div className="results">
      <div className="winner-crown">
        <Icon name="Trophy" size={48} />
      </div>
      <span className="eyebrow">THE CITY IS YOURS</span>
      <h2>{winner.name}，城市之王</h2>
      <p>{state.endReason}</p>
      <div className="ranking-list">
        {ranking(state).map((p, i) => (
          <div key={p.id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <i style={{ background: p.color }} />
            <strong>
              {p.name}
              {p.human ? " · 你" : ""}
            </strong>
            <small>
              {p.bankrupt
                ? "已破产"
                : `${ownedTiles(state, p.id).length} 块地产`}
            </small>
            <b>{money(netWorth(state, p.id))}</b>
          </div>
        ))}
      </div>
      <button className="button primary full" onClick={onNew}>
        开启下一段旅程 <Icon name="ArrowUpRight" size={20} />
      </button>
    </div>
  );
}
