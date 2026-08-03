<script setup lang="ts">
import {
  lobbyFormError,
  validateLobbyInput,
  type LobbyField,
  type LobbyFormError,
  type LobbyFormInput,
  type LobbyFormMode,
  type LobbyFormState,
} from "./lobbyModel";

const props = defineProps<{
  mode: LobbyFormMode;
  number: string;
  title: string;
  description: string;
  submit: (input: LobbyFormInput) => Promise<void>;
  compact?: boolean;
  labelledBy?: string;
}>();

const displayName = ref("");
const gameID = ref("");
const state = ref<LobbyFormState>("idle");
const formError = ref<LobbyFormError>();
const displayNameInput = ref<HTMLInputElement | null>(null);
const gameIDInput = ref<HTMLInputElement | null>(null);

const formID = computed(() => `lobby-${props.mode}-form`);
const headingID = computed(() => `${formID.value}-heading`);
const formLabelledBy = computed(() => props.labelledBy ?? headingID.value);
const errorID = computed(() => `${formID.value}-error`);
const displayNameErrorID = computed(() => `${formID.value}-display-name-error`);
const gameIDErrorID = computed(() => `${formID.value}-game-id-error`);
const submitLabel = computed(() => props.mode === "create" ? "Создать комнату" : "Войти в комнату");
const pendingLabel = computed(() => props.mode === "create" ? "Создаём…" : "Входим…");

function values(): LobbyFormInput {
  if (props.mode === "create") {
    return {mode: "create", displayName: displayName.value};
  }
  return {
    mode: "join",
    displayName: displayName.value,
    gameID: gameID.value,
  };
}

function focusField(field: LobbyField): void {
  void nextTick(() => {
    if (field === "gameID") {
      gameIDInput.value?.focus();
      return;
    }
    displayNameInput.value?.focus();
  });
}

function setError(error: LobbyFormError): void {
  formError.value = error;
  state.value = error.kind === "offline" ? "offline" : "error";
  focusField(error.field);
}

function handleInvalid(event: Event): void {
  event.preventDefault();
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const field: LobbyField = target === gameIDInput.value ? "gameID" : "displayName";
  const error = validateLobbyInput(props.mode, values()) ?? {
    field,
    kind: "validation" as const,
    message: target.validationMessage || "Проверьте это поле.",
    retryable: false,
  };
  setError(error);
}

async function handleSubmit(): Promise<void> {
  formError.value = undefined;
  const input = values();
  const validationError = validateLobbyInput(props.mode, input);
  if (validationError) {
    setError(validationError);
    return;
  }

  state.value = "loading";
  try {
    await props.submit(input);
    state.value = "success";
  } catch (error: unknown) {
    setError(lobbyFormError(error));
  }
}
</script>

