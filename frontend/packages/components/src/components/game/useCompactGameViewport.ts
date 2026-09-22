import {ref, readonly, onMounted, onBeforeUnmount, type Ref} from "vue";
export function useCompactGameViewport(): Readonly<Ref<boolean>> {
  const compact = ref(false);
  let query: MediaQueryList | undefined;

  const sync = (event?: MediaQueryListEvent): void => {
    compact.value = event?.matches ?? query?.matches ?? false;
  };

  onMounted(() => {
    query = window.matchMedia("(width < 1024px)");
    sync();
    query.addEventListener("change", sync);
  });
  onBeforeUnmount(() => query?.removeEventListener("change", sync));

  return readonly(compact);
}
