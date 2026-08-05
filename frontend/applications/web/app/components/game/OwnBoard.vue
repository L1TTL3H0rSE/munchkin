<script setup lang="ts">
import type {CardView, Projection} from "@munchkin/contracts";
import type {CardActionBinding, CardActionState} from "../actionModel";
import GameCard from "../GameCard.vue";
import SheetDialog from "../ui/SheetDialog.vue";
import {uniqueCards} from "./gameTableViewModel";
import type {GamePresentationModel} from "./gamePresentationModel";

const props = defineProps<{
  projection: Projection;
  presentationModel: GamePresentationModel;
  bindingsForCard: (cardID: string) => CardActionBinding[];
  stateForCard: (cardID: string) => CardActionState;
  confirmedCardIds: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  activate: [binding: CardActionBinding];
  "open-strength": [];
}>();
const characterOpen = ref(false);
const combat = computed(() => props.projection.turn.combat);
const result = computed(() => props.presentationModel.primary.kind === "result"
  ? props.presentationModel.primary
  : undefined,
);
const isPreparation = computed(() =>
  props.presentationModel.primary.kind === "phase"
  && ["setup", "preparation"].includes(props.presentationModel.primary.family),
);
const isDoorChoice = computed(() => props.presentationModel.primary.kind === "door-choice");
const characterCards = computed<CardView[]>(() => uniqueCards([
  ...props.projection.you.equipped,
  ...props.projection.you.carried,
  ...props.projection.you.traits,
  ...props.projection.you.attachments,
  ...props.projection.you.persistent_curses,
]));

function activate(binding: CardActionBinding) {
  characterOpen.value = false;
  emit("activate", binding);
}
</script>

<template>
  <section
    class="own-board"
    data-figma-region="desktop-player-panel"
    aria-labelledby="own-board-title"
  >
    <section v-if="result" class="own-board__result" aria-labelledby="own-result-title">
      <p id="own-result-title">{{ result.source === "reward" ? "ИТОГ БОЯ" : "РЕЗУЛЬТАТ" }}</p>
      <div class="own-board__result-summary">
        <span>{{ result.source === "reward" ? "ПОЛУЧЕНО" : "РЕЗУЛЬТАТ" }}</span>
        <strong v-if="result.source === 'reward'">+{{ result.levels }} уровень · {{ result.treasures }} карты</strong>
        <strong v-else>{{ result.escaped ? "Успешный побег" : "Побег не удался" }}</strong>
        <p v-if="result.source === 'reward'">
          Сокровища уже находятся в руке.<br>Рука {{ projection.you.hand.length }} / {{ projection.you.hand_limit }}.
        </p>
        <p v-else>
          Бросок: {{ result.roll }}<br>
          Бонус: {{ result.modifier >= 0 ? "+" : "−" }}{{ Math.abs(result.modifier) }}<br>
          Итог: {{ result.total }}
        </p>
      </div>
    </section>

    <section v-else-if="isDoorChoice" class="own-board__result" aria-labelledby="own-door-title">
      <p id="own-door-title">ТЕКУЩИЙ ШАГ</p>
      <div class="own-board__result-summary">
        <span>ШАГ 1 ИЗ 3</span>
        <strong>Открыть дверь</strong>
        <p>Верхняя карта определит продолжение: монстр — бой; проклятие — эффект; остальное — выбор пути.</p>
      </div>
    </section>

    <section v-else-if="isPreparation" class="own-board__result" aria-labelledby="own-preparation-title">
      <p id="own-preparation-title">ПОДГОТОВКА</p>
      <div class="own-board__result-summary">
        <span>ПЕРЕД ОТКРЫТИЕМ ДВЕРИ</span>
        <strong>{{ projection.you.setup_done ? "Персонаж готов" : "Собери персонажа" }}</strong>
        <p>Экипируй подходящие вещи, затем подтверди подготовку доступным действием.</p>
      </div>
    </section>

    <section v-else-if="combat" class="own-board__combat" aria-labelledby="own-strength-title">
      <p id="own-strength-title">РАСЧЁТ БОЯ</p>
      <button class="own-board__strength-button" type="button" @click="emit('open-strength')">
        <strong>{{ combat.player_strength }} : {{ combat.monster_strength }}</strong>
        <span>ОТКРЫТЬ РАСЧЁТ</span>
      </button>
      <div class="own-board__calculation">
        <section>
          <p>ВЫ</p>
          <strong>{{ combat.player_strength }}</strong>
          <span>Уровень {{ projection.you.level }}</span>
          <span>Экипировка и эффекты учтены сервером</span>
        </section>
        <section>
          <p>МОНСТРЫ</p>
          <strong>{{ combat.monster_strength }}</strong>
          <span v-for="monster in combat.monsters" :key="monster.instance_id">
            {{ monster.name }} · {{ monster.combat_strength ?? "—" }}
          </span>
        </section>
      </div>
    </section>

    <section class="own-board__character">
      <div>
        <p>ТВОЙ ПЕРСОНАЖ</p>
        <h2 id="own-board-title">{{ projection.you.name }} · {{ projection.you.level }} уровень</h2>
        <span>{{ projection.you.character_tags.join(" · ") || "Без класса и расы" }}</span>
      </div>
      <p class="own-board__tags">Экипировка, класс и раса открываются отдельно.</p>
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="characterOpen"
        @click="characterOpen = true"
      >
        Персонаж
      </button>
    </section>

    <SheetDialog
      :open="characterOpen"
      title="Персонаж"
      :description="`${projection.you.name} · уровень ${projection.you.level}`"
      v-bind="{titleID: 'character-info-title'}"
      data-figma-node="271:791"
      @close="characterOpen = false"
    >
      <dl class="character-info__stats">
        <div><dt>Сила</dt><dd>{{ projection.you.combat_strength }}</dd></div>
        <div><dt>Побег</dt><dd>{{ projection.you.escape_bonus >= 0 ? "+" : "" }}{{ projection.you.escape_bonus }}</dd></div>
        <div><dt>Рука</dt><dd>{{ projection.you.hand.length }}/{{ projection.you.hand_limit }}</dd></div>
      </dl>
      <p v-if="projection.you.character_tags.length" class="character-info__tags">
        {{ projection.you.character_tags.join(" · ") }}
      </p>
      <div v-if="characterCards.length" class="character-info__cards" role="list" aria-label="Карты персонажа">
        <GameCard
          v-for="card in characterCards"
          :key="card.instance_id"
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
      <p v-else class="character-info__empty" role="status">Нет открытых карт персонажа.</p>
    </SheetDialog>
  </section>
