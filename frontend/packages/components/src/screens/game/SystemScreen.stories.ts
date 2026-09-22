import type {Meta, StoryObj} from "@storybook/vue3-vite";
import {expect, userEvent, within} from "storybook/test";
import {gameScreenArgs} from "../../../test/screenFixtures";
import GameScreen from "./GameScreen.vue";

const meta = {
  title: "Screens/System",
  component: GameScreen,
  args: gameScreenArgs("stale-projection"),
  globals: {viewport: {value: "wide"}},
  beforeEach: async ({globals}) => {
    await expect(window.innerWidth).toBe(globals.viewport.value === "compact" ? 360 : 1440);
  },
} satisfies Meta<typeof GameScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

async function assertSingleHeader(canvasElement: HTMLElement): Promise<void> {
  const headers = canvasElement.querySelectorAll(".game-table__desktop-header, .game-table__compact-header");
  const visibleHeaders = Array.from(headers).filter((header) => header.getClientRects().length > 0);
  await expect(visibleHeaders).toHaveLength(1);
}

const waiting: Story["play"] = async ({canvasElement, args}) => {
  await assertSingleHeader(canvasElement);
  const header = Array.from(canvasElement.querySelectorAll(".game-table__desktop-header, .game-table__compact-header"))
    .find((element) => element.getClientRects().length > 0);
  await expect(header).toHaveTextContent(/ХОДИТ|ЧУЖОЙ ХОД/);
  const table = canvasElement.querySelector(".game-table");
  await expect(table).toBeVisible();
  await expect(canvasElement.querySelector(".game-connection-status")).not.toBeInTheDocument();
  await expect(args.onExecute).not.toHaveBeenCalled();
  await expect(within(canvasElement).queryByRole("button", {name: "Открыть дверь"})).not.toBeInTheDocument();
};

export const Waiting: Story = {play: waiting};
export const WaitingCompact: Story = {...Waiting, globals: {viewport: {value: "compact"}}};
export const TurnPassed: Story = {args: gameScreenArgs("turn-passed"), play: waiting};
export const TurnPassedCompact: Story = {...TurnPassed, globals: {viewport: {value: "compact"}}};
export const RoomLobby: Story = {
  args: gameScreenArgs("lobby-state"),
  play: async ({canvasElement, args}) => {
    await assertSingleHeader(canvasElement);
    await expect(canvasElement.querySelector(".game-table")).toHaveAttribute("data-state", "lobby");
    await userEvent.click(within(canvasElement).getByRole("button", {name: "Начать игру"}));
    await expect(args.onExecute).toHaveBeenCalledOnce();
    await expect(args.onExecute).toHaveBeenCalledWith({action: {type: "start"}, index: 0}, {});
    await expect(canvasElement.querySelector(".game-table")).toHaveAttribute("data-state", "lobby");
  },
};
export const RoomLobbyCompact: Story = {...RoomLobby, globals: {viewport: {value: "compact"}}};

