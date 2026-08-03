<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import type {CardActionBinding, CardActionState} from "../../actionModel";
import GameCard from "../../GameCard.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import HandTab from "../primitives/HandTab.vue";

defineProps<{
  projection: Projection;
  showHand: boolean;
  hasInteraction: boolean;
  hasActionableDeadline: boolean;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const emit = defineEmits<{activate: [binding: CardActionBinding]}>();
const handOpen = ref(false);
const characterOpen = ref(false);

function activate(binding: CardActionBinding) {
  emit("activate", binding);
}
</script>

<template>
  <section class="mobile-own-state" aria-label="Карты и персонаж">
    <div class="mobile-own-state__controls">
      <button
        class="mobile-own-state__character"
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="characterOpen"
        @click="characterOpen = true"
      >
        Персонаж
      </button>
      <HandTab
        v-if="showHand"
        :count="projection.you.hand.length"
        :has-actionable-deadline="hasActionableDeadline"
        :deadline-at="projection.interaction?.deadline_at"
        :server-time="projection.interaction?.server_time"
        :has-interaction="hasInteraction"
        @open="handOpen = true"
      />
    </div>
  </section>

  <SheetDialog
    :open="handOpen"
    :title="`Рука · ${projection.you.hand.length}`"
    v-bind="{titleID: 'mobile-hand-sheet-title'}"
    data-figma-node="147:803"
    @close="handOpen = false"
  >
    <div class="mobile-hand-sheet__grid" role="list">
      <GameCard
        v-for="card in projection.you.hand"
        :key="`mobile-hand-${card.instance_id}`"
        :card="card"
        :content-set-id="projection.content_set_id"
        compact
        :action-bindings="bindingsForCard(card.instance_id)"
        :action-state="stateForCard(card.instance_id)"
        :motion-state="confirmedCardIds.has(card.instance_id) ? 'confirmed' : undefined"
        role="listitem"
        @activate="activate"
      />
    </div>
  </SheetDialog>

  <SheetDialog
    :open="characterOpen"
    title="Персонаж"
    :description="`${projection.you.name} · уровень ${projection.you.level}`"
    v-bind="{titleID: 'mobile-character-sheet-title'}"
    data-figma-node="180:1601"
    @close="characterOpen = false"
  >
    <dl class="mobile-character-sheet__stats">
      <div><dt>Сила</dt><dd>{{ projection.you.combat_strength }}</dd></div>
      <div><dt>Побег</dt><dd>{{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</dd></div>
      <div><dt>Рука</dt><dd>{{ projection.you.hand.length }}/{{ projection.you.hand_limit }}</dd></div>
    </dl>
    <p class="mobile-character-sheet__tags">
      {{ projection.you.character_tags.join(" · ") || "Без класса и расы" }}
    </p>
  </SheetDialog>
</template>

<style scoped lang="scss">
.mobile-own-state,
.mobile-own-state__controls { min-width: 0; }
.mobile-own-state__controls { display: flex; align-items: stretch; gap: 8px; }
.mobile-own-state__character {
  min-height: 44px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 8px;
  color: inherit;
  background: transparent;
  font: inherit;
  font-size: .7rem;
  cursor: pointer;
}
.mobile-own-state__controls :deep(.hand-tab) { flex: 1 1 auto; min-width: 0; }
.mobile-hand-sheet__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 12px; }
.mobile-character-sheet__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; }
.mobile-character-sheet__stats div { border: 1px solid var(--color-line); border-radius: 10px; padding: 10px; }
.mobile-character-sheet__stats dt { color: var(--color-text-muted); font-size: .65rem; }
.mobile-character-sheet__stats dd { margin: 3px 0 0; font-size: 1.1rem; font-weight: 800; }
.mobile-character-sheet__tags { color: var(--color-text-secondary); }
</style>
