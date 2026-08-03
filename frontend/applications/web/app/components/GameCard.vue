<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import SemanticButton from "./ui/SemanticButton.vue";
import CardPresentation from "./game/primitives/CardPresentation.vue";
import {
  actionLabel,
  type CardActionBinding,
  type CardActionState,
} from "./actionModel";

const props = withDefaults(defineProps<{
  card: CardView;
  choice?: boolean;
  contentSetId: string;
  compact?: boolean;
  encounter?: boolean;
  encounterPeekSide?: "previous" | "next";
  imageUrl?: string;
  actionBindings?: CardActionBinding[];
  actionState?: CardActionState;
  motionState?: "confirmed";
  showMeta?: boolean;
}>(), {
  compact: false,
  encounter: false,
  encounterPeekSide: undefined,
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
  <CardPresentation
    class="game-card"
    :class="{'game-card--compact': compact}"
    :card="card"
    :choice="choice"
    :compact="compact"
    :encounter="encounter"
    :encounter-peek-side="encounterPeekSide"
    :image-url="resolvedImageURL"
    :show-meta="showMeta"
    :data-action-state="actionState"
    :data-motion="motionState"
  >
    <template v-if="actionBindings.length" #actions>
      <div class="game-card__actions">
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
        <span v-if="actionState === 'selected'" class="game-card__action-state">
          Действия карты открыты ниже
        </span>
        <span v-else-if="actionState === 'confirmed'" class="game-card__action-state">
          Состояние подтверждено сервером
        </span>
      </div>
    </template>
  </CardPresentation>
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

.game-card--compact .game-card__actions :deep(.semantic-button) {
  min-height: 2.5rem;
  padding: .4rem .35rem;
  font-size: .62rem;
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
  choice: false,
