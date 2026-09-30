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
  await waitFor(() => expect(window.innerWidth).toBe(compact ? 360 : 1440));
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
  if (matches.length !== 1) {
    throw new Error(`Expected one visible ${selector}, found ${matches.length}`);
  }
  return matches[0]!;
}

function isCompact(context: Context): boolean {
  return context.globals.viewport.value === "compact";
}

function projectionOf(context: Context) {
  const state = context.args.routeState;
  if (!("projection" in state)) {
    throw new Error("Table story requires a projection");
  }
  return state.projection;
}

async function expectFigmaNodes(element: Element | null, desktop: string, compactNode: string): Promise<void> {
  await expect(element).toHaveAttribute("data-figma-desktop-node", desktop);
  await expect(element).toHaveAttribute("data-figma-compact-node", compactNode);
}

async function pressEscape(dialog: HTMLElement): Promise<void> {
  if ("__vitest_browser__" in globalThis) {
    const {userEvent: nativeUserEvent} = await import("vitest/browser");
    await nativeUserEvent.keyboard("{Escape}");
  } else {
    const cancel = new Event("cancel", {cancelable: true});
    dialog.dispatchEvent(cancel);
    await expect(cancel.defaultPrevented).toBe(true);
  }
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

export const ActiveTurn = table("full-roster-combat", async (context) => {
  await expect(context.canvasElement).not.toHaveTextContent(
    /ПУБЛИЧНЫЕ ЗОНЫ|ТВОЯ ЗОНА|Текущая задача|Текущий контекст|Ждём следующую карту|\blocal\b|\bcourier\b/i,
  );
  await expect(within(context.canvasElement).queryByRole("button", {name: "Зоны"})).toBeNull();
  await execute("request_combat_resolution", /^Завершить бой$/)(context);
});
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

const nonEquipActions = /Сыграть|Искать неприятности|Использовать способность|Сбросить/;

export const HandFastEquip = table("single-setup", async (context) => {
  const hand = projectionOf(context).you.hand;
  await expect(hand).toHaveLength(8);
  await expect(context.canvasElement.querySelector(".game-table__stage .choice-card-presentation")).toBeNull();
  if (isCompact(context)) {
    await expect(within(context.canvasElement).getByRole("button", {name: "Рука · 8"})).toBeVisible();
  }
  await openHand(context);
  const canvas = within(context.canvasElement);
  const handDialog = canvas.getByRole("dialog");
  await expectFigmaNodes(handDialog, "253:96", "181:1634");
  await expect(within(handDialog).getAllByRole("option")).toHaveLength(8);
  await userEvent.click(canvas.getByRole("option", {name: /Учебный шлем/}));
  const dialog = canvas.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:fast-equip");
  await expectFigmaNodes(dialog, "291:1587", "342:3574");
  await expect(within(dialog).queryAllByRole("button", {name: nonEquipActions})).toHaveLength(0);
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
  const slot = canvas.getByRole("dialog").querySelector<HTMLElement>(".equipment-slot")!;
  await expect(slot).toHaveTextContent("ГОЛОВНЯК");
  await userEvent.click(slot);
  const dialog = canvas.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:exact-equip");
  await expectFigmaNodes(dialog, "291:1587", "340:3475");
  await expect(dialog).toHaveTextContent("Головняк · пусто");
  await expect(dialog).toHaveTextContent("Учебный шлем");
  await expect(dialog).not.toHaveTextContent("Учебная броня");
  await expect(dialog).not.toHaveTextContent("Класс следопыта");
  await expect(within(dialog).queryAllByRole("button", {name: nonEquipActions})).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole("button", {name: "Экипировать"}));
  await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
  await expect(context.args.onExecute).toHaveBeenCalledWith(
    expect.objectContaining({action: expect.objectContaining({type: "equip_item", source_instance_id: "setup-treasure-1"})}),
    {instance_id: "setup-treasure-1"},
  );
});
export const EquipmentSlotOpenCompact = compact(EquipmentSlotOpen);

function informationSheet(selector: string, copy: string[], desktopNode: string, compactNode: string): Play {
  return async (context) => {
    const opener = visibleElement(context.canvasElement, selector);
    opener.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = within(context.canvasElement).getByRole("dialog");
    await expectFigmaNodes(dialog, desktopNode, compactNode);
    for (const text of copy) {
      await expect(dialog).toHaveTextContent(text);
    }
    await dismiss(context, opener);
    await userEvent.click(opener);
  };
}

export const CharacterOpen = table("single-combat", informationSheet(
  ".game-table__character, .mobile-game-table__dock-character", ["Персонаж"], "267:708", "165:42",
));
export const CharacterOpenCompact = compact(CharacterOpen);
export const StrengthOpen = table("single-combat", informationSheet(
  ".game-table__strength, .mobile-game-header__strength", ["Подробный расчёт силы"], "271:3010", "164:42",
));
export const StrengthOpenCompact = compact(StrengthOpen);
export const OpponentOpen = table("full-roster-combat", informationSheet(
  ".opponent-tile:first-child", ["Публичное состояние соперника", "Содержимое руки соперника скрыто"], "271:3216", "166:42",
));
export const OpponentOpenCompact = compact(OpponentOpen);

