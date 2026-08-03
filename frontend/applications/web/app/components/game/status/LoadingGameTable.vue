<script setup lang="ts">
import SystemStateSurface from "./SystemStateSurface.vue";

const opponents = ["Игрок 1", "Игрок 2", "Игрок 3"];
const handCards = ["Запасной план", "Дымовая завеса", "Тяжёлый рюкзак", "Зелье спешки"];
</script>

<template>
  <section class="loading-game-table" aria-label="Загрузка игрового стола" aria-busy="true">
    <header class="loading-game-table__header">
      <span class="loading-game-table__phase">СТАРТ</span>
      <strong>ПОДКЛЮЧЕНИЕ</strong>
      <span class="loading-game-table__online">
        <i aria-hidden="true" /> В СЕТИ
      </span>
      <span class="loading-game-table__version">ХОД 4</span>
    </header>

    <aside class="loading-game-table__roster" aria-label="Соперники загружаются">
      <p class="eyebrow">СОПЕРНИКИ · 3</p>
      <div class="loading-game-table__opponents" role="list">
        <div v-for="opponent in opponents" :key="opponent" role="listitem">
          <strong>{{ opponent }}</strong>
          <span>Состояние загружается</span>
        </div>
      </div>
      <section class="loading-game-table__room" aria-label="Комната">
        <p class="eyebrow">КОМНАТА</p>
        <strong>4 игрока</strong>
        <span>Стол готов</span>
      </section>
    </aside>

    <main class="loading-game-table__main">
      <section class="loading-game-table__stage" aria-labelledby="loading-stage-title">
        <header>
          <h1 id="loading-stage-title">Загружаем игру</h1>
          <p>Получаем актуальное состояние и приватные данные игрока.</p>
        </header>
        <SystemStateSurface kind="loading" />
        <p class="loading-game-table__note">ОБЫЧНО ЭТО ЗАНИМАЕТ НЕСКОЛЬКО СЕКУНД</p>
      </section>

      <section class="loading-game-table__hand" aria-labelledby="loading-hand-title">
        <header>
          <p id="loading-hand-title" class="eyebrow">РУКА · 4</p>
          <span>2 карты доступны сейчас</span>
        </header>
        <div class="loading-game-table__cards" role="list" aria-label="Карты загружаются">
          <div v-for="card in handCards" :key="card" role="listitem">
            <span class="loading-game-table__art">ИЛЛЮСТРАЦИЯ</span>
            <strong>{{ card }}</strong>
            <small>Данные карты загружаются</small>
          </div>
        </div>
      </section>
    </main>

    <aside class="loading-game-table__side" aria-label="Состояние подключения">
      <p class="eyebrow">ПОДКЛЮЧЕНИЕ</p>
      <section class="loading-game-table__connection">
        <p class="eyebrow">ПОДКЛЮЧЕНИЕ</p>
        <h2>Получаем состояние</h2>
        <p>Сессия найдена<br>Ожидаем projection</p>
      </section>
      <section class="loading-game-table__player">
        <p class="eyebrow">ТВОЙ ПЕРСОНАЖ</p>
        <strong>Игрок · уровень —</strong>
        <span>Персонаж загружается</span>
        <small>Экипировка, класс и раса открываются отдельно.</small>
      </section>
      <section class="loading-game-table__actions">
        <p class="eyebrow">ЗАГРУЗКА</p>
        <strong>Действия недоступны</strong>
        <span>Экран откроется автоматически.</span>
        <button type="button" disabled>Загрузка</button>
      </section>
    </aside>
  </section>
</template>

<style scoped lang="scss">
.loading-game-table {
  min-width: 0;
  min-height: 100dvh;
  display: grid;
  gap: 16px;
  padding: 16px;
  color: var(--color-text-primary);
  background: var(--color-canvas);
}

.loading-game-table__header {
  min-width: 0;
  min-height: 56px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  padding: 0 16px;
  background: var(--color-surface);
}

.loading-game-table__header > strong {
  justify-self: center;
  color: var(--color-action-primary);
  font-size: .84rem;
  letter-spacing: .08em;
}

