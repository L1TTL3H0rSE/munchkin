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
  timerText: string;
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
    if (selectedActionID.value && !options.value.some(({action}) =>
      action.action_id === selectedActionID.value,
    )) {
      selectedActionID.value = null;
    }
  },
);

function submitPick(): void {
  const action = selectedOption.value?.action;
  if (!action || props.busy || terminal.value) return;
  emit("submit", action);
}

function submitPass(): void {
  if (!passAction.value || props.busy || terminal.value) return;
  emit("submit", passAction.value);
}
</script>

<template>
  <section
    v-if="isDeathLootInteraction(interaction)"
    class="death-loot-surface"
    data-testid="death-loot-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
    data-priority="actor"
    aria-label="Выбор добычи после смерти"
  >
    <header class="death-loot-surface__header">
      <div>
        <h3>Добыча после смерти</h3>
        <p>Твой приоритет · осталось {{ interaction.death_loot.remaining_count }} · выбери 1 карту.</p>
      </div>
      <time :datetime="interaction.deadline_at">{{ timerText }}</time>
    </header>

    <p v-if="terminalMessage" class="death-loot-surface__result" role="status" aria-live="polite">
      {{ terminalMessage }}
    </p>

    <form
      v-if="options.length || passAction"
      class="death-loot-form"
      novalidate
      @submit.prevent="submitPick"
    >
      <div class="death-loot-form__choices">
        <fieldset
          v-if="options.length"
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
            <CardPresentation :card="option.card" variant="choice" choice-context="loot" />
          </button>
        </fieldset>
      </div>
      <button
        v-if="passAction"
        class="death-loot-submit death-loot-submit--secondary"
        type="button"
        :disabled="busy || terminal"
        @click="submitPass"
      >
        Пас
      </button>
      <button
        class="death-loot-submit"
        type="submit"
        :disabled="busy || terminal || !selectedOption"
      >
        {{ busy ? "Отправляем выбор…" : "Забрать выбранную карту" }}
      </button>
    </form>

    <p v-if="!options.length && !terminal" class="death-loot-surface__opaque" role="status">
      Доступных карт сейчас нет.
    </p>
  </section>
</template>

<style scoped>
.death-loot-surface { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 16px; min-width: 0; box-sizing: border-box; color: var(--color-text-primary); }
.death-loot-surface__header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.death-loot-surface__header > div { min-width: 0; }
.death-loot-surface__header h3,
.death-loot-surface__header p { margin: 0; }
.death-loot-surface__header h3 { font-size: 20px; line-height: 24px; }
.death-loot-surface__header p { margin-top: 12px; color: var(--color-text-muted); font-size: 11px; line-height: 14px; white-space: nowrap; }
.death-loot-surface__header time { position: relative; z-index: 1; flex: 0 0 70px; min-height: 40px; display: grid; place-items: center; box-sizing: border-box; border: 1px solid var(--color-accent-strong); border-radius: 12px; font-weight: 700; }
.death-loot-surface__result,
.death-loot-surface__opaque { margin: 0; overflow-wrap: anywhere; line-height: 1.45; }
.death-loot-surface__result { color: var(--color-action-primary); }
.death-loot-surface__opaque { place-self: center; color: var(--color-text-muted); text-align: center; }
.death-loot-form { display: grid; grid-template-rows: 218px 44px 52px; gap: 4px; margin: 0; }
.death-loot-form__choices { min-width: 0; overflow-x: auto; scrollbar-width: none; }
.death-loot-form fieldset { min-width: max-content; display: grid; grid-auto-flow: column; grid-auto-columns: 150px; gap: 12px; margin: 0; border: 0; padding: 0; }
.death-loot-form legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.death-loot-option { min-width: 0; border: 0; padding: 0; background: transparent; cursor: pointer; }
.death-loot-option--selected :deep(.choice-card-presentation) { border-color: var(--color-action-primary); }
.death-loot-submit { width: 100%; min-height: 44px; border: 0; border-radius: 14px; color: #fff9ef; background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.death-loot-submit:disabled { opacity: .45; }
.death-loot-submit--secondary { border: 1px solid var(--color-accent-strong); color: var(--color-action-primary); background: transparent; }
@media (prefers-reduced-motion: reduce) { .death-loot-option { transition: none; } }
@media (forced-colors: active) { .death-loot-option, .death-loot-submit { border-color: CanvasText; forced-color-adjust: none; } }
@media (width < 380px) { .death-loot-surface__header p { white-space: normal; } }
</style>
