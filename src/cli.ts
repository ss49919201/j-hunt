#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { calculateCurrentStatus } from "./domain/status";
import { isoDateTime, optionalText, optionalUrl, positiveInteger, positiveNumber, ValidationError } from "./domain/validation";
import { CareerRepository, ConflictError, NotFoundError } from "./infrastructure/career-repository";
import {
  assertAllowedOptions,
  assertPositionalCount,
  extractGlobalArguments,
  optionFlag,
  optionValue,
  parseArguments,
  requiredPositional,
  type ParsedArguments,
} from "./cli/arguments";
import { formatCompany, formatEvent, formatNote, formatResume, formatSubmission, shortId } from "./cli/presentation";

const VERSION = "0.1.0";

const HELP = `j-hunt ${VERSION} — 転職活動管理CLI

使い方:
  j-hunt [--db <path>] [--json] <command>

コマンド:
  company add <name> [--website <url>]
  company list
  company show <id|name>
  company update <id|name> [--name <name>] [--website <url>]
  company delete <id|name> [--force]

  event add <company> <type> [--at <ISO8601>] [type options]
  event list <company>

  note add <company> --title <title> --body <body>
  note list <company>
  note update <id> [--title <title>] [--body <body>]
  note delete <id>

  resume add <pdf-path> [--name <name>]
  resume list
  resume export <id|name> <output-path> [--force]
  resume submit <id|name> <company> [--at <ISO8601>]
  resume delete <id|name> [--force]

イベント種別:
  casual-interview-applied
  casual-interview-scheduled
  casual-interview-completed
  selection-scheduled --round <n>
  selection-completed --round <n>
  offer-received [--position <text>] [--salary <number>]
  rejected [--reason <text>]

環境変数:
  J_HUNT_DB_PATH  SQLite DBの保存先
`;

interface CliOutput {
  write(message: string): void;
  error(message: string): void;
}

const terminalOutput: CliOutput = {
  write: (message) => process.stdout.write(`${message}\n`),
  error: (message) => process.stderr.write(`${message}\n`),
};

export async function runCli(rawArgs: string[], output: CliOutput = terminalOutput): Promise<number> {
  let repository: CareerRepository | undefined;
  try {
    const global = extractGlobalArguments(rawArgs);
    if (global.args.length === 0 || global.args.includes("--help") || global.args.includes("-h")) {
      output.write(HELP);
      return 0;
    }
    if (global.args[0] === "--version" || global.args[0] === "-v") {
      output.write(VERSION);
      return 0;
    }

    const dbPath = resolveDatabasePath(global.dbPath);
    repository = new CareerRepository(dbPath);
    const result = await dispatch(repository, global.args);
    output.write(global.json ? JSON.stringify(result.value, null, 2) : result.text);
    return 0;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
      output.error(`エラー: ${error.message}`);
      return 2;
    }
    output.error(`予期しないエラー: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    repository?.close();
  }
}

interface CommandResult {
  value: unknown;
  text: string;
}

async function dispatch(repository: CareerRepository, args: string[]): Promise<CommandResult> {
  const [resource, action, ...rest] = args;
  if (!resource || !action) throw new ValidationError("コマンドが不足しています。--helpで使い方を確認してください。");
  const parsed = parseArguments(rest);
  switch (resource) {
    case "company":
      return companyCommand(repository, action, parsed);
    case "event":
      return eventCommand(repository, action, parsed);
    case "note":
      return noteCommand(repository, action, parsed);
    case "resume":
      return resumeCommand(repository, action, parsed);
    default:
      throw new ValidationError(`未知のコマンドです: ${resource}`);
  }
}

function companyCommand(repository: CareerRepository, action: string, parsed: ParsedArguments): CommandResult {
  switch (action) {
    case "add": {
      assertAllowedOptions(parsed, ["website"]);
      assertPositionalCount(parsed, 1);
      const company = repository.addCompany(
        requiredPositional(parsed, 0, "企業名"),
        optionalUrl(optionValue(parsed, "website")) ?? null,
      );
      return { value: company, text: `企業を登録しました: ${company.name} (${shortId(company.id)})` };
    }
    case "list": {
      assertAllowedOptions(parsed, []);
      assertPositionalCount(parsed, 0);
      const companies = repository.listCompanies().map((company) => ({
        ...company,
        status: calculateCurrentStatus(repository.listEvents(company.id)),
      }));
      return {
        value: companies,
        text: companies.length
          ? companies.map((company) => `${shortId(company.id)}\t${company.name}\t${company.status.label}`).join("\n")
          : "企業はまだ登録されていません。",
      };
    }
    case "show": {
      assertAllowedOptions(parsed, []);
      assertPositionalCount(parsed, 1);
      const company = repository.findCompany(requiredPositional(parsed, 0, "企業IDまたは企業名"));
      const events = repository.listEvents(company.id);
      const notes = repository.listNotes(company.id);
      const submissions = repository.listResumeSubmissions(company.id);
      const resumes = repository.listResumes();
      const status = calculateCurrentStatus(events);
      const sections = [formatCompany(company, status.label)];
      sections.push(`\nイベント:\n${events.length ? events.map(formatEvent).join("\n") : "なし"}`);
      sections.push(`\nノート:\n${notes.length ? notes.map(formatNote).join("\n\n") : "なし"}`);
      sections.push(`\n職務経歴書提出:\n${submissions.length ? submissions.map((item) => formatSubmission(item, resumes)).join("\n") : "なし"}`);
      return { value: { company, status, events, notes, submissions }, text: sections.join("\n") };
    }
    case "update": {
      assertAllowedOptions(parsed, ["name", "website"]);
      assertPositionalCount(parsed, 1);
      const name = optionValue(parsed, "name");
      const websiteRaw = optionValue(parsed, "website");
      if (name === undefined && websiteRaw === undefined) throw new ValidationError("--nameまたは--websiteを指定してください。");
      const website = optionalUrl(websiteRaw);
      const changes: { name?: string; website?: string | null } = {};
      if (name !== undefined) changes.name = name;
      if (website !== undefined) changes.website = website;
      const company = repository.updateCompany(requiredPositional(parsed, 0, "企業IDまたは企業名"), changes);
      return { value: company, text: `企業を更新しました: ${company.name}` };
    }
    case "delete": {
      assertAllowedOptions(parsed, ["force"]);
      assertPositionalCount(parsed, 1);
      const reference = requiredPositional(parsed, 0, "企業IDまたは企業名");
      const company = repository.findCompany(reference);
      const relatedCount = repository.companyRelatedCount(company.id);
      if (relatedCount > 0 && !optionFlag(parsed, "force")) {
        throw new ConflictError(`企業には${relatedCount}件の関連データがあります。削除するには--forceを指定してください。`);
      }
      repository.deleteCompany(company.id);
      return { value: { deleted: company }, text: `企業を削除しました: ${company.name}` };
    }
    default:
      throw new ValidationError(`未知のcompany操作です: ${action}`);
  }
}

function eventCommand(repository: CareerRepository, action: string, parsed: ParsedArguments): CommandResult {
  if (action === "list") {
    assertAllowedOptions(parsed, []);
    assertPositionalCount(parsed, 1);
    const events = repository.listEvents(requiredPositional(parsed, 0, "企業IDまたは企業名"));
    return { value: events, text: events.length ? events.map(formatEvent).join("\n") : "イベントはありません。" };
  }
  if (action !== "add") throw new ValidationError(`未知のevent操作です: ${action}`);

  assertAllowedOptions(parsed, ["at", "round", "position", "salary", "reason"]);
  assertPositionalCount(parsed, 2);
  const companyId = requiredPositional(parsed, 0, "企業IDまたは企業名");
  const type = requiredPositional(parsed, 1, "イベント種別");
  const occurredAt = isoDateTime(optionValue(parsed, "at"));
  const round = optionValue(parsed, "round");
  const position = optionalText(optionValue(parsed, "position"));
  const salary = optionValue(parsed, "salary");
  const reason = optionalText(optionValue(parsed, "reason"));

  let event;
  switch (type) {
    case "casual-interview-applied":
      rejectTypeOptions(parsed, ["at"]);
      event = repository.addEvent({ type: "casual_interview_applied", companyId, occurredAt });
      break;
    case "casual-interview-scheduled":
      rejectTypeOptions(parsed, ["at"]);
      event = repository.addEvent({ type: "casual_interview_scheduled", companyId, occurredAt });
      break;
    case "casual-interview-completed":
      rejectTypeOptions(parsed, ["at"]);
      event = repository.addEvent({ type: "casual_interview_completed", companyId, occurredAt });
      break;
    case "selection-scheduled":
      rejectTypeOptions(parsed, ["at", "round"]);
      event = repository.addEvent({
        type: "selection_scheduled",
        companyId,
        occurredAt,
        round: positiveInteger(round ?? "", "--round"),
      });
      break;
    case "selection-completed":
      rejectTypeOptions(parsed, ["at", "round"]);
      event = repository.addEvent({
        type: "selection_completed",
        companyId,
        occurredAt,
        round: positiveInteger(round ?? "", "--round"),
      });
      break;
    case "offer-received": {
      rejectTypeOptions(parsed, ["at", "position", "salary"]);
      const input: Parameters<CareerRepository["addEvent"]>[0] = { type: "offer_received", companyId, occurredAt };
      if (position !== undefined) input.position = position;
      if (salary !== undefined) input.annualSalary = positiveNumber(salary, "--salary");
      event = repository.addEvent(input);
      break;
    }
    case "rejected": {
      rejectTypeOptions(parsed, ["at", "reason"]);
      const input: Parameters<CareerRepository["addEvent"]>[0] = { type: "rejected", companyId, occurredAt };
      if (reason !== undefined) input.reason = reason;
      event = repository.addEvent(input);
      break;
    }
    case "resume-submitted":
      throw new ValidationError("resume-submittedは`resume submit`コマンドで記録してください。");
    default:
      throw new ValidationError(`未知のイベント種別です: ${type}`);
  }
  return { value: event, text: `イベントを記録しました: ${formatEvent(event)}` };
}

function noteCommand(repository: CareerRepository, action: string, parsed: ParsedArguments): CommandResult {
  switch (action) {
    case "add": {
      assertAllowedOptions(parsed, ["title", "body"]);
      assertPositionalCount(parsed, 1);
      const note = repository.addNote(
        requiredPositional(parsed, 0, "企業IDまたは企業名"),
        optionValue(parsed, "title", true)!,
        optionValue(parsed, "body", true)!,
      );
      return { value: note, text: `ノートを追加しました: ${note.title} (${shortId(note.id)})` };
    }
    case "list": {
      assertAllowedOptions(parsed, []);
      assertPositionalCount(parsed, 1);
      const notes = repository.listNotes(requiredPositional(parsed, 0, "企業IDまたは企業名"));
      return { value: notes, text: notes.length ? notes.map(formatNote).join("\n\n") : "ノートはありません。" };
    }
    case "update": {
      assertAllowedOptions(parsed, ["title", "body"]);
      assertPositionalCount(parsed, 1);
      const title = optionValue(parsed, "title");
      const body = optionValue(parsed, "body");
      if (title === undefined && body === undefined) throw new ValidationError("--titleまたは--bodyを指定してください。");
      const changes: { title?: string; body?: string } = {};
      if (title !== undefined) changes.title = title;
      if (body !== undefined) changes.body = body;
      const note = repository.updateNote(requiredPositional(parsed, 0, "ノートID"), changes);
      return { value: note, text: `ノートを更新しました: ${note.title}` };
    }
    case "delete": {
      assertAllowedOptions(parsed, []);
      assertPositionalCount(parsed, 1);
      const note = repository.findNote(requiredPositional(parsed, 0, "ノートID"));
      repository.deleteNote(note.id);
      return { value: { deleted: note }, text: `ノートを削除しました: ${note.title}` };
    }
    default:
      throw new ValidationError(`未知のnote操作です: ${action}`);
  }
}

async function resumeCommand(repository: CareerRepository, action: string, parsed: ParsedArguments): Promise<CommandResult> {
  switch (action) {
    case "add": {
      assertAllowedOptions(parsed, ["name"]);
      assertPositionalCount(parsed, 1);
      const path = resolve(requiredPositional(parsed, 0, "PDFファイル"));
      const file = Bun.file(path);
      if (!(await file.exists())) throw new NotFoundError(`ファイル「${path}」が見つかりません。`);
      const defaultName = basename(path).replace(/\.pdf$/i, "");
      const resume = repository.addResume(optionValue(parsed, "name") ?? defaultName, new Uint8Array(await file.arrayBuffer()));
      return { value: resume, text: `職務経歴書を登録しました: ${resume.name} (${shortId(resume.id)})` };
    }
    case "list": {
      assertAllowedOptions(parsed, []);
      assertPositionalCount(parsed, 0);
      const resumes = repository.listResumes();
      return { value: resumes, text: resumes.length ? resumes.map(formatResume).join("\n") : "職務経歴書はありません。" };
    }
    case "export": {
      assertAllowedOptions(parsed, ["force"]);
      assertPositionalCount(parsed, 2);
      const resume = repository.getResumeContent(requiredPositional(parsed, 0, "職務経歴書IDまたは名前"));
      const outputPath = resolve(requiredPositional(parsed, 1, "出力先"));
      if (existsSync(outputPath) && !optionFlag(parsed, "force")) {
        throw new ConflictError(`出力先「${outputPath}」は既に存在します。上書きするには--forceを指定してください。`);
      }
      await Bun.write(outputPath, resume.content);
      const { content: _content, ...metadata } = resume;
      return { value: { resume: metadata, outputPath }, text: `職務経歴書を書き出しました: ${outputPath}` };
    }
    case "submit": {
      assertAllowedOptions(parsed, ["at"]);
      assertPositionalCount(parsed, 2);
      const submission = repository.submitResume(
        requiredPositional(parsed, 0, "職務経歴書IDまたは名前"),
        requiredPositional(parsed, 1, "企業IDまたは企業名"),
        isoDateTime(optionValue(parsed, "at"), "提出日時"),
      );
      return { value: submission, text: `職務経歴書の提出を記録しました: ${shortId(submission.id)}` };
    }
    case "delete": {
      assertAllowedOptions(parsed, ["force"]);
      assertPositionalCount(parsed, 1);
      const resume = repository.findResume(requiredPositional(parsed, 0, "職務経歴書IDまたは名前"));
      repository.deleteResume(resume.id, optionFlag(parsed, "force"));
      return { value: { deleted: resume }, text: `職務経歴書を削除しました: ${resume.name}` };
    }
    default:
      throw new ValidationError(`未知のresume操作です: ${action}`);
  }
}

function rejectTypeOptions(parsed: ParsedArguments, allowed: readonly string[]): void {
  assertAllowedOptions(parsed, allowed);
}

function resolveDatabasePath(cliPath: string | undefined): string {
  const configured = cliPath ?? process.env.J_HUNT_DB_PATH;
  if (configured) return resolve(configured);
  const dataHome = process.env.XDG_DATA_HOME ? resolve(process.env.XDG_DATA_HOME) : join(homedir(), ".local", "share");
  return join(dataHome, "j-hunt", "career.db");
}

if (import.meta.main) {
  process.exitCode = await runCli(Bun.argv.slice(2));
}
