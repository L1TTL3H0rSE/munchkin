import type {Meta, StoryObj} from "@storybook/vue3-vite";
import {expect, userEvent, waitFor, within} from "storybook/test";
import {gameScreenArgs} from "../../../test/screenFixtures";
import GameScreen from "./GameScreen.vue";

const meta = {
  title: "Screens/Interactions",
  component: GameScreen,
  args: gameScreenArgs("interaction-material"),
  globals: {viewport: {value: "wide"}},
} satisfies Meta<typeof GameScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
type Context = Parameters<NonNullable<Story["play"]>>[0];
const compact = {viewport: {value: "compact"}};

async function screen(context: Context) {
  const width = context.globals.viewport.value === "compact" ? 360 : 1440;
  await expect(window.innerWidth).toBe(width);
  return within(context.canvasElement);
}

async function mandatoryDialog(context: Context) {
  const canvas = await screen(context);
  const dialog = await canvas.findByRole("dialog");
  await expect(context.canvasElement.querySelectorAll("dialog[open]")).toHaveLength(1);
  await expect(within(dialog).queryByRole("button", {name: /Закрыть|Свернуть/})).toBeNull();
  if ("__vitest_browser__" in globalThis) {
    const {userEvent: browserUser} = await import("vitest/browser");
    await browserUser.keyboard("{Escape}");
    await browserUser.tab();
  } else {
    const cancel = new Event("cancel", {cancelable: true});
    dialog.dispatchEvent(cancel);
    await expect(cancel.defaultPrevented).toBe(true);
    await userEvent.tab();
  }
  await expect(dialog).toHaveAttribute("open");
  await expect(dialog.contains(document.activeElement)).toBe(true);
  return within(dialog);
}

async function dismissDialog(canvas: ReturnType<typeof within>) {
  if ("__vitest_browser__" in globalThis) {
    const {userEvent: browserUser} = await import("vitest/browser");
    await browserUser.keyboard("{Escape}");
  } else {
    await userEvent.click(within(canvas.getByRole("dialog")).getByRole("button", {name: /Закрыть|Свернуть/}));
  }
  await waitFor(() => expect(canvas.queryByRole("dialog")).toBeNull());
}

function interaction(context: Context) {
  if (!("projection" in context.args.routeState) || !context.args.routeState.projection.interaction) {
    throw new Error("Interaction story requires an actor projection and interaction");
  }
  return context.args.routeState.projection.interaction;
}

const submitResponse: NonNullable<Story["play"]> = async (context) => {
  const dialog = await mandatoryDialog(context);
  const actions = interaction(context).actions;
  const index = actions.length - 1;
  const options = dialog.getAllByRole("option");
  await expect(options).toHaveLength(actions.length);
  await userEvent.click(options[index]!);
  await expect(options[index]).toHaveAttribute("aria-selected", "true");
  const submit = context.canvasElement.querySelector<HTMLButtonElement>(".interaction-submit");
  await expect(submit).toBeEnabled();
  if (!submit) {
    throw new Error("Interaction submit is absent");
  }
  submit.focus();
  await userEvent.keyboard("{Enter}");
  await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
  await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledWith(actions[index]);
};

export const RequiredResponse: Story = {play: submitResponse};
export const RequiredResponseCompact: Story = {...RequiredResponse, globals: compact};
export const PassOnly: Story = {args: gameScreenArgs("interaction-pass-only"), play: submitResponse};
export const PassOnlyCompact: Story = {...PassOnly, globals: compact};
export const TargetResponse: Story = {args: gameScreenArgs("target-response"), play: submitResponse};
export const TargetResponseCompact: Story = {...TargetResponse, globals: compact};

