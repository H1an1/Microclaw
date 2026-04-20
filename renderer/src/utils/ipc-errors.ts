export function normalizeIpcErrorMessage(error: unknown, fallback: string): string {
  const raw = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : fallback;

  const sanitized = raw
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  return sanitized || fallback;
}

export function isGatewayDisconnectedMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.includes("gateway 未连接") || normalized.includes("gateway not connected");
}