<script setup lang="ts">
import type {Projection} from "@munchkin/contracts";
import GameCard from "../../GameCard.vue";
import SheetDialog from "../../ui/SheetDialog.vue";
import {publicCardsForOpponent} from "../gameTableViewModel";
import {opponentStatus, opponentStatusLabel} from "../gamePresentationModel";

const props = defineProps<{projection: Projection}>();
const selectedPlayerID = ref("");
const selectedPlayer = computed(() => props.projection.players.find((player) =>
  player.player_id === selectedPlayerID.value,
));
</script>

<template>
  <section
    v-if="projection.players.length"
    class="mobile-opponents"
    data-figma-region="mobile-opponents"
    data-figma-node="92:32"
    :data-count="Math.min(projection.players.length, 3)"
    aria-label="Соперники"
  >
    <div class="mobile-opponents__rail" role="list">
      <button
        v-for="player in projection.players.slice(0, 3)"
        :key="player.player_id"
        class="mobile-opponent-chip"
        :class="{'mobile-opponent-chip--current': projection.turn.player_id === player.player_id}"
        type="button"
        role="listitem"
        :aria-label="`Информация об игроке ${player.name}`"
        @click="selectedPlayerID = player.player_id"
      >
        <span class="mobile-opponent-chip__copy">
          <strong>{{ player.name }}</strong>
          <small>· {{ player.level }}</small>
        </span>
      </button>
    </div>

    <SheetDialog
      v-if="selectedPlayer"
      :open="Boolean(selectedPlayer)"
      :title="selectedPlayer.name"
      :description="`Уровень ${selectedPlayer.level} · ${selectedPlayer.hand_count} карт в руке · ${opponentStatusLabel(opponentStatus(projection, selectedPlayer))}`"
      v-bind="{titleID: 'mobile-opponent-info-title'}"
      data-figma-node="185:1742"
      @close="selectedPlayerID = ''"
    >
      <div
        v-if="publicCardsForOpponent(selectedPlayer).length"
        class="mobile-opponent-info__cards"
        role="list"
        aria-label="Открытые карты игрока"
      >
        <GameCard
          v-for="card in publicCardsForOpponent(selectedPlayer)"
          :key="card.instance_id"
          :card="card"
          :content-set-id="projection.content_set_id"
          compact
          role="listitem"
        />
      </div>
      <p v-else class="mobile-opponent-info__empty" role="status">Нет открытых карт.</p>
    </SheetDialog>
  </section>
</template>

<style scoped lang="scss">
.mobile-opponents { min-width: 0; }
.mobile-opponents__rail { min-width: 0; display: flex; gap: 8px; }
.mobile-opponent-chip {
  flex: 0 0 calc((100% - 16px) / 3);
  width: calc((100% - 16px) / 3);
  min-width: 0;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--color-text-primary);
  background: var(--color-surface);
  font: inherit;
  cursor: pointer;
}
.mobile-opponents[data-count="1"] .mobile-opponent-chip { flex-basis: 100%; width: 100%; }
.mobile-opponents[data-count="2"] .mobile-opponent-chip { flex-basis: calc((100% - 8px) / 2); width: calc((100% - 8px) / 2); }
.mobile-opponent-chip--current { border-color: var(--color-accent-strong); box-shadow: inset 0 -2px var(--color-accent-strong); }
.mobile-opponent-chip__copy { min-width: 0; display: flex; align-items: baseline; gap: 4px; }
.mobile-opponent-chip__copy strong,
.mobile-opponent-chip__copy small { overflow: hidden; font-size: 11px; line-height: 14px; text-overflow: ellipsis; white-space: nowrap; }
.mobile-opponent-chip__copy small { flex: 0 0 auto; color: var(--color-text-muted); }
.mobile-opponent-info__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.mobile-opponent-info__empty { color: var(--color-text-muted); }
</style>
