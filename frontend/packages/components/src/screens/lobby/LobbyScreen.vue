<script setup lang="ts">
import {onMounted, ref} from "vue";
import LobbyForm from "../../components/lobby/LobbyForm.vue";
import type {LobbyFormInput, LobbyFormMode, LobbySubmissionState} from "../../components/lobby/lobbyModel";
const props = withDefaults(defineProps<{
  forms: Record<LobbyFormMode, LobbySubmissionState>;
  initialMode?: LobbyFormMode;
}>(), {initialMode: "create"});
const emit = defineEmits<{submit: [input: LobbyFormInput]}>();
const selectedMode = ref<LobbyFormMode>(props.initialMode);
const interactive = ref(false);
const heroDoorArt = "/munchkin/hero-door.png";
const heroTreasureArt = "/munchkin/hero-treasure.png";
onMounted(() => { interactive.value = true; });
function selectMode(mode: LobbyFormMode): void { selectedMode.value = mode; }
</script>

<template>
  <section
    class="lobby-page"
    aria-labelledby="lobby-page-title"
    data-hydrated="true"
    :data-interactive="interactive ? 'true' : undefined"
  >
    <div class="lobby-page__inner">
      <section
        class="lobby-page__hero"
        aria-labelledby="lobby-page-title"
      >
        <div class="lobby-page__brand-row">
          <a class="lobby-page__brand" href="/" aria-label="Munchkin, на главную">
            MUNCHKIN
          </a>
          <span class="lobby-page__mode-pill">ОНЛАЙН</span>
        </div>
        <div class="lobby-page__hero-copy">
          <h1 id="lobby-page-title">Собери друзей.<br>Начни игру.</h1>
          <p class="lobby-page__lede">
            Создай комнату или войди по приглашению — без лишних экранов и настроек.
          </p>
        </div>
        <div class="lobby-page__hero-cards" aria-hidden="true">
          <div class="lobby-page__hero-card lobby-page__hero-card--door">
            <img :src="heroDoorArt" alt="">
          </div>
          <div class="lobby-page__hero-card lobby-page__hero-card--treasure">
            <img :src="heroTreasureArt" alt="">
          </div>
        </div>
      </section>

      <section
        class="lobby-entry"
        aria-labelledby="lobby-entry-title"
        :data-mode="selectedMode"
      >
        <header class="lobby-entry__header">
          <h2 id="lobby-entry-title">Войти в игру</h2>
          <p>
            <template v-if="selectedMode === 'create'">
              <span class="lobby-entry__description--desktop">
                Создай новую комнату или войди по приглашению.
              </span>
              <span class="lobby-entry__description--mobile">
                Одна короткая форма — выбери, что хочешь сделать.
              </span>
            </template>
            <span v-else>Введи ID комнаты и имя — и можно начинать.</span>
          </p>
        </header>

        <div class="lobby-entry__mode-switch" role="group" aria-label="Режим входа в игру">
          <button
            type="button"
            :aria-pressed="selectedMode === 'create'"
            :class="{'is-selected': selectedMode === 'create'}"
            @click="selectMode('create')"
          >
            Создать
          </button>
          <button
            type="button"
            :aria-pressed="selectedMode === 'join'"
            :class="{'is-selected': selectedMode === 'join'}"
            @click="selectMode('join')"
          >
            Войти
          </button>
        </div>

        <div class="lobby-page__forms" aria-label="Форма комнаты">
        <LobbyForm
          v-show="selectedMode === 'create'"
          mode="create"
          number="01"
          title="Создать комнату"
          description="Откройте новый стол и пригласите друзей по коду."
          compact
          labelled-by="lobby-entry-title"
          :busy="forms['create'].busy"
          :error="forms['create'].error"
          :successful="forms['create'].successful"
          @submit="emit('submit', $event)"
        />
        <LobbyForm
          v-show="selectedMode === 'join'"
          mode="join"
          number="02"
          title="Войти в комнату"
          description="Введите код комнаты, который вам прислали."
          compact
          labelled-by="lobby-entry-title"
          :busy="forms['join'].busy"
          :error="forms['join'].error"
          :successful="forms['join'].successful"
          @submit="emit('submit', $event)"
        />
        </div>

        <p class="lobby-entry__note">
          {{ selectedMode === 'create'
            ? "После создания ты сразу окажешься за столом."
            : "Для входа нужен код комнаты и имя игрока." }}
        </p>
        <p class="lobby-entry__footer-note">
          {{ selectedMode === 'create'
            ? "Для входа по приглашению переключи вкладку «Войти»."
            : "Нет ID? Попроси создателя прислать его ещё раз." }}
        </p>
      </section>
    </div>
  </section>
</template>


<style scoped lang="scss">
@use "../../assets/scss/pages/lobby";
</style>