<template>
  <form
    class="lobby-form"
    :class="[`lobby-form--${props.mode}`, {'lobby-form--compact': props.compact}]"
    :aria-labelledby="formLabelledBy"
    :aria-busy="state === 'loading'"
    :data-state="state"
    novalidate
    @invalid.capture="handleInvalid"
    @submit.prevent="handleSubmit"
  >
    <span v-if="!props.compact" class="lobby-form__number">{{ props.number }}</span>
    <h2 v-if="!props.compact" :id="headingID">{{ props.title }}</h2>
    <p v-if="!props.compact" class="lobby-form__description">{{ props.description }}</p>

    <fieldset class="lobby-form__fields">
      <legend class="lobby-form__legend">{{ props.title }}</legend>

      <label :for="`${formID}-display-name`">
        {{ props.compact ? "Твоё имя" : "Имя игрока" }}
        <input
          :id="`${formID}-display-name`"
          ref="displayNameInput"
          v-model="displayName"
          name="display_name"
          autocomplete="nickname"
          maxlength="40"
          minlength="1"
          required
          :placeholder="props.compact ? 'Как тебя назвать?' : undefined"
          :aria-describedby="formError?.field === 'displayName' ? displayNameErrorID : undefined"
          :aria-invalid="formError?.field === 'displayName' ? 'true' : undefined"
        >
      </label>
      <p
        v-if="formError?.field === 'displayName'"
        :id="displayNameErrorID"
        class="lobby-form__field-error"
      >
        {{ formError.message }}
      </p>

      <label v-if="props.mode === 'join'" :for="`${formID}-game-id`">
        {{ props.compact ? "ID комнаты" : "ID игры" }}
        <input
          :id="`${formID}-game-id`"
          ref="gameIDInput"
          v-model="gameID"
          name="game_id"
          autocomplete="off"
          autocapitalize="none"
          inputmode="text"
          maxlength="80"
          required
          :placeholder="props.compact ? 'Например, K7M2' : undefined"
          :aria-describedby="formError?.field === 'gameID' ? gameIDErrorID : undefined"
          :aria-invalid="formError?.field === 'gameID' ? 'true' : undefined"
        >
      </label>
      <p
        v-if="formError?.field === 'gameID'"
        :id="gameIDErrorID"
        class="lobby-form__field-error"
      >
        {{ formError.message }}
      </p>
    </fieldset>

    <p
      v-if="formError?.field === 'form'"
      :id="errorID"
      class="lobby-form__error"
      role="alert"
    >
      {{ formError.message }}
      <span v-if="formError.retryable"> Можно повторить попытку.</span>
    </p>
    <p v-if="state === 'success'" class="lobby-form__status" role="status">
      Готово, открываем игру…
    </p>

    <button
      class="lobby-form__submit"
      type="submit"
      :disabled="state === 'loading'"
      :aria-busy="state === 'loading'"
      :aria-describedby="formError?.field === 'form' ? errorID : undefined"
    >
      {{ state === "loading" ? pendingLabel : submitLabel }}
    </button>
  </form>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.lobby-form {
  display: grid;
  min-width: 0;
  gap: var(--space-4);
  align-content: start;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
  box-shadow: 0 8px 0 rgb(38 55 46 / 6%);
}

.lobby-form[data-state="loading"] { border-color: var(--color-accent-strong); }
.lobby-form[data-state="success"] { border-color: var(--color-success); }
.lobby-form[data-state="offline"],
.lobby-form[data-state="error"] { border-color: var(--color-danger); }
.lobby-form__number {
  color: var(--color-rust);
  font-family: var(--font-meta);
  font-size: .75rem;
  font-weight: 800;
  letter-spacing: .12em;
}
.lobby-form h2 { margin: 0; font-size: clamp(1.45rem, 3vw, 1.9rem); }
.lobby-form__description { min-height: 2.8em; margin: 0; color: var(--color-text-muted); }
.lobby-form__fields {
  display: grid;
  min-width: 0;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  border: 0;
}
.lobby-form__legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lobby-form label { display: grid; gap: .15rem; color: var(--color-text-muted); }
.lobby-form input { min-height: 44px; margin-top: .2rem; }
.lobby-form input[aria-invalid="true"] { border-color: var(--color-danger); }
.lobby-form__field-error,
.lobby-form__error,
.lobby-form__status { margin: -.45rem 0 0; font-size: .9rem; line-height: 1.4; }
.lobby-form__field-error,
.lobby-form__error { color: var(--color-danger); }
.lobby-form__error {
  border-left: 4px solid var(--color-danger);
  border-radius: var(--radius-control);
  padding: .75rem;
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-paper));
}
.lobby-form__status { color: var(--color-success); }
.lobby-form__submit { min-height: 44px; justify-self: start; min-width: 132px; }
.lobby-form__submit:disabled {
  border-color: var(--color-line);
  background: var(--color-line);
  color: var(--color-text);
  opacity: 1;
}

@include api.forced-colors {
  .lobby-form { box-shadow: none; }
  .lobby-form__error { border: 2px solid CanvasText; }
}

@media (max-width: 374px) {
  .lobby-form { padding: 1rem; }
  .lobby-form__description { min-height: 0; }
}
</style>