export const DoorReady = table("single-preparation", execute("open_door", /^Открыть дверь$/));
export const DoorReadyCompact = compact(DoorReady);
export const PostDoorChoice = table("single-door-choice", async (context) => {
  await execute("loot_room", /^Обчистить комнату$/)(context);
  await expect(within(context.canvasElement).queryByRole("button", {name: "Открыть дверь"})).toBeNull();
  await openHand(context);
  const dialog = within(context.canvasElement).getByRole("dialog");
  await expect(context.canvasElement.querySelectorAll("dialog[open]")).toHaveLength(1);
  await expectFigmaNodes(dialog, "253:96", "181:1634");
  await userEvent.click(within(dialog).getByRole("option", {name: /Монстр из руки/}));
  await userEvent.click(within(dialog).getByRole("button", {name: "Искать неприятности"}));
  await expect(context.args.onExecute).toHaveBeenCalledTimes(2);
  await expect(context.args.onExecute).toHaveBeenLastCalledWith(
    expect.objectContaining({action: expect.objectContaining({type: "look_for_trouble", source_instance_id: "door-choice-monster"})}),
    {instance_id: "door-choice-monster"},
  );
});
export const PostDoorChoiceCompact = compact(PostDoorChoice);

const runAwayChoice = (desktopNode: string): Play => async (context) => {
  const {canvasElement, args} = context;
  const canvas = within(canvasElement);
  const projection = projectionOf(context);
  const monster = projection.turn.combat!.monsters.find((card) =>
    card.instance_id === projection.turn.run_away!.current_monster_instance_id)!;
  const buttons = canvas.getAllByRole("button", {name: "Бросить кубик"});
  await expect(buttons).toHaveLength(1);
  if (isCompact(context)) {
    const dialog = canvas.getByRole("dialog");
    await expect(canvasElement.querySelectorAll("dialog[open]")).toHaveLength(1);
    await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:run-away-response");
    await expect(dialog).toContainElement(buttons[0]!);
    await pressEscape(dialog);
    await expect(dialog).toHaveAttribute("open");
    await expect(canvasElement.querySelectorAll("dialog[open]")).toHaveLength(1);
  } else {
    await expect(canvas.queryAllByRole("dialog")).toHaveLength(0);
    const surface = canvasElement.querySelector(".game-table__run-away");
    await expect(surface).toHaveAttribute("data-figma-owner", "game-board:run-away-wide");
    await expect(surface).toHaveAttribute("data-figma-desktop-node", desktopNode);
    await expect(surface).toHaveTextContent(monster.name);
    await expect(canvasElement.querySelector(".game-table__action-panel")).toContainElement(buttons[0]!);
  }
  await userEvent.click(buttons[0]!);
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
  await expect(args["onSubmit-interaction"]).toHaveBeenCalledWith(projection.interaction!.actions[0]);
  await expect(args.onExecute).not.toHaveBeenCalled();
};
export const RunAwayChoice = table("single-run-away", runAwayChoice("285:1473"));
export const RunAwayChoiceCompact = compact(RunAwayChoice);

export const RewardReceived = table("reward-received", result(".game-table__reward", "Награда"));
export const RewardReceivedCompact = compact(RewardReceived);
export const Preparation = table("single-setup", execute("finish_setup", /^Закончить подготовку$/));
export const PreparationCompact = compact(Preparation);
export const CurseEffect = table("curse-confirmed", result("[data-figma-owner='game-board:curse-confirmed']", "Проклятие!"));
export const CurseEffectCompact = compact(CurseEffect);
export const HelpAccepted = table("helper-accepted", async (context) => {
  const selector = "[data-figma-owner='game-board:help-accepted']";
  await result(selector, "Помощник присоединился")(context);
  await expect(context.canvasElement.querySelector(selector)).toHaveTextContent("Илья помогает в бою");
  await expect(context.canvasElement.querySelector(selector)).toHaveTextContent("Помощнику обещано 1 сокровище");
});
export const HelpAcceptedCompact = compact(HelpAccepted);

function runAwayResult(passedMonster: string): Play {
  return async (context) => {
    const {canvasElement} = context;
    const selector = "[data-figma-owner='game-board:run-away-success']";
    await result(selector, "Ты смылся")(context);
    await expect(canvasElement.querySelector(selector)).toHaveTextContent(`${passedMonster} пройдена`);
    await expectFigmaNodes(canvasElement.querySelector(".game-table"), "294:1998", "unverified");
    if (!isCompact(context)) {
      // Compact header shows only turn ownership for another player's turn.
      await expect(visibleElement(canvasElement, ".desktop-game-header__turn h1")).toHaveTextContent("УСПЕХ");
    }
    await expect(canvasElement.querySelector(".interaction-surface, .run-away-summary, dialog[open]")).toBeNull();
  };
}
export const RunAwaySuccess = table("run-away-success", runAwayResult("Архивная пыль"));
export const RunAwaySuccessCompact = compact(RunAwaySuccess);
export const RunAwayFailure = table("run-away-failure", result("[data-figma-owner='game-board:run-away-failure']", "Побег не удался"));
export const RunAwayFailureCompact = compact(RunAwayFailure);

export const RunAwayNextMonster = table("run-away-next-monster", async (context) => {
  const {canvasElement, args} = context;
  const canvas = within(canvasElement);
  const confirm = canvas.getByRole("button", {name: "Подтвердить"});
  if (isCompact(context)) {
    const dialog = canvas.getByRole("dialog");
    await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:run-away-next");
    await expect(dialog).toContainElement(confirm);
  } else {
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvasElement.querySelector(".game-table__run-away-next")).toBeVisible();
    await expect(canvasElement.querySelector(".game-table__action-panel")).toContainElement(confirm);
  }
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
export const NextRunAwayAttempt = table("mobile-run-away-choice", runAwayChoice("293:2026"));
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
export const RunAwaySequenceResult = table("run-away-result", runAwayResult("Гидра из справок"));
export const RunAwaySequenceResultCompact = compact(RunAwaySequenceResult);
