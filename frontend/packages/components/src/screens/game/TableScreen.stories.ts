import type {Meta, StoryObj} from "@storybook/vue3-vite";
import type {ActionType} from "@munchkin/contracts";
import {expect, userEvent, waitFor, within} from "storybook/test";
import {gameScreenArgs} from "../../../test/screenFixtures";
import GameScreen from "./GameScreen.vue";

const meta = {
  title: "Screens/Table",
  component: GameScreen,
  args: gameScreenArgs("full-roster-combat"),
  globals: {viewport: {value: "wide"}},
} satisfies Meta<typeof GameScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
type Play = NonNullable<Story["play"]>;
type Context = Parameters<Play>[0];

async function checkLayout({canvasElement, globals}: Context): Promise<void> {
  const compact = globals.viewport.value === "compact";
  await expect(window.innerWidth).toBe(compact ? 360 : 1440);
  await expect(canvasElement.querySelectorAll(".game-table")).toHaveLength(1);
  const desktop = canvasElement.querySelector(".desktop-game-header");
  const mobile = canvasElement.querySelector(".mobile-game-header");
  await expect(compact ? mobile : desktop).toBeVisible();
  await expect(compact ? desktop : mobile).not.toBeVisible();
}

function table(fixtureID: string, play: Play): Story {
  return {
    args: gameScreenArgs(fixtureID),
    parameters: {fixtureID},
    play: async (context) => {
      await checkLayout(context);
      await play(context);
    },
  };
}

function compact(story: Story): Story {
  return {...story, globals: {viewport: {value: "compact"}}};
}

function visibleElement(canvasElement: HTMLElement, selector: string): HTMLElement {
  const matches = [...canvasElement.querySelectorAll<HTMLElement>(selector)]
    .filter((element) => element.checkVisibility());
  expect(matches).toHaveLength(1);
  return matches[0]!;
}

async function openHand(context: Context): Promise<HTMLElement> {
  const opener = visibleElement(context.canvasElement, ".game-table__hand header button, .mobile-game-table__dock-hand");
  await userEvent.click(opener);
  await expect(within(context.canvasElement).getByRole("dialog")).toBeVisible();
  return opener;
}

