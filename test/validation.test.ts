import { describe, expect, test } from "bun:test";
import {
  isoDateTime,
  optionalText,
  optionalUrl,
  positiveInteger,
  positiveNumber,
  requiredText,
  ValidationError,
} from "../src/domain/validation";

describe("validation", () => {
  test("文字列を正規化する", () => {
    expect(requiredText("  Example株式会社  ", "企業名")).toBe(
      "Example株式会社",
    );
    expect(optionalText("  メモ  ")).toBe("メモ");
    expect(optionalText("   ")).toBeUndefined();
    expect(optionalText(undefined)).toBeUndefined();

    expect(() => requiredText("   ", "企業名")).toThrow(
      new ValidationError("企業名は空にできません。"),
    );
  });

  test("正の整数と数値へ変換する", () => {
    expect(positiveInteger("2", "選考回数")).toBe(2);
    expect(positiveNumber("650.5", "年収")).toBe(650.5);

    expect(() => positiveInteger("1.5", "選考回数")).toThrow(
      "選考回数には1以上の整数を指定してください。",
    );
    expect(() => positiveNumber("0", "年収")).toThrow(
      "年収には0より大きい数値を指定してください。",
    );
  });

  test("日時をISO 8601形式へ正規化する", () => {
    expect(isoDateTime("2026-09-04T12:34:56+09:00")).toBe(
      "2026-09-04T03:34:56.000Z",
    );
    expect(() => isoDateTime("not-a-date", "提出日時")).toThrow(
      "提出日時は有効なISO 8601日時で指定してください。",
    );
  });

  test("HTTP(S) URLだけを受け付ける", () => {
    expect(optionalUrl("  https://example.com  ")).toBe("https://example.com/");
    expect(optionalUrl("  ")).toBeNull();
    expect(optionalUrl(undefined)).toBeUndefined();
    expect(() => optionalUrl("ftp://example.com")).toThrow(
      "websiteにはhttpまたはhttpsのURLを指定してください。",
    );
  });
});
