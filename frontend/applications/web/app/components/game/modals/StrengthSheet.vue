<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import SheetDialog from "../../ui/SheetDialog.vue";

const props = defineProps<{projection: Projection}>();
const emit = defineEmits<{close: []}>();

const combat = computed(() => props.projection.turn.combat);
const playerStrength = computed(() =>
  combat.value?.player_strength ?? props.projection.you.strength_breakdown.total_strength,
);
const monsterStrength = computed(() => combat.value?.monster_strength ?? 0);
const score = computed(() => combat.value
  ? `${playerStrength.value} : ${monsterStrength.value}`
  : String(playerStrength.value));
const monsterBase = computed(() => (combat.value?.monsters ?? []).reduce((total, card) =>
  total + (card.combat_strength ?? 0),
0));
const monsterModifier = computed(() => monsterStrength.value - monsterBase.value);
const helperName = computed(() => {
  const helperID = combat.value?.helper_player_id;
  if (!helperID) return "нет";
  if (helperID === props.projection.you.player_id) return props.projection.you.name;
  return props.projection.players.find((player) => player.player_id === helperID)?.name ?? "есть";
});
const outcome = computed(() => !combat.value
  ? "ТЕКУЩАЯ СИЛА"
  : combat.value.player_winning ? "ПОБЕЖДАЕШЬ" : "ПРОИГРЫВАЕШЬ");
const tieCopy = computed(() => combat.value?.tie_wins
  ? "ничья считается победой"
  : "ничья считается поражением");

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
</script>

<template>
  <SheetDialog
    class="strength-breakdown-dialog"
    :open="true"
    title="Подробный расчёт силы"
    description="Только подтверждённые сервером источники"
    compact-title="Сила"
    compact-description="Разбор текущего боя"
    data-figma-desktop-node="271:3010"
    data-figma-compact-node="164:42"
    @close="emit('close')"
  >
    <template #header-action>
      <div class="strength-sheet__header-actions">
        <strong>{{ score }}</strong>
        <button type="button" @click="emit('close')">Закрыть</button>
      </div>
    </template>

    <div class="strength-sheet__compact">
      <div class="strength-sheet__compact-summary">
        <strong>{{ score }}</strong>
        <span>{{ outcome }}</span>
      </div>
      <dl>
        <div><dt>Твой уровень</dt><dd>{{ projection.you.level }}</dd></div>
        <div><dt>Экипировка</dt><dd>{{ signed(projection.you.strength_breakdown.equipment_bonus) }}</dd></div>
        <div><dt>Временные модификаторы</dt><dd>{{ signed(projection.you.strength_breakdown.temporary_bonus) }}</dd></div>
        <div v-if="combat" class="strength-sheet__divider" aria-hidden="true" />
        <div v-for="monster in combat?.monsters ?? []" :key="monster.instance_id">
          <dt>{{ monster.name }}</dt><dd>{{ monster.combat_strength ?? 0 }}</dd>
        </div>
        <div v-if="combat"><dt>Усиления монстров</dt><dd>{{ signed(monsterModifier) }}</dd></div>
      </dl>
      <p v-if="combat">Помощник: {{ helperName }} · {{ tieCopy }}</p>
    </div>

    <div class="strength-sheet__desktop">
      <section>
        <header><span>ТВОЙ ПЕРСОНАЖ</span><strong>{{ playerStrength }}</strong></header>
        <dl>
          <div><dt>Уровень</dt><dd>{{ projection.you.level }}</dd></div>
          <div v-for="card in projection.you.equipped" :key="card.instance_id">
            <dt>{{ card.name }}</dt><dd>{{ signed(card.bonus ?? 0) }}</dd>
          </div>
          <div><dt>Экипировка, итого</dt><dd>{{ signed(projection.you.strength_breakdown.equipment_bonus) }}</dd></div>
          <div><dt>Временные бонусы</dt><dd>{{ signed(projection.you.strength_breakdown.temporary_bonus) }}</dd></div>
          <div><dt>Общая сила</dt><dd>{{ playerStrength }}</dd></div>
        </dl>
      </section>
      <section>
        <header><span>МОНСТРЫ</span><strong>{{ monsterStrength }}</strong></header>
        <dl>
          <div v-for="monster in combat?.monsters ?? []" :key="monster.instance_id">
            <dt>{{ monster.name }}</dt><dd>{{ monster.combat_strength ?? 0 }}</dd>
          </div>
          <div><dt>Модификаторы монстров</dt><dd>{{ signed(monsterModifier) }}</dd></div>
          <div><dt>Помощник</dt><dd>{{ helperName }}</dd></div>
          <div><dt>Монстры, итого</dt><dd>{{ monsterBase }}</dd></div>
          <div><dt>Общая сила</dt><dd>{{ monsterStrength }}</dd></div>
        </dl>
      </section>
    </div>
    <p class="strength-sheet__desktop-note">Итог изменится только после новой подтверждённой проекции.</p>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.strength-breakdown-dialog) { width: min(900px, calc(100% - 24px)); }