</template>

<style scoped lang="scss">
.own-board {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 16px;
}

.own-board__character,
.own-board__calculation,
.own-board__result-summary {
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 14px;
  background: var(--color-surface-control);
}

.own-board__result { display: grid; gap: 14px; }
.own-board__result > p { margin: 0; color: var(--color-text-muted); font-size: .58rem; font-weight: 800; letter-spacing: .1em; }
.own-board__result-summary {
  min-height: 236px;
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 18px;
}
.own-board__result-summary span { color: var(--color-text-muted); font-size: 11px; font-weight: 600; }
.own-board__result-summary strong { font-size: 20px; line-height: 26px; }
.own-board__result-summary p { margin: 0; color: var(--color-text-secondary); font-size: 14px; line-height: 20px; }

.own-board__combat {
  display: grid;
  justify-items: center;
  gap: 14px;
}

.own-board__combat > p,
.own-board__character p,
.own-board__character h2 { margin: 0; }
.own-board__combat > p,
.own-board__character > div > p { color: var(--color-text-muted); font-size: .58rem; font-weight: 800; letter-spacing: .1em; }

.own-board__strength-button {
  width: 160px;
  height: 48px;
  display: flex;
  align-tiems: center;
  justify-content: center;
  flex-direction: column;
  gap: 1px;
  border: 1px solid #162f31;
  border-radius: 999px;
  color: #fff;
  background: var(--color-info);
  box-shadow: 0 3px 5px rgb(59 46 40 / 18%);
  font: inherit;
  cursor: pointer;
}
.own-board__strength-button strong { font-size: 20px; line-height: 23px; }
.own-board__strength-button span { font-size: 9px; font-weight: 700; letter-spacing: .08em; }

.own-board__calculation {
  width: 100%;
  min-height: 236px;
  box-sizing: border-box;
  display: grid;
  align-content: start;
  gap: 16px;
}
.own-board__calculation section {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 8px;
}
.own-board__calculation section + section { border-top: 1px solid var(--color-line); padding-top: 16px; }
.own-board__calculation p,
.own-board__calculation strong,
.own-board__calculation span { margin: 0; }
.own-board__calculation p { color: var(--color-accent-strong); font-size: .58rem; font-weight: 800; letter-spacing: .08em; }
.own-board__calculation strong { grid-column: 2; grid-row: 1 / span 2; color: var(--color-accent-strong); font-size: 1.1rem; }
.own-board__calculation span { grid-column: 1 / -1; color: var(--color-text-secondary); font-size: .62rem; }

.own-board__character {
  min-height: 188px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-content: start;
  gap: 12px;
  color: #fff9ef;
  background: var(--color-surface-inverse);
}

.own-board__character h2 { margin-top: 4px; font-size: 1.05rem; }
.own-board__character > div > span,
.own-board__tags { color: #cfc2b1; font-size: .68rem; }
.own-board__tags { grid-column: 1 / -1; }
.own-board__character button {
  grid-column: 2;
  grid-row: 1;
  align-self: start;
  min-height: 44px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 12px;
  padding: 8px;
  color: #fff9ef;
  background: rgb(255 255 255 / 6%);
  font: inherit;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  cursor: pointer;
}
.character-info__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0 0 16px; }
.character-info__stats div { border: 1px solid var(--color-line); border-radius: 10px; padding: 10px; }
.character-info__stats dt { color: var(--color-text-muted); font-size: .65rem; }
.character-info__stats dd { margin: 3px 0 0; font-size: 1.1rem; font-weight: 800; }
.character-info__tags { color: var(--color-text-secondary); }
.character-info__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.character-info__empty { color: var(--color-text-muted); }
</style>
