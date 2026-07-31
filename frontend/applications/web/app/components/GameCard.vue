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

<style scoped>
.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.game-card {
  --card-accent: #ef6d34;
  --card-accent-deep: #71321f;
  --card-route: #ff9a6f;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  width: min(310px, 100%);
  min-height: 430px;
  padding: .72rem;
  display: grid;
  grid-template-rows: auto auto minmax(160px, 1fr) auto;
  gap: .55rem;
  color: #1c1c18;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--card-accent), #171811 60%), #171811 38%),
    #171811;
  clip-path: polygon(0 18px, 18px 0, calc(100% - 34px) 0, 100% 28px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 26px 100%, 0 calc(100% - 30px));
  filter: drop-shadow(0 14px 22px rgb(0 0 0 / 32%));
  transition:
    border-color var(--duration-quick) var(--easing-enter),
    filter var(--duration-quick) var(--easing-enter),
    opacity var(--duration-quick) var(--easing-enter);
}

.game-card::before {
  content: "";
  position: absolute;
  z-index: -2;
  inset: 0;
  color: var(--card-route);
  background: url("../assets/card-frame-motif.svg") center / cover;
  opacity: .16;
  transform: rotate(-1.5deg) scale(1.04);
}

.game-card::after {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 5px;
  border: 2px solid color-mix(in srgb, var(--card-accent), white 16%);
  clip-path: polygon(0 15px, 15px 0, calc(100% - 31px) 0, 100% 25px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 23px 100%, 0 calc(100% - 27px));
  pointer-events: none;
}

.game-card--door {
  --card-accent: #c8ef36;
  --card-accent-deep: #50620d;
  --card-route: #e6ff77;
}

.game-card--treasure {
  --card-accent: #f07136;
  --card-accent-deep: #74321d;
  --card-route: #ffad72;
}

.game-card__route {
  position: absolute;
  z-index: 3;
  top: 3.2rem;
  right: -.15rem;
  display: grid;
  gap: .22rem;
}

.game-card__route i {
  width: 1.5rem;
  height: .22rem;
  display: block;
  background: var(--card-accent);
}

.game-card__route i:nth-child(2) { width: 2.1rem; transform: translateX(-.6rem); }
.game-card__route i:nth-child(3) { width: .9rem; transform: translateX(.25rem); }

.game-card__header {
  min-width: 0;
  padding: .2rem .35rem .05rem;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: .5rem;
  color: #f8f2df;
}

.game-card__actions {
  position: relative;
  z-index: 5;
  min-width: 0;
  display: grid;
  gap: .3rem;
}

