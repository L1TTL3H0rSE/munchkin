<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {Projection} from "@munchkin/contracts";

import {
  interactionIsTerminal,
  type InteractionActionView,
} from "./interactionModel";
import {
  deathLootOptions,
  deathLootParticipants,
  deathLootPassAction,
  deathLootTerminalMessage,
  isDeathLootInteraction,
  type DeathLootInteraction,
} from "./deathLootModel";
import {projectedPlayerName} from "./helperOfferModel";

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
const participants = computed(() => deathLootParticipants(
  props.projection,
  props.interaction,
));
const terminal = computed(() => interactionIsTerminal(props.interaction) ||
  props.interaction.death_loot.remaining_count === 0);
const terminalMessage = computed(() => deathLootTerminalMessage(props.interaction));
const deadPlayerName = computed(() => projectedPlayerName(
  props.projection,
  props.interaction.death_loot.dead_player_id,
));
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
      <div>
        <p class="eyebrow">ПУБЛИЧНЫЙ РЕЗУЛЬТАТ / PRIVATE DESCRIPTOR</p>
        <h3 id="death-loot-surface-title">Приоритет добычи</h3>
        <p>
          Добыча после смерти игрока
          <strong>{{ deadPlayerName }}</strong> распределяется по решению сервера.
          Остаток и результат берутся только из текущей projection.
        </p>
      </div>
      <time :datetime="interaction.deadline_at">
        Срок: {{ interaction.deadline_at }}
      </time>
    </header>

    <dl class="death-loot-stats" aria-label="Состояние пула добычи">
      <div>
        <dt>Всего</dt>
        <dd>{{ interaction.death_loot.initial_count }}</dd>
      </div>
      <div>
        <dt>Осталось</dt>
        <dd>{{ interaction.death_loot.remaining_count }}</dd>
      </div>
      <div>
        <dt>Взято</dt>
        <dd>{{ interaction.death_loot.picked_count }}</dd>
      </div>
      <div>
        <dt>В публичной зоне</dt>
        <dd>{{ interaction.death_loot.discarded_count }}</dd>
      </div>
    </dl>

    <section class="death-loot-queue" aria-labelledby="death-loot-queue-title">
      <div>
        <p id="death-loot-queue-title" class="eyebrow">СТАТУС ПРИОРИТЕТА</p>
        <p v-if="interaction.response_required_for_you" role="status">
          Ваш seat сейчас активен. Выберите только один вариант из server descriptors
          или передайте приоритет пасом.
        </p>
        <p v-else role="status">
          Текущий seat скрыт в этой projection; варианты добычи и identities карт вам
          не переданы.
        </p>
      </div>
      <div v-if="participants.length" class="death-loot-queue__participants">
        <span>Публичные участники</span>
        <ol>
          <li
            v-for="participant in participants"
            :key="participant.playerID"
            :data-player-id="participant.playerID"
          >
            {{ participant.name }}
            <strong v-if="participant.playerID === projection.you.player_id">
              (вы)
            </strong>
          </li>
        </ol>
      </div>
      <p v-else class="death-loot-queue__empty">
        В projection нет доступных участников очереди.
      </p>
    </section>

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
        <legend>Варианты только текущего приоритета</legend>
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
          <span>
            <strong>{{ option.card.name }}</strong>
            <small>
              Выбор передан сервером; действие не меняет projection до подтверждения.
            </small>
          </span>
        </label>
      </fieldset>
      <button
        class="death-loot-submit"
        type="submit"
        :disabled="busy || terminal || !selectedOption"
      >
        {{ busy ? "Отправляем выбор…" : "Взять выбранную карту" }}
      </button>
    </form>

    <div v-if="passAction" class="death-loot-pass">
      <button
        class="death-loot-submit death-loot-submit--secondary"
        type="button"
        :disabled="busy || terminal"
        @click="submitPass"
      >
        {{ busy ? "Отправляем…" : "Пасовать" }}
      </button>
      <small>Пас передаёт приоритет; клиент не меняет seat и не сбрасывает остаток сам.</small>
    </div>

    <p v-if="!options.length && !terminal" class="death-loot-surface__opaque" role="status">
      Варианты карт не раскрыты этой projection. Ждём публичное обновление состояния
      от сервера.
    </p>
  </section>
