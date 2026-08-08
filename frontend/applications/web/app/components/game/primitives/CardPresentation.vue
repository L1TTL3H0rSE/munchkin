<script setup lang="ts">
import type {CardView} from "@munchkin/contracts";

defineOptions({inheritAttrs: false});

const props = withDefaults(defineProps<{
  card: CardView;
  variant: "choice" | "encounter";
  imageUrl?: string;
}>(), {
  imageUrl: "",
});

const encounterTitle = computed(() =>
  props.card.kind === "curse" && !/^проклятие/iu.test(props.card.name)
    ? `Проклятие! ${props.card.name}`
    : props.card.name,
);

const choiceKind = computed(() => {
  switch (props.card.kind) {
    case "one_shot": return "Одноразовая";
    case "item": return props.card.item_size === "big" ? "Большая вещь" : "Вещь";
    case "monster": return "Монстр";
    case "curse": return "Проклятие";
    case "class": return "Класс";
    case "race": return "Раса";
    case "trait_attachment": return "Усиление";
    case "level_up": return "Новый уровень";
    case "cheat": return "Исключение";
    default: {
      const exhaustive: never = props.card.kind;
      return exhaustive;
    }
  }
});

const choiceMeta = computed(() => [
  choiceKind.value,
  props.card.value !== undefined ? String(props.card.value) : "",
].filter(Boolean).join(" · "));
</script>

<template>
  <article
    v-if="variant === 'encounter'"
    v-bind="$attrs"
    class="card-presentation encounter-card-presentation"
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
    v-else
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
  </article>

</template>

<style scoped lang="scss">
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
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
