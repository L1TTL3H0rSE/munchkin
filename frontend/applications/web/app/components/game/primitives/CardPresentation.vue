<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";
import CardArtPlaceholder from "./CardArtPlaceholder.vue";
import CardFrame from "./CardFrame.vue";

defineOptions({inheritAttrs: false});

const props = withDefaults(defineProps<{
  card: CardView;
  choice?: boolean;
  compact?: boolean;
  encounter?: boolean;
  encounterPeekSide?: "previous" | "next";
  imageUrl?: string;
  showMeta?: boolean;
}>(), {
  choice: false,
  compact: false,
  encounter: false,
  encounterPeekSide: undefined,
  imageUrl: "",
  showMeta: false,
});

const encounterTitle = computed(() =>
  props.card.kind === "curse" && !/^проклятие/iu.test(props.card.name)
    ? `Проклятие! ${props.card.name}`
    : props.card.name,
);

const choiceKind = computed(() => {
  if (props.card.kind === "one_shot") {
    return "Одноразовая";
  }
  if (props.card.kind === "item") {
    return props.card.item_size === "big" ? "Большая вещь" : "Вещь";
  }
  if (props.card.kind === "monster") {
    return "Монстр";
  }
  if (props.card.kind === "curse") {
    return "Проклятие";
  }
  return props.card.kind.replaceAll("_", " ");
});

const choiceMeta = computed(() => [
  choiceKind.value,
  props.card.value !== undefined ? String(props.card.value) : "",
].filter(Boolean).join(" · "));
</script>

<template>
  <article
    v-if="encounterPeekSide"
    v-bind="$attrs"
    class="card-presentation encounter-peek"
    :data-side="encounterPeekSide"
    :data-kind="card.kind"
    data-figma-node="99:18"
    :aria-label="card.name"
  >
    <div class="encounter-peek__art">
      <img
        v-if="imageUrl"
        class="encounter-peek__image"
        :src="imageUrl"
        :alt="card.alt_text || card.name"
      >
      <span
        v-if="card.kind === 'monster' && card.combat_strength !== undefined"
        class="encounter-peek__level"
      >
        {{ card.combat_strength }}
      </span>
      <h3 class="encounter-peek__title">{{ encounterTitle }}</h3>
    </div>
    <div class="encounter-peek__body">
      Открой карту, чтобы прочитать правила.
    </div>
  </article>

  <article
    v-else-if="encounter"
    v-bind="$attrs"
    class="card-presentation encounter-card-presentation"
    :class="{'card-frame--compact': compact}"
    :data-kind="card.kind"
    data-figma-node="96:30"
    :aria-label="card.name"
  >
    <div class="encounter-card-presentation__art card-frame__art">
      <img
        v-if="imageUrl"
        class="encounter-card-presentation__image"
        :src="imageUrl"
        :alt="card.alt_text || card.name"
      >
      <span v-else class="encounter-card-presentation__placeholder" role="img" :aria-label="`Иллюстрация для карты «${card.name}» пока не создана`">
        ИЛЛЮСТРАЦИЯ КАРТЫ
      </span>
      <span
        v-if="card.kind === 'monster' && card.combat_strength !== undefined"
        class="encounter-card-presentation__level"
        :aria-label="`Уровень монстра ${card.combat_strength}`"
      >
        {{ card.combat_strength }}
      </span>
      <h3 class="encounter-card-presentation__title">
        {{ encounterTitle }}
      </h3>
    </div>

    <div class="encounter-card-presentation__body card-frame__content">
      <p v-if="card.rules_text" class="encounter-card-presentation__rules">
        {{ card.rules_text }}
      </p>
      <div
        v-if="card.kind === 'monster' && (card.levels_reward !== undefined || card.treasure_count !== undefined)"
        class="encounter-card-presentation__rewards"
      >
        <span>{{ card.levels_reward === undefined ? "—" : `+${card.levels_reward} уровень` }}</span>
        <span>{{ card.treasure_count === undefined ? "—" : `${card.treasure_count} ${card.treasure_count === 1 ? "сокровище" : "сокровища"}` }}</span>
      </div>
    </div>
  </article>

  <article
    v-else-if="choice"
    v-bind="$attrs"
    class="card-presentation choice-card-presentation"
    :data-kind="card.kind"
    data-figma-node="110:29"
    :aria-label="card.name"
  >
    <div class="choice-card-presentation__art">
      <img
        v-if="imageUrl"
        class="choice-card-presentation__image"
        :src="imageUrl"
        :alt="card.alt_text || card.name"
      >
      <span v-else>ИЛЛЮСТРАЦИЯ</span>
    </div>
    <div class="choice-card-presentation__body">
      <h3>{{ card.name }}</h3>
      <p class="choice-card-presentation__meta">{{ choiceMeta }}</p>
      <p v-if="card.rules_text">{{ card.rules_text }}</p>
    </div>
    <slot name="actions" />
  </article>

  <CardFrame
    v-else
    v-bind="$attrs"
    class="card-presentation"
    :deck="card.deck"
    :kind="card.kind"
    :compact="compact"
    :aria-label="card.name"
  >
    <template v-if="showMeta || $slots.actions" #header>
      <header class="card-presentation__header">
        <div v-if="showMeta" class="card-presentation__meta">
          <span>{{ card.deck === "door" ? "Дверь" : "Сокровище" }}</span>
          <small>{{ card.kind.replaceAll("_", " ") }}</small>
        </div>
        <slot name="actions" />
      </header>
    </template>
    <template #art>
      <img v-if="imageUrl" class="card-presentation__image" :src="imageUrl" :alt="card.alt_text || card.name">
      <CardArtPlaceholder v-else :label="`Иллюстрация для карты «${card.name}» пока не создана`" />
    </template>
    <div class="card-presentation__copy game-card__copy">
      <h3 class="card-presentation__name game-card__name">{{ card.name }}</h3>
      <div v-if="card.combat_strength || card.bonus || card.value !== undefined" class="card-presentation__stats game-card__stats">
        <span v-if="card.combat_strength">Сила {{ card.combat_strength }}</span>
        <span v-if="card.bonus">Бонус +{{ card.bonus }}</span>
        <span v-if="card.value !== undefined">{{ card.value }} голдов</span>
      </div>
      <p v-if="card.rules_text" class="card-presentation__rules game-card__rules">{{ card.rules_text }}</p>
    </div>
  </CardFrame>
