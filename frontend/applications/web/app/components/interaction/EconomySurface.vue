<script setup lang="ts">
import {computed, reactive, ref, watch} from "vue";
import type {
  InteractionView,
  Projection,
} from "@munchkin/contracts";

import {
  charitySurfaceData,
  economyActionKey,
  economyActions,
  ownCardByID,
  ownCarriedCardsFor,
  ownHandCardsFor,
  playerName,
  type CharitySurfaceData,
  type EconomyAction,
  type EconomySubmission,
} from "./economyModel";

const discardValue = "__discard__";

const props = withDefaults(defineProps<{
  projection: Projection;
  actions?: Array<{action: EconomyAction; index: number}>;
  interaction?: InteractionView;
  charityTransfer?: CharitySurfaceData;
  busy: boolean;
}>(), {
  actions: () => [],
  interaction: undefined,
  charityTransfer: undefined,
});

const emit = defineEmits<{
  submit: [request: EconomySubmission];
}>();

const offeredSelections = reactive<Record<string, string[]>>({});
const requestedSelections = reactive<Record<string, string[]>>({});
const offerRecipients = reactive<Record<string, string>>({});
const theftCosts = reactive<Record<string, string>>({});
const theftVictims = reactive<Record<string, string>>({});
const charitySelections = reactive<Record<string, string>>({});
const formError = ref("");

const economyEntries = computed(() => props.actions.length
  ? props.actions
  : economyActions([]));
const offerEntries = computed(() => economyEntries.value.filter(({action}) =>
  action.type === "propose_trade" || action.type === "propose_gift",
));
const theftEntries = computed(() => economyEntries.value.filter(({action}) =>
  action.type === "attempt_theft",
));
const charityEntry = computed(() => economyEntries.value.find(({action}) =>
  action.type === "resolve_charity",
));
const charityData = computed(() => props.charityTransfer
  ?? charitySurfaceData(props.interaction, charityEntry.value?.action));
const charityCards = computed(() => (charityData.value?.instanceIDs ?? [])
  .map((instanceID) => ownCardByID(props.projection, instanceID))
  .filter((card): card is NonNullable<typeof card> => Boolean(card)));

const hasForms = computed(() => offerEntries.value.length > 0 ||
  theftEntries.value.length > 0 || Boolean(charityData.value));

function entryKey(action: EconomyAction, index: number): string {
  return economyActionKey(action, index);
}

function actionCards(action: EconomyAction) {
  return action.type === "attempt_theft"
    ? ownHandCardsFor(props.projection, action)
    : ownCarriedCardsFor(props.projection, action);
}

function actionTargetIDs(action: EconomyAction): string[] {
  return action.target_player_ids ?? [];
}

function actionMinimum(action: EconomyAction): number {
  return action.minimum ?? 0;
}

function actionMaximum(action: EconomyAction, fallback: number): number {
  return action.maximum ?? fallback;
}

function requestedMinimum(action: EconomyAction): number {
  return action.type === "propose_trade" ? 1 : 0;
}

function requestedMaximum(action: EconomyAction): number {
  return action.requested_instance_ids?.length ?? 0;
}

function opaqueRequestedLabel(index: number): string {
  return `Дескриптор карты получателя №${index + 1}`;
}

function offerIsValid(action: EconomyAction, index: number): boolean {
  const key = entryKey(action, index);
  const offered = offeredSelections[key] ?? [];
  const requested = requestedSelections[key] ?? [];
  const offeredIDs = new Set(action.instance_ids ?? []);
  const requestedIDs = new Set(action.requested_instance_ids ?? []);
  const recipient = offerRecipients[key] ?? "";
  const offeredMin = Math.max(1, actionMinimum(action));
  const offeredMax = actionMaximum(action, offeredIDs.size);
  const requestedMin = requestedMinimum(action);
  const requestedMax = requestedMaximum(action);
  return Boolean(recipient) &&
    actionTargetIDs(action).includes(recipient) &&
    offered.length >= offeredMin &&
    offered.length <= offeredMax &&
    offered.every((instanceID) => offeredIDs.has(instanceID)) &&
    new Set(offered).size === offered.length &&
    requested.length >= requestedMin &&
    requested.length <= requestedMax &&
    requested.every((instanceID) => requestedIDs.has(instanceID)) &&
    new Set(requested).size === requested.length;
}

