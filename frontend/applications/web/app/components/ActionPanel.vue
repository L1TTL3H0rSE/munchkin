<script setup lang="ts">
import type {
  ActionDescriptor,
  CardView,
} from "@munchkin/contracts";
import {
  actionKey,
  actionLabel,
  buildCommandPayload,
  reconcileActionState,
  selectionIsValid,
  type ActionEntry,
} from "./actionModel";

const props = withDefaults(defineProps<{
  entries: ActionEntry[];
  cards: CardView[];
  playerNames?: Record<string, string>;
  busy: boolean;
  contextCardName?: string;
}>(), {
  playerNames: () => ({}),
  contextCardName: "",
});

const emit = defineEmits<{
  close: [];
  execute: [entry: ActionEntry, payload: ReturnType<typeof buildCommandPayload>];
}>();

const selections = reactive<Record<string, string[]>>({});
const targets = reactive<Record<string, string>>({});

watch(
  () => props.entries,
  (entries) => reconcileActionState(entries, selections, targets),
  {deep: true, immediate: true},
);

const cardNames = computed(() => new Map(
  props.cards.map((card) => [card.instance_id, card.name]),
));
const panelEyebrow = computed(() =>
  props.entries.length === 1 && !props.contextCardName
    ? "ДОСТУПНОЕ ДЕЙСТВИЕ"
    : "СЕРВЕРНЫЕ ДЕЙСТВИЯ",
);
const panelTitle = computed(() => {
  if (props.contextCardName) {
    return `Карта: ${props.contextCardName}`;
  }
  const [entry] = props.entries;
  return props.entries.length === 1 && entry
    ? `Можно ${actionLabel(entry.action).toLocaleLowerCase("ru-RU")}`
    : "Что можно сделать";
});
const panelHint = computed(() => {
  if (props.contextCardName) {
    return "Выберите один из вариантов для этой карты.";
  }
  return props.entries.length === 1
    ? "Подтверди действие, чтобы продолжить серверный ход."
    : "Доступные действия появятся здесь после подтверждённого состояния.";
});

function selected(entry: ActionEntry) {
  return selections[actionKey(entry.action, entry.index)] ?? [];
}

function toggle(
  entry: ActionEntry,
  instanceID: string,
  checked: boolean,
) {
  const key = actionKey(entry.action, entry.index);
  const values = new Set(selections[key] ?? []);
  if (checked) {
    values.add(instanceID);
  } else {
    values.delete(instanceID);
  }
  selections[key] = [...values];
}

function toggleFromEvent(
  entry: ActionEntry,
  instanceID: string,
  event: Event,
) {
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }
  toggle(
    entry,
    instanceID,
    event.target.checked,
  );
}

function target(entry: ActionEntry) {
  return targets[actionKey(entry.action, entry.index)];
}

function valid(entry: ActionEntry) {
  return selectionIsValid(entry.action, selected(entry), target(entry));
}

function submit(entry: ActionEntry) {
  emit(
    "execute",
    entry,
    buildCommandPayload(entry.action, selected(entry), target(entry)),
  );
}

function optionLabel(instanceID: string) {
  return cardNames.value.get(instanceID)
    ?? props.playerNames[instanceID]
    ?? instanceID;
}

function targetOptions(action: ActionDescriptor) {
  return [
    ...(action.target_instance_ids ?? []),
    ...(action.target_player_ids ?? []),
  ];
}

function isPlayerTarget(action: ActionDescriptor, targetID: string) {
  return action.target_player_ids?.includes(targetID) ?? false;
}
</script>

