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
  toggle(
    entry,
    instanceID,
    (event.target as HTMLInputElement).checked,
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
    :aria-busy="busy"
    aria-labelledby="action-dock-title"
  >
    <header class="action-dock__header">
      <div>
        <p class="eyebrow">СЕРВЕРНЫЕ ДЕЙСТВИЯ</p>
        <h2 id="action-dock-title">
          {{ contextCardName ? `Карта: ${contextCardName}` : "Что можно сделать" }}
        </h2>
        <p class="action-dock__hint">
          {{ contextCardName
            ? "Выберите один из вариантов для этой карты."
            : "Доступные действия появятся здесь после подтверждённого состояния." }}
        </p>
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
