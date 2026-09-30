import { test, expect, type Page } from "@playwright/test";
import { newGame, random } from "../../src/game/engine";
import type { GameState } from "../../src/game/types";
const key = "city-circuit-save-v1";
const fixture = () =>
  newGame(
    {
      name: "城市测试员",
      npcDifficulties: ["easy", "medium", "hard"],
      maxRounds: 20,
    },
    2468,
  );
const saved = (page: Page) =>
  page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  ) as Promise<GameState>;
async function resume(page: Page, state: GameState) {
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(
        "city-circuit-prefs",
        JSON.stringify({ speed: 350, sound: false }),
      );
    },
    { key, state },
  );
  await page.goto("/");
  await page.getByRole("button", { name: /继续上次旅程/ }).click();
}
function forceDice(s: GameState, a: number, b: number) {
  for (let seed = 1; seed < 500000; seed++) {
    const rng = { seed } as GameState;
    if (
      1 + Math.floor(random(rng) * 6) === a &&
      1 + Math.floor(random(rng) * 6) === b
    ) {
      s.seed = seed;
      return;
    }
  }
}
test("real WebGL city, configurable 5 NPCs, rulebook and persisted start", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /下一站/ })).toBeVisible();
  await page.getByRole("button", { name: "5 位 NPC 6 人局" }).click();
  await page.getByLabel("你的名字").fill("小城主");
  const levels = ["hard", "easy", "medium", "hard", "easy"];
  for (let i = 0; i < 5; i++)
    await page.locator(".npc-setup select").nth(i).selectOption(levels[i]);
  await page.getByLabel("旅程长度").selectOption("20");
  await page.getByRole("button", { name: "玩法指南" }).click();
  await expect(page.getByRole("dialog")).toContainText("现金不足与破产");
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.getByRole("button", { name: "开启新旅程" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("canvas").evaluate((c: HTMLCanvasElement) => c.width),
    )
    .toBeGreaterThan(600);
  const webgl = await page
    .locator("canvas")
    .evaluate((c: HTMLCanvasElement) => {
      const gl = c.getContext("webgl2");
      return {
        valid: !!gl && !gl.isContextLost(),
        width: c.width,
        height: c.height,
      };
    });
  expect(webgl.valid).toBe(true);
  expect(webgl.width).toBeGreaterThan(600);
  const s = await saved(page);
  expect(s.players).toHaveLength(6);
  expect(s.players[0].name).toBe("小城主");
  expect(s.players.slice(1).map((p) => p.difficulty)).toEqual(levels);
  expect(s.maxRounds).toBe(20);
  expect(errors).toEqual([]);
});
test("roll, buy property, automatic NPC turns, pause and reload continuation", async ({
  page,
}) => {
  const initial = fixture();
  initial.players.forEach((p) => (p.cards = []));
  forceDice(initial, 1, 2);
  await resume(page, initial);
  await page.getByRole("button", { name: "掷骰出发" }).click();
  await expect(page.getByRole("button", { name: "购买 ₡120" })).toBeEnabled();
  await page.getByRole("button", { name: "购买 ₡120" }).click();
  expect((await saved(page)).estates[3].owner).toBe(0);
  await page.getByRole("button", { name: "结束回合", exact: true }).click();
  await expect.poll(async () => (await saved(page)).current).toBe(1);
  await expect.poll(async () => (await saved(page)).phase).not.toBe("roll");
  await page.getByRole("button", { name: "暂停自动回合" }).click();
  const paused = await saved(page);
  await page.waitForTimeout(1300);
  expect((await saved(page)).logSerial).toBe(paused.logSerial);
  // Remove the fixture initializer so the genuine current save is tested on reload.
  await page.context().clearCookies();
  const savedState = await saved(page);
  await page.addInitScript(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key, state: savedState },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: /继续上次旅程/ }),
  ).toBeVisible();
  expect((await saved(page)).estates[3].owner).toBe(0);
  await page.getByRole("button", { name: /继续上次旅程/ }).click();
  await expect(page.getByRole("heading", { name: "城市旅行家" })).toBeVisible();
});
test("remote die targeting and free-rent card work through the actual UI", async ({
  page,
}) => {
  const s = fixture();
  s.players[0].cards = ["remote"];
  await resume(page, s);
  await page.getByRole("button", { name: "使用遥控骰子", exact: true }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("选择前进步数").selectOption("3");
  await modal.getByRole("button", { name: "使用遥控骰子" }).click();
  await expect(page.getByRole("button", { name: "购买 ₡120" })).toBeEnabled();
  const after = await saved(page);
  expect(after.players[0].position).toBe(3);
  expect(after.players[0].cards).toHaveLength(0);
  expect(after.usedCards).toBe(1);
});
test("free rent bypasses landlord payment", async ({ page }) => {
  const s = fixture();
  s.players[0].cards = ["freeRent"];
  s.players[0].position = 1;
  s.estates[1].owner = 1;
  s.phase = "rent";
  s.rent = { amount: 100, owner: 1, tile: 1 };
  await resume(page, s);
  await page.getByRole("button", { name: "使用免租券", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "使用免租券" })
    .click();
  const after = await saved(page);
  expect(after.phase).toBe("end");
  expect(after.players[0].cash).toBe(1600);
  expect(after.players[1].cash).toBe(1600);
  await expect(
    page.getByRole("button", { name: "结束回合", exact: true }),
  ).toBeVisible();
});
test("property management builds, sells, mortgages and redeems correctly", async ({
  page,
}) => {
  const s = fixture();
  s.estates[1].owner = 0;
  s.estates[3].owner = 0;
  await resume(page, s);
  await page.getByRole("button", { name: /我的地产/ }).click();
  const first = page.locator(".asset-row").filter({ hasText: "榕树老街" }),
    second = page.locator(".asset-row").filter({ hasText: "落日码头" });
  await first.getByRole("button", { name: "建造 ₡50" }).click();
  await expect(first.getByRole("button", { name: "建造 ₡50" })).toBeDisabled();
  await second.getByRole("button", { name: "建造 ₡50" }).click();
  expect((await saved(page)).players[0].cash).toBe(1500);
  await first.getByRole("button", { name: "卖楼 +₡25" }).click();
  await second.getByRole("button", { name: "卖楼 +₡25" }).click();
  await first.getByRole("button", { name: "抵押 +₡50" }).click();
  expect((await saved(page)).estates[1].mortgaged).toBe(true);
  await first.getByRole("button", { name: "赎回 ₡55" }).click();
  expect((await saved(page)).players[0].cash).toBe(1545);
  expect((await saved(page)).estates[1].mortgaged).toBe(false);
});
test("negotiates a real NPC trade and shops for one card", async ({ page }) => {
  const s = fixture();
  s.estates[1].owner = 1;
  await resume(page, s);
  await page.getByRole("button", { name: /发起交易/ }).click();
  const modal = page.getByRole("dialog");
  await modal.getByLabel("你收到的地产").selectOption("1");
  await modal.getByLabel(/现金差额/).fill("100");
  await expect(modal).toContainText("愿意接受这个方案");
  await modal.getByRole("button", { name: "确认交易" }).click();
  expect((await saved(page)).estates[1].owner).toBe(0);
  expect((await saved(page)).players[1].cash).toBe(1700);
});
test("shop and forced debt have usable settlement controls", async ({
  page,
}) => {
  const s = fixture();
  s.phase = "market";
  s.players[0].position = 4;
  s.market = ["grant", "portal", "boost"];
  await resume(page, s);
  await page.locator(".market-card").filter({ hasText: "城市补助" }).click();
  expect((await saved(page)).players[0].cash).toBe(1510);
  expect((await saved(page)).phase).toBe("end");
});
test("debt can be paid after mortgaging, without losing the current turn", async ({
  page,
}) => {
  const s = fixture();
  s.phase = "debt";
  s.players[0].cash = 20;
  s.estates[5].owner = 0;
  s.debt = {
    amount: 120,
    creditor: 1,
    reason: "租金",
    next: "end",
    fund: false,
  };
  await resume(page, s);
  await page.getByRole("button", { name: "管理资产", exact: true }).click();
  await page.getByRole("button", { name: "抵押 +₡100" }).click();
  await page.getByRole("button", { name: "偿付欠款 ₡120" }).click();
  const after = await saved(page);
  expect(after.phase).toBe("end");
  expect(after.players[0].cash).toBe(0);
  expect(after.players[1].cash).toBe(1720);
});
test("human participates in an NPC-initiated auction", async ({ page }) => {
  const s = fixture();
  s.current = 1;
  s.players[1].position = 1;
  s.phase = "auction";
  s.auction = {
    tile: 1,
    bid: 0,
    leader: null,
    bidder: 0,
    active: [0, 1, 2, 3],
  };
  await resume(page, s);
  await page.getByRole("button", { name: "出价 ₡40" }).click();
  expect((await saved(page)).auction!.leader).toBe(0);
  await expect
    .poll(async () => (await saved(page)).auction?.bid ?? 0)
    .toBeGreaterThan(40);
});
test("jail card releases the player to roll normally", async ({ page }) => {
  const s = fixture();
  s.players[0].jail = 1;
  s.players[0].position = 8;
  s.players[0].cards = ["escape"];
  await resume(page, s);
  await page
    .getByRole("button", { name: "使用出狱通行证", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "使用出狱通行证" })
    .click();
  await expect(page.getByRole("button", { name: "掷骰出发" })).toBeVisible();
  expect((await saved(page)).players[0].jail).toBe(0);
});
test("round limit produces a winner, ranking and a new-game path", async ({
  page,
}) => {
  const s = fixture();
  s.round = 20;
  s.current = 3;
  s.phase = "end";
  s.players.forEach((p) => (p.cards = []));
  s.players[2].cash = 3000;
  await resume(page, s);
  const modal = page.getByRole("dialog", { name: "旅程结算" });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("桃桃，城市之王");
  expect((await saved(page)).phase).toBe("gameover");
  await modal.getByRole("button", { name: "开启下一段旅程" }).click();
  await expect(page.getByRole("button", { name: "开启新旅程" })).toBeVisible();
});
test("a bankrupt player can spectate while NPCs continue automatically", async ({
  page,
}) => {
  const s = fixture();
  s.phase = "debt";
  s.players[0].cash = 0;
  s.debt = {
    amount: 500,
    creditor: 1,
    reason: "租金",
    next: "end",
    fund: false,
  };
  s.players.forEach((p) => (p.cards = []));
  await resume(page, s);
  await page.getByRole("button", { name: "宣告破产" }).click();
  await expect(
    page.getByRole("heading", { name: "城市继续，坐看风云。" }),
  ).toBeVisible();
  await expect.poll(async () => (await saved(page)).current).toBe(1);
  await expect
    .poll(async () => (await saved(page)).logSerial)
    .toBeGreaterThan(s.logSerial + 2);
  expect((await saved(page)).players[0].bankrupt).toBe(true);
});
test("city map is keyboard-accessible and opens tile details", async ({
  page,
}) => {
  await resume(page, fixture());
  await page.getByRole("button", { name: "城市地图" }).click();
  await expect(page.locator(".board-overview button")).toHaveCount(32);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /榕树老街/ })
    .click();
  await expect(page.locator(".tile-info")).toContainText("榕树老街");
  await expect(page.locator(".tile-info")).toContainText("₡100");
});
test("mobile setup, 3D board, cards and dialogs fit without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "5 位 NPC 6 人局" }).click();
  await page.getByRole("button", { name: "开启新旅程" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "道具图鉴" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.getByRole("button", { name: "切换棋盘视角" }).click();
  await page.screenshot({
    path: "test-results/mobile-game.png",
    fullPage: true,
  });
});