.loading-game-table__phase {
  display: inline-grid;
  place-items: center;
  min-width: 45px;
  height: 25px;
  border-radius: 8px;
  color: #fff9ef;
  background: var(--color-action-response);
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .06em;
}

.loading-game-table__online,
.loading-game-table__version {
  color: var(--color-text-muted);
  font-size: .62rem;
  font-weight: 800;
  letter-spacing: .08em;
}

.loading-game-table__online {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.loading-game-table__online i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
}

.loading-game-table__roster,
.loading-game-table__stage,
.loading-game-table__side {
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.loading-game-table__roster {
  display: grid;
  align-content: start;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 16px;
  padding: 16px 16px 24px;
}

.loading-game-table__roster > .eyebrow,
.loading-game-table__side > .eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: .58rem;
  letter-spacing: .1em;
}

.loading-game-table__opponents {
  display: grid;
  align-content: start;
  gap: 8px;
}

.loading-game-table__opponents > div {
  min-height: 82px;
  display: grid;
  align-content: center;
  gap: 4px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 12px;
  background: var(--color-surface-control);
}

.loading-game-table__opponents strong {
  font-size: .78rem;
}

.loading-game-table__opponents span,
.loading-game-table__room span {
  color: var(--color-text-secondary);
  font-size: .64rem;
}

.loading-game-table__room {
  min-height: 141px;
  display: grid;
  align-content: start;
  gap: 4px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 12px;
  background: var(--color-surface-control);
}

.loading-game-table__room p,
.loading-game-table__room strong,
.loading-game-table__room span {
  margin: 0;
}

.loading-game-table__room strong {
  font-size: .82rem;
}

.loading-game-table__main {
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 278px;
  gap: 16px;
}

.loading-game-table__stage {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 0;
  padding: 16px 23px;
}

.loading-game-table__stage > header h1,
.loading-game-table__stage > header p {
  margin: 0;
}

.loading-game-table__stage > header p {
  margin-top: 4px;
  color: var(--color-text-secondary);
  font-size: .8rem;
}

.loading-game-table__stage :deep(.system-state-surface) {
  width: min(560px, 100%);
  min-height: 250px;
  box-sizing: border-box;
  justify-self: center;
  grid-template-columns: 1fr;
  align-content: center;
  justify-items: center;
  gap: 12px;
  border-top: 1px solid var(--color-line);
  border-radius: 16px;
  padding: 28px;
  text-align: center;
  box-shadow: none;
  margin-top: 58px;
}

.loading-game-table__stage :deep(.system-state-surface__mark),
.loading-game-table__stage :deep(.system-state-surface__skeleton) {
  display: none;
}

.loading-game-table__stage :deep(.system-state-surface__body) {
  display: grid;
  justify-items: center;
}

.loading-game-table__stage :deep(.system-state-surface__eyebrow) {
  display: inline-grid;
  place-items: center;
  min-width: 132px;
  min-height: 28px;
  border-radius: 999px;
  color: var(--color-text-primary);
  background: var(--color-action-primary);
  font-size: .58rem;
}

.loading-game-table__stage :deep(.system-state-surface h1) {
  margin-top: 12px;
  font-size: 1.75rem;
}

.loading-game-table__stage :deep(.system-state-surface__description) {
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: .8rem;
}

.loading-game-table__stage :deep(.system-state-surface__note) {
  margin-top: 12px;
  color: var(--color-action-primary);
  font-size: .8rem;
}

.loading-game-table__note {
  margin: 62px 0 0;
  color: var(--color-text-muted);
  font-size: .62rem;
  font-weight: 800;
  letter-spacing: .08em;
}

.loading-game-table__hand {
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  overflow: hidden;
  border-radius: var(--radius-panel);
  padding: 14px 16px 12px;
  color: #fff9ef;
  background: var(--color-surface-inverse);
}

.loading-game-table__hand > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.loading-game-table__hand > header p,
.loading-game-table__hand > header span {
  margin: 0;
}

.loading-game-table__hand > header .eyebrow {
  color: #b9d8cc;
  font-size: .58rem;
}

.loading-game-table__hand > header span {
  color: #cfc2b1;
  font-size: .62rem;
}

