<script setup lang="ts">
import {
  lobbyFormError,
  validateLobbyInput,
  type LobbyField,
  type LobbyFormError,
  type LobbyFormInput,
  type LobbyFormMode,
} from "./lobbyModel";

const props = defineProps<{
  mode: LobbyFormMode;
  number: string;
  title: string;
  description: string;
  submit: (input: LobbyFormInput) => Promise<void>;
}>();

const displayName = ref("");
const gameID = ref("");
const state = ref<"idle" | "loading" | "success" | "error" | "offline">("idle");
const formError = ref<LobbyFormError>();
const formElement = ref<HTMLFormElement | null>(null);
const displayNameInput = ref<HTMLInputElement | null>(null);
const gameIDInput = ref<HTMLInputElement | null>(null);

const formID = computed(() => `lobby-${props.mode}-form`);
const headingID = computed(() => `${formID.value}-heading`);
const errorID = computed(() => `${formID.value}-error`);
const displayNameErrorID = computed(() => `${formID.value}-display-name-error`);
const gameIDErrorID = computed(() => `${formID.value}-game-id-error`);
const submitLabel = computed(() => props.mode === "create" ? "Создать" : "Войти");
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
    ref="formElement"
    class="lobby-form"
    :class="`lobby-form--${props.mode}`"
    :aria-labelledby="headingID"
    :aria-busy="state === 'loading'"
    :data-state="state"
    novalidate
    @invalid.capture="handleInvalid"
    @submit.prevent="handleSubmit"
  >
    <span class="lobby-form__number">{{ props.number }}</span>
    <h2 :id="headingID">{{ props.title }}</h2>
    <p class="lobby-form__description">{{ props.description }}</p>

    <fieldset class="lobby-form__fields">
      <legend class="lobby-form__legend">{{ props.title }}</legend>

      <label :for="`${formID}-display-name`">
        Имя игрока
        <input
          :id="`${formID}-display-name`"
          ref="displayNameInput"
          v-model="displayName"
          autocomplete="name"
          maxlength="40"
          minlength="1"
          required
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
        ID игры
        <input
          :id="`${formID}-game-id`"
          ref="gameIDInput"
          v-model="gameID"
          autocomplete="off"
          inputmode="text"
          required
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
    >
      {{ state === "loading" ? pendingLabel : submitLabel }}
    </button>
  </form>
</template>

<style scoped>
.lobby-form {
  display: grid;
  min-width: 0;
  gap: 1rem;
  align-content: start;
  padding: clamp(1rem, 3vw, 1.5rem);
  border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel), transparent 8%);
}

.lobby-form[data-state="loading"] { border-color: var(--acid); }
.lobby-form[data-state="success"] { border-color: var(--success, #38b978); }
.lobby-form[data-state="offline"],
.lobby-form[data-state="error"] { border-color: var(--orange); }
.lobby-form__number { color: var(--orange); font-size: .72rem; }
.lobby-form h2 { margin: 0; font-size: clamp(1.5rem, 4vw, 2rem); }
.lobby-form__description { min-height: 2.8em; margin: 0; color: var(--muted); }
.lobby-form__fields {
  display: grid;
  min-width: 0;
  gap: .85rem;
  margin: 0;
  padding: 0;
  border: 0;
}
.lobby-form__legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.lobby-form label { display: grid; gap: .15rem; }
.lobby-form input { min-height: 44px; margin-top: .2rem; }
.lobby-form input[aria-invalid="true"] { border-color: var(--orange); }
.lobby-form__field-error,
.lobby-form__error,
.lobby-form__status { margin: -.45rem 0 0; font-size: .9rem; line-height: 1.4; }
.lobby-form__field-error,
.lobby-form__error { color: #ffd3bd; }
.lobby-form__error { border-left: 4px solid var(--orange); padding: .75rem; background: #381c13; }
.lobby-form__status { color: var(--acid); }
.lobby-form__submit { min-height: 44px; }

@media (max-width: 374px) {
  .lobby-form { padding: 1rem; }
  .lobby-form__description { min-height: 0; }
}
</style>
