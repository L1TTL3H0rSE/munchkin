<script setup lang="ts">
import {
  interactionActionKey,
  type InteractionActionView,
} from "../interactionModel";

const props = defineProps<{
  actions: InteractionActionView[];
  selectedActionId: string | null;
  busy: boolean;
  terminal: boolean;
  labelFor: (action: InteractionActionView, index: number) => string;
  detailsFor: (action: InteractionActionView) => string[];
}>();

const emit = defineEmits<{
  select: [action: InteractionActionView];
}>();

function selectAction(action: InteractionActionView): void {
  if (props.busy || props.terminal) {
    return;
  }
  emit("select", action);
}
</script>

<template>
  <fieldset
    v-if="actions.length"
    class="interaction-actions"
    :disabled="busy || terminal"
  >
    <legend>Доступные действия текущего окна</legend>
    <label
      v-for="(action, actionIndex) in actions"
      :key="interactionActionKey(action)"
      class="interaction-action"
      :class="{
        'interaction-action--selected': action.action_id === selectedActionId,
      }"
      :data-state="action.action_id === selectedActionId ? 'selected' : 'available'"
    >
      <input
        type="radio"
        name="interaction-action"
        :value="action.action_id"
        :checked="action.action_id === selectedActionId"
        :disabled="busy || terminal"
        @change="selectAction(action)"
      >
      <span>
        <strong>{{ labelFor(action, actionIndex) }}</strong>
        <small>{{ detailsFor(action).join(" · ") }}</small>
      </span>
    </label>
  </fieldset>
</template>

<style scoped>
.interaction-actions {
  display: grid;
  gap: .65rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.interaction-actions legend {
  margin-bottom: .25rem;
  color: var(--color-text-muted, #9eaa8e);
  font-size: .8rem;
  text-transform: uppercase;
}

.interaction-action {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: .75rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .8rem;
  cursor: pointer;
}

.interaction-action--selected {
  border-color: var(--color-accent-strong);
  color: var(--color-text);
  background: var(--color-paper);
}

.interaction-action input {
  margin-top: .25rem;
}

.interaction-action span {
  display: grid;
  gap: .25rem;
  min-width: 0;
}

.interaction-action strong,
.interaction-action small {
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.interaction-action small {
  color: var(--color-text-muted, #9eaa8e);
}

@media (forced-colors: active) {
  .interaction-action {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