.loading-game-table__cards {
  min-width: 0;
  display: flex;
  justify-content: safe center;
  gap: 16px;
  overflow-x: auto;
  padding: 2px;
}

.loading-game-table__cards > div {
  flex: 0 0 150px;
  min-height: 218px;
  display: grid;
  align-content: start;
  gap: 8px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 8px;
  color: var(--color-text-primary);
  background: var(--color-surface);
}

.loading-game-table__art {
  min-height: 76px;
  display: grid;
  place-items: center;
  color: #fff9ef;
  background: linear-gradient(135deg, #c8d7cf, #879a92);
  font-size: .56rem;
  letter-spacing: .08em;
}

.loading-game-table__cards strong {
  font-family: var(--font-card);
  font-size: .74rem;
}

.loading-game-table__cards small {
  color: var(--color-text-secondary);
  font-size: .58rem;
}

.loading-game-table__side {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 16px;
}

.loading-game-table__connection,
.loading-game-table__actions {
  display: grid;
  align-content: start;
  gap: 10px;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  padding: 16px;
  background: var(--color-surface-control);
}

.loading-game-table__connection {
  min-height: 236px;
  margin-top: 64px;
}

.loading-game-table__connection p,
.loading-game-table__connection h2,
.loading-game-table__actions p,
.loading-game-table__actions strong,
.loading-game-table__actions span {
  margin: 0;
}

.loading-game-table__connection h2 {
  margin-top: 4px;
  font-size: 1.25rem;
}

.loading-game-table__connection > p:last-child,
.loading-game-table__actions span {
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.loading-game-table__player {
  min-height: 188px;
  display: grid;
  align-content: start;
  gap: 8px;
  border-radius: 12px;
  padding: 16px;
  color: #fff9ef;
  background: var(--color-surface-inverse);
}

.loading-game-table__player .eyebrow {
  color: #cfc2b1;
}

.loading-game-table__player strong {
  margin-top: 12px;
  font-family: var(--font-card);
  font-size: 1rem;
}

.loading-game-table__player span,
.loading-game-table__player small {
  color: #cfc2b1;
  font-size: .64rem;
}

.loading-game-table__player small {
  margin-top: 16px;
  line-height: 1.4;
}

.loading-game-table__actions {
  min-height: 204px;
  margin-top: 11px;
}

.loading-game-table__actions .eyebrow {
  color: var(--color-text-muted);
}

.loading-game-table__actions strong {
  margin-top: 12px;
  font-size: .86rem;
}

.loading-game-table__actions button {
  width: 100%;
  min-height: 51px;
  margin-top: auto;
  border: 0;
  border-radius: 12px;
  color: var(--color-text-secondary);
  background: #adc4bb;
  font: inherit;
  font-weight: 800;
}

@media (min-width: 1024px) {
  .loading-game-table {
    grid-template-columns: 248px minmax(0, 768px) 360px;
    grid-template-rows: 56px minmax(0, 1fr);
    width: min(1440px, 100%);
    box-sizing: border-box;
    margin: 0 auto;
  }

  .loading-game-table__header {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .loading-game-table__roster {
    grid-column: 1;
    grid-row: 2;
  }

  .loading-game-table__main {
    grid-column: 2;
    grid-row: 2;
  }

  .loading-game-table__side {
    grid-column: 3;
    grid-row: 2;
  }
}

@media (max-width: 1023px) {
  .loading-game-table__roster,
  .loading-game-table__side,
  .loading-game-table__hand {
    display: none;
  }

  .loading-game-table__main {
    grid-template-rows: minmax(0, 1fr);
  }

  .loading-game-table__stage {
    min-height: calc(100dvh - 104px);
  }

  .loading-game-table__stage :deep(.system-state-surface) {
    margin-top: 16px;
  }

  .loading-game-table__note {
    margin-top: 16px;
  }
}

@media (max-width: 599px) {
  .loading-game-table {
    padding: 12px;
  }

  .loading-game-table__header {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding-inline: 12px;
  }

  .loading-game-table__version {
    display: none;
  }

  .loading-game-table__stage {
    padding: 16px;
  }
}
</style>
