<template>
  <aside class="lobby-recovery" aria-labelledby="lobby-recovery-title">
    <p class="lobby-recovery__eyebrow">СЕССИЯ ВКЛАДКИ</p>
    <h2 id="lobby-recovery-title">Повторный вход без раскрытия credential</h2>
    <p>
      Гостевой доступ хранится только в sessionStorage этой вкладки. Credential
      не попадает в URL, SSR и сообщения об ошибках; для возврата используйте
      открытую вкладку или сохранённый ID комнаты.
    </p>
  </aside>
</template>

<style scoped>
.lobby-recovery {
  display: grid;
  gap: .65rem;
  max-width: 62ch;
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--line);
  color: var(--muted);
  background: color-mix(in srgb, var(--panel), transparent 20%);
}
.lobby-recovery h2,
.lobby-recovery p { margin: 0; }
.lobby-recovery h2 { color: var(--ink); font-size: 1rem; }
.lobby-recovery__eyebrow { color: var(--acid); font-size: .7rem; font-weight: 800; letter-spacing: .14em; }
</style>
