import type {Meta, StoryObj} from "@storybook/vue3-vite";
import {expect, fn, userEvent, within} from "storybook/test";
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
} satisfies Meta<typeof LobbyScreen>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {
  play: async ({canvasElement, args}) => {
    const canvas = within(canvasElement);
    const form = within(canvasElement.querySelector(".lobby-form--create") as HTMLElement);
    await userEvent.type(form.getByLabelText("Твоё имя"), "Игрок");
    await userEvent.click(form.getByRole("button", {name: "Создать комнату"}));
    await expect(args.onSubmit).toHaveBeenCalledWith({mode: "create", displayName: "Игрок"});
    await expect(canvas.getByRole("heading", {name: /Собери друзей/})).toBeVisible();
  },
};
export const Join: Story = {args: {initialMode: "join"}};
export const Compact: Story = {globals: {viewport: {value: "compact"}}};
export const Pending: Story = {
  args: {forms: {...meta.args.forms, create: {busy: true, error: null, successful: false}}},
  play: async ({canvasElement}) => {
    await expect(canvasElement.querySelector(".lobby-form--create")).toHaveAttribute("aria-busy", "true");
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", {name: "Войти"}));
    await expect(canvasElement.querySelector(".lobby-form--join")).toHaveAttribute("data-state", "idle");
  },
};
export const Offline: Story = {args: {forms: {...meta.args.forms, create: {
  busy: false, successful: false,
  error: {field: "form", kind: "offline", message: "Проверьте подключение и повторите попытку.", retryable: true},
}}}};
