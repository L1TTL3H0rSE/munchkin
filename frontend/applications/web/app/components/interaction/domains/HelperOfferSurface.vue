<script setup lang="ts">
import {computed, ref, watch} from "vue";
import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {
  helperCancelAction,
  helperOfferAction,
  helperOfferOptions,
  helperRewardsFor,
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

const selectedHelperPlayerID = ref("");
const selectedRewardValue = ref("");
const formError = ref("");

const helperOptions = computed(() => helperOfferOptions(props.interaction.actions));
const rewardValues = computed(() => helperRewardsFor(
  helperOptions.value,
  selectedHelperPlayerID.value,
));
const selectedAction = computed(() => helperOfferAction(
  props.interaction.actions,
  selectedHelperPlayerID.value,
  Number(selectedRewardValue.value),
));
const cancelAction = computed(() => helperCancelAction(props.interaction));
const invited = computed(() => isInvitedHelperOffer(props.interaction));

function reset(): void {
  const first = helperOptions.value[0];
  selectedHelperPlayerID.value = first?.helperPlayerID ?? "";
  selectedRewardValue.value = first?.rewardTreasures[0]?.toString() ?? "";
  formError.value = "";
}

function submitOffer(): void {
  const action = selectedAction.value;
  if (!action) {
    formError.value = "Выберите помощника и награду из текущей проекции.";
    return;
  }
  formError.value = "";
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

watch(
  () => selectedHelperPlayerID.value,
  () => {
    if (!rewardValues.value.includes(Number(selectedRewardValue.value))) {
      selectedRewardValue.value = rewardValues.value[0]?.toString() ?? "";
    }
    formError.value = "";
  },
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
    v-if="helperOptions.length"
    class="helper-offer-form interaction-helper-form"
    novalidate
    @submit.prevent="submitOffer"
  >
    <fieldset :disabled="busy || terminal">
      <legend>Параметры предложения</legend>
      <label for="interaction-helper-player">Помощник</label>
      <select
        id="interaction-helper-player"
        v-model="selectedHelperPlayerID"
        required
        :aria-describedby="formError ? 'interaction-helper-error' : undefined"
        :aria-invalid="formError ? 'true' : undefined"
      >
        <option
          v-for="option in helperOptions"
          :key="option.helperPlayerID"
          :value="option.helperPlayerID"
        >
          {{ projectedPlayerName(projection, option.helperPlayerID) }}
        </option>
      </select>

      <label for="interaction-helper-reward">Награда помощнику, сокровищ</label>
      <input
        id="interaction-helper-reward"
        v-model="selectedRewardValue"
        type="number"
        inputmode="numeric"
        :min="rewardValues[0]"
        :max="rewardValues[rewardValues.length - 1]"
        step="1"
        required
        :aria-describedby="formError ? 'interaction-helper-error' : undefined"
        :aria-invalid="formError ? 'true' : undefined"
        @input="formError = ''"
      >
      <small v-if="rewardValues.length">
        Доступно по текущей проекции: {{ rewardValues.join(", ") }}.
      </small>
    </fieldset>
    <p v-if="formError" id="interaction-helper-error" role="alert">
      {{ formError }}
    </p>
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

.helper-offer-form select,
.helper-offer-form input {
  width: 100%;
  min-height: 2.75rem;
  border: 1px solid var(--color-line, #566044);
  padding: .55rem .65rem;
  color: var(--color-text);
  background: var(--color-paper);
  font: inherit;
}

.helper-offer-form select:focus-visible,
.helper-offer-form input:focus-visible {
  outline: 2px solid var(--color-accent-strong);
  outline-offset: 2px;
}

.helper-offer-form [aria-invalid="true"] {
  border-color: #ef8d74;
}

.helper-offer-form > p[role="alert"] {
  color: var(--color-danger);
}

.helper-offer-cancel {
  justify-self: start;
  border-color: var(--color-line, #566044);
  color: var(--color-text-muted, #9eaa8e);
  background: transparent;
}
</style>
