import { ValidationError } from "../domain/validation";

export interface ParsedArguments {
  positionals: string[];
  options: Map<string, string | true>;
}

export interface GlobalArguments {
  args: string[];
  dbPath?: string;
  json: boolean;
}

export function extractGlobalArguments(args: string[]): GlobalArguments {
  const remaining: string[] = [];
  let dbPath: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (token === "--json") {
      json = true;
      continue;
    }
    if (token === "--db") {
      const next = args[index + 1];
      if (!next || next.startsWith("--"))
        throw new ValidationError("--dbにはDBファイルのパスが必要です。");
      dbPath = next;
      index += 1;
      continue;
    }
    if (token.startsWith("--db=")) {
      dbPath = token.slice("--db=".length);
      if (!dbPath)
        throw new ValidationError("--dbにはDBファイルのパスが必要です。");
      continue;
    }
    remaining.push(token);
  }

  return dbPath === undefined
    ? { args: remaining, json }
    : { args: remaining, dbPath, json };
}

export function parseArguments(args: string[]): ParsedArguments {
  const positionals: string[] = [];
  const options = new Map<string, string | true>();
  const booleanOptions = new Set(["force"]);

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const equalsIndex = token.indexOf("=");
    if (equalsIndex >= 0) {
      const key = token.slice(2, equalsIndex);
      const value = token.slice(equalsIndex + 1);
      if (!key || !value)
        throw new ValidationError(`不正なオプションです: ${token}`);
      options.set(key, value);
      continue;
    }

    const key = token.slice(2);
    if (!key) throw new ValidationError("不正なオプションです: --");
    if (booleanOptions.has(key)) {
      options.set(key, true);
      continue;
    }
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      options.set(key, next);
      index += 1;
    } else {
      options.set(key, true);
    }
  }

  return { positionals, options };
}

export function optionValue(
  parsed: ParsedArguments,
  name: string,
  required = false,
): string | undefined {
  const value = parsed.options.get(name);
  if (value === undefined) {
    if (required) throw new ValidationError(`--${name}を指定してください。`);
    return undefined;
  }
  if (value === true) throw new ValidationError(`--${name}には値が必要です。`);
  return value;
}

export function optionFlag(parsed: ParsedArguments, name: string): boolean {
  const value = parsed.options.get(name);
  if (value === undefined) return false;
  if (value !== true) throw new ValidationError(`--${name}は値を取りません。`);
  return true;
}

export function assertAllowedOptions(
  parsed: ParsedArguments,
  allowed: readonly string[],
): void {
  for (const name of parsed.options.keys()) {
    if (!allowed.includes(name))
      throw new ValidationError(`未対応のオプションです: --${name}`);
  }
}

export function requiredPositional(
  parsed: ParsedArguments,
  index: number,
  label: string,
): string {
  const value = parsed.positionals[index];
  if (value === undefined)
    throw new ValidationError(`${label}を指定してください。`);
  return value;
}

export function assertPositionalCount(
  parsed: ParsedArguments,
  maximum: number,
): void {
  if (parsed.positionals.length > maximum) {
    throw new ValidationError(
      `余分な引数があります: ${parsed.positionals.slice(maximum).join(" ")}`,
    );
  }
}