.game-card__activate {
  width: 100%;
  min-height: 2.75rem;
  padding: .55rem .65rem;
  border-color: var(--card-accent);
  color: #15160e;
  background: var(--card-accent);
  font-size: .68rem;
  line-height: 1.15;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.game-card__activate:disabled {
  color: var(--ink);
  background: color-mix(in srgb, var(--card-accent), #15160e 65%);
  cursor: wait;
  opacity: 1;
}

.game-card__action-state {
  color: var(--muted);
  font-size: .62rem;
  line-height: 1.25;
  text-align: center;
}

.game-card[data-action-state="available"] {
  filter: drop-shadow(0 14px 22px rgb(0 0 0 / 32%))
    drop-shadow(0 0 0.75rem color-mix(in srgb, var(--card-accent), transparent 62%));
}

.game-card[data-action-state="selected"] {
  outline: 3px solid var(--card-accent);
  outline-offset: 4px;
}

.game-card[data-action-state="pending"] {
  border-color: var(--color-info);
  filter: drop-shadow(0 10px 16px rgb(0 0 0 / 35%));
}

.game-card[data-action-state="disabled"] {
  filter: grayscale(.7) drop-shadow(0 8px 14px rgb(0 0 0 / 30%));
  opacity: .7;
}

.game-card[data-motion="confirmed"] {
  animation: card-confirmed var(--duration-standard) var(--easing-enter) both;
}

@keyframes card-confirmed {
  0% { transform: translateY(.35rem); }
  100% { transform: translateY(0); }
}

.game-card__deck,
.game-card small {
  font-size: .64rem;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: .12em;
}

.game-card__deck { color: var(--card-accent); }

.game-card small {
  overflow: hidden;
  color: #c9c4b3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-card__illustration {
  position: relative;
  min-height: 0;
  aspect-ratio: 2 / 2.35;
  overflow: hidden;
  border: 2px solid var(--card-accent);
  background: #10110d;
  clip-path: polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%);
}

.game-card__illustration::after {
  content: "";
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 5px rgb(17 18 13 / 42%);
  pointer-events: none;
}

.game-card__illustration-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--card-accent);
  background:
    radial-gradient(circle at 70% 26%, currentColor 0 5%, transparent 5.5%),
    linear-gradient(35deg, transparent 0 43%, currentColor 43.5% 45%, transparent 45.5%),
    linear-gradient(145deg, color-mix(in srgb, var(--card-accent-deep), #15160f 48%), #15160f);
}

.game-card__illustration-fallback::before,
.game-card__illustration-fallback::after,
.game-card__illustration-fallback span {
  content: "";
  position: absolute;
  border: 2px solid currentColor;
  transform: rotate(45deg);
}

.game-card__illustration-fallback::before {
  width: 34%;
  aspect-ratio: 1;
}

.game-card__illustration-fallback::after {
  width: 18%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(52%, -48%);
}

.game-card__illustration-fallback span {
  width: 55%;
  height: 22%;
  border-width: 0 0 2px;
  transform: rotate(-18deg);
}

.card-copy {
  position: relative;
  min-width: 0;
  margin-top: -.95rem;
  padding: 1.15rem .78rem .7rem;
  display: grid;
  gap: .52rem;
  background:
    linear-gradient(115deg, transparent 0 12px, #eee8d7 12.5px) top left / 100% 100% no-repeat;
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--card-accent-deep), transparent 8%);
}

.game-card__name {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  font-size: 1.08rem;
  line-height: 1.05;
  letter-spacing: -.025em;
}

.card-stats {
  display: flex;
  flex-wrap: wrap;
  gap: .28rem;
}

.card-stats span {
  border: 1px solid var(--card-accent-deep);
  padding: .18rem .32rem;
  color: var(--card-accent-deep);
  font-size: .62rem;
  font-weight: 800;
  line-height: 1.15;
}

.card-rules {
  margin: 0;
  font-size: .76rem;
  line-height: 1.36;
}

.card-flavor {
  margin: 0;
  color: #686454;
  font-size: .68rem;
  font-style: italic;
  line-height: 1.3;
}

.game-card__notches {
  position: absolute;
  z-index: 4;
  right: .35rem;
  bottom: .4rem;
  width: 1.9rem;
  height: .35rem;
  border-top: 2px solid var(--card-accent);
  border-bottom: 2px solid var(--card-accent);
  transform: skewX(-28deg);
}

.game-card--compact {
  flex: 0 0 178px;
  width: 178px;
  min-height: 272px;
  padding: .48rem;
  grid-template-rows: auto auto 112px auto;
  gap: .35rem;
  clip-path: polygon(0 11px, 11px 0, calc(100% - 22px) 0, 100% 17px, 100% calc(100% - 11px), calc(100% - 11px) 100%, 16px 100%, 0 calc(100% - 19px));
}

.game-card--compact::after { inset: 3px; border-width: 1px; }
.game-card--compact .game-card__header { padding-inline: .2rem; }
.game-card--compact .game-card__activate { min-height: 2.5rem; padding: .38rem .35rem; font-size: .58rem; }
.game-card--compact .game-card__deck,
.game-card--compact small { font-size: .5rem; }
.game-card--compact .game-card__illustration { aspect-ratio: auto; }
.game-card--compact .card-copy { margin-top: -.65rem; padding: .85rem .5rem .45rem; gap: .35rem; box-shadow: 3px 3px 0 var(--card-accent-deep); }
.game-card--compact .game-card__name { font-size: .78rem; }
.game-card--compact .card-stats span { font-size: .5rem; padding: .12rem .2rem; }
.game-card--compact .card-rules { font-size: .58rem; line-height: 1.28; }
.game-card--compact .card-flavor { display: none; }

@media (prefers-reduced-motion: reduce) {
  .game-card[data-motion="confirmed"] {
    animation: none;
    outline: 3px solid var(--color-success);
    outline-offset: 3px;
  }
}
</style>
