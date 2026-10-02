import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  BOARD,
  COLORS,
  DIFFICULTIES,
  NPC_NAMES,
  type CardId,
  type Difficulty,
} from "./game/data";
import { currentPlayer, gameReducer, newGame, ownedTiles } from "./game/engine";
import { aiAction } from "./game/ai";
import { loadGame, saveGame } from "./game/storage";
import type { Action, GameState } from "./game/types";
import {
  Assets,
  BoardOverview,
  CardDetail,
  CardLibrary,
  GameLog,
  Hand,
  PlayerList,
  Results,
  Rules,
  TileInfo,
  Trade,
  TurnPanel,
} from "./components/GameUI";
import { Dice, Icon, Modal } from "./components/UI";
import "./styles.css";
const Board = lazy(() => import("./components/Board"));
type Dialog =
  | "rules"
  | "cards"
  | "assets"
  | "trade"
  | "settings"
  | "new"
  | "results"
  | "map"
  | null;
type Preferences = { speed: number; sound: boolean };
function getPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem("city-circuit-prefs") || "{}");
    return {
      speed: [350, 850, 1400].includes(p.speed) ? p.speed : 850,
      sound: p.sound === true,
    };
  } catch {
    return { speed: 850, sound: false };
  }
}
let audioContext: AudioContext | null = null;
function soundEffect() {
  try {
    audioContext ??= new AudioContext();
    void audioContext.resume();
    const oscillator = audioContext.createOscillator(),
      gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      260,
      audioContext.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(0.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.16,
    );
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.17);
  } catch {
    /* Audio is optional. */
  }
}

