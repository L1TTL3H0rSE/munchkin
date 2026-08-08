<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";
import SheetDialog from "../../ui/SheetDialog.vue";
import type {EquipmentSlot} from "../gameSheetModel";

const props = defineProps<{projection: Projection}>();
const emit = defineEmits<{
  close: [];
  "open-slot": [slot: EquipmentSlot];
  "open-actions": [];
}>();

const supplementalActions = computed(() => props.projection.turn.available_actions.filter((action) => [
  "use_ability",
  "discard_card",
  "sell_items",
  "propose_trade",
  "propose_gift",
  "attempt_theft",
].includes(action.type)));

const slots: Array<{
  slot: EquipmentSlot;
  desktop: string;
  compact: string;
}> = [
  {slot: "headgear", desktop: "ГОЛОВА", compact: "ГОЛОВНЯК"},
  {slot: "armor", desktop: "ТЕЛО", compact: "БРОНЯ"},
  {slot: "footgear", desktop: "НОГИ", compact: "ОБУВЬ"},
  {slot: "hands", desktop: "РУКИ · 2", compact: "РУКИ"},
];

const className = computed(() => props.projection.you.traits.find((card) =>
  card.trait_group === "class",
)?.name);
const raceName = computed(() => props.projection.you.traits.find((card) =>
  card.trait_group === "race",
)?.name);
const carriedValue = computed(() => props.projection.you.carried.reduce((total, card) =>
  total + (card.value ?? 0),
0));
const compactDescription = computed(() => [
  `Уровень ${props.projection.you.level}`,
  className.value,
  raceName.value,
].filter(Boolean).join(" · "));

function equippedIn(slot: EquipmentSlot): CardView[] {
  return props.projection.you.equipped.filter((card) => card.item_slot === slot);
}

function slotName(slot: EquipmentSlot): string {
  const items = equippedIn(slot);
  return items.length ? items.map((card) => card.name).join(" · ") : "";
}

function slotBonus(slot: EquipmentSlot): number {
  return equippedIn(slot).reduce((total, card) => total + (card.bonus ?? 0), 0);
}
</script>