function theftIsValid(action: EconomyAction, index: number): boolean {
  const key = entryKey(action, index);
  const cost = theftCosts[key] ?? "";
  const victim = theftVictims[key] ?? "";
  return Boolean(
    cost &&
    action.instance_ids?.includes(cost) &&
    victim &&
    action.target_player_ids?.includes(victim),
  );
}

function charityOptionIsValid(value: string): boolean {
  if (!value || value === discardValue) {
    return value === discardValue;
  }
  return charityData.value?.eligibleRecipientIDs.includes(value) ?? false;
}

const charitySelectedCount = computed(() => Object.values(charitySelections)
  .filter((value) => charityOptionIsValid(value)).length);

const charityIsValid = computed(() => {
  const data = charityData.value;
  if (!data) {
    return false;
  }
  return charitySelectedCount.value === data.excess;
});

function resetForms(): void {
  for (const key of Object.keys(offeredSelections)) {
    Reflect.deleteProperty(offeredSelections, key);
  }
  for (const key of Object.keys(requestedSelections)) {
    Reflect.deleteProperty(requestedSelections, key);
  }
  for (const key of Object.keys(offerRecipients)) {
    Reflect.deleteProperty(offerRecipients, key);
  }
  for (const key of Object.keys(theftCosts)) {
    Reflect.deleteProperty(theftCosts, key);
  }
  for (const key of Object.keys(theftVictims)) {
    Reflect.deleteProperty(theftVictims, key);
  }
  for (const key of Object.keys(charitySelections)) {
    Reflect.deleteProperty(charitySelections, key);
  }
  for (const {action, index} of economyEntries.value) {
    const key = entryKey(action, index);
    const targets = actionTargetIDs(action);
    if (action.type === "propose_trade" || action.type === "propose_gift") {
      offeredSelections[key] = [];
      requestedSelections[key] = [];
      offerRecipients[key] = targets[0] ?? "";
    }
    if (action.type === "attempt_theft") {
      theftCosts[key] = action.instance_ids?.[0] ?? "";
      theftVictims[key] = targets[0] ?? "";
    }
  }
  formError.value = "";
}

watch(
  () => [
    props.projection.version,
    props.interaction?.interaction_id ?? "",
    props.interaction?.my_response_state ?? "",
    props.actions.map(({action, index}) => entryKey(action, index)).join("|"),
    charityData.value?.instanceIDs.join("|") ?? "",
  ].join("::"),
  resetForms,
  {immediate: true},
);

function submitOffer(action: EconomyAction, index: number): void {
  if (!offerIsValid(action, index) || props.busy) {
    formError.value = "Выберите допустимые карты и получателя из текущих дескрипторов.";
    return;
  }
  const key = entryKey(action, index);
  formError.value = "";
  emit("submit", {
    kind: "offer",
    offerKind: action.type === "propose_trade" ? "trade" : "gift",
    action,
    recipientPlayerID: offerRecipients[key] ?? "",
    offeredInstanceIDs: [...(offeredSelections[key] ?? [])],
    requestedInstanceIDs: [...(requestedSelections[key] ?? [])],
  });
}

function submitTheft(action: EconomyAction, index: number): void {
  if (!theftIsValid(action, index) || props.busy) {
    formError.value = "Выберите стоимость и жертву из текущих server descriptors.";
    return;
  }
  const key = entryKey(action, index);
  formError.value = "";
  emit("submit", {
    kind: "theft",
    action,
    victimPlayerID: theftVictims[key] ?? "",
    costInstanceID: theftCosts[key] ?? "",
  });
}

function submitCharity(): void {
  const data = charityData.value;
  if (!data || !charityIsValid.value || props.busy) {
    formError.value = `Нужно распределить ровно ${data?.excess ?? 0} карт.`;
    return;
  }
  formError.value = "";
  emit("submit", {
    kind: "charity",
    action: charityEntry.value?.action,
    interactionID: props.interaction?.interaction_id,
    allocations: data.instanceIDs
      .filter((instanceID) => charityOptionIsValid(charitySelections[instanceID] ?? ""))
      .map((instanceID) => {
        const recipient = charitySelections[instanceID];
        return recipient === discardValue
          ? {instance_id: instanceID}
          : {instance_id: instanceID, recipient_player_id: recipient};
      }),
  });
}
</script>

