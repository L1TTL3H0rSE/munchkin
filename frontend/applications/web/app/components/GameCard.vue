<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import SemanticButton from "./ui/SemanticButton.vue";
import CardArtPlaceholder from "./game/primitives/CardArtPlaceholder.vue";
import CardFrame from "./game/primitives/CardFrame.vue";
import {
  actionLabel,
  type CardActionBinding,
  type CardActionState,
} from "./actionModel";

const props = withDefaults(defineProps<{
  card: CardView;
  contentSetId: string;
  compact?: boolean;
  imageUrl?: string;
  actionBindings?: CardActionBinding[];
  actionState?: CardActionState;
  motionState?: "confirmed";
  showMeta?: boolean;
}>(), {
  compact: false,
  imageUrl: "",
  actionBindings: () => [],
  actionState: "idle" as CardActionState,
  motionState: undefined,
  showMeta: false,
});

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
}>();

const api = useGameApi();
const resolvedImageURL = computed(() => {
  if (props.imageUrl) {
    return props.imageUrl;
  }
  return props.card.image
    ? api.contentAssetURL(props.contentSetId, props.card.image)
    : "";
});

const activateCopy = computed(() => {
  const [binding] = props.actionBindings;
  if (props.actionBindings.length === 1 && binding?.mode === "direct") {
    return actionLabel(binding.action);
  }
  return "Выбрать действие";
});

const actionButtonDisabled = computed(() =>
  props.actionState === "disabled" || props.actionState === "pending",
);

function activate() {
  const [binding] = props.actionBindings;
  if (binding && !actionButtonDisabled.value) {
    emit("activate", binding);
  }
}
</script>

<template>
  <CardFrame
    class="game-card"
    :class="{'game-card--compact': compact}"
    :deck="card.deck"
    :compact="compact"
    :aria-label="card.name"
    :data-action-state="actionState"
    :data-motion="motionState"
  >
    <template #header>
      <header class="game-card__header">
        <div v-if="showMeta" class="game-card__meta">
          <span class="game-card__deck">
            {{ card.deck === "door" ? "Дверь" : "Сокровище" }}
          </span>
          <small>{{ card.kind.replaceAll("_", " ") }}</small>
        </div>
        <div v-if="actionBindings.length" class="game-card__actions">
          <SemanticButton
            class="game-card__activate"
            variant="secondary"
            :busy="actionState === 'pending'"
            :disabled="actionButtonDisabled"
            :aria-label="`${card.name}: ${activateCopy}`"
            @click="activate"
          >
            {{ actionState === "pending" ? "Отправляем…" : activateCopy }}
          </SemanticButton>
          <span
            v-if="actionState === 'selected'"
            class="game-card__action-state"
          >
            Действия карты открыты ниже
          </span>
          <span
            v-else-if="actionState === 'confirmed'"
            class="game-card__action-state"
          >
            Состояние подтверждено сервером
          </span>
        </div>
      </header>
    </template>

    <template #art>
      <img
        v-if="resolvedImageURL"
        class="game-card__image"
        :src="resolvedImageURL"
        :alt="card.alt_text || card.name"
      >
      <CardArtPlaceholder
        v-else
        :label="`Иллюстрация для карты «${card.name}» пока не создана`"
      />
    </template>

    <div class="game-card__copy">
      <h3 class="game-card__name">{{ card.name }}</h3>
      <div
        v-if="card.combat_strength || card.bonus || card.value !== undefined"
        class="game-card__stats"
      >
        <span v-if="card.combat_strength">Сила {{ card.combat_strength }}</span>
        <span v-if="card.bonus">Бонус +{{ card.bonus }}</span>
        <span v-if="card.value !== undefined">{{ card.value }} голдов</span>
      </div>
      <p v-if="card.rules_text" class="game-card__rules">
        {{ card.rules_text }}
      </p>
      <p v-if="card.flavor_text && !compact" class="game-card__flavor">
        {{ card.flavor_text }}
      </p>
    </div>

    <template
      v-if="card.kind === 'monster' && (card.levels_reward !== undefined || card.treasure_count !== undefined)"
      #footer
    >
      <div class="game-card__reward-footer">
        <span>
          {{ card.levels_reward === undefined ? "—" : `+${card.levels_reward} уровень` }}
        </span>
        <span>
          {{ card.treasure_count === undefined ? "—" : `${card.treasure_count} сокровищ` }}
        </span>
      </div>
    </template>
  </CardFrame>