export const Reconnecting: Story = {
  args: {...gameScreenArgs("offline-stale"), connectionState: "resyncing", isBusy: true},
  play: async ({canvasElement, args}) => {
    await assertSingleHeader(canvasElement);
    const status = canvasElement.querySelector(".game-connection-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("aria-busy", "true");
    await expect(status).toHaveTextContent("Переподключаемся…");
    await expect(canvasElement.querySelector(".game-table")).toBeVisible();
    await expect(within(canvasElement).queryByRole("button", {name: "Попробовать снова"})).not.toBeInTheDocument();
    await expect(args.onExecute).not.toHaveBeenCalled();
  },
};
export const ReconnectingCompact: Story = {...Reconnecting, globals: {viewport: {value: "compact"}}};

const retryConnection: Story["play"] = async ({canvasElement, args}) => {
  await assertSingleHeader(canvasElement);
  const status = canvasElement.querySelector(".game-connection-status") as HTMLElement;
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("aria-live", "assertive");
  await userEvent.click(within(status).getByRole("button", {name: "Попробовать снова"}));
  await expect(args.onRetry).toHaveBeenCalledOnce();
  await expect(args.onExecute).not.toHaveBeenCalled();
};
export const ConnectionFailed: Story = {
  args: {
    ...gameScreenArgs("offline-stale"), connectionState: "failed", errorKind: "offline", isBusy: true,
    errorMessage: "INTERNAL_DIAGNOSTIC_SENTINEL",
  },
  play: async (context) => {
    await expect(context.canvasElement).not.toHaveTextContent("INTERNAL_DIAGNOSTIC_SENTINEL");
    await expect(context.canvasElement.querySelector(".game-connection-status")).toHaveTextContent("Не удалось подключиться");
    await retryConnection(context);
  },
};
export const ConnectionFailedCompact: Story = {...ConnectionFailed, globals: {viewport: {value: "compact"}}};
export const StaleChoice: Story = {
  args: {...gameScreenArgs("single-preparation"), errorKind: "stale_version"},
  play: async (context) => {
    await expect(context.canvasElement.querySelector(".game-connection-status")).toHaveTextContent("Нужно обновить состояние");
    await retryConnection(context);
  },
};
export const StaleChoiceCompact: Story = {...StaleChoice, globals: {viewport: {value: "compact"}}};

const retrySurface: Story["play"] = async ({canvasElement, args}) => {
  const canvas = within(canvasElement);
  await expect(canvasElement.querySelectorAll(".system-state-surface")).toHaveLength(1);
  await expect(canvasElement.querySelector(".game-table")).not.toBeInTheDocument();
  await userEvent.click(canvas.getByRole("button", {name: /Продолжить|Попробовать снова/}));
  await expect(args.onRetry).toHaveBeenCalledOnce();
  await expect(args.onExecute).not.toHaveBeenCalled();
};
export const Death: Story = {
  args: gameScreenArgs("death-loot-single"),
  play: async (context) => {
    await expect(within(context.canvasElement).getByRole("heading", {name: "Персонаж погиб"})).toBeVisible();
    await retrySurface(context);
  },
};
export const DeathCompact: Story = {...Death, globals: {viewport: {value: "compact"}}};
export const DeathRecovery: Story = {
  args: gameScreenArgs("death-loot-all-pass"),
  play: async (context) => {
    await expect(within(context.canvasElement).getByRole("heading", {name: "Персонаж восстановлен"})).toBeVisible();
    await retrySurface(context);
  },
};
export const DeathRecoveryCompact: Story = {...DeathRecovery, globals: {viewport: {value: "compact"}}};
export const InitialLoading: Story = {
  args: {...gameScreenArgs("single-combat"), routeState: {kind: "loading"}},
  play: async ({canvasElement}) => {
    await expect(within(canvasElement).getByRole("heading", {name: "Подготавливаем стол…"})).toBeVisible();
    await expect(canvasElement.querySelector(".loading-game-table")).toHaveAttribute("aria-busy", "true");
    await expect(within(canvasElement).queryByRole("button")).not.toBeInTheDocument();
    await expect(canvasElement.querySelector(".game-table")).not.toBeInTheDocument();
  },
};
export const InitialLoadingCompact: Story = {...InitialLoading, globals: {viewport: {value: "compact"}}};
export const SessionLost: Story = {
  args: {...gameScreenArgs("offline-stale"), routeState: {kind: "auth"}, errorKind: "auth"},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", {name: "Сессия этой вкладки потеряна"})).toBeVisible();
    const link = canvas.getByRole("link", {name: "Вернуться в лобби"});
    await expect(link).toHaveAttribute("href", "/");
    link.focus();
    await expect(link).toHaveFocus();
    await expect(canvasElement.querySelector(".game-table")).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
export const SessionLostCompact: Story = {...SessionLost, globals: {viewport: {value: "compact"}}};
export const GameUnavailable: Story = {
  args: {...gameScreenArgs("offline-stale"), routeState: {kind: "unavailable"}, errorKind: "transient"},
  play: async (context) => {
    await expect(within(context.canvasElement).getByRole("heading", {name: "Игра недоступна"})).toBeVisible();
    await retrySurface(context);
  },
};
export const GameUnavailableCompact: Story = {...GameUnavailable, globals: {viewport: {value: "compact"}}};

const terminal: Story["play"] = async ({canvasElement, args, globals}) => {
  await assertSingleHeader(canvasElement);
  const canvas = within(canvasElement);
  await expect(canvasElement.querySelector(".game-table")).toHaveAttribute("data-state", "finished");
  await expect(canvasElement.querySelector(".game-table__finished")).toBeVisible();
  await expect(canvasElement.querySelector(".game-table__finished-card")).toHaveTextContent("Победител");
  if (globals.viewport.value === "compact") {
    await expect(canvas.queryByRole("button", {name: "Открыть итоги"})).not.toBeInTheDocument();
    await expect(canvasElement.querySelector(".mobile-game-table__dock-primary")).not.toBeInTheDocument();
  } else {
    const results = canvas.getByRole("button", {name: "Открыть итоги"});
    await userEvent.click(results);
    await expect(results).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("list", {name: "Финальные результаты игроков"})).toBeVisible();
    await userEvent.click(results);
    await expect(results).toHaveAttribute("aria-expanded", "false");
  }
  await expect(args.onExecute).not.toHaveBeenCalled();
  await expect(args["onSubmit-interaction"]).not.toHaveBeenCalled();
};
export const Victory: Story = {args: gameScreenArgs("victory-six-player"), play: terminal};
export const VictoryCompact: Story = {...Victory, globals: {viewport: {value: "compact"}}};
export const GameFinished: Story = {args: gameScreenArgs("single-finished"), play: terminal};
export const GameFinishedCompact: Story = {...GameFinished, globals: {viewport: {value: "compact"}}};