export default function App() {
  const [saved] = useState(loadGame),
    [state, setState] = useState<GameState | null>(saved),
    [playing, setPlaying] = useState(false);
  const [name, setName] = useState(saved?.players[0].name || "旅行家");
  const [npcCount, setNpcCount] = useState(
    saved ? saved.players.length - 1 : 3,
  );
  const [difficulties, setDifficulties] = useState<Difficulty[]>(
    saved
      ? [
          ...saved.players.slice(1).map((p) => p.difficulty),
          "medium" as Difficulty,
          "medium" as Difficulty,
        ].slice(0, 5)
      : ["easy", "medium", "hard", "medium", "hard"],
  );
  const [maxRounds, setMaxRounds] = useState(saved?.maxRounds ?? 30);
  const [dialog, setDialog] = useState<Dialog>(null),
    [card, setCard] = useState<CardId | null>(null);
  const [selected, setSelected] = useState<number | null>(null),
    [view, setView] = useState(0);
  const [paused, setPaused] = useState(false),
    [busy, setBusy] = useState(false),
    [preferences, setPreferences] = useState(getPreferences);
  const [savedOkay, setSavedOkay] = useState(true);
  const movementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeDialog = useCallback(() => {
    setDialog(null);
    setCard(null);
  }, []);
  const dispatch = useCallback(
    (action: Action) => {
      if (!state || busy) return;
      const next = gameReducer(state, action);
      if (next === state) return;
      if (preferences.sound) soundEffect();
      if (
        next.movementSerial !== state.movementSerial ||
        action.type === "ROLL"
      ) {
        setBusy(true);
        if (movementTimer.current) clearTimeout(movementTimer.current);
        movementTimer.current = setTimeout(
          () => setBusy(false),
          Math.max(950, (next.movement?.steps ?? 0) * 105 + 350),
        );
      }
      setState(next);
    },
    [state, busy, preferences.sound],
  );
  useEffect(() => {
    if (state && playing) setSavedOkay(saveGame(state));
  }, [state, playing]);
  useEffect(() => {
    try {
      localStorage.setItem("city-circuit-prefs", JSON.stringify(preferences));
    } catch {
      /* Preferences do not block play. */
    }
  }, [preferences]);
  useEffect(
    () => () => {
      if (movementTimer.current) clearTimeout(movementTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (
      !playing ||
      !state ||
      paused ||
      busy ||
      dialog ||
      card ||
      state.phase === "gameover"
    )
      return;
    const actor =
      state.phase === "auction" && state.auction
        ? state.players[state.auction.bidder]
        : currentPlayer(state);
    if (actor.human && !actor.bankrupt) return;
    const timer = setTimeout(() => {
      const action = aiAction(state);
      if (action) dispatch(action);
    }, preferences.speed);
    return () => clearTimeout(timer);
  }, [playing, state, paused, busy, dialog, card, preferences.speed, dispatch]);
  useEffect(() => {
    if (playing && state?.phase === "gameover") setDialog("results");
  }, [playing, state?.phase]);
  const start = () => {
    if (movementTimer.current) clearTimeout(movementTimer.current);
    setBusy(false);
    setPaused(false);
    setSelected(null);
    setCard(null);
    setDialog(null);
    setState(
      newGame({
        name,
        npcDifficulties: difficulties.slice(0, npcCount),
        maxRounds,
      }),
    );
    setPlaying(true);
  };
  const setup = () => {
    setDialog(null);
    setCard(null);
    setPlaying(false);
    setPaused(false);
    setSelected(null);
  };
  const active = !!state && playing;
  const yourTurn =
    active &&
    state.current === 0 &&
    !state.players[0].bankrupt &&
    state.phase !== "gameover";
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            if (active) setDialog("new");
          }}
          aria-label="环游富翁首页"
        >
          <div className="brand-mark">
            <Icon name="Building2" size={25} />
          </div>
          <div>
            <strong>
              环游富翁<span>®</span>
            </strong>
            <small>CITY CIRCUIT</small>
          </div>
        </a>
        <div className="header-tagline">一点运气，一整座城市。</div>
        <nav className="header-nav">
          <button className="nav-button" onClick={() => setDialog("rules")}>
            <Icon name="CircleHelp" size={17} />
            <span>玩法指南</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setPreferences((p) => ({ ...p, sound: !p.sound }))}
            aria-label={preferences.sound ? "关闭音效" : "开启音效"}
          >
            <Icon name={preferences.sound ? "Volume2" : "VolumeX"} size={19} />
          </button>
          <button
            className="icon-button"
            onClick={() => setDialog("settings")}
            aria-label="游戏设置"
          >
            <Icon name="Settings2" size={19} />
          </button>
          {active && (
            <button
              className="button compact secondary"
              onClick={() => setDialog("new")}
            >
              新旅程 <Icon name="ArrowUpRight" size={16} />
            </button>
          )}
        </nav>
      </header>
      <main>
        {!active ? (
          <>
            <div className="welcome-heading">
              <div>
                <div className="eyebrow">
                  <i /> YOUR NEXT LITTLE ADVENTURE
                </div>
                <h1>
                  下一站，<span>你的城市。</span>
                  <span className="title-star">✳</span>
                </h1>
                <p>掷骰、买地、建造。和性格各异的旅行家，来一场城市争夺战。</p>
              </div>
              <div className="welcome-note">
                <Icon name="Orbit" size={27} />
                <span>
                  3D 城市棋盘
                  <br />
                  <small>在每一个街角，发现可能。</small>
                </span>
              </div>
            </div>
            <div className="welcome-layout">
              <div className="welcome-board">
                <div className="scene-top">
                  <span className="pill">
                    <i /> 城市已就绪
                  </span>
                  <span className="scene-label">32 个街角 / 无限可能</span>
                </div>
                <div className="welcome-canvas">
                  <Suspense
                    fallback={
                      <div className="scene-loading">正在搭建你的城市…</div>
                    }
                  >
                    <Board
                      state={null}
                      selected={selected}
                      onSelect={setSelected}
                      view={view}
                    />
                  </Suspense>
                </div>
                {selected !== null && (
                  <TileInfo
                    state={null}
                    tile={selected}
                    onClose={() => setSelected(null)}
                  />
                )}
                <div className="scene-bottom">
                  <span>
                    <Icon name="Orbit" size={14} /> 拖动旋转 · 右键 / 双指平移 ·
                    滚轮缩放
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setView((v) => v + 1)}
                    aria-label="切换棋盘视角"
                  >
                    <Icon name="MapPin" size={17} />
                  </button>
                </div>
                <div className="scene-corner-tag">
                  一座城市，等你落子。<span>EST. 2026</span>
                </div>
              </div>
              <section className="panel setup-panel">
                <div className="setup-heading">
                  <div className="eyebrow">LET’S GET GOING</div>
                  <h2>准备好出发了吗？</h2>
                  <p>选好你的同行者，故事就此开始。</p>
                </div>
                <label className="field-label" htmlFor="player-name">
                  你的名字
                  <input
                    id="player-name"
                    value={name}
                    maxLength={12}
                    placeholder="给自己取个名字"
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="field-label">
                  NPC 同行者<span className="field-note">每位难度独立设置</span>
                  <div className="segmented count-options">
                    {[3, 4, 5].map((n) => (
                      <button
                        className={npcCount === n ? "chosen" : ""}
                        onClick={() => setNpcCount(n)}
                        key={n}
                        aria-pressed={npcCount === n}
                      >
                        {n} 位 NPC<span>{n + 1} 人局</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="npc-setup-list">
                  {difficulties.slice(0, npcCount).map((d, i) => (
                    <div className="npc-setup" key={i}>
                      <div
                        className="avatar small-avatar"
                        style={{ background: COLORS[i + 1] }}
                      >
                        {NPC_NAMES[i].slice(-1)}
                      </div>
                      <strong>{NPC_NAMES[i]}</strong>
                      <select
                        aria-label={`${NPC_NAMES[i]}的难度`}
                        value={d}
                        onChange={(e) =>
                          setDifficulties((old) =>
                            old.map((value, j) =>
                              i === j ? (e.target.value as Difficulty) : value,
                            ),
                          )
                        }
                      >
                        {Object.entries(DIFFICULTIES).map(([key, value]) => (
                          <option value={key} key={key}>
                            {value.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <label className="field-label" htmlFor="rounds">
                  旅程长度
                  <select
                    id="rounds"
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Number(e.target.value))}
                  >
                    <option value={20}>轻松一局 · 20 轮</option>
                    <option value={30}>城市之争 · 30 轮</option>
                    <option value={50}>长途旅行 · 50 轮</option>
                    <option value={0}>自由旅程 · 直到只剩一人</option>
                  </select>
                </label>
                <p className="round-hint">
                  {maxRounds
                    ? "完成指定轮数后，总资产最高的旅行家获胜。"
                    : "自由旅程没有轮数限制，最后一位未破产玩家获胜。"}
                </p>
                <button
                  className="button primary full start-button"
                  onClick={start}
                >
                  开启新旅程 <Icon name="ArrowUpRight" size={21} />
                </button>
                {state && (
                  <button
                    className="continue-button"
                    onClick={() => {
                      setPlaying(true);
                      setBusy(false);
                    }}
                  >
                    继续上次旅程{" "}
                    <span>
                      第 {state.round} 轮 <Icon name="ChevronRight" size={15} />
                    </span>
                  </button>
                )}
                <div className="setup-footnote">
                  <Icon name="Check" size={13} /> 无需登录 · 自动存档 ·
                  纯前端运行
                </div>
              </section>
            </div>
            <div className="feature-strip">
              {[
                [
                  "Building2",
                  "把街角，变成你的地盘",
                  "集齐街区，建房升级，让租金为你工作。",
                ],
                [
                  "Sparkles",
                  "好牌，留给关键时刻",
                  "9 种道具卡，给每一次掷骰多一点想象。",
                ],
                [
                  "Dices",
                  "各有策略，才有意思",
                  "每位 NPC 独立难度，用你的方式赢下城市。",
                ],
              ].map(([icon, title, sub], i) => (
                <div key={title}>
                  <span className="feature-number">0{i + 1}</span>
                  <div className="feature-icon">
                    <Icon name={icon} size={24} />
                  </div>
                  <div>
                    <h3>{title}</h3>
                    <p>{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="game-topline">
              <div>
                <span className="eyebrow">THE CITY IS IN PLAY</span>
                <h1>
                  {state.players[0].bankrupt
                    ? "城市继续，坐看风云。"
                    : state.phase === "gameover"
                      ? "这座城市，有了新的主人。"
                      : "你的城市，正在生长。"}
                </h1>
              </div>
              <div className="session-status">
                <span
                  className={`save-status ${savedOkay ? "" : "save-failed"}`}
                >
                  <Icon name={savedOkay ? "Check" : "CircleHelp"} size={13} />
                  {savedOkay ? "已自动保存" : "浏览器存储不可用"}
                </span>
                <button
                  className="pause-button"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "继续自动回合" : "暂停自动回合"}
                >
                  <Icon name={paused ? "Play" : "Pause"} size={14} />
                  <span>{paused ? "继续" : "暂停"}</span>
                </button>
              </div>
            </div>
            <div className="game-layout">
              <div className="game-main">
                <div className="game-board">
                  <div className="scene-top">
                    <span className="pill round-pill">
                      <span className="round-number">
                        {String(state.round).padStart(2, "0")}
                      </span>
                      <span>
                        当前轮次
                        <small>
                          {state.maxRounds
                            ? `/ ${state.maxRounds} 轮`
                            : "自由旅程"}
                        </small>
                      </span>
                    </span>
                    <div className="board-tools">
                      <button
                        className="icon-button"
                        onClick={() => setDialog("map")}
                        aria-label="城市地图"
                      >
                        <Icon name="MapPin" size={18} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setView((v) => v + 1)}
                        aria-label="切换棋盘视角"
                      >
                        <Icon name="Orbit" size={18} />
                      </button>
                      <button
                        className="icon-button"
                        onClick={() => setDialog("cards")}
                        aria-label="道具图鉴"
                      >
                        <Icon name="Sparkles" size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="game-canvas">
                    <Suspense
                      fallback={
                        <div className="scene-loading">正在加载城市…</div>
                      }
                    >
                      <Board
                        state={state}
                        selected={selected}
                        onSelect={setSelected}
                        view={view}
                      />
                    </Suspense>
                  </div>
                  {selected !== null && (
                    <TileInfo
                      state={state}
                      tile={selected}
                      onClose={() => setSelected(null)}
                    />
                  )}
                  <div className="board-bottom">
                    <div className="board-legend">
                      <i
                        style={{
                          background: state.players[state.current].color,
                        }}
                      />
                      <span>
                        {state.players[state.current].name} ·{" "}
                        {BOARD[currentPlayer(state).position].name}
                      </span>
                    </div>
                    <div className="dice-pair">
                      <Dice value={state.dice[0]} rolling={busy} />
                      <Dice value={state.dice[1]} rolling={busy} />
                      <span>
                        {state.dice[0] + state.dice[1]}
                        <small>步</small>
                      </span>
                    </div>
                    <span className="board-tip">
                      拖动旋转 / 右键平移 / 滚轮缩放
                    </span>
                  </div>
                </div>
                <TurnPanel
                  state={state}
                  busy={busy}
                  paused={paused}
                  dispatch={dispatch}
                  onAssets={() => setDialog("assets")}
                  onResult={() => setDialog("results")}
                />
                <Hand
                  state={state}
                  disabled={busy}
                  onCard={setCard}
                  onLibrary={() => setDialog("cards")}
                />
              </div>
              <aside className="game-sidebar">
                <PlayerList state={state} />
                <div className="asset-quick-actions">
                  <button onClick={() => setDialog("assets")}>
                    <Icon name="Building2" size={20} />
                    <span>
                      我的地产
                      <small>{ownedTiles(state, 0).length} 块城市资产</small>
                    </span>
                    <Icon name="ChevronRight" size={15} />
                  </button>
                  <button
                    onClick={() => setDialog("trade")}
                    disabled={
                      state.phase === "gameover" || state.players[0].bankrupt
                    }
                  >
                    <Icon name="ArrowLeftRight" size={20} />
                    <span>
                      发起交易<small>拼出完整街区</small>
                    </span>
                    <Icon name="ChevronRight" size={15} />
                  </button>
                </div>
                <GameLog state={state} />
                <div className="strategy-note">
                  <Icon name="Sparkles" size={19} />
                  <p>
                    {yourTurn
                      ? "一个好时机，比一张好牌更重要。"
                      : state.players[0].bankrupt
                        ? "你已进入观战。可以加快 NPC 速度或开启新旅程。"
                        : "城市从不等人，好在你的同行者会自己行动。"}
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer>
        <span>
          CITY CIRCUIT <i>© 2026</i>
        </span>
        <span>
          用一点策略，遇见一座新城市。<i className="footer-star">✳</i>
        </span>
      </footer>
      {dialog === "rules" && (
        <Modal
          title="城市旅行指南"
          subtitle="出发前读一读，或者边玩边探索。"
          wide
          onClose={closeDialog}
        >
          <Rules />
        </Modal>
      )}
      {dialog === "cards" && (
        <Modal
          title="道具卡图鉴"
          subtitle="九张好牌，九种改写城市的方式。"
          wide
          onClose={closeDialog}
        >
          <CardLibrary />
        </Modal>
      )}
      {dialog === "map" && (
        <Modal
          title="城市地图"
          subtitle="三十二个街角，每一步都有新可能。"
          wide
          onClose={closeDialog}
        >
          <BoardOverview
            state={active ? state : null}
            onSelect={(id) => {
              setSelected(id);
              closeDialog();
            }}
          />
        </Modal>
      )}
      {dialog === "assets" && state && (
        <Modal
          title="我的城市资产"
          subtitle="建造、卖楼、抵押与赎回。"
          wide
          onClose={closeDialog}
        >
          <Assets state={state} dispatch={dispatch} />
        </Modal>
      )}
      {dialog === "trade" && state && (
        <Modal
          title="聊聊一笔好交易"
          subtitle="NPC 会根据街区潜力与难度评估方案。"
          onClose={closeDialog}
        >
          <Trade state={state} dispatch={dispatch} />
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="按你的节奏旅行" onClose={closeDialog}>
          <div className="settings-form">
            <label>
              NPC 行动速度
              <div className="segmented">
                {[
                  [1400, "悠闲"],
                  [850, "标准"],
                  [350, "快速"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={preferences.speed === value ? "chosen" : ""}
                    onClick={() =>
                      setPreferences((p) => ({ ...p, speed: Number(value) }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </label>
            <div className="settings-row">
              <span>
                <strong>城市音效</strong>
                <small>轻量合成音效，默认关闭。</small>
              </span>
              <button
                role="switch"
                aria-checked={preferences.sound}
                aria-label="城市音效"
                className={`toggle ${preferences.sound ? "on" : ""}`}
                onClick={() =>
                  setPreferences((p) => ({ ...p, sound: !p.sound }))
                }
              >
                <i />
              </button>
            </div>
            <p className="muted helper">
              存档和偏好仅保存在当前浏览器，不会上传到服务器。打开玩法或管理弹窗时，自动
              NPC 回合会暂时等待。
            </p>
          </div>
        </Modal>
      )}
      {dialog === "new" && (
        <Modal title="准备换一座新城市？" onClose={closeDialog}>
          <p className="muted">
            当前旅程已自动保存。返回出发页后仍可继续，开启新旅程会替换本机存档。
          </p>
          <div className="dialog-actions">
            <button className="button secondary" onClick={closeDialog}>
              留在这里
            </button>
            <button className="button primary" onClick={setup}>
              回到出发页 <Icon name="ArrowUpRight" size={18} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "results" && state && (
        <Modal title="旅程结算" onClose={closeDialog}>
          <Results state={state} onNew={setup} />
        </Modal>
      )}
      {card && state && (
        <Modal title={CARD_TITLE(card)} onClose={closeDialog}>
          <CardDetail
            state={state}
            card={card}
            disabled={busy}
            onPlay={(target) => {
              dispatch({ type: "CARD", card, target });
              setCard(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function CARD_TITLE(id: CardId) {
  return {
    remote: "遥控骰子",
    portal: "任意门",
    shield: "租金护盾",
    freeRent: "免租券",
    boost: "租金翻倍",
    demolish: "拆迁许可",
    grant: "城市补助",
    steal: "资金转移",
    escape: "出狱通行证",
  }[id];
}