async function dismiss(context: Context, opener: HTMLElement): Promise<void> {
  const dialog = within(context.canvasElement).getByRole("dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog.contains(document.activeElement)).toBe(true);
  if ("__vitest_browser__" in globalThis) {
    const {userEvent: nativeUserEvent} = await import("vitest/browser");
    await nativeUserEvent.tab();
    if (document.activeElement === document.body) {
      await nativeUserEvent.tab();
    }
    await expect(dialog.contains(document.activeElement)).toBe(true);
    await nativeUserEvent.keyboard("{Escape}");
  } else {
    await userEvent.click(within(dialog).getAllByRole("button", {name: "Закрыть"})[0]!);
  }
  await waitFor(() => expect(context.canvasElement.querySelector("dialog[open]")).toBeNull());
  await expect(opener).toHaveFocus();
}

function execute(type: ActionType, label: RegExp): Play {
  return async ({canvasElement, args}) => {
    const buttons = within(canvasElement).getAllByRole("button", {name: label});
    await userEvent.click(buttons[0]!);
    await expect(args.onExecute).toHaveBeenCalledTimes(1);
    await expect(args.onExecute).toHaveBeenCalledWith(
      expect.objectContaining({action: expect.objectContaining({type})}), {},
    );
  };
}

function result(selector: string, copy: string): Play {
  return async ({canvasElement, args}) => {
    const surface = canvasElement.querySelector(selector);
    await expect(surface).toBeVisible();
    await expect(surface).toHaveTextContent(copy);
    await expect(args.onExecute).not.toHaveBeenCalled();
    await expect(args["onSubmit-interaction"]).not.toHaveBeenCalled();
  };
}

export const ActiveTurn = table("full-roster-combat", execute("request_combat_resolution", /^Завершить бой$/));
export const ActiveTurnCompact = compact(ActiveTurn);

export const HandExpanded = table("card-action-rail", async (context) => {
  const opener = await openHand(context);
  const projection = context.args.routeState;
  if (!("projection" in projection)) {
    throw new Error("Hand story requires a projection");
  }
  const card = projection.projection.you.hand.find((entry) => entry.instance_id === "hero-card-3")!;
  const dialog = within(context.canvasElement).getByRole("dialog");
  await userEvent.click(within(dialog).getByRole("option", {name: new RegExp(card.name)}));
  await userEvent.click(within(dialog).getByRole("button", {name: "Сыграть карту"}));
  await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
  await expect(context.args.onExecute).toHaveBeenCalledWith(
    expect.objectContaining({action: expect.objectContaining({type: "play_card", source_instance_id: card.instance_id})}),
    {instance_id: card.instance_id},
  );
  await dismiss(context, opener);
  await userEvent.click(opener);
});
export const HandExpandedCompact = compact(HandExpanded);

export const HandFastEquip = table("single-setup", async (context) => {
  await openHand(context);
  const canvas = within(context.canvasElement);
  await userEvent.click(canvas.getByRole("option", {name: /Учебный шлем/}));
  const dialog = canvas.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:fast-equip");
  await userEvent.click(within(dialog).getByRole("button", {name: "Экипировать"}));
  await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
  await expect(context.args.onExecute).toHaveBeenCalledWith(
    expect.objectContaining({action: expect.objectContaining({type: "equip_item", source_instance_id: "setup-treasure-1"})}),
    {instance_id: "setup-treasure-1"},
  );
});
export const HandFastEquipCompact = compact(HandFastEquip);

export const EquipmentSlotOpen = table("single-setup", async (context) => {
  await userEvent.click(visibleElement(context.canvasElement, ".game-table__character, .mobile-game-table__dock-character"));
  const canvas = within(context.canvasElement);
  await userEvent.click(canvas.getByRole("dialog").querySelector<HTMLElement>(".equipment-slot")!);
  const dialog = canvas.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:exact-equip");
  await expect(dialog).toHaveTextContent("Головняк");
  await userEvent.click(within(dialog).getByRole("button", {name: "Экипировать"}));
  await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
  await expect(context.args.onExecute).toHaveBeenCalledWith(
    expect.objectContaining({action: expect.objectContaining({type: "equip_item", source_instance_id: "setup-treasure-1"})}),
    {instance_id: "setup-treasure-1"},
  );
});
export const EquipmentSlotOpenCompact = compact(EquipmentSlotOpen);

function informationSheet(selector: string, copy: string): Play {
  return async (context) => {
    const opener = visibleElement(context.canvasElement, selector);
    opener.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = within(context.canvasElement).getByRole("dialog");
    await expect(dialog).toHaveTextContent(copy);
    await dismiss(context, opener);
    await userEvent.click(opener);
  };
}

export const CharacterOpen = table("single-combat", informationSheet(".game-table__character, .mobile-game-table__dock-character", "Персонаж"));
export const CharacterOpenCompact = compact(CharacterOpen);
export const StrengthOpen = table("single-combat", informationSheet(".game-table__strength, .mobile-game-header__strength", "Подробный расчёт силы"));
export const StrengthOpenCompact = compact(StrengthOpen);
export const OpponentOpen = table("full-roster-combat", informationSheet(".opponent-tile:first-child", "Публичное состояние соперника"));
export const OpponentOpenCompact = compact(OpponentOpen);

export const DoorReady = table("single-preparation", execute("open_door", /^Открыть дверь$/));
export const DoorReadyCompact = compact(DoorReady);
export const PostDoorChoice = table("single-door-choice", execute("loot_room", /^Обчистить комнату$/));
export const PostDoorChoiceCompact = compact(PostDoorChoice);

export const RunAwayChoice = table("single-run-away", async ({canvasElement, args, globals}) => {
  const canvas = within(canvasElement);
  const buttons = canvas.getAllByRole("button", {name: "Бросить кубик"});
  await expect(buttons).toHaveLength(1);
  await expect(canvas.queryAllByRole("dialog")).toHaveLength(globals.viewport.value === "compact" ? 1 : 0);
  await userEvent.click(buttons[0]!);
  const state = args.routeState;
  if (!("projection" in state)) {
    throw new Error("Run-away story requires a projection");
  }
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledWith(state.projection.interaction!.actions[0]);
  await expect(args.onExecute).not.toHaveBeenCalled();
});
export const RunAwayChoiceCompact = compact(RunAwayChoice);

export const RewardReceived = table("reward-received", result(".game-table__reward", "Награда"));
export const RewardReceivedCompact = compact(RewardReceived);
export const Preparation = table("single-setup", execute("finish_setup", /^Закончить подготовку$/));
export const PreparationCompact = compact(Preparation);
export const CurseEffect = table("curse-confirmed", result("[data-figma-owner='game-board:curse-confirmed']", "Проклятие!"));
export const CurseEffectCompact = compact(CurseEffect);
export const HelpAccepted = table("helper-accepted", result("[data-figma-owner='game-board:help-accepted']", "Помощник присоединился"));
export const HelpAcceptedCompact = compact(HelpAccepted);
export const RunAwaySuccess = table("run-away-success", result("[data-figma-owner='game-board:run-away-success']", "Ты смылся"));
export const RunAwaySuccessCompact = compact(RunAwaySuccess);
export const RunAwayFailure = table("run-away-failure", result("[data-figma-owner='game-board:run-away-failure']", "Побег не удался"));
export const RunAwayFailureCompact = compact(RunAwayFailure);

export const RunAwayNextMonster = table("run-away-next-monster", async ({canvasElement, args}) => {
  const canvas = within(canvasElement);
  const confirm = canvas.getByRole("button", {name: "Подтвердить"});
  await expect(confirm).toBeDisabled();
  const state = args.routeState;
  if (!("projection" in state)) {
    throw new Error("Monster choice requires a projection");
  }
  const choice = state.projection.interaction!.actions[0]!;
  const monster = state.projection.turn.combat!.monsters.find((card) => card.instance_id === choice.choice_ids![0])!;
  await userEvent.click(canvas.getByRole("button", {name: new RegExp(monster.name)}));
  await expect(confirm).toBeEnabled();
  await userEvent.click(confirm);
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledWith(choice);
  await expect(args.onExecute).not.toHaveBeenCalled();
});
export const RunAwayNextMonsterCompact = compact(RunAwayNextMonster);
export const EndTurnReady = table("end-turn-ready", execute("end_turn", /^(Завершить|Закончить) ход$/));
export const EndTurnReadyCompact = compact(EndTurnReady);
export const EmptyHand = table("empty-hand", async (context) => {
  const opener = await openHand(context);
  const dialog = within(context.canvasElement).getByRole("dialog");
  await expect(dialog).toHaveTextContent("В руке нет карт");
  await expect(within(dialog).queryAllByRole("option")).toHaveLength(0);
  await dismiss(context, opener);
  await userEvent.click(opener);
});
export const EmptyHandCompact = compact(EmptyHand);

export const MultipleMonsters = table("mobile-combat-multiple", execute("request_combat_resolution", /^Завершить бой$/));
export const MultipleMonstersCompact = compact(MultipleMonsters);
export const OneOpponent = table("opponents-one", async (context) => {
  await expect(context.canvasElement.querySelectorAll(".opponent-tile")).toHaveLength(1);
  await execute("request_combat_resolution", /^Завершить бой$/)(context);
});
export const OneOpponentCompact = compact(OneOpponent);
export const ThreeOpponents = table("opponents-three", async (context) => {
  await expect(context.canvasElement.querySelectorAll(".opponent-tile")).toHaveLength(3);
  await execute("request_combat_resolution", /^Завершить бой$/)(context);
});
export const ThreeOpponentsCompact = compact(ThreeOpponents);
export const NextRunAwayAttempt: Story = {
  ...RunAwayChoice,
  args: gameScreenArgs("mobile-run-away-choice"),
  parameters: {fixtureID: "mobile-run-away-choice"},
};
export const NextRunAwayAttemptCompact = compact(NextRunAwayAttempt);
export const FullRosterLongCopy = table("full-roster-long-copy", async (context) => {
  await expect(context.canvasElement.querySelectorAll(".opponent-tile")).toHaveLength(5);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  await openHand(context);
  const dialog = within(context.canvasElement).getByRole("dialog");
  await expect(within(dialog).getAllByRole("option")).toHaveLength(6);
  await expect(dialog).toHaveTextContent("Карта с длинным русским названием номер 6");
});
export const FullRosterLongCopyCompact = compact(FullRosterLongCopy);
export const RunAwaySequenceResult = table("run-away-result", result("[data-figma-owner='game-board:run-away-success']", "Ты смылся"));
export const RunAwaySequenceResultCompact = compact(RunAwaySequenceResult);