</template>

<style scoped>
.death-loot-surface {
  display: grid;
  gap: 1rem;
  min-width: 0;
  border: 1px solid var(--acid);
  padding: 1rem;
  color: var(--color-text);
  background: var(--color-surface);
}

.death-loot-surface__header,
.death-loot-queue,
.death-loot-form,
.death-loot-pass {
  display: grid;
  gap: .65rem;
  min-width: 0;
}

.death-loot-surface__header {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.death-loot-surface__header h3,
.death-loot-surface__header p,
.death-loot-surface__header time,
.death-loot-queue p,
.death-loot-queue__participants > span,
.death-loot-pass small,
.death-loot-surface__opaque,
.death-loot-surface__result {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.death-loot-surface__header h3 {
  margin-top: .35rem;
  color: var(--acid);
}

.death-loot-surface__header p,
.death-loot-surface__header time,
.death-loot-queue p,
.death-loot-queue__participants > span,
.death-loot-pass small,
.death-loot-surface__opaque {
  color: var(--muted);
}

.death-loot-surface__header time {
  color: var(--acid);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.death-loot-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: .65rem;
  margin: 0;
  min-width: 0;
}

.death-loot-stats > div {
  min-width: 0;
  border: 1px solid var(--line);
  padding: .7rem;
}

.death-loot-stats dt {
  color: var(--muted);
  font-size: .75rem;
  overflow-wrap: anywhere;
  text-transform: uppercase;
}

.death-loot-stats dd {
  margin: .25rem 0 0;
  color: var(--acid);
  font-size: 1.35rem;
  font-variant-numeric: tabular-nums;
}

.death-loot-queue {
  grid-template-columns: minmax(0, 1fr) minmax(12rem, 1fr);
  border: 1px solid var(--line);
  padding: .8rem;
}

.death-loot-queue .eyebrow {
  color: var(--acid);
}

.death-loot-queue__participants {
  min-width: 0;
}

.death-loot-queue__participants ol {
  display: grid;
  gap: .25rem;
  margin: .4rem 0 0;
  padding-left: 1.35rem;
}

.death-loot-queue__participants li {
  min-width: 0;
  overflow-wrap: anywhere;
}

.death-loot-queue__empty {
  align-self: center;
}

.death-loot-form fieldset {
  display: grid;
  gap: .65rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.death-loot-form legend {
  margin-bottom: .2rem;
  color: var(--muted);
  font-size: .8rem;
  text-transform: uppercase;
}

.death-loot-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: .75rem;
  min-width: 0;
  border: 1px solid var(--line);
  padding: .8rem;
  cursor: pointer;
}

.death-loot-option--selected {
  border-color: var(--acid);
  background: var(--color-paper);
}

.death-loot-option input {
  margin-top: .25rem;
}

.death-loot-option span {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.death-loot-option strong,
.death-loot-option small {
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.death-loot-option small {
  color: var(--muted);
}

.death-loot-submit {
  width: min(100%, 22rem);
}

.death-loot-submit--secondary {
  border-color: var(--line);
  color: var(--muted);
  background: transparent;
}

.death-loot-surface__result {
  border: 1px solid var(--acid);
  padding: .8rem;
  color: var(--acid);
}

.death-loot-surface__opaque {
  border: 1px dashed var(--line);
  padding: .8rem;
}

@media (prefers-reduced-motion: reduce) {
  .death-loot-surface,
  .death-loot-option {
    scroll-behavior: auto;
    transition: none;
  }
}

@media (width <= 560px) {
  .death-loot-surface__header,
  .death-loot-queue {
    grid-template-columns: 1fr;
  }

  .death-loot-surface__header time {
    text-align: left;
  }
}

@media (forced-colors: active) {
  .death-loot-surface,
  .death-loot-stats > div,
  .death-loot-queue,
  .death-loot-option,
  .death-loot-surface__result,
  .death-loot-surface__opaque {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
