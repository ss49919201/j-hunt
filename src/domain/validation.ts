export class ValidationError extends Error {
  override name = "ValidationError";
}

export function requiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) throw new ValidationError(`${fieldName}は空にできません。`);
  return normalized;
}

export function optionalText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function positiveInteger(value: string | number, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${fieldName}には1以上の整数を指定してください。`);
  }
  return parsed;
}

export function positiveNumber(value: string | number, fieldName: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName}には0より大きい数値を指定してください。`);
  }
  return parsed;
}

export function isoDateTime(value: string | undefined, fieldName = "日時"): string {
  if (value === undefined) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${fieldName}は有効なISO 8601日時で指定してください。`);
  }
  return parsed.toISOString();
}

export function optionalUrl(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new ValidationError("websiteにはhttpまたはhttpsのURLを指定してください。");
  }
}
