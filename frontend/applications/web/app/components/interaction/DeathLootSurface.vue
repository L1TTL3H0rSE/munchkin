<script setup lang="ts">
import {computed, ref, watch} from "vue";
import CardPresentation from "../game/primitives/CardPresentation.vue";

import {
  interactionIsTerminal,
  type InteractionActionView,
} from "./interactionModel";
import {
  deathLootOptions,
  deathLootPassAction,
  deathLootTerminalMessage,
  isDeathLootInteraction,
  type DeathLootInteraction,
} from "./deathLootModel";

const props = defineProps<{
  interaction: DeathLootInteraction;
  busy: boolean;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
}>();

const selectedActionID = ref<string | null>(null);
const options = computed(() => deathLootOptions(props.interaction));
const passAction = computed(() => deathLootPassAction(props.interaction));
const terminal = computed(() => interactionIsTerminal(props.interaction) ||
  props.interaction.death_loot.remaining_count === 0);
const terminalMessage = computed(() => deathLootTerminalMessage(props.interaction));
const selectedOption = computed(() => options.value.find(({action}) =>
  action.action_id === selectedActionID.value,
));

watch(
  () => options.value.map(({action}) =>
    `${action.interaction_id}:${action.revision}:${action.action_id}`,
  ).join("|"),
  () => {
    if (!options.value.some(({action}) => action.action_id === selectedActionID.value)) {
      selectedActionID.value = options.value[0]?.action.action_id ?? null;
    }
  },
  {immediate: true},
);

function submitPick(): void {
  const action = selectedOption.value?.action;
  if (!action || props.busy || terminal.value) {
    return;
  }
  emit("submit", action);
}

function submitPass(): void {
  if (!passAction.value || props.busy || terminal.value) {
    return;
  }
  emit("submit", passAction.value);
}
</script>

<template>
  <section
    v-if="isDeathLootInteraction(interaction)"
    class="death-loot-surface"
    data-testid="death-loot-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
    :data-priority="interaction.response_required_for_you ? 'actor' : 'observer'"
    aria-labelledby="death-loot-surface-title"
  >
    <header class="death-loot-surface__header">
      <h3 id="death-loot-surface-title">Добыча погибшего игрока</h3>
      <p>Выбери одну карту из доступного пула или откажись.</p>
    </header>

    <p v-if="terminalMessage" class="death-loot-surface__result" role="status" aria-live="polite">
      {{ terminalMessage }}
    </p>

    <form
      v-if="options.length"
      class="death-loot-form"
      novalidate
      @submit.prevent="submitPick"
    >
      <div class="death-loot-form__choices">
        <fieldset
          :disabled="busy || terminal"
          role="listbox"
          aria-label="Доступные карты погибшего игрока"
        >
          <legend>Доступные карты</legend>
          <button
            v-for="option in options"
            :key="option.action.action_id"
            type="button"
            role="option"
            :aria-selected="option.action.action_id === selectedActionID"
            class="death-loot-option"
            :class="{'death-loot-option--selected': option.action.action_id === selectedActionID}"
            @click="selectedActionID = option.action.action_id"
          >
            <CardPresentation :card="option.card" variant="choice" />
          </button>
        </fieldset>
        <button
          v-if="passAction"
          class="death-loot-submit death-loot-submit--secondary"
          type="button"
          :disabled="busy || terminal"
          @click="submitPass"
        >
          <span>ПРОПУСТИТЬ</span>
          <small>Не брать карту</small>
        </button>
      </div>
      <button
        class="death-loot-submit"
        type="submit"
        :disabled="busy || terminal || !selectedOption"
      >
        {{ busy ? "Отправляем выбор…" : "Забрать карту" }}
      </button>
    </form>

    <p v-if="!options.length && !terminal" class="death-loot-surface__opaque" role="status">
      Доступных карт сейчас нет.
    </p>
    <footer class="death-loot-surface__footer">
      <small>ПОСЛЕ ОТВЕТА ПРИОРИТЕТ ПЕРЕЙДЁТ К СЛЕДУЮЩЕМУ ИГРОКУ</small>
    </footer>
  </section>
</template>

<style scoped>
.death-loot-surface {
  position: relative;
  display: grid;
  min-width: 0;
  color: var(--color-text);
}

.death-loot-surface__header,
.death-loot-form,
.death-loot-surface__header h3,
.death-loot-surface__header p,
.death-loot-surface__opaque,
.death-loot-surface__result {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.death-loot-surface__header p,
.death-loot-surface__opaque {
  color: var(--muted);
}

.death-loot-form fieldset {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.death-loot-option {
  min-width: 0;
  cursor: pointer;
}

.death-loot-surface__result {
  color: var(--color-action-primary);
}

.death-loot-surface__opaque {
  place-self: center;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .death-loot-surface,
  .death-loot-option {
    scroll-behavior: auto;
    transition: none;
  }
}

@media (forced-colors: active) {
  .death-loot-surface,
  .death-loot-option,
  .death-loot-surface__result,
  .death-loot-surface__opaque {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}

.death-loot-surface {
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  box-sizing: border-box;
  border: 0;
  padding: 0;
  background: transparent;
}
.death-loot-surface__header { display: block; }
.death-loot-surface__header h3 { margin: 0; color: var(--color-text-primary); font-size: 20px; line-height: 24px; }
.death-loot-surface__header p { margin: 6px 0 0; color: var(--color-text-secondary); font-size: 12px; line-height: 16px; }
.death-loot-form {
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
}
.death-loot-form__choices {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 12px;
  overflow-x: auto;
  padding: 6px;
  scroll-snap-type: x proximity;
}
.death-loot-form fieldset {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: visible;
}
.death-loot-form legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.death-loot-option {
  position: relative;
  flex: 0 0 auto;
  display: block;
  border: 0;
  padding: 0;
  background: transparent;
  scroll-snap-align: center;
}
.death-loot-option--selected :deep(.choice-card-presentation) { border-color: var(--color-action-primary); }
.death-loot-submit:not(.death-loot-submit--secondary) {
  justify-self: end;
  width: 180px;
  min-height: 44px;
}
.death-loot-submit--secondary {
  flex: 0 0 auto;
  width: 150px;
  height: 218px;
  display: grid;
  align-content: end;
  justify-items: start;
  gap: 8px;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  padding: 102px 10px 10px;
  color: var(--color-text-primary);
  background: linear-gradient(#aabdb5 0 92px, var(--color-surface-card) 92px);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
  text-align: start;
  scroll-snap-align: center;
}
.death-loot-submit--secondary span { font-size: 11px; font-weight: 600; }
.death-loot-submit--secondary small { color: var(--color-text-muted); font-size: 9px; }
.death-loot-surface__footer {
  align-self: end;
  color: var(--color-text-muted);
  font-size: 9px;
  letter-spacing: .04em;
}

@media (width < 600px) {
  .death-loot-submit:not(.death-loot-submit--secondary) {
    width: 100%;
  }
}
</style>
