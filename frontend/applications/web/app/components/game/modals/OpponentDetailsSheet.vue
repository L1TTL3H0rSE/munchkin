<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";
import SheetDialog from "../../ui/SheetDialog.vue";
import type {EquipmentSlot} from "../gameSheetModel";

const props = defineProps<{projection: Projection; playerId: string}>();
const emit = defineEmits<{close: []}>();

const player = computed(() => props.projection.players.find((candidate) =>
  candidate.player_id === props.playerId,
));
const slots: Array<{slot: EquipmentSlot; desktop: string; compact: string}> = [
  {slot: "headgear", desktop: "ГОЛОВА", compact: "ГОЛОВНЯК"},
  {slot: "armor", desktop: "ТЕЛО", compact: "БРОНЯ"},
  {slot: "footgear", desktop: "НОГИ", compact: "ОБУВЬ"},
  {slot: "hands", desktop: "РУКИ · 2", compact: "РУКИ"},
];
const className = computed(() => player.value?.traits.find((card) =>
  card.trait_group === "class",
)?.name);
const raceName = computed(() => player.value?.traits.find((card) =>
  card.trait_group === "race",
)?.name);
const carriedValue = computed(() => player.value?.carried.reduce((total, card) =>
  total + (card.value ?? 0),
0) ?? 0);
const equipmentBonus = computed(() => player.value?.strength_breakdown?.equipment_bonus);
const baseStrength = computed(() => player.value?.strength_breakdown?.base_strength);
const temporaryBonus = computed(() => player.value?.strength_breakdown?.temporary_bonus);
const totalStrength = computed(() => player.value?.strength_breakdown?.total_strength
  ?? player.value?.combat_strength);
const compactDescription = computed(() => player.value
  ? `Уровень ${player.value.level} · сила ${totalStrength.value ?? "—"} · ${player.value.hand_count} карт в руке`
  : "Соперник больше не доступен");

function equippedIn(slot: EquipmentSlot): CardView[] {
  return player.value?.equipped.filter((card) => card.item_slot === slot) ?? [];
}

function slotName(slot: EquipmentSlot): string {
  return equippedIn(slot).map((card) => card.name).join(" · ");
}

function slotBonus(slot: EquipmentSlot): number {
  return equippedIn(slot).reduce((total, card) => total + (card.bonus ?? 0), 0);
}

function signed(value: number | undefined): string {
  if (value === undefined) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
}

function exact(value: number | undefined): number | string {
  return value ?? "—";
}
</script>

<template>
  <SheetDialog
    class="opponent-details-dialog"
    :open="true"
    :title="player?.name ?? 'Соперник'"
    description="Публичное состояние соперника"
    :compact-title="player?.name ?? 'Соперник'"
    :compact-description="compactDescription"
    data-figma-desktop-node="271:3216"
    data-figma-compact-node="166:42"
    @close="emit('close')"
  >
    <div v-if="player" class="opponent-details">
      <section class="opponent-details__summary">
        <div class="opponent-details__identity">
          <div><strong>{{ player.name }}</strong><span>{{ player.dead ? "Выбыл" : "В игре" }}</span></div>
          <b>{{ player.level }}</b>
        </div>
        <div class="opponent-details__desktop-traits">
          <div v-if="className"><span>КЛАСС</span><strong>{{ className }}</strong></div>
          <div v-if="raceName"><span>РАСА</span><strong>{{ raceName }}</strong></div>
        </div>
        <dl>
          <div><dt>Уровень</dt><dd>{{ player.level }}</dd></div>
          <div><dt>Базовая сила</dt><dd>{{ exact(baseStrength) }}</dd></div>
          <div><dt>Экипировка</dt><dd>{{ signed(equipmentBonus) }}</dd></div>
          <div><dt>Временные бонусы</dt><dd>{{ signed(temporaryBonus) }}</dd></div>
          <div><dt>Карт в руке</dt><dd>{{ player.hand_count }}</dd></div>
        </dl>
        <div class="opponent-details__summary-carried">
          <span>ПЕРЕНОСИМЫЕ ВЕЩИ</span>
          <strong>{{ player.carried.length }} вещи · {{ carriedValue }} голдов</strong>
        </div>
      </section>

      <section class="opponent-details__loadout">
        <div class="opponent-details__heading">
          <h3>Публичная экипировка</h3>
          <p>Состав руки скрыт; видны только публичные зоны и количество</p>
        </div>
        <div class="opponent-details__compact-traits">
          <span v-if="className">{{ className }}</span>
          <span v-if="raceName">{{ raceName }}</span>
          <span>{{ signed(player.escape_bonus ?? 0) }} ПОБЕГ</span>
        </div>
        <div class="opponent-details__slots">
          <div
            v-for="itemSlot in slots"
            :key="itemSlot.slot"
            class="opponent-slot"
            :class="{'opponent-slot--empty': !slotName(itemSlot.slot)}"
          >
            <span class="opponent-slot__desktop-label">{{ itemSlot.desktop }}</span>
            <span class="opponent-slot__compact-label">{{ itemSlot.compact }}</span>
            <strong>{{ slotName(itemSlot.slot) || "Пусто" }}</strong>
            <small>{{ slotName(itemSlot.slot) ? signed(slotBonus(itemSlot.slot)) : "—" }}</small>
          </div>
        </div>
        <div class="opponent-details__carried">
          <span>ОТКРЫТЫЕ ВЕЩИ · {{ player.carried.length }}</span>
          <p>{{ player.carried.map((card) => card.name).join(" · ") || "Нет открытых вещей" }}</p>
          <p v-if="player.persistent_curses.length">
            Проклятия: {{ player.persistent_curses.map((card) => card.name).join(" · ") }}
          </p>
        </div>
        <small class="opponent-details__privacy">Содержимое руки соперника скрыто.</small>
      </section>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
