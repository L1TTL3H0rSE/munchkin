<script setup lang="ts">
import {computed, ref, watch} from "vue";
import CardPresentation from "../game/primitives/CardPresentation.vue";
import {useInteractionCountdown} from "@munchkin/shared";

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

const props = withDefaults(defineProps<{
  interaction: DeathLootInteraction;
  busy: boolean;
  timerText?: string;
  variant?: "compact" | "desktop";
}>(), {timerText: "", variant: "compact"});

const emit = defineEmits<{
  submit: [action: InteractionActionView];
  "open-character": [];
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
const selectedAction = computed(() => selectedOption.value?.action ??
  (passAction.value?.action_id === selectedActionID.value ? passAction.value : undefined));
const countdown = useInteractionCountdown(
  () => props.interaction.deadline_at,
  () => props.interaction.server_time,
);
const displayTimerText = computed(() => props.timerText ||
  `${Math.floor(countdown.remainingSeconds.value / 60).toString().padStart(2, "0")}:${(countdown.remainingSeconds.value % 60).toString().padStart(2, "0")}`,
);

watch(
  () => options.value.map(({action}) =>
    `${action.interaction_id}:${action.revision}:${action.action_id}`,
  ).join("|"),
  () => {
    if (selectedActionID.value && !options.value.some(({action}) =>
      action.action_id === selectedActionID.value,
    )) {
      selectedActionID.value = null;
    }
  },
);

function submitPick(): void {
  const action = selectedOption.value?.action;
  if (!action || props.busy || terminal.value) return;
  emit("submit", action);
}

function submitPass(): void {
  if (!passAction.value || props.busy || terminal.value) return;
  emit("submit", passAction.value);
}

function submitSelected(): void {
  if (!selectedAction.value || props.busy || terminal.value) return;
  emit("submit", selectedAction.value);
}
</script>

<template>
  <template v-if="variant === 'desktop' && isDeathLootInteraction(interaction)">
    <main class="game-table__stage">
      <section
        class="game-table__death-loot"
        data-figma-owner="game-board:death-loot-wide"
        data-figma-desktop-node="295:2355"
        aria-labelledby="desktop-death-loot-title"
      >
        <header>
          <h2 id="desktop-death-loot-title">Добыча погибшего игрока</h2>
          <p>Выбери одну карту из доступного пула или откажись.</p>
        </header>
        <div class="game-table__death-loot-choices" role="listbox" aria-label="Доступная добыча">
          <button
            v-for="option in options"
            :key="option.action.action_id"
            type="button"
            role="option"
            :aria-selected="option.action.action_id === selectedActionID"
            @click="selectedActionID = option.action.action_id"
          >
            <CardPresentation :card="option.card" variant="choice" choice-context="loot" />
          </button>
          <button
            v-if="passAction"
            class="game-table__death-loot-pass"
            type="button"
            role="option"
            :aria-selected="passAction.action_id === selectedActionID"
            @click="selectedActionID = passAction.action_id"
          >
            <span aria-hidden="true">ИЛЛЮСТРАЦИЯ</span>
            <strong>Пропустить</strong>
            <small>Не брать карту</small>
            <p>Сохранить текущий инвентарь.</p>
          </button>
        </div>
        <footer>
          <span>ПОСЛЕ ОТВЕТА ПРИОРИТЕТ ПЕРЕЙДЁТ К СЛЕДУЮЩЕМУ ИГРОКУ</span>
          <time :datetime="interaction.deadline_at">{{ displayTimerText }}</time>
        </footer>
      </section>
    </main>

    <aside class="game-table__sidebar" aria-label="Твой персонаж">
      <section class="game-table__death-priority">
        <span>ДОБЫЧА</span>
        <div>
          <span>ДОБЫЧА</span>
          <strong>Твой приоритет</strong>
          <p>Пул: {{ interaction.death_loot.remaining_count }} карт<br>Можно выбрать: 1<br>Уже выбрано: {{ interaction.death_loot.picked_count }}</p>
        </div>
      </section>
      <button class="game-table__character" type="button" @click="emit('open-character')">
        <span>Твой персонаж</span>
        <b>Персонаж</b>
        <strong>Инвентарь после смерти</strong>
        <em>Экипировка, класс и раса открываются отдельно.</em>
      </button>
      <section class="game-table__action-panel" aria-live="polite">
        <span>ТРЕБУЕТСЯ ВЫБОР</span>
        <strong>Подтверди карту</strong>
        <p>{{ selectedAction?.type === "pass" ? "Откажись от карты в этом приоритете." : "Выбор окончательный." }}</p>
        <button class="game-primary-action" type="button" :disabled="busy || !selectedAction" @click="submitSelected">
          {{ busy ? "Подтверждаем…" : selectedAction?.type === "pass" ? "Пас" : "Забрать карту" }}
        </button>
      </section>
    </aside>
  </template>

  <section
    v-else-if="isDeathLootInteraction(interaction)"
    class="death-loot-surface"
    data-testid="death-loot-surface"
    :data-state="terminal ? 'terminal' : busy ? 'pending' : 'open'"
    data-priority="actor"
    aria-label="Выбор добычи после смерти"
  >
    <header class="death-loot-surface__header">
      <div>
        <h3>Добыча после смерти</h3>
        <p>Твой приоритет · осталось {{ interaction.death_loot.remaining_count }} · выбери 1 карту.</p>
      </div>
      <time :datetime="interaction.deadline_at">{{ displayTimerText }}</time>
    </header>

    <p v-if="terminalMessage" class="death-loot-surface__result" role="status" aria-live="polite">
      {{ terminalMessage }}
    </p>

    <form
      v-if="options.length || passAction"
      class="death-loot-form"
      novalidate
      @submit.prevent="submitPick"
    >
      <div class="death-loot-form__choices">
        <fieldset
          v-if="options.length"
          :disabled="busy || terminal"
          role="listbox"
          aria-label="Доступные карты погибшего игрока"
        >
          <legend>Доступные карты</legend>
          <button
            v-for="option in options"
            :key="option.action.action_id"
            type="button"
            role="option"
            :aria-selected="option.action.action_id === selectedActionID"
            class="death-loot-option"
            :class="{'death-loot-option--selected': option.action.action_id === selectedActionID}"
            @click="selectedActionID = option.action.action_id"
          >
            <CardPresentation :card="option.card" variant="choice" choice-context="loot" />
          </button>
        </fieldset>
      </div>
      <button
        v-if="passAction"
        class="death-loot-submit death-loot-submit--secondary"
        type="button"
        :disabled="busy || terminal"
        @click="submitPass"
      >
        Пас
      </button>
      <button
        class="death-loot-submit"
        type="submit"
        :disabled="busy || terminal || !selectedOption"
      >
        {{ busy ? "Отправляем выбор…" : "Забрать выбранную карту" }}
      </button>
    </form>

    <p v-if="!options.length && !terminal" class="death-loot-surface__opaque" role="status">
      Доступных карт сейчас нет.
    </p>
  </section>
</template>

<style scoped lang="scss">
.game-table {
  &__stage,
  &__sidebar { min-width: 0; border: 1px solid var(--color-line); border-radius: var(--radius-panel); background: var(--color-surface); }
  &__stage { position: relative; display: grid; place-items: center; overflow: hidden; }
  &__death-loot { width: 100%; height: 100%; min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 16px; box-sizing: border-box; padding: 18px 16px 20px; }
  &__death-loot header h2,
  &__death-loot header p { margin: 0; }
  &__death-loot header h2 { font-size: 20px; line-height: 24px; }
  &__death-loot header p { margin-top: 6px; color: var(--color-text-secondary); font-size: 12px; }
  &__death-loot-choices { min-width: 0; display: flex; align-items: center; justify-content: safe center; gap: 58px; overflow-x: auto; padding: 6px; }
  &__death-loot-choices > button { flex: 0 0 auto; border: 2px solid transparent; border-radius: 14px; padding: 0; background: transparent; }
  &__death-loot-choices > button[aria-selected="true"] { border-color: var(--color-accent-strong); }
  &__death-loot-pass { width: 150px; height: 218px; display: grid; grid-template-rows: 92px auto auto 1fr; overflow: hidden; color: inherit; background: var(--color-surface-card); box-shadow: 0 7px 18px rgb(59 46 40 / 14%); text-align: left; }
  &__death-loot-pass > span { display: grid; place-items: center; color: var(--color-text-primary); background: color-mix(in srgb, var(--color-accent) 30%, var(--color-surface)); font-size: 9px; font-weight: 700; letter-spacing: .08em; }
  &__death-loot-pass strong,
  &__death-loot-pass small,
  &__death-loot-pass p { margin: 0; padding-inline: 10px; }
  &__death-loot-pass strong { padding-top: 10px; font-size: 11px; }
  &__death-loot-pass small { padding-top: 6px; color: var(--color-text-muted); font-size: 9px; }
  &__death-loot-pass p { padding-top: 8px; font-size: 10px; line-height: 14px; }
  &__death-loot footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--color-text-muted); font-size: 9px; letter-spacing: .04em; }
  &__death-loot footer time { flex: 0 0 auto; color: var(--color-text-primary); font-size: 12px; letter-spacing: 0; }

  &__sidebar { grid-column: 3; grid-row: 1 / span 2; display: grid; grid-template-rows: 332px 188px minmax(194px, 1fr); gap: 24px; padding: 16px; }
  &__death-priority { min-width: 0; display: grid; grid-template-rows: auto 1fr; gap: 76px; }
  &__death-priority > span,
  &__death-priority > div > span,
  &__action-panel > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  &__death-priority > div { display: grid; align-content: start; gap: 18px; border: 1px solid var(--color-line); border-radius: 16px; padding: 16px; background: var(--color-surface-card); }
  &__death-priority strong { font-size: 20px; }
  &__death-priority p { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }
  &__character { min-width: 0; display: grid; align-content: start; border: 0; border-radius: 16px; padding: 16px; color: var(--color-surface); background: var(--color-ink); font: inherit; text-align: left; cursor: pointer; }
  &__character > span { color: var(--color-surface); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  &__character b { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  &__character strong { margin-top: 12px; font-family: var(--font-card); font-size: 19px; }
  &__character em { margin-top: auto; color: var(--color-surface-muted); font-size: 10px; font-style: normal; line-height: 1.4; }
  &__action-panel { min-width: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; align-content: start; gap: 12px; border: 1px solid var(--color-line); border-radius: 16px; padding: 14px; }
  &__action-panel > strong { font-size: 14px; }
  &__action-panel p { margin: 0; color: var(--color-text-muted); font-size: 10px; line-height: 1.45; }
}

.game-primary-action { width: 100%; min-height: 52px; border: 0; border-radius: 14px; padding: 0 18px; color: var(--color-surface); background: var(--color-accent-strong); font: inherit; font-weight: 800; cursor: pointer; }
.game-primary-action:disabled { color: var(--color-text-primary); background: var(--color-surface-control); cursor: default; }
</style>

<style scoped>
.death-loot-surface { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 16px; min-width: 0; box-sizing: border-box; color: var(--color-text-primary); }
.death-loot-surface__header { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.death-loot-surface__header > div { min-width: 0; }
.death-loot-surface__header h3,
.death-loot-surface__header p { margin: 0; }
.death-loot-surface__header h3 { font-size: 20px; line-height: 24px; }
.death-loot-surface__header p { margin-top: 12px; color: var(--color-text-muted); font-size: 11px; line-height: 14px; white-space: nowrap; }
.death-loot-surface__header time { position: relative; z-index: 1; flex: 0 0 70px; min-height: 40px; display: grid; place-items: center; box-sizing: border-box; border: 1px solid var(--color-accent-strong); border-radius: 12px; font-weight: 700; }
.death-loot-surface__result,
.death-loot-surface__opaque { margin: 0; overflow-wrap: anywhere; line-height: 1.45; }
.death-loot-surface__result { color: var(--color-action-primary); }
.death-loot-surface__opaque { place-self: center; color: var(--color-text-muted); text-align: center; }
.death-loot-form { display: grid; grid-template-rows: 218px 44px 52px; gap: 4px; margin: 0; }
.death-loot-form__choices { min-width: 0; overflow-x: auto; scrollbar-width: none; }
.death-loot-form fieldset { min-width: max-content; display: grid; grid-auto-flow: column; grid-auto-columns: 150px; gap: 12px; margin: 0; border: 0; padding: 0; }
.death-loot-form legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.death-loot-option { min-width: 0; border: 0; padding: 0; background: transparent; cursor: pointer; }
.death-loot-option--selected :deep(.choice-card-presentation) { border-color: var(--color-action-primary); }
.death-loot-submit { width: 100%; min-height: 44px; border: 0; border-radius: 14px; color: var(--color-surface); background: var(--color-accent-strong); font: inherit; font-weight: 800; }
.death-loot-submit:disabled { opacity: .45; }
.death-loot-submit--secondary { border: 1px solid var(--color-accent-strong); color: var(--color-action-primary); background: transparent; }
@media (prefers-reduced-motion: reduce) { .death-loot-option { transition: none; } }
@media (forced-colors: active) { .death-loot-option, .death-loot-submit { border-color: CanvasText; forced-color-adjust: none; } }
@media (width < 380px) { .death-loot-surface__header p { white-space: normal; } }
</style>