const charity: NonNullable<Story["play"]> = async (context) => {
  const dialog = await mandatoryDialog(context);
  if (!("projection" in context.args.routeState)) {
    throw new Error("Charity requires a projection");
  }
  const projection = context.args.routeState.projection;
  const transfer = projection.interaction?.charity_transfer;
  const action = projection.turn.available_actions.find((candidate) => candidate.type === "resolve_charity");
  const count = transfer?.excess ?? action?.minimum;
  if (!count) {
    throw new Error("Charity requires a positive server-projected excess");
  }
  const cards = context.canvasElement.querySelectorAll<HTMLButtonElement>(".charity-sheet__rail > button");
  await expect(context.canvasElement.querySelector(".charity-sheet__submit")).toBeDisabled();
  for (let index = 0; index < count; index++) {
    await userEvent.click(cards[index]!);
  }
  if (transfer) {
    await userEvent.click(dialog.getByRole("button", {name: "Назначить получателей"}));
    await expect(dialog.getByRole("button", {name: "Передать карты"})).toBeDisabled();
    const groups = context.canvasElement.querySelectorAll<HTMLElement>(".charity-sheet__recipients > div");
    await expect(groups).toHaveLength(count);
    await userEvent.click(within(groups[0]!).getByRole("button", {name: "Борис"}));
    await userEvent.click(within(groups[1]!).getByRole("button", {name: "Вера"}));
    await userEvent.click(dialog.getByRole("button", {name: "Передать карты"}));
    await expect(context.args["onSubmit-economy"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-economy"]).toHaveBeenCalledWith({
      kind: "charity", interactionID: projection.interaction!.interaction_id,
      allocations: [
        {instance_id: "charity-card-1", recipient_player_id: "player_1"},
        {instance_id: "charity-card-2", recipient_player_id: "player_2"},
      ],
    });
  } else {
    await expect(context.canvasElement.querySelector(".charity-sheet__recipients")).toBeNull();
    await userEvent.click(dialog.getByRole("button", {name: "Сбросить карты"}));
    await expect(context.args["onSubmit-economy"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-economy"]).toHaveBeenCalledWith({
      kind: "charity", action,
      allocations: projection.you.hand.slice(0, count).map((card) => ({instance_id: card.instance_id})),
    });
  }
};
export const Charity: Story = {args: gameScreenArgs("charity-transfer"), play: charity};
export const CharityCompact: Story = {...Charity, globals: compact};
export const CharityDiscard: Story = {args: gameScreenArgs("single-charity"), play: charity};
export const CharityDiscardCompact: Story = {...CharityDiscard, globals: compact};

export const HelpOffer: Story = {
  args: gameScreenArgs("helper-offer"),
  play: async (context) => {
    let canvas = await screen(context);
    if (window.innerWidth < 1024) {
      canvas = await mandatoryDialog(context);
    }
    const choices = canvas.getByRole("listbox", {name: "Варианты помощи"});
    const options = within(choices).getAllByRole("option");
    const action = interaction(context).actions[0]!;
    await userEvent.click(options[0]!);
    await expect(options[0]).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getAllByRole("button", {name: "Предложить помощь"})).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", {name: "Предложить помощь"}));
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledWith(action);
  },
};
export const HelpOfferCompact: Story = {...HelpOffer, globals: compact};
export const HelpIncoming: Story = {
  args: gameScreenArgs("helper-invite"),
  play: async (context) => {
    const canvas = await screen(context);
    if (window.innerWidth < 1024) {
      const dialog = await mandatoryDialog(context);
      await userEvent.click(dialog.getByRole("option", {name: /^Принять/}));
      await userEvent.click(dialog.getByRole("button", {name: "Принять"}));
    } else {
      const submit = canvas.getByRole("button", {name: "Подтвердить"});
      await expect(submit).toBeDisabled();
      await userEvent.click(canvas.getByRole("option", {name: /ИЛЛЮСТРАЦИЯ Принять/}));
      await userEvent.click(submit);
    }
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledWith(interaction(context).actions[0]);
  },
};
export const HelpIncomingCompact: Story = {...HelpIncoming, globals: compact};
export const RunAwayPending: Story = {
  args: gameScreenArgs("run-away-pending"),
  play: async (context) => {
    const canvas = await screen(context);
    if (window.innerWidth < 1024) {
      await expect(canvas.queryByRole("dialog")).toBeNull();
      await expect(canvas.queryByRole("button", {name: "Бросить кубик"})).toBeNull();
    } else {
      await expect(canvas.getByRole("heading", {name: "Бросок отправлен"})).toBeVisible();
      await expect(canvas.queryByRole("button", {name: "Бросить кубик"})).toBeNull();
    }
    await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
  },
};
export const RunAwayPendingCompact: Story = {...RunAwayPending, globals: compact};
export const DeathLoot: Story = {
  args: gameScreenArgs("death-loot"),
  play: async (context) => {
    const canvas = await screen(context);
    if (window.innerWidth < 1024) {
      const dialog = await mandatoryDialog(context);
      const surface = dialog.getByTestId("death-loot-surface");
      await expect(canvas.getAllByTestId("death-loot-surface")).toHaveLength(1);
      await expect(surface).toHaveAttribute("data-priority", "actor");
      await expect(surface.querySelectorAll(".death-loot-option")).toHaveLength(2);
      await userEvent.click(dialog.getByRole("option", {name: /Плащ обходчика/}));
      await userEvent.click(dialog.getByRole("button", {name: "Забрать выбранную карту"}));
    } else {
      await expect(canvas.queryByRole("dialog")).toBeNull();
      await expect(canvas.getByRole("listbox", {name: "Доступная добыча"})).toBeVisible();
      await expect(context.canvasElement.querySelectorAll(".game-table__death-loot")).toHaveLength(1);
      await userEvent.click(canvas.getByRole("option", {name: /Плащ обходчика/}));
      await userEvent.click(canvas.getByRole("button", {name: "Забрать карту"}));
    }
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledWith(interaction(context).actions[0]);
  },
};
export const DeathLootCompact: Story = {...DeathLoot, globals: compact};
export const Trade: Story = {args: gameScreenArgs("economy-offer"), play: submitResponse};
export const TradeCompact: Story = {...Trade, globals: compact};

