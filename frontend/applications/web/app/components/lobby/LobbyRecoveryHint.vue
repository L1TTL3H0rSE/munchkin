<template>
  <aside class="lobby-recovery" aria-labelledby="lobby-recovery-title">
    <p class="lobby-recovery__eyebrow">ЕСЛИ ВЫ УЖЕ ИГРАЛИ</p>
    <h2 id="lobby-recovery-title">Вернитесь за знакомый стол</h2>
    <p>
      Откройте комнату по её коду и укажите своё имя ещё раз.
    </p>
  </aside>
</template>

<style scoped lang="scss">
@use "../../assets/scss/api" as api;

.lobby-recovery {
  display: grid;
  gap: var(--space-2);
  max-width: 62ch;
  margin: 0;
  padding: 1rem 1.125rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-panel);
  color: var(--color-ink);
  background: color-mix(in srgb, var(--color-surface) 72%, var(--color-canvas));
}
.lobby-recovery h2,
.lobby-recovery p { margin: 0; }
.lobby-recovery h2 { color: var(--color-ink); font-size: 1rem; }
.lobby-recovery__eyebrow {
  color: var(--color-accent-strong);
  font-family: var(--font-meta);
  font-size: .7rem;
  font-weight: 800;
  letter-spacing: .14em;
}

@include api.forced-colors {
  .lobby-recovery { background: Canvas; }
}
</style>