<template>
  <section
    v-if="hasForms"
    class="economy-surface"
    data-testid="economy-surface"
    :data-state="busy ? 'pending' : 'open'"
    aria-labelledby="economy-surface-title"
  >
    <header class="economy-surface__header">
      <div>
        <p class="eyebrow">СЕРВЕРНАЯ ЭКОНОМИКА</p>
        <h3 id="economy-surface-title">Карты и transfer clauses</h3>
        <p>
          Доступны только собственные карты и opaque descriptors из текущей проекции.
          Перемещение произойдёт только после подтверждения сервера.
        </p>
      </div>
    </header>

    <p v-if="formError" class="economy-surface__error" role="alert">
      {{ formError }}
    </p>

    <div v-if="offerEntries.length" class="economy-surface__grid">
      <article
        v-for="{action, index} in offerEntries"
        :key="entryKey(action, index)"
        class="economy-card"
        :data-kind="action.type === 'propose_trade' ? 'trade' : 'gift'"
      >
        <h4>{{ action.type === "propose_trade" ? "Обмен" : "Подарок" }}</h4>
        <p>
          Получатель:
          <strong>{{ playerName(projection, offerRecipients[entryKey(action, index)] ?? "") }}</strong>
        </p>
        <form novalidate @submit.prevent="submitOffer(action, index)">
          <fieldset :disabled="busy">
            <legend>Ваши передаваемые карты</legend>
            <label
              v-for="card in actionCards(action)"
              :key="card.instance_id"
              class="economy-option"
            >
              <input
                v-model="offeredSelections[entryKey(action, index)]"
                type="checkbox"
                :value="card.instance_id"
              >
              <span>{{ card.name }}</span>
            </label>
            <small>
              Выбрать: {{ Math.max(1, actionMinimum(action)) }}–{{ actionMaximum(action, actionCards(action).length) }}.
            </small>

            <label v-if="actionTargetIDs(action).length > 1" class="economy-field">
              Получатель
              <select v-model="offerRecipients[entryKey(action, index)]">
                <option
                  v-for="targetID in actionTargetIDs(action)"
                  :key="targetID"
                  :value="targetID"
                >
                  {{ playerName(projection, targetID) }}
                </option>
              </select>
            </label>

            <template v-if="action.type === 'propose_trade'">
              <span class="economy-label">Opaque descriptors карт получателя</span>
              <label
                v-for="(instanceID, requestedIndex) in action.requested_instance_ids ?? []"
                :key="instanceID"
                class="economy-option"
              >
                <input
                  v-model="requestedSelections[entryKey(action, index)]"
                  type="checkbox"
                  :value="instanceID"
                >
                <span>{{ opaqueRequestedLabel(requestedIndex) }}</span>
              </label>
              <small>Выбрать descriptors: 1–{{ requestedMaximum(action) }}.</small>
            </template>
          </fieldset>
          <button
            class="economy-submit"
            type="submit"
            :disabled="busy || !offerIsValid(action, index)"
          >
            {{ busy ? "Отправляем…" : "Отправить предложение" }}
          </button>
        </form>
      </article>
    </div>

    <div v-if="theftEntries.length" class="economy-surface__grid">
      <article
        v-for="{action, index} in theftEntries"
        :key="entryKey(action, index)"
        class="economy-card economy-card--hazard"
      >
        <h4>Кража с server resolution</h4>
        <p>
          Способность:
          <strong>{{ ownCardByID(projection, action.source_instance_id ?? "")?.name ?? "из текущей проекции" }}</strong>
        </p>
        <form novalidate @submit.prevent="submitTheft(action, index)">
          <fieldset :disabled="busy">
            <legend>Typed параметры действия</legend>
            <label class="economy-field">
              Стоимость
              <select v-model="theftCosts[entryKey(action, index)]">
                <option
                  v-for="card in actionCards(action)"
                  :key="card.instance_id"
                  :value="card.instance_id"
                >
                  {{ card.name }}
                </option>
              </select>
            </label>
            <label class="economy-field">
              Жертва
              <select v-model="theftVictims[entryKey(action, index)]">
                <option
                  v-for="targetID in actionTargetIDs(action)"
                  :key="targetID"
                  :value="targetID"
                >
                  {{ playerName(projection, targetID) }}
                </option>
              </select>
            </label>
            <small>Случайную карту и итог выбирает сервер; чужие candidates не показываются.</small>
          </fieldset>
          <button
            class="economy-submit economy-submit--hazard"
            type="submit"
            :disabled="busy || !theftIsValid(action, index)"
          >
            {{ busy ? "Открываем окно…" : "Начать кражу" }}
          </button>
        </form>
      </article>
    </div>

    <form
      v-if="charityData"
      class="economy-card economy-card--charity"
      novalidate
      @submit.prevent="submitCharity"
    >
      <h4>Обязательная благотворительность</h4>
      <p>
        Распределите ровно <strong>{{ charityData.excess }}</strong> excess-карт;
        оставшиеся карты не меняются этой командой.
      </p>
      <fieldset :disabled="busy">
        <legend>Получатель или сброс для каждой выбранной карты</legend>
        <label
          v-for="card in charityCards"
          :key="card.instance_id"
          class="economy-field economy-field--card"
        >
          <span>{{ card.name }}</span>
          <select
            v-model="charitySelections[card.instance_id]"
            :aria-label="`Решение для карты ${card.name}`"
          >
            <option value="">Не выбрано</option>
            <option :value="discardValue">Сбросить</option>
            <option
              v-for="recipientID in charityData.eligibleRecipientIDs"
              :key="recipientID"
              :value="recipientID"
            >
              Передать: {{ playerName(projection, recipientID) }}
            </option>
          </select>
        </label>
      </fieldset>
      <p class="economy-surface__count" role="status">
        Выбрано решений: {{ charitySelectedCount }} / {{ charityData.excess }}.
      </p>
      <button
        class="economy-submit"
        type="submit"
        :disabled="busy || !charityIsValid"
      >
        {{ busy ? "Подтверждаем…" : "Подтвердить распределение" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.economy-surface {
  display: grid;
  gap: .9rem;
  min-width: 0;
  border: 1px solid var(--acid);
  padding: 1rem;
  background: #171a0d;
}

.economy-surface__header,
.economy-card form,
.economy-card fieldset {
  display: grid;
  gap: .65rem;
  min-width: 0;
}

.economy-surface__header h3,
.economy-card h4,
.economy-surface__header p,
.economy-card p,
.economy-surface__count {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.45;
}

.economy-surface__header h3,
.economy-card h4 {
  color: var(--acid);
}

.economy-surface__header p,
.economy-card p,
.economy-card small,
.economy-surface__count {
  color: var(--muted);
}

.economy-surface__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  gap: .75rem;
  min-width: 0;
}

.economy-card {
  display: grid;
  align-content: start;
  gap: .75rem;
  min-width: 0;
  border: 1px solid var(--line);
  padding: .85rem;
  background: #11130c;
}

.economy-card > * {
  min-width: 0;
  max-width: 100%;
}

.economy-card--hazard {
  border-color: var(--orange);
}

.economy-card--charity {
  background: #1a1d10;
}

.economy-card fieldset {
  margin: 0;
  border: 0;
  padding: 0;
}

.economy-card legend,
.economy-label {
  color: var(--muted);
  font-size: .78rem;
  text-transform: uppercase;
}

.economy-option {
  display: flex;
  align-items: start;
  gap: .55rem;
  min-width: 0;
  line-height: 1.4;
}

.economy-option input {
  flex: 0 0 auto;
  margin-top: .25rem;
}

.economy-option span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.economy-field {
  display: grid;
  gap: .35rem;
  min-width: 0;
}

.economy-field select {
  width: 100%;
  max-width: 100%;
  min-height: 2.75rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid var(--line);
  padding: .55rem .65rem;
  color: inherit;
  background: var(--color-board);
  font: inherit;
}

.economy-field--card {
  grid-template-columns: minmax(0, 1fr) minmax(10rem, 15rem);
  align-items: center;
  gap: .75rem;
}

.economy-field--card > span {
  overflow-wrap: anywhere;
}

.economy-submit {
  width: 100%;
  min-height: 2.75rem;
  white-space: normal;
  overflow-wrap: anywhere;
}

.economy-submit--hazard {
  border-color: var(--orange);
}

.economy-surface__error {
  border: 1px solid #ef8d74;
  padding: .7rem;
  color: #ffd2c6;
}

@media (prefers-reduced-motion: reduce) {
  .economy-surface,
  .economy-card {
    transition: none;
  }
}

@media (width <= 560px) {
  .economy-field--card {
    grid-template-columns: 1fr;
  }
}

@media (forced-colors: active) {
  .economy-surface,
  .economy-card,
  .economy-surface__error {
    border-color: CanvasText;
    forced-color-adjust: none;
  }
}
</style>