<template>
  <aside
    class="action-dock"
    :data-state="busy ? 'pending' : entries.length ? 'available' : 'idle'"
    :data-entry-count="entries.length"
    :aria-busy="busy"
    aria-labelledby="action-dock-title"
  >
    <header class="action-dock__header">
      <div>
        <p class="eyebrow">{{ panelEyebrow }}</p>
        <h2 id="action-dock-title">{{ panelTitle }}</h2>
        <p class="action-dock__hint">{{ panelHint }}</p>
      </div>
      <button
        v-if="contextCardName"
        class="action-dock__close"
        type="button"
        aria-label="Закрыть действия карты"
        @click="emit('close')"
      >
        Закрыть
      </button>
    </header>

    <p v-if="!entries.length" class="action-dock__empty" role="status">
      Выберите карту с отметкой «Доступно» или дождитесь хода другого игрока.
    </p>

    <div v-else class="action-list">
      <article
        v-for="entry in entries"
        :key="actionKey(entry.action, entry.index)"
        class="action-choice"
        :data-state="busy ? 'pending' : 'available'"
      >
        <strong>{{ actionLabel(entry.action) }}</strong>
        <small v-if="entry.action.source_instance_id" class="action-choice__source">
          Источник: {{ optionLabel(entry.action.source_instance_id) }}
        </small>

        <div v-if="entry.action.instance_ids?.length" class="action-options">
          <label
            v-for="instanceID in entry.action.instance_ids"
            :key="instanceID"
            class="selection-option"
          >
            <input
              type="checkbox"
              :checked="selected(entry).includes(instanceID)"
              :disabled="busy"
              @change="toggleFromEvent(entry, instanceID, $event)"
            >
            <span>{{ optionLabel(instanceID) }}</span>
          </label>
          <small>
            Выбрать: {{ entry.action.minimum ?? 0 }}–{{ entry.action.maximum ?? entry.action.minimum ?? 0 }}
            <template v-if="entry.action.minimum_total">
              · сумма не меньше {{ entry.action.minimum_total }}
            </template>
          </small>
        </div>

        <label v-if="targetOptions(entry.action).length" class="target-select">
          Цель
          <select
            v-model="targets[actionKey(entry.action, entry.index)]"
            :disabled="busy"
          >
            <option value="" disabled>Выберите цель</option>
            <option
              v-for="targetID in targetOptions(entry.action)"
              :key="targetID"
              :value="targetID"
            >
              {{ optionLabel(targetID) }}
              <template v-if="isPlayerTarget(entry.action, targetID)">
                · игрок
              </template>
            </option>
          </select>
        </label>

        <button
          class="action-choice__submit"
          type="button"
          :disabled="busy || !valid(entry)"
          @click="submit(entry)"
        >
          {{ busy ? "Отправляем…" : actionLabel(entry.action) }}
        </button>
      </article>
    </div>
  </aside>
</template>

<style scoped>
.action-dock {
  min-width: 0;
  display: grid;
  gap: .85rem;
}

.action-dock__header {
  min-width: 0;
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding: .5rem .65rem 0;
}

.action-dock__header h2 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 1.25rem;
}

.action-dock__hint,
.action-dock__empty {
  margin: 0;
  color: var(--muted);
  line-height: 1.45;
}

.action-dock__hint {
  max-width: 60ch;
  margin-top: .35rem;
  font-size: .84rem;
}

.action-dock__empty {
  border: 1px dashed var(--line);
  padding: .75rem;
}

.action-dock__close {
  flex: 0 0 auto;
  min-height: 2.75rem;
  border-color: var(--line);
  color: var(--ink);
  background: transparent;
}

.action-list {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: .75rem;
}

.action-choice {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: .7rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--color-surface-control);
  padding: .8rem;
}

.action-choice > strong {
  color: var(--color-text-primary);
  font-size: .78rem;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.action-choice__source {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.action-options {
  display: grid;
  gap: .4rem;
  max-height: 180px;
  overflow-y: auto;
}

.selection-option {
  display: flex;
  align-items: center;
  gap: .5rem;
  color: var(--ink);
  text-transform: none;
  letter-spacing: 0;
}

.selection-option input {
  width: auto;
  margin: 0;
}

.target-select {
  display: grid;
  gap: .4rem;
}

.target-select select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-primary);
  padding: .65rem;
}

.action-choice__submit {
  width: 100%;
  min-height: 2.75rem;
  border-color: var(--color-action-primary);
  border-radius: var(--radius-control);
  color: #fff9ef;
  background: var(--color-action-primary);
  font-weight: 800;
}

.action-choice__submit:disabled {
  border-color: var(--color-line);
  color: var(--color-text-muted);
  background: var(--color-line);
}

@media (width <= 599px) {
  .action-list {
    max-height: min(64dvh, 36rem);
    overflow-y: auto;
    padding: .1rem;
  }

  .action-dock__header {
    padding-inline: .4rem;
  }

  .action-dock__header h2 {
    font-size: 1.05rem;
  }
}
</style>