:deep(.opponent-details-dialog) { width: min(940px, calc(100% - 24px)); }
:deep(.opponent-details-dialog .sheet-dialog__surface) { min-height: 620px; gap: 20px; box-sizing: border-box; padding: 24px; }
.opponent-details { min-width: 0; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; }
.opponent-details__summary,
.opponent-details__loadout { min-width: 0; border-radius: 16px; padding: 16px; }
.opponent-details__summary { display: grid; align-content: start; gap: 16px; background: var(--color-surface-raised, #fffdf8); }
.opponent-details__identity { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 12px; padding: 12px; color: #fff9ef; background: var(--color-ink); }
.opponent-details__identity > div { display: grid; gap: 5px; }
.opponent-details__identity span { color: #cfc5ba; font-size: 11px; }
.opponent-details__identity strong { font-size: 18px; }
.opponent-details__identity b { font-size: 20px; }
.opponent-details__desktop-traits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.opponent-details__desktop-traits > div { min-height: 56px; display: grid; align-content: center; gap: 4px; border: 1px solid var(--color-line); border-radius: 12px; padding: 8px 12px; }
.opponent-details__desktop-traits span,
.opponent-details__summary-carried span,
.opponent-details__carried span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.opponent-details__desktop-traits strong { font-size: 11px; font-weight: 500; }
.opponent-details dl { display: grid; margin: 0; }
.opponent-details dl > div { min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.opponent-details dt { color: var(--color-text-muted); }
.opponent-details dd { margin: 0; }
.opponent-details__summary-carried { min-height: 76px; display: grid; align-content: center; gap: 6px; border-radius: 12px; padding: 12px; background: var(--color-surface-card); }
.opponent-details__summary-carried strong { color: var(--color-accent-strong); font-size: 11px; font-weight: 500; }
.opponent-details__loadout { display: grid; grid-template-rows: auto 236px 116px auto; gap: 16px; background: var(--color-surface-card); }
.opponent-details__heading h3 { margin: 0; font-size: 18px; }
.opponent-details__heading p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 11px; }
.opponent-details__compact-traits { display: none; }
.opponent-details__slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.opponent-slot { position: relative; min-width: 0; min-height: 112px; display: grid; align-content: start; gap: 8px; border: 2px solid var(--color-accent-strong); border-radius: 16px; padding: 12px; background: var(--color-surface-raised, #fffdf8); }
.opponent-slot--empty { border-color: var(--color-line); }
.opponent-slot > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.opponent-slot strong { overflow-wrap: anywhere; font-size: 11px; font-weight: 500; }
.opponent-slot small { position: absolute; top: 12px; right: 12px; color: var(--color-accent-strong); font-size: 14px; font-weight: 800; }
.opponent-slot__compact-label { display: none; }
.opponent-details__carried { min-height: 116px; display: grid; align-content: start; gap: 8px; border: 1px solid var(--color-line); border-radius: 12px; padding: 12px; background: var(--color-surface-raised, #fffdf8); }
.opponent-details__carried p { margin: 0; font-size: 11px; }
.opponent-details__privacy { color: var(--color-text-muted); font-size: 10px; }

@media (width < 1024px) {
  :deep(.opponent-details-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.opponent-details-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .opponent-details { grid-template-columns: 1fr; }
  .opponent-details__summary { display: none; }
  .opponent-details__loadout { grid-template-rows: 32px 154px 88px auto; gap: 8px; border: 1px solid var(--color-line); padding: 12px; }
  .opponent-details__heading { display: none; }
  .opponent-details__compact-traits { min-width: 0; display: flex; gap: 8px; overflow-x: auto; }
  .opponent-details__compact-traits span { flex: 0 0 auto; height: 32px; box-sizing: border-box; border: 1px solid var(--color-accent-strong); border-radius: 12px; padding: 8px 10px; color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .opponent-details__slots { gap: 8px; }
  .opponent-slot { min-height: 72px; border-width: 1px; border-radius: 12px; padding: 8px; }
  .opponent-slot small { position: static; display: none; }
  .opponent-slot__desktop-label { display: none; }
  .opponent-slot__compact-label { display: inline; }
  .opponent-details__carried { min-height: 88px; border: 0; padding: 8px 10px; background: var(--color-surface-control); }
  .opponent-details__carried p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}

@media (width < 600px) {
  :deep(.opponent-details-dialog) { width: 100%; }
}
</style>
