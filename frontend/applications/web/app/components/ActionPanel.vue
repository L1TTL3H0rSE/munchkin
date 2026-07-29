<script setup lang="ts">
import type {
  ActionDescriptor,
  CardView,
  CommandPayload,
} from "@munchkin/contracts";
import {
  actionKey,
  actionLabel,
  buildCommandPayload,
  reconcileActionState,
  selectionIsValid,
} from "./actionModel";

const props = defineProps<{
  actions: ActionDescriptor[];
  cards: CardView[];
  busy: boolean;
}>();

const emit = defineEmits<{
  execute: [action: ActionDescriptor, payload: CommandPayload];
}>();

const selections = reactive<Record<string, string[]>>({});
const targets = reactive<Record<string, string>>({});

watch(
  () => props.actions,
  (actions) => reconcileActionState(actions, selections, targets),
  {deep: true, immediate: true},
);

const cardNames = computed(() => new Map(
  props.cards.map((card) => [card.instance_id, card.name]),
));

function selected(action: ActionDescriptor, index: number) {
  return selections[actionKey(action, index)] ?? [];
}

function toggle(
  action: ActionDescriptor,
  index: number,
  instanceID: string,
  checked: boolean,
) {
  const key = actionKey(action, index);
  const values = new Set(selections[key] ?? []);
  if (checked) {
    values.add(instanceID);
  } else {
    values.delete(instanceID);
  }
  selections[key] = [...values];
}

function toggleFromEvent(
  action: ActionDescriptor,
  index: number,
  instanceID: string,
  event: Event,
) {
  toggle(
    action,
    index,
    instanceID,
    (event.target as HTMLInputElement).checked,
  );
}

function target(action: ActionDescriptor, index: number) {
  return targets[actionKey(action, index)];
}

function valid(action: ActionDescriptor, index: number) {
  return selectionIsValid(
    action,
    selected(action, index),
    target(action, index),
  );
}

function submit(action: ActionDescriptor, index: number) {
  emit(
    "execute",
    action,
    buildCommandPayload(
      action,
      selected(action, index),
      target(action, index),
    ),
  );
}

function optionLabel(instanceID: string) {
  return cardNames.value.get(instanceID) ?? instanceID;
}
</script>

<template>
  <div class="action-list">
    <article
      v-for="(action, index) in actions"
      :key="actionKey(action, index)"
      class="action-choice"
    >
      <strong>{{ actionLabel(action) }}</strong>

      <div v-if="action.instance_ids?.length" class="action-options">
        <label
          v-for="instanceID in action.instance_ids"
          :key="instanceID"
          class="selection-option"
        >
          <input
            type="checkbox"
            :checked="selected(action, index).includes(instanceID)"
            @change="toggleFromEvent(action, index, instanceID, $event)"
          >
          <span>{{ optionLabel(instanceID) }}</span>
        </label>
        <small>
          Выбрать: {{ action.minimum ?? 0 }}–{{ action.maximum ?? action.minimum ?? 0 }}
          <template v-if="action.minimum_total">
            · сумма не меньше {{ action.minimum_total }}
          </template>
        </small>
      </div>

      <label v-if="action.target_instance_ids?.length" class="target-select">
        Цель
        <select v-model="targets[actionKey(action, index)]">
          <option value="" disabled>Выберите предмет</option>
          <option
            v-for="instanceID in action.target_instance_ids"
            :key="instanceID"
            :value="instanceID"
          >
            {{ optionLabel(instanceID) }}
          </option>
        </select>
      </label>

      <button
        :disabled="busy || !valid(action, index)"
        @click="submit(action, index)"
      >
        {{ actionLabel(action) }}
      </button>
    </article>
  </div>
</template>