</template>

<style scoped lang="scss">
@use "../assets/scss/api" as api;

.game-card {
  scroll-snap-align: start;
  transition:
    border-color var(--duration-quick) var(--easing-enter),
    box-shadow var(--duration-quick) var(--easing-enter),
    opacity var(--duration-quick) var(--easing-enter);
}

.game-card__image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.game-card__header {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.game-card__meta {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--color-text-muted);
}

.game-card__deck,
.game-card__meta small {
  font-size: .64rem;
  font-weight: 900;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.game-card__deck {
  color: var(--card-accent);
}

.game-card__meta small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-card__actions {
  min-width: 0;
  display: grid;
  gap: var(--space-1);
}

.game-card__actions :deep(.semantic-button) {
  width: 100%;
  min-height: 2.75rem;
  border-color: var(--card-accent);
  color: var(--color-text);
  background: color-mix(in srgb, var(--card-accent), var(--color-paper) 72%);
}

.game-card__action-state {
  color: var(--color-text-muted);
  font-size: .68rem;
  line-height: 1.25;
  text-align: center;
}

.game-card__copy {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) 0;
}

.game-card__name {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 1.08rem;
  line-height: 1.08;
}

.game-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.game-card__stats span {
  border: 1px solid var(--card-accent-deep);
  padding: .18rem .32rem;
  color: var(--card-accent-deep);
  font-size: .62rem;
  font-weight: 800;
  line-height: 1.15;
}

.game-card__rules,
.game-card__flavor {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.36;
}

.game-card__rules {
  font-size: .76rem;
}

.game-card__flavor {
  color: var(--color-text-muted);
  font-size: .68rem;
  font-style: italic;
  line-height: 1.3;
}

.game-card__reward-footer {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--card-accent-deep);
  font-size: .72rem;
  font-weight: 900;
}

.game-card[data-action-state="available"] {
  box-shadow:
    0 12px 24px rgb(31 52 42 / 18%),
    0 0 0 3px color-mix(in srgb, var(--card-accent), transparent 55%);
}

.game-card[data-action-state="selected"] {
  outline: 3px solid var(--card-accent);
  outline-offset: 4px;
}

.game-card[data-action-state="pending"] {
  border-color: var(--color-info);
  opacity: .8;
}

.game-card[data-action-state="disabled"] {
  filter: grayscale(.55);
  opacity: .68;
}

.game-card[data-motion="confirmed"] {
  animation: game-card-confirmed var(--duration-standard) var(--easing-enter) both;
}

.game-card--compact .game-card__header {
  gap: var(--space-1);
}

.game-card--compact .game-card__actions :deep(.semantic-button) {
  min-height: 2.5rem;
  padding: .4rem .35rem;
  font-size: .62rem;
}

.game-card--compact .game-card__meta small,
.game-card--compact .game-card__deck {
  font-size: .5rem;
}

.game-card--compact .game-card__copy {
  gap: var(--space-1);
  padding-inline: .35rem;
}

.game-card--compact .game-card__name {
  font-size: .78rem;
}

.game-card--compact .game-card__stats span {
  padding: .12rem .2rem;
  font-size: .5rem;
}

.game-card--compact .game-card__rules {
  font-size: .58rem;
  line-height: 1.28;
}

.game-card--compact .game-card__flavor {
  display: none;
}

.game-card--compact .game-card__reward-footer {
  font-size: .56rem;
}

@keyframes game-card-confirmed {
  0% { transform: translateY(.35rem); }
  100% { transform: translateY(0); }
}

@include api.reduced-motion {
  .game-card[data-motion="confirmed"] {
    animation: none;
    outline: 3px solid var(--color-success);
    outline-offset: 3px;
  }
}
</style>