<template>
  <SheetDialog
    class="character-equipment-dialog"
    :open="true"
    title="Персонаж и экипировка"
    description="Класс, раса, бонусы и занятые слоты"
    compact-title="Персонаж"
    :compact-description="compactDescription"
    title-id="character-equipment-title"
    :close-label="projection.turn.phase === 'setup' ? 'Готово' : 'Закрыть'"
    data-figma-desktop-node="267:708"
    data-figma-compact-node="165:42"
    @close="emit('close')"
  >
    <div class="character-equipment">
      <section class="character-equipment__summary" aria-label="Параметры персонажа">
        <div class="character-equipment__identity">
          <div>
            <strong>{{ projection.you.name }}</strong>
            <span>Твой персонаж</span>
          </div>
          <b>{{ projection.you.level }}</b>
        </div>
        <div class="character-equipment__desktop-traits">
          <div v-if="className"><span>КЛАСС</span><strong>{{ className }}</strong></div>
          <div v-if="raceName"><span>РАСА</span><strong>{{ raceName }}</strong></div>
        </div>
        <dl>
          <div><dt>Уровень</dt><dd>{{ projection.you.level }}</dd></div>
          <div><dt>Базовая сила</dt><dd>{{ projection.you.strength_breakdown.base_strength }}</dd></div>
          <div><dt>Экипировка</dt><dd>+{{ projection.you.strength_breakdown.equipment_bonus }}</dd></div>
          <div><dt>Временные бонусы</dt><dd>{{ projection.you.strength_breakdown.temporary_bonus >= 0 ? "+" : "" }}{{ projection.you.strength_breakdown.temporary_bonus }}</dd></div>
          <div><dt>Карт в руке</dt><dd>{{ projection.you.strength_breakdown.hand_count }}</dd></div>
        </dl>
        <button
          class="character-equipment__summary-carried"
          type="button"
          :disabled="!supplementalActions.length"
          @click="emit('open-actions')"
        >
          <span>ПЕРЕНОСИМЫЕ ВЕЩИ</span>
          <strong>{{ projection.you.carried.length }} вещи · {{ carriedValue }} голдов</strong>
        </button>
      </section>

      <section class="character-equipment__loadout" aria-label="Слоты экипировки">
        <div class="character-equipment__heading">
          <h3>Текущая экипировка</h3>
          <p>Бонус учитывается сервером после подтверждения состояния</p>
        </div>
        <div class="character-equipment__compact-traits">
          <span v-if="className">{{ className }}</span>
          <span v-if="raceName">{{ raceName }}</span>
          <span>{{ projection.you.escape_bonus >= 0 ? "+" : "−" }}{{ Math.abs(projection.you.escape_bonus) }} ПОБЕГ</span>
        </div>
        <div class="character-equipment__slots">
          <button
            v-for="itemSlot in slots"
            :key="itemSlot.slot"
            class="equipment-slot"
            :class="{'equipment-slot--empty': !slotName(itemSlot.slot)}"
            type="button"
            @click="emit('open-slot', itemSlot.slot)"
          >
            <span class="equipment-slot__desktop-label">{{ itemSlot.desktop }}</span>
            <span class="equipment-slot__compact-label">{{ itemSlot.compact }}</span>
            <strong class="equipment-slot__desktop-value">{{ slotName(itemSlot.slot) || "Свободно" }}</strong>
            <strong class="equipment-slot__compact-value">{{ slotName(itemSlot.slot) || "Пусто" }}</strong>
            <small>{{ slotName(itemSlot.slot) ? `+${slotBonus(itemSlot.slot)}` : "—" }}</small>
          </button>
        </div>
        <button
          class="character-equipment__carried"
          type="button"
          :disabled="!supplementalActions.length"
          @click="emit('open-actions')"
        >
          <span>В РЮКЗАКЕ · {{ projection.you.carried.length }}</span>
          <p v-if="projection.you.carried.length">
            <template v-for="(card, index) in projection.you.carried" :key="card.instance_id">
              {{ index ? " · " : "" }}{{ card.name }}<template v-if="card.value"> · {{ card.value }} голдов</template>
            </template>
          </p>
          <p v-else>Нет предметов в рюкзаке</p>
        </button>
        <small class="character-equipment__compact-note">Тап по слоту открывает доступные действия.</small>
      </section>
    </div>
  </SheetDialog>
</template>

