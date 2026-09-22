<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {
  helperCancelAction,
  helperOfferActions,
  isInvitedHelperOffer,
  projectedPlayerName,
  formatAbsoluteDeadline,
} from "../helperOfferModel";
import type {InteractionActionView} from "../interactionModel";

const props = defineProps<{
  projection: Projection;
  interaction: InteractionView;
  busy: boolean;
  terminal: boolean;
}>();

const emit = defineEmits<{
  submit: [action: InteractionActionView];
}>();

const selectedActionID = ref("");
const offerActions = computed(() => helperOfferActions(props.interaction.actions));
const selectedAction = computed(() => offerActions.value.find((action) =>
  action.action_id === selectedActionID.value,
));
const cancelAction = computed(() => helperCancelAction(props.interaction));
const invited = computed(() => isInvitedHelperOffer(props.interaction));

function reset(): void {
  selectedActionID.value = offerActions.value[0]?.action_id ?? "";
}

function submitOffer(): void {
  const action = selectedAction.value;
  if (!action || props.busy || props.terminal) return;
  emit("submit", action);
}

function submitCancel(): void {
  if (cancelAction.value && !props.busy && !props.terminal) {
    emit("submit", cancelAction.value);
  }
}

watch(
  () => [
    props.interaction.interaction_id,
    props.interaction.actions.map((action) => action.action_id).join("|"),
  ].join(":"),
  reset,
  {immediate: true},
);

</script>

<template>
  <section
    v-if="invited && interaction.combat_help_offer"
    class="helper-offer-summary interaction-helper-summary"
    aria-label="Предложение помощи"
  >
    <p class="helper-offer-summary__eyebrow">ПРЕДЛОЖЕНИЕ ПОМОЩИ</p>
    <p>
      Участник боя:
      <strong>{{ projectedPlayerName(projection, projection.turn.player_id) }}</strong>
    </p>
    <p>
      Награда:
      <strong>{{ interaction.combat_help_offer.reward_treasures }} сокр.</strong>
    </p>
    <p>
      Срок до
      <time :datetime="interaction.deadline_at">
        {{ formatAbsoluteDeadline(interaction.deadline_at) }}
      </time>
    </p>
  </section>

  <form
    v-if="offerActions.length"
    class="helper-offer-form interaction-helper-form"
    novalidate
    @submit.prevent="submitOffer"
  >
    <fieldset :disabled="busy || terminal">
      <legend>Выбери вариант предложения</legend>
      <div class="helper-offer-form__choices" role="listbox" aria-label="Варианты помощи">
        <button
          v-for="action in offerActions"
          :key="action.action_id"
          type="button"
          role="option"
          :aria-selected="action.action_id === selectedActionID"
          :disabled="busy || terminal"
          @click="selectedActionID = action.action_id"
        >
          <span>ПОМОЩНИК</span>
          <strong>{{ projectedPlayerName(projection, action.helper_player_id ?? '') }}</strong>
          <small>{{ action.reward_treasures ?? 0 }} сокровища</small>
        </button>
      </div>
    </fieldset>
    <button type="submit" :disabled="busy || terminal || !selectedAction">
      {{ busy ? "Отправляем предложение…" : "Предложить помощь" }}
    </button>
  </form>

  <button
    v-if="cancelAction"
    class="helper-offer-cancel"
    type="button"
    :disabled="busy || terminal"
    @click="submitCancel"
  >
    {{ busy ? "Отменяем…" : "Отменить предложение" }}
  </button>
</template>

<style scoped>
.helper-offer-summary,
.helper-offer-form {
  display: grid;
  gap: .65rem;
  min-width: 0;
  border: 1px solid var(--color-line, #566044);
  padding: .85rem;
}

.helper-offer-summary p,
.helper-offer-form p,
.helper-offer-form small {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.helper-offer-summary__eyebrow {
  color: var(--color-accent-strong);
  font-size: .75rem;
  letter-spacing: .08em;
}

.helper-offer-summary time {
  color: var(--color-accent-strong);
  font-variant-numeric: tabular-nums;
}

.helper-offer-form fieldset {
  display: grid;
  gap: .55rem;
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}

.helper-offer-form legend {
  margin-bottom: .15rem;
  color: var(--color-text-muted, #9eaa8e);
  font-size: .8rem;
  text-transform: uppercase;
}

.helper-offer-form__choices {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px;
}

.helper-offer-form__choices button {
  flex: 0 0 150px;
  min-height: 218px;
  display: grid;
  align-content: end;
  justify-items: start;
  gap: 8px;
  border: 1px solid var(--color-line, #566044);
  border-radius: 14px;
  padding: 102px 10px 10px;
  color: var(--color-text);
  background: linear-gradient(#aabdb5 0 92px, var(--color-paper) 92px);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
  font: inherit;
  text-align: start;
}

.helper-offer-form__choices button[aria-selected="true"] { border: 3px solid var(--color-accent-strong); }
.helper-offer-form__choices span { color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.helper-offer-form__choices small { color: var(--color-text-muted); }

.helper-offer-cancel {
  justify-self: start;
  border-color: var(--color-line, #566044);
  color: var(--color-text-muted, #9eaa8e);
  background: transparent;
}
</style>
