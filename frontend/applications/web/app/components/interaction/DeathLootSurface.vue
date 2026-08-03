<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {Projection} from "@munchkin/contracts";
import GameCard from "../GameCard.vue";

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
  projection: Projection;
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
      <fieldset :disabled="busy || terminal">
        <legend>Доступные карты</legend>
        <label
          v-for="option in options"
          :key="option.action.action_id"
          class="death-loot-option"
          :class="{'death-loot-option--selected': option.action.action_id === selectedActionID}"
        >
          <input
            v-model="selectedActionID"
            type="radio"
            name="death-loot-option"
            :value="option.action.action_id"
          >
          <GameCard :card="option.card" :content-set-id="projection.content_set_id" choice />
        </label>
      </fieldset>
      <button
        class="death-loot-submit"
        type="submit"
        :disabled="busy || terminal || !selectedOption"
      >
        {{ busy ? "Отправляем выбор…" : "Забрать карту" }}
      </button>
    </form>

    <div v-if="passAction" class="death-loot-pass">
      <button
        class="death-loot-submit death-loot-submit--secondary"
        type="button"
        :disabled="busy || terminal"
        @click="submitPass"
      >
        <span>ПРОПУСТИТЬ</span>
        <small>Не брать карту</small>
      </button>
    </div>

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
.death-loot-pass {
  min-width: 0;
}

.death-loot-surface__header h3,
.death-loot-surface__header p,
.death-loot-pass small,
.death-loot-surface__opaque,
.death-loot-surface__result {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.death-loot-surface__header p,
.death-loot-pass small,
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
  height: 410px;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
  box-sizing: border-box;
  border: 0;
  padding: 0;
  background: transparent;
}
.death-loot-surface__header { display: block; }
.death-loot-surface__header h3 { margin: 0; color: var(--color-text-primary); font-size: 20px; line-height: 24px; }
.death-loot-surface__header p { margin: 6px 0 0; color: var(--color-text-secondary); font-size: 12px; line-height: 16px; }
.death-loot-form { align-self: stretch; display: contents; }
.death-loot-form fieldset {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 42px;
  overflow: hidden;
}
.death-loot-form legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.death-loot-option {
  position: relative;
  display: block;
  border: 0;
  padding: 0;
}
.death-loot-option input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.death-loot-option--selected :deep(.choice-card-presentation) { border-color: var(--color-action-primary); }
.death-loot-submit:not(.death-loot-submit--secondary) {
  position: absolute;
  right: 16px;
  bottom: 14px;
  width: 180px;
  min-height: 44px;
}
.death-loot-pass {
  position: absolute;
  top: 126px;
  right: 42px;
}
.death-loot-submit--secondary {
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
}
.death-loot-submit--secondary span { font-size: 11px; font-weight: 600; }
.death-loot-submit--secondary small { color: var(--color-text-muted); font-size: 9px; }
.death-loot-surface__footer {
  align-self: end;
  color: var(--color-text-muted);
  font-size: 9px;
  letter-spacing: .04em;
}
</style>