<style scoped lang="scss">
.character-equipment { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 16px; min-width: 0; }
.character-equipment__summary,
.character-equipment__loadout { min-width: 0; border-radius: 16px; padding: 16px; }
.character-equipment__summary { display: grid; align-content: start; gap: 16px; background: var(--color-surface-raised, #fffdf8); }
.character-equipment__identity { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-radius: 12px; padding: 12px; color: #fff9ef; background: var(--color-ink); }
.character-equipment__identity > div { display: grid; gap: 5px; }
.character-equipment__identity span { color: #cfc5ba; font-size: 11px; }
.character-equipment__identity strong { font-size: 18px; }
.character-equipment__identity b { font-size: 20px; }
.character-equipment__desktop-traits { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.character-equipment__desktop-traits > div { min-height: 56px; display: grid; align-content: center; gap: 4px; border: 1px solid var(--color-line); border-radius: 12px; padding: 8px 12px; }
.character-equipment__desktop-traits span,
.character-equipment__summary-carried span,
.character-equipment__carried span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.character-equipment__desktop-traits strong { font-size: 11px; font-weight: 500; }
.character-equipment dl { display: grid; gap: 0; margin: 0; }
.character-equipment dl > div { display: flex; justify-content: space-between; gap: 12px; min-height: 28px; align-items: center; }
.character-equipment dt { color: var(--color-text-muted); }
.character-equipment dd { margin: 0; }
.character-equipment__summary-carried { min-height: 76px; display: grid; align-content: center; gap: 6px; border: 0; border-radius: 12px; padding: 12px; color: inherit; background: var(--color-surface-control); text-align: left; font: inherit; }
.character-equipment__summary-carried:disabled,
.character-equipment__carried:disabled { cursor: default; }
.character-equipment__summary-carried strong { color: var(--color-accent-strong); font-size: 11px; font-weight: 500; }
.character-equipment__summary-carried small,
.character-equipment__carried small { color: var(--color-accent-strong); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.character-equipment__loadout { display: grid; grid-template-rows: auto auto 1fr; gap: 16px; background: var(--color-surface-card); }
.character-equipment__heading h3 { margin: 0; font-size: 18px; }
.character-equipment__heading p { margin: 4px 0 0; color: var(--color-text-muted); font-size: 11px; }
.character-equipment__compact-traits,
.character-equipment__compact-note { display: none; }
.character-equipment__slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.equipment-slot { position: relative; min-width: 0; min-height: 112px; display: grid; align-content: start; gap: 8px; border: 2px solid var(--color-accent-strong); border-radius: 16px; padding: 12px; color: inherit; background: var(--color-surface-raised, #fffdf8); text-align: left; cursor: pointer; }
.equipment-slot--empty { border-style: dashed; }
.equipment-slot > span { color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; }
.equipment-slot strong { overflow-wrap: anywhere; font-size: 11px; font-weight: 500; }
.equipment-slot small { position: absolute; top: 12px; right: 12px; color: var(--color-accent-strong); font-size: 14px; font-weight: 800; }
.equipment-slot__compact-label { display: none; }
.equipment-slot__compact-value { display: none; }
.character-equipment__carried { min-height: 116px; display: grid; align-content: start; gap: 8px; border: 1px solid var(--color-line); border-radius: 12px; padding: 12px; color: inherit; background: var(--color-surface-raised, #fffdf8); text-align: left; font: inherit; }
.character-equipment__carried p { margin: 0; overflow: hidden; color: var(--color-text); line-height: 1.45; }

:deep(.character-equipment-dialog) { width: min(940px, calc(100% - 24px)); }
:deep(.character-equipment-dialog .sheet-dialog__surface) { min-height: 620px; gap: 20px; box-sizing: border-box; padding: 24px; }

@media (width < 1024px) {
  :deep(.character-equipment-dialog) { width: min(560px, calc(100% - 24px)); max-height: min(470px, calc(100dvh - 24px)); }
  :deep(.character-equipment-dialog .sheet-dialog__surface) { min-height: min(470px, calc(100dvh - 24px)); max-height: min(470px, calc(100dvh - 24px)); padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .character-equipment { grid-template-columns: 1fr; gap: 12px; }
  .character-equipment__summary { display: none; }
  .character-equipment__loadout { grid-template-rows: 32px 154px 88px auto; gap: 8px; border: 1px solid var(--color-line); padding: 12px; background: var(--color-surface-card); }
  .character-equipment__heading { display: none; }
  .character-equipment__compact-traits { min-width: 0; display: flex; gap: 8px; overflow-x: auto; }
  .character-equipment__compact-traits span { flex: 0 0 auto; min-width: 70px; height: 32px; box-sizing: border-box; border: 1px solid var(--color-accent-strong); border-radius: 12px; padding: 8px 10px; color: var(--color-text-muted); font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .character-equipment__slots { gap: 8px; }
  .equipment-slot { min-height: 72px; border-width: 1px; border-radius: 12px; padding: 8px; }
  .equipment-slot--empty { border-style: solid; }
  .equipment-slot small { position: static; display: none; }
  .equipment-slot__desktop-label { display: none; }
  .equipment-slot__desktop-value { display: none; }
  .equipment-slot__compact-label { display: inline; }
  .equipment-slot__compact-value { display: block; }
  .character-equipment__carried { min-height: 88px; border: 0; padding: 8px 10px; background: var(--color-surface-control); }
  .character-equipment__carried p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .character-equipment__compact-note { display: block; color: var(--color-text-muted); font-size: 10px; }
}

@media (width < 600px) {
  :deep(.character-equipment-dialog) { width: 100%; }
}
</style>
