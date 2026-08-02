export function advisoryRemainingMilliseconds(
  deadlineAt: string,
  serverTime: string,
  now: number,
  receivedAt: number,
): number | null {
  const deadline = Date.parse(deadlineAt);
  const server = Date.parse(serverTime);
  if (!Number.isFinite(deadline) || !Number.isFinite(server)) {
    return null;
  }
  return Math.max(0, deadline - server - (now - receivedAt));
}

export function formatAdvisoryTime(milliseconds: number | null): string {
  if (milliseconds === null) {
    return "Таймер недоступен";
  }
  if (milliseconds <= 0) {
    return "Время вышло — ждём сервер";
  }
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