</template>

<style scoped lang="scss">
.encounter-peek {
  position: relative;
  width: 208px;
  height: 330px;
  min-height: 330px;
  overflow: hidden;
  box-sizing: border-box;
  border: 2px solid var(--color-border-card);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-surface-card, #fff9ef);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
}

.encounter-peek__art {
  position: absolute;
  top: -2px;
  left: -2px;
  width: 208px;
  height: 198px;
  overflow: hidden;
  background: linear-gradient(112.22deg, #c8d7cf 2%, #879a92 102%);
}

.encounter-peek__image { width: 100%; height: 100%; display: block; object-fit: cover; }
.encounter-peek__level {
  position: absolute;
  z-index: 2;
  top: 14px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border: 2px solid var(--color-border-card);
  border-radius: 999px;
  color: var(--color-action-response);
  background: var(--color-surface-card, #fff9ef);
  font-family: var(--font-meta);
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
}
.encounter-peek[data-side="previous"] .encounter-peek__level { left: 166px; }
.encounter-peek[data-side="next"] .encounter-peek__level { left: 10px; }
.encounter-peek__title {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 48px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  padding: 0 14px;
  color: #fff;
  background: rgb(40 49 46 / 82%);
  font-family: var(--font-card);
  font-size: 19px;
  font-weight: 600;
  line-height: 24px;
  white-space: nowrap;
}
.encounter-peek[data-kind="curse"] .encounter-peek__title { background: var(--color-danger, #9a463d); }
.encounter-peek__body {
  position: absolute;
  top: 196px;
  left: -2px;
  width: 208px;
  height: 132px;
  box-sizing: border-box;
  overflow: hidden;
  padding: 14px;
  color: var(--color-text-secondary);
  background: var(--color-surface-card, #fff9ef);
  font-family: var(--font-card);
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

.encounter-card-presentation {
  position: relative;
  width: 240px;
  height: 400px;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--color-border-card);
  border-radius: 16px;
  color: var(--color-text-primary);
  background: var(--color-surface-card, #fff9ef);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
}

.encounter-card-presentation__art {
  position: relative;
  flex: 0 0 236px;
  width: 240px;
  height: 236px;
  overflow: hidden;
  border: 0;
  background: linear-gradient(111.58deg, #c8d7cf 2%, #879a92 102%);
}

.encounter-card-presentation__image { width: 100%; height: 100%; display: block; object-fit: cover; }
.encounter-card-presentation__placeholder {
  position: absolute;
  top: 104px;
  left: 60px;
  color: rgb(255 255 255 / 78%);
  font-family: var(--font-meta);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  letter-spacing: .72px;
  white-space: nowrap;
}

.encounter-card-presentation__level {
  position: absolute;
  z-index: 2;
  top: 14px;
  left: 14px;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border: 3px solid var(--color-border-card);
  border-radius: 999px;
  color: var(--color-action-response);
  background: var(--color-surface-card, #fff9ef);
  font-family: var(--font-meta);
  font-size: 20px;
  font-weight: 700;
  line-height: 23px;
}

.encounter-card-presentation__title {
  position: absolute;
  z-index: 1;
  right: 0;
  bottom: 0;
  left: 0;
  height: 56px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  padding: 4px 16px;
  color: #fff;
  background: rgb(40 49 46 / 82%);
  font-family: var(--font-card);
  font-size: 19px;
  font-weight: 600;
  line-height: 24px;
}

.encounter-card-presentation[data-kind="curse"] .encounter-card-presentation__title {
  background: var(--color-danger, #9a463d);
}

.encounter-card-presentation__body {
  flex: 0 0 164px;
  width: 240px;
  height: 164px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 14px 16px;
  background: var(--color-surface-card, #fff9ef);
}

.encounter-card-presentation__rules {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--color-text-primary);
  font-family: var(--font-card);
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
}

.encounter-card-presentation__rewards {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  color: var(--color-text-secondary);
  font-family: var(--font-meta);
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  white-space: nowrap;
}

.choice-card-presentation {
  position: relative;
  flex: 0 0 150px;
  width: 150px;
  height: 218px;
  min-height: 218px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  color: var(--color-text-primary);
  background: var(--color-surface-card, #fff9ef);
  box-shadow: 0 7px 18px rgb(59 46 40 / 14%);
}
.choice-card-presentation__art {
  position: relative;
  flex: 0 0 92px;
  width: 150px;
  height: 92px;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: rgb(255 255 255 / 76%);
  background: linear-gradient(122.38deg, #c8d7cf 2%, #879a92 102%);
  font-family: var(--font-meta);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  letter-spacing: .72px;
}
.choice-card-presentation__image { width: 100%; height: 100%; display: block; object-fit: cover; }
.choice-card-presentation__body {
  flex: 0 0 126px;
  width: 150px;
  height: 126px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  box-sizing: border-box;
  padding: 10px;
}
.choice-card-presentation__body h3,
.choice-card-presentation__body p { margin: 0; }
.choice-card-presentation__body h3 {
  overflow: hidden;
  font-family: var(--font-meta);
  font-size: 11px;
  font-weight: 500;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.choice-card-presentation__body p {
  display: -webkit-box;
  overflow: hidden;
  font-family: var(--font-meta);
  font-size: 10px;
  font-weight: 500;
  line-height: 14px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.choice-card-presentation__body .choice-card-presentation__meta {
  color: var(--color-text-muted);
  font-size: 9px;
  font-weight: 600;
  line-height: 12px;
  letter-spacing: .72px;
  text-transform: none;
  -webkit-line-clamp: 1;
}
.choice-card-presentation :deep(.game-card__actions) {
  position: absolute;
  z-index: 2;
  inset: 0;
}
.choice-card-presentation :deep(.game-card__activate) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0;
  opacity: 0;
}
.choice-card-presentation :deep(.game-card__action-state) { display: none; }
.choice-card-presentation[data-action-state="available"] { border-color: var(--color-action-primary); }
.choice-card-presentation[data-action-state="selected"] { outline: 3px solid var(--color-action-primary); outline-offset: -3px; }
.choice-card-presentation[data-action-state="disabled"] { opacity: .58; }

.card-presentation__header,
.card-presentation__copy { min-width: 0; display: grid; gap: 8px; }
.card-presentation__meta,
.card-presentation__stats { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.card-presentation__meta { color: var(--color-text-muted); font-size: .64rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.card-presentation__image { width: 100%; height: 100%; display: block; object-fit: cover; }
.card-presentation__name,
.card-presentation__rules { margin: 0; overflow-wrap: anywhere; }
.card-presentation__name { font-family: var(--font-card); font-size: 1.08rem; line-height: 1.2; }
.card-presentation__stats { justify-content: start; flex-wrap: wrap; }
.card-presentation__stats span { border: 1px solid var(--card-accent-deep); padding: .18rem .32rem; color: var(--card-accent-deep); font-size: .62rem; font-weight: 800; }
.card-presentation__rules { display: -webkit-box; overflow: hidden; font-family: var(--font-card); font-size: .7rem; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 5; }
.card-presentation.card-frame--compact .card-presentation__copy { gap: 4px; }
.card-presentation.card-frame--compact .card-presentation__name { font-size: .78rem; }
.card-presentation.card-frame--compact .card-presentation__rules { font-size: .58rem; line-height: 1.28; -webkit-line-clamp: 4; }
</style>