:deep(.strength-breakdown-dialog .sheet-dialog__surface) { min-height: 540px; gap: 20px; box-sizing: border-box; padding: 24px; }
.strength-sheet__header-actions { display: flex; align-items: center; gap: 16px; }
.strength-sheet__header-actions > strong { color: var(--color-accent-strong); font-size: 42px; line-height: 1; }
.strength-sheet__header-actions button { width: 110px; min-height: 52px; border: 1px solid var(--color-accent-strong); border-radius: 14px; color: var(--color-accent-strong); background: transparent; font: inherit; font-weight: 700; }
.strength-sheet__desktop { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.strength-sheet__desktop section { min-width: 0; min-height: 360px; border-radius: 16px; padding: 16px; background: var(--color-surface-raised, #fffdf8); }
.strength-sheet__desktop header { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.strength-sheet__desktop header span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.strength-sheet__desktop header strong { color: var(--color-accent-strong); font-size: 20px; }
.strength-sheet__desktop dl,
.strength-sheet__compact dl { display: grid; gap: 4px; margin: 0; }
.strength-sheet__desktop dl > div,
.strength-sheet__compact dl > div { min-width: 0; min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.strength-sheet__desktop dt,
.strength-sheet__compact dt { min-width: 0; overflow: hidden; color: var(--color-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.strength-sheet__desktop dd,
.strength-sheet__compact dd { flex: 0 0 auto; margin: 0; }
.strength-sheet__desktop-note { margin: 0; color: var(--color-text-muted); font-size: 11px; }
.strength-sheet__compact { display: none; }

@media (width < 1024px) {
  :deep(.strength-breakdown-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.strength-breakdown-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .strength-sheet__header-actions > strong { display: none; }
  .strength-sheet__header-actions button { width: 70px; min-height: 44px; border-color: var(--color-status-warning, #765044); border-radius: 12px; color: var(--color-status-warning, #765044); font-size: 14px; }
  .strength-sheet__desktop,
  .strength-sheet__desktop-note { display: none; }
  .strength-sheet__compact { min-height: 336px; display: grid; align-content: start; gap: 8px; border: 1px solid var(--color-line); border-radius: 16px; padding: 12px; background: var(--color-surface-card); }
  .strength-sheet__compact-summary { min-height: 62px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid var(--color-accent-strong); border-radius: 12px; padding: 8px 12px; background: var(--color-surface-control); }
  .strength-sheet__compact-summary strong { font-size: 20px; }
  .strength-sheet__compact-summary span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
  .strength-sheet__compact p { margin: 0; color: var(--color-text-muted); font-size: 10px; }
  .strength-sheet__compact dl > .strength-sheet__divider { min-height: 1px; border-top: 1px solid var(--color-line); }
}

@media (width < 600px) {
  :deep(.strength-breakdown-dialog) { width: 100%; }
}
</style>
