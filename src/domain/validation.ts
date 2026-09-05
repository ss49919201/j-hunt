import { z } from "zod";

export class ValidationError extends Error {
  override name = "ValidationError";
}

const requiredTextSchema = z.string().trim().min(1);
const optionalTextSchema = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();
const positiveIntegerSchema = z.coerce.number().min(1).refine(Number.isInteger);
const positiveNumberSchema = z.coerce.number().positive().finite();
const isoDateTimeSchema = z.coerce
  .date()
  .transform((value) => value.toISOString());
const optionalUrlSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.union([z.null(), z.url({ protocol: /^https?$/, normalize: true })]))
  .optional();

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationError(message);
  return result.data;
}

export function requiredText(value: string, fieldName: string): string {
  return parseOrThrow(
    requiredTextSchema,
    value,
    `${fieldName}は空にできません。`,
  );
}

export function optionalText(value: string | undefined): string | undefined {
  return optionalTextSchema.parse(value);
}

export function positiveInteger(
  value: string | number,
  fieldName: string,
): number {
  return parseOrThrow(
    positiveIntegerSchema,
    value,
    `${fieldName}には1以上の整数を指定してください。`,
  );
}

export function positiveNumber(
  value: string | number,
  fieldName: string,
): number {
  return parseOrThrow(
    positiveNumberSchema,
    value,
    `${fieldName}には0より大きい数値を指定してください。`,
  );
}

export function isoDateTime(
  value: string | undefined,
  fieldName = "日時",
): string {
  if (value === undefined) return new Date().toISOString();
  return parseOrThrow(
    isoDateTimeSchema,
    value,
    `${fieldName}は有効なISO 8601日時で指定してください。`,
  );
}

export function optionalUrl(
  value: string | undefined,
): string | null | undefined {
  return parseOrThrow(
    optionalUrlSchema,
    value,
    "websiteにはhttpまたはhttpsのURLを指定してください。",
  );
}
