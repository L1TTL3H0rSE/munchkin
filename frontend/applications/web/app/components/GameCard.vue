<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
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
}>(), {
  compact: false,
  imageUrl: "",
  actionBindings: () => [],
  actionState: "idle" as CardActionState,
  motionState: undefined,
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
  <article
    class="game-card"
    :class="[
      `game-card--${card.deck}`,
      {'game-card--compact': compact},
    ]"
    :data-action-state="actionState"
    :data-motion="motionState"
  >
    <div class="game-card__route" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
    <header class="game-card__header">
      <span class="game-card__deck">
        {{ card.deck === "door" ? "Дверь" : "Сокровище" }}
      </span>
      <small>{{ card.kind.replaceAll("_", " ") }}</small>
    </header>
    <div v-if="actionBindings.length" class="game-card__actions">
      <button
        class="game-card__activate"
        type="button"
        :disabled="actionButtonDisabled"
        :aria-label="`${card.name}: ${activateCopy}`"
        @click="activate"
      >
        {{ actionState === "pending" ? "Отправляем…" : activateCopy }}
      </button>
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
    <div class="game-card__illustration">
      <img
        v-if="resolvedImageURL"
        class="card-image"
        :src="resolvedImageURL"
        :alt="card.alt_text || card.name"
      >
      <div
        v-else
        class="game-card__illustration-fallback"
        role="img"
        :aria-label="`Иллюстрация для карты «${card.name}» пока не создана`"
      >
        <span aria-hidden="true" />
      </div>
    </div>
    <div class="card-copy">
      <h3 class="game-card__name">{{ card.name }}</h3>
      <div class="card-stats">
        <span v-if="card.combat_strength">Сила {{ card.combat_strength }}</span>
        <span v-if="card.treasure_count">Сокровища {{ card.treasure_count }}</span>
        <span v-if="card.bonus">Бонус +{{ card.bonus }}</span>
        <span v-if="card.value !== undefined">{{ card.value }} голдов</span>
      </div>
      <p v-if="card.rules_text" class="card-rules">{{ card.rules_text }}</p>
      <p v-if="card.flavor_text && !compact" class="card-flavor">
        {{ card.flavor_text }}
      </p>
    </div>
    <div class="game-card__notches" aria-hidden="true" />
  </article>
</template>
