export function formatSseEvent(eventName: string, data: unknown, eventId?: string): string {
  const sanitizedEventName = eventName.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128) || "message";
  const sanitizedEventId = eventId?.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 128);
  const payload = JSON.stringify(data, (_key, value: unknown) => value === undefined ? null : value);
  return `${sanitizedEventId === undefined ? "" : `id: ${sanitizedEventId}\n`}event: ${sanitizedEventName}\ndata: ${payload}\n\n`;
}

export function sanitizeSsePayload(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, (_key, value: unknown) => {
    if (typeof value === "string") {
      return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
    }

    return value === undefined ? null : value;
  }));
}