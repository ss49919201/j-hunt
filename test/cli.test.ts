import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("CLI", () => {
  test("企業登録からイベント状態のJSON出力まで操作できる", async () => {
    const directory = mkdtempSync(join(tmpdir(), "j-hunt-test-"));
    temporaryDirectories.push(directory);
    const dbPath = join(directory, "career.db");

    expect(
      await invoke(["--db", dbPath, "company", "add", "Example株式会社"]),
    ).toMatchObject({ code: 0 });
    expect(
      await invoke([
        "--db",
        dbPath,
        "event",
        "add",
        "Example株式会社",
        "selection-scheduled",
        "--round",
        "1",
      ]),
    ).toMatchObject({ code: 0 });
    const result = await invoke(["--db", dbPath, "--json", "company", "list"]);
    const companies = JSON.parse(result.stdout) as Array<{
      name: string;
      status: { label: string };
    }>;

    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      name: "Example株式会社",
      status: { label: "1次選考待ち" },
    });
  });

  test("PDF以外のファイルを拒否する", async () => {
    const directory = mkdtempSync(join(tmpdir(), "j-hunt-test-"));
    temporaryDirectories.push(directory);
    const dbPath = join(directory, "career.db");
    const textPath = join(directory, "resume.txt");
    writeFileSync(textPath, "not a pdf");

    const result = await invoke(["--db", dbPath, "resume", "add", textPath]);

    expect(result.code).toBe(2);
    expect(result.stderr).toContain("PDF形式");
  });
});

async function invoke(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runCli(args, {
    write: (message) => stdout.push(message),
    error: (message) => stderr.push(message),
  });
  return { code, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}