async function openEconomy(context: Context) {
  const canvas = await screen(context);
  const opener = window.innerWidth < 1024
    ? canvas.getByRole("button", {name: "Персонаж"})
    : context.canvasElement.querySelector<HTMLButtonElement>(".game-table__character");
  if (!opener) {
    throw new Error("Character opener is absent");
  }
  await userEvent.click(opener);
  const character = await canvas.findByRole("dialog");
  await userEvent.click(within(character).getByRole("button", {
    name: window.innerWidth < 1024 ? /В РЮКЗАКЕ/ : /ПЕРЕНОСИМЫЕ ВЕЩИ/,
  }));
  const dialog = await canvas.findByRole("dialog");
  await expect(context.canvasElement.querySelectorAll("dialog[open]")).toHaveLength(1);
  return {canvas, dialog: within(dialog), opener};
}

const proposeEconomy: NonNullable<Story["play"]> = async (context) => {
  const {canvas, dialog, opener} = await openEconomy(context);
  const trade = context.name.startsWith("Trade Proposal");
  await userEvent.click(dialog.getByRole("tab", {name: trade ? "Предложить обмен · Вера" : "Предложить подарок · Борис"}));
  await expect(context.canvasElement.querySelector(".turn-action-sheet__submit")).toBeDisabled();
  await userEvent.click(dialog.getByRole("option", {name: trade ? /Передаваемый плащ/ : /Передаваемый фонарь/}));
  if (trade) {
    await userEvent.click(dialog.getByRole("button", {name: "Выбрать встречные карты"}));
    await userEvent.click(dialog.getByRole("option", {name: /Запасной щит/}));
  }
  await userEvent.click(dialog.getByRole("button", {name: trade ? "Предложить обмен" : "Предложить подарок"}));
  await expect(context.args["onSubmit-economy"]).toHaveBeenCalledTimes(1);
  await expect(context.args["onSubmit-economy"]).toHaveBeenCalledWith(expect.objectContaining({
    kind: "offer", recipientPlayerID: trade ? "player_2" : "player_1",
    offeredInstanceIDs: [trade ? "transfer-card-2" : "transfer-card-1"],
    requestedInstanceIDs: trade ? ["opaque-recipient-card-1"] : [],
  }));
  await dismissDialog(canvas);
  await waitFor(() => expect(opener).toHaveFocus());
  await expect(context.args.onExecute).not.toHaveBeenCalled();
};
export const Gift: Story = {args: gameScreenArgs("economy-actions"), play: proposeEconomy};
export const GiftCompact: Story = {...Gift, globals: compact};
export const TradeProposal: Story = {args: gameScreenArgs("economy-actions"), play: proposeEconomy};
export const TradeProposalCompact: Story = {...TradeProposal, globals: compact};
export const TheftResponse: Story = {args: gameScreenArgs("theft-response"), play: submitResponse};
export const TheftResponseCompact: Story = {...TheftResponse, globals: compact};
export const PrivateChoice: Story = {args: gameScreenArgs("interaction-private-choice"), play: submitResponse};
export const PrivateChoiceCompact: Story = {...PrivateChoice, globals: compact};
export const EffectChoice: Story = {
  args: gameScreenArgs("target-private-choice"),
  play: async (context) => {
    const dialog = await mandatoryDialog(context);
    const confirm = dialog.getByRole("button", {name: "Подтвердить выбор"});
    await expect(confirm).toBeDisabled();
    await userEvent.click(dialog.getByRole("option", {name: /Карта с длинным названием/}));
    await userEvent.click(confirm);
    if (!("projection" in context.args.routeState)) {
      throw new Error("Effect choice requires a projection");
    }
    const action = context.args.routeState.projection.turn.available_actions[0];
    await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
    await expect(context.args.onExecute).toHaveBeenCalledWith({action, index: 0}, {choice_ids: ["hero-card-1"]});
    await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
  },
};
export const EffectChoiceCompact: Story = {...EffectChoice, globals: compact};
export const ExpiredChoice: Story = {
  args: gameScreenArgs("expired-choice"),
  play: async (context) => {
    const canvas = await screen(context);
    const dialog = await canvas.findByRole("dialog");
    await expect(within(dialog).getByText("Окно ответа истекло на сервере.")).toBeVisible();
    await expect(within(dialog).queryByRole("option")).toBeNull();
    await dismissDialog(canvas);
    await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
  },
};
export const ExpiredChoiceCompact: Story = {...ExpiredChoice, globals: compact};

