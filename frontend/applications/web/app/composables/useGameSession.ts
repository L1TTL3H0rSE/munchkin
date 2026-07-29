const storageKey = (gameID: string) => `munchkin:credential:${gameID}`;

export function useGameSession() {
  function save(gameID: string, credential: string) {
    if (!import.meta.client) {
      return;
    }
    sessionStorage.setItem(storageKey(gameID), credential);
  }

  function read(gameID: string) {
    if (!import.meta.client) {
      return null;
    }
    return sessionStorage.getItem(storageKey(gameID));
  }

  function clear(gameID: string) {
    if (!import.meta.client) {
      return;
    }
    sessionStorage.removeItem(storageKey(gameID));
  }

  return {save, read, clear};
}
