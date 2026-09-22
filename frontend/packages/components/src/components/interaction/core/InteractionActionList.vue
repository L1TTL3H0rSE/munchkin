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
    role="listbox"
    aria-label="Доступные действия текущего окна"
    :disabled="busy || terminal"
  >
    <legend>Доступные действия текущего окна</legend>
    <button
      v-for="(action, actionIndex) in actions"
      :key="interactionActionKey(action)"
      type="button"
      role="option"
      :aria-selected="action.action_id === selectedActionId"
      class="interaction-action"
      :class="{
        'interaction-action--selected': action.action_id === selectedActionId,
      }"
      :data-state="action.action_id === selectedActionId ? 'selected' : 'available'"
      :disabled="busy || terminal"
      @click="selectAction(action)"
    >
      <span class="interaction-action__illustration" aria-hidden="true">
        <i />
        <i />
      </span>
      <span class="interaction-action__copy">
        <strong>{{ labelFor(action, actionIndex) }}</strong>
        <small>{{ detailsFor(action).join(" · ") }}</small>
      </span>
    </button>
  </fieldset>
</template>

<style scoped>
.interaction-actions {
  display: flex;
  align-items: stretch;
  gap: 12px;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
  overflow-x: auto;
  scroll-snap-type: x proximity;
}

.interaction-actions legend {
  margin-bottom: .25rem;
  color: var(--color-text-muted, #9eaa8e);
  font-size: .8rem;
  text-transform: uppercase;
}

.interaction-action {
  flex: 0 0 150px;
  min-width: 150px;
  height: 218px;
  display: grid;
  grid-template-rows: 92px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--color-line, #566044);
  border-radius: 14px;
  padding: 0;
  color: var(--color-text-primary);
  background: var(--color-surface-card);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
  font: inherit;
  text-align: start;
  cursor: pointer;
  scroll-snap-align: center;
}

.interaction-action--selected {
  border: 3px solid var(--color-accent-strong);
}

.interaction-action__illustration {
  position: relative;
  display: block;
  overflow: hidden;
  background: #aabdb5;
}

.interaction-action__illustration::before,
.interaction-action__illustration::after,
.interaction-action__illustration i {
  position: absolute;
  display: block;
  content: "";
  border: 2px solid rgb(255 249 239 / 82%);
  transform: rotate(45deg);
}
.interaction-action__illustration::before { width: 44px; height: 44px; top: 24px; left: 52px; }
.interaction-action__illustration::after { width: 84px; top: 53px; left: 34px; border-width: 1px 0 0; transform: rotate(-18deg); }
.interaction-action__illustration i:first-child { width: 9px; height: 9px; top: 16px; right: 18px; border-radius: 50%; background: rgb(255 249 239 / 82%); transform: none; }
.interaction-action__illustration i:last-child { width: 120px; top: 42px; left: -10px; border-width: 1px 0 0; transform: rotate(34deg); }

.interaction-action__copy {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 12px 10px;
}

.interaction-action strong,
.interaction-action small {
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.interaction-action small {
  color: var(--color-text-muted, #9eaa8e);
  font-size: 9px;
}

.interaction-action strong { font-size: 11px; }

@media (forced-colors: active) {
  .interaction-action {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