const observer: NonNullable<Story["play"]> = async (context) => {
  const canvas = await screen(context);
  const dialog = await canvas.findByRole("dialog");
  await expect(within(dialog).queryByRole("option")).toBeNull();
  await expect(dialog).not.toHaveTextContent("Предложенный предмет");
  await expect(dialog).not.toHaveTextContent("hero-card-");
  await expect(dialog.querySelector(".interaction-helper-summary")).toBeNull();
  await expect(dialog.querySelector(".interaction-helper-form")).toBeNull();
  await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
};
export const OpaqueWindow: Story = {args: gameScreenArgs("interaction-opaque"), play: observer};
export const OpaqueWindowCompact: Story = {...OpaqueWindow, globals: compact};
export const HelperObserver: Story = {args: gameScreenArgs("helper-observer"), play: observer};
export const HelperObserverCompact: Story = {...HelperObserver, globals: compact};
export const EconomyObserver: Story = {args: gameScreenArgs("economy-observer"), play: observer};
export const EconomyObserverCompact: Story = {...EconomyObserver, globals: compact};
export const TargetObserver: Story = {args: gameScreenArgs("target-observer"), play: observer};
export const TargetObserverCompact: Story = {...TargetObserver, globals: compact};
export const AdvancedCombat: Story = {args: gameScreenArgs("advanced-combat"), play: submitResponse};
export const AdvancedCombatCompact: Story = {...AdvancedCombat, globals: compact};
export const ForcedHelper: Story = {
  args: gameScreenArgs("advanced-forced-helper"),
  play: async (context) => {
    const canvas = await screen(context);
    const dialog = await canvas.findByRole("dialog");
    await expect(dialog).not.toHaveTextContent("Наград");
    await expect(within(dialog).queryByRole("button", {name: "Отклонить"})).toBeNull();
    await submitResponse(context);
  },
};
export const ForcedHelperCompact: Story = {...ForcedHelper, globals: compact};
export const AdvancedObserver: Story = {
  args: gameScreenArgs("advanced-observer"),
  play: async (context) => {
    await observer(context);
    const dialog = within(context.canvasElement).getByRole("dialog");
    await expect(dialog).not.toHaveTextContent("Вызов дополнительного монстра");
    await expect(dialog).not.toHaveTextContent("Карта с длинным названием");
  },
};
export const AdvancedObserverCompact: Story = {...AdvancedObserver, globals: compact};
export const TargetInitiator: Story = {
  args: gameScreenArgs("target-initiator"),
  play: async (context) => {
    const canvas = await screen(context);
    const opener = canvas.getByRole("button", {name: window.innerWidth < 1024 ? /^Рука ·/ : "Открыть руку"});
    await userEvent.click(opener);
    const dialog = within(await canvas.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("option", {name: /Эффект с выбором цели/}));
    const submit = dialog.getByRole("button", {name: "Применить эффект к цели"});
    await expect(submit).toBeDisabled();
    await userEvent.click(dialog.getByRole("button", {name: "Борис"}));
    await userEvent.click(submit);
    if (!("projection" in context.args.routeState)) {
      throw new Error("Target action requires a projection");
    }
    await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
    await expect(context.args.onExecute).toHaveBeenCalledWith({
      action: context.args.routeState.projection.turn.available_actions[0], index: 0,
    }, {instance_id: "target-effect-card", target_player_id: "player_1"});
  },
};
export const TargetInitiatorCompact: Story = {...TargetInitiator, globals: compact};
export const RunAwayResponse: Story = {
  args: gameScreenArgs("run-away-response"),
  play: async (context) => {
    let canvas = await screen(context);
    if (window.innerWidth < 1024) {
      canvas = await mandatoryDialog(context);
    }
    await expect(canvas.getAllByRole("button", {name: "Бросить кубик"})).toHaveLength(1);
    await userEvent.click(canvas.getByRole("button", {name: "Бросить кубик"}));
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledTimes(1);
    await expect(context.args["onSubmit-interaction"]).toHaveBeenCalledWith(interaction(context).actions[0]);
  },
};
export const RunAwayResponseCompact: Story = {...RunAwayResponse, globals: compact};
export const RunAwayObserver: Story = {
  args: gameScreenArgs("run-away-observer"),
  play: async (context) => {
    const canvas = await screen(context);
    await expect(context.canvasElement.querySelector(".game-table")).toBeVisible();
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvas.queryByRole("button", {name: "Бросить кубик"})).toBeNull();
    await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
  },
};
export const RunAwayObserverCompact: Story = {...RunAwayObserver, globals: compact};
export const AbilityCombat: Story = {
  args: gameScreenArgs("ability-combat"),
  play: async (context) => {
    const {dialog} = await openEconomy(context);
    const submit = dialog.getByRole("button", {name: "Использовать способность"});
    await expect(submit).toBeDisabled();
    await userEvent.click(dialog.getByRole("option", {name: /Карта с длинным названием/}));
    await userEvent.click(submit);
    if (!("projection" in context.args.routeState)) {
      throw new Error("Ability action requires a projection");
    }
    await expect(context.args.onExecute).toHaveBeenCalledTimes(1);
    await expect(context.args.onExecute).toHaveBeenCalledWith({
      action: context.args.routeState.projection.turn.available_actions[0], index: 0,
    }, {instance_id: "ability-source", instance_ids: ["hero-card-1"], ability_index: 0});
  },
};
export const AbilityCombatCompact: Story = {...AbilityCombat, globals: compact};
export const DeathLootObserver: Story = {
  args: gameScreenArgs("death-loot-observer"),
  play: async (context) => {
    const canvas = await screen(context);
    await expect(context.canvasElement.querySelector(".game-table")).toBeVisible();
    await expect(canvas.queryByRole("dialog")).toBeNull();
    await expect(canvas.queryByRole("button", {name: /Забрать.*карту/})).toBeNull();
    await expect(context.canvasElement).not.toHaveTextContent("Плащ обходчика");
    await expect(context.canvasElement).not.toHaveTextContent("loot-option-");
    await expect(context.args["onSubmit-interaction"]).not.toHaveBeenCalled();
  },
};
export const DeathLootObserverCompact: Story = {...DeathLootObserver, globals: compact};
