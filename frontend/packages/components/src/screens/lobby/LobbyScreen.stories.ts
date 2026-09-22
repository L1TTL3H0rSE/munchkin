import type {Meta, StoryObj} from "@storybook/vue3-vite";
import {expect, fn, userEvent, waitFor, within} from "storybook/test";
import {lobbyErrorForKind} from "../../components/lobby/lobbyModel";
import LobbyScreen from "./LobbyScreen.vue";

const meta = {
  title: "Screens/Lobby",
  component: LobbyScreen,
  args: {
    forms: {
      create: {busy: false, error: null, successful: false},
      join: {busy: false, error: null, successful: false},
    },
    onSubmit: fn(),
  },
  parameters: {lobby: true},
  globals: {viewport: {value: "wide"}},
  beforeEach: async ({globals}) => {
    await waitFor(() => expect(window.innerWidth).toBe(globals.viewport.value === "compact" ? 360 : 1440));
  },
} satisfies Meta<typeof LobbyScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({canvasElement, args, globals}) => {
    const canvas = within(canvasElement);
    const form = within(canvasElement.querySelector(".lobby-form--create") as HTMLElement);
    await userEvent.type(form.getByLabelText("Твоё имя"), "Игрок");
    await userEvent.click(form.getByRole("button", {name: "Создать комнату"}));
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "create", displayName: "Игрок"});
    await expect(canvas.getByRole("heading", {name: "Войти в игру"})).toBeVisible();
    if (globals.viewport.value === "wide") {
      await expect(canvas.getByRole("heading", {name: /Собери друзей/})).toBeVisible();
    }
  },
};
export const CreateCompact: Story = {...Create, globals: {viewport: {value: "compact"}}};
export const Join: Story = {
  args: {initialMode: "join"},
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Друг");
    await userEvent.type(canvas.getByRole("textbox", {name: "ID комнаты"}), "K7M2{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "join", displayName: "Друг", gameID: "K7M2"});
  },
};
export const JoinCompact: Story = {...Join, globals: {viewport: {value: "compact"}}};
export const Compact: Story = {...CreateCompact};
export const Empty: Story = {
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {name: "Создать комнату"}));
    const input = canvas.getByRole("textbox", {name: "Твоё имя"});
    await expect(input).toHaveFocus();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Введите имя игрока.")).toBeVisible();
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.type(input, "Исправлено{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "create", displayName: "Исправлено"});
    await expect(input).not.toHaveAttribute("aria-invalid");
  },
};
export const EmptyCompact: Story = {...Empty, globals: {viewport: {value: "compact"}}};
export const EmptyRoom: Story = {
  args: {initialMode: "join"},
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Друг{Enter}");
    const room = canvas.getByRole("textbox", {name: "ID комнаты"});
    await expect(room).toHaveFocus();
    await expect(room).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Введите ID игры.")).toBeVisible();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
export const EmptyRoomCompact: Story = {...EmptyRoom, globals: {viewport: {value: "compact"}}};
export const Pending: Story = {
  args: {forms: {...meta.args.forms, create: {busy: true, error: null, successful: false}}},
  play: async ({canvasElement, args}) => {
    await expect(canvasElement.querySelector(".lobby-form--create")).toHaveAttribute("aria-busy", "true");
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Создатель");
    await expect(canvas.getByRole("button", {name: "Создаём…"})).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", {name: "Войти"}));
    await expect(canvasElement.querySelector(".lobby-form--join")).toHaveAttribute("data-state", "idle");
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Гость");
    await userEvent.type(canvas.getByRole("textbox", {name: "ID комнаты"}), "K7M2{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledOnce();
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "join", displayName: "Гость", gameID: "K7M2"});
    await userEvent.click(canvas.getByRole("button", {name: "Создать"}));
    await expect(canvas.getByRole("textbox", {name: "Твоё имя"})).toHaveValue("Создатель");
    await expect(canvasElement.querySelector(".lobby-form--create")).toHaveAttribute("aria-busy", "true");
  },
};
export const PendingCompact: Story = {...Pending, globals: {viewport: {value: "compact"}}};
export const JoinPending: Story = {
  args: {initialMode: "join", forms: {...meta.args.forms, join: {busy: true, error: null, successful: false}}},
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", {name: "Входим…"})).toBeDisabled();
    await expect(canvasElement.querySelector(".lobby-form--join")).toHaveAttribute("aria-busy", "true");
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Гость{Enter}");
    await expect(args.onSubmit).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", {name: "Создать"}));
    await expect(canvas.getByRole("button", {name: "Создать комнату"})).toBeEnabled();
  },
};
export const JoinPendingCompact: Story = {...JoinPending, globals: {viewport: {value: "compact"}}};
export const KeyboardModes: Story = {
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    const create = canvas.getByRole("button", {name: "Создать"});
    create.focus();
    await userEvent.tab();
    const join = canvas.getByRole("button", {name: "Войти"});
    await expect(join).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(join).toHaveAttribute("aria-pressed", "true");
    await userEvent.tab();
    const name = canvas.getByRole("textbox", {name: "Твоё имя"});
    await expect(name).toHaveFocus();
    await userEvent.type(name, "Сохранено");
    await userEvent.tab();
    await expect(canvas.getByRole("textbox", {name: "ID комнаты"})).toHaveFocus();
    await userEvent.click(create);
    await expect(canvasElement.querySelector(".lobby-form--join")).not.toBeVisible();
    await userEvent.click(join);
    await expect(canvas.getByRole("textbox", {name: "Твоё имя"})).toHaveValue("Сохранено");
  },
};
export const KeyboardModesCompact: Story = {...KeyboardModes, globals: {viewport: {value: "compact"}}};
export const Offline: Story = {
  args: {forms: {...meta.args.forms, create: {busy: false, successful: false, error: lobbyErrorForKind("offline")}}},
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Проверьте подключение");
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), "Повтор{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "create", displayName: "Повтор"});
  },
};
export const OfflineCompact: Story = {...Offline, globals: {viewport: {value: "compact"}}};
export const RoomNotFound: Story = {
  args: {initialMode: "join", forms: {...meta.args.forms, join: {
    busy: false, successful: false, error: lobbyErrorForKind("not_found"),
  }}},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", {name: "ID комнаты"})).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByText("Комната не найдена. Проверьте код и повторите попытку.")).toBeVisible();
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
export const RoomNotFoundCompact: Story = {...RoomNotFound, globals: {viewport: {value: "compact"}}};
export const ServerError: Story = {
  args: {forms: {...meta.args.forms, create: {busy: false, successful: false, error: lobbyErrorForKind("transient")}}},
  play: async ({canvasElement}) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Сейчас не получается открыть комнату.");
    await expect(canvas.getByRole("button", {name: "Создать комнату"})).toBeEnabled();
  },
};
export const ServerErrorCompact: Story = {...ServerError, globals: {viewport: {value: "compact"}}};
export const Success: Story = {
  args: {forms: {...meta.args.forms, create: {busy: false, error: null, successful: true}}},
  play: async ({canvasElement}) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Готово, открываем игру…");
    await expect(canvasElement.querySelector(".lobby-form--create")).toHaveAttribute("data-state", "success");
  },
};
export const SuccessCompact: Story = {...Success, globals: {viewport: {value: "compact"}}};
export const JoinSuccess: Story = {
  args: {initialMode: "join", forms: {...meta.args.forms, join: {busy: false, error: null, successful: true}}},
  play: async ({canvasElement}) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Готово, открываем игру…");
    await expect(canvasElement.querySelector(".lobby-form--join")).toHaveAttribute("data-state", "success");
  },
};
export const JoinSuccessCompact: Story = {...JoinSuccess, globals: {viewport: {value: "compact"}}};
export const LongValues: Story = {
  args: {initialMode: "join"},
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    const name = "И".repeat(40);
    const room = "K".repeat(80);
    await userEvent.type(canvas.getByRole("textbox", {name: "Твоё имя"}), `${name}Лишнее`);
    await userEvent.type(canvas.getByRole("textbox", {name: "ID комнаты"}), `${room}Лишнее`);
    await userEvent.click(canvas.getByRole("button", {name: "Войти в комнату"}));
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "join", displayName: name, gameID: room});
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
export const LongValuesCompact: Story = {...LongValues, globals: {viewport: {value: "compact"}}};
