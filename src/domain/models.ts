import { err, ok, type Result } from "./result";
import {
  isoDateTime,
  optionalUrl,
  positiveInteger,
  positiveNumber,
  requiredText,
  ValidationError,
} from "./validation";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EventBase {
  id: string;
  companyId: string;
  occurredAt: string;
  createdAt: string;
}

export interface CasualInterviewApplied extends EventBase {
  type: "casual_interview_applied";
}

export interface CasualInterviewScheduled extends EventBase {
  type: "casual_interview_scheduled";
}

export interface CasualInterviewCompleted extends EventBase {
  type: "casual_interview_completed";
}

export interface ResumeSubmitted extends EventBase {
  type: "resume_submitted";
  resumeId: string;
}

export interface SelectionScheduled extends EventBase {
  type: "selection_scheduled";
  round: number;
}

export interface SelectionCompleted extends EventBase {
  type: "selection_completed";
  round: number;
}

export interface OfferReceived extends EventBase {
  type: "offer_received";
  position?: string;
  annualSalary?: number;
}

export interface Rejected extends EventBase {
  type: "rejected";
  reason?: string;
}

export type CareerEvent =
  | CasualInterviewApplied
  | CasualInterviewScheduled
  | CasualInterviewCompleted
  | ResumeSubmitted
  | SelectionScheduled
  | SelectionCompleted
  | OfferReceived
  | Rejected;

export type CareerEventType = CareerEvent["type"];

export interface Note {
  id: string;
  companyId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeWithContent extends Resume {
  content: Uint8Array;
}

export interface ResumeSubmission {
  id: string;
  companyId: string;
  resumeId: string;
  submittedAt: string;
  createdAt: string;
}

export interface CurrentStatus {
  label: string;
}

export interface NewCompanyInput {
  name: string;
  website?: string | null;
}

export type NewCareerEventInput =
  | { type: "casual_interview_applied"; companyId: string; occurredAt: string }
  | {
      type: "casual_interview_scheduled";
      companyId: string;
      occurredAt: string;
    }
  | {
      type: "casual_interview_completed";
      companyId: string;
      occurredAt: string;
    }
  | {
      type: "resume_submitted";
      companyId: string;
      occurredAt: string;
      resumeId: string;
    }
  | {
      type: "selection_scheduled";
      companyId: string;
      occurredAt: string;
      round: number;
    }
  | {
      type: "selection_completed";
      companyId: string;
      occurredAt: string;
      round: number;
    }
  | {
      type: "offer_received";
      companyId: string;
      occurredAt: string;
      position?: string;
      annualSalary?: number;
    }
  | {
      type: "rejected";
      companyId: string;
      occurredAt: string;
      reason?: string;
    };

export interface NewNoteInput {
  companyId: string;
  title: string;
  body: string;
}

export interface NewResumeInput {
  name: string;
  content: Uint8Array;
}

export interface NewResumeSubmissionInput {
  companyId: string;
  resumeId: string;
  submittedAt: string;
}

export function newCompany(
  input: NewCompanyInput,
): Result<Company, ValidationError> {
  const now = new Date().toISOString();
  return construct(() =>
    buildCompany({
      id: crypto.randomUUID(),
      name: input.name,
      website: input.website ?? null,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

export function reconstructCompany(
  input: Company,
): Result<Company, ValidationError> {
  return construct(() => buildCompany(input));
}

export function newCareerEvent(
  input: NewCareerEventInput,
): Result<CareerEvent, ValidationError> {
  return construct(() =>
    buildCareerEvent({
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }),
  );
}

export function reconstructCareerEvent(
  input: CareerEvent,
): Result<CareerEvent, ValidationError> {
  return construct(() => buildCareerEvent(input));
}

export function newNote(input: NewNoteInput): Result<Note, ValidationError> {
  const now = new Date().toISOString();
  return construct(() =>
    buildNote({
      id: crypto.randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

export function reconstructNote(input: Note): Result<Note, ValidationError> {
  return construct(() => buildNote(input));
}

export function newResume(
  input: NewResumeInput,
): Result<Resume, ValidationError> {
  return construct(() => {
    validatePdf(input.content);
    const now = new Date().toISOString();
    return buildResume({
      id: crypto.randomUUID(),
      name: input.name,
      size: input.content.byteLength,
      createdAt: now,
      updatedAt: now,
    });
  });
}

export function reconstructResume(
  input: Resume,
): Result<Resume, ValidationError> {
  return construct(() => buildResume(input));
}

export function reconstructResumeWithContent(
  input: ResumeWithContent,
): Result<ResumeWithContent, ValidationError> {
  return construct(() => {
    validatePdf(input.content);
    const resume = buildResume(input);
    if (resume.size !== input.content.byteLength) {
      throw new ValidationError("職務経歴書のサイズが内容と一致しません。");
    }
    return { ...resume, content: input.content };
  });
}

export function newResumeSubmission(
  input: NewResumeSubmissionInput,
): Result<ResumeSubmission, ValidationError> {
  return construct(() =>
    buildResumeSubmission({
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    }),
  );
}

export function reconstructResumeSubmission(
  input: ResumeSubmission,
): Result<ResumeSubmission, ValidationError> {
  return construct(() => buildResumeSubmission(input));
}

function buildCompany(input: Company): Company {
  return {
    id: requiredText(input.id, "企業ID"),
    name: requiredText(input.name, "企業名"),
    website: validateWebsite(input.website),
    createdAt: validateDateTime(input.createdAt, "登録日時"),
    updatedAt: validateDateTime(input.updatedAt, "更新日時"),
  };
}

function buildCareerEvent(input: CareerEvent): CareerEvent {
  const base = {
    id: requiredText(input.id, "イベントID"),
    companyId: requiredText(input.companyId, "企業ID"),
    occurredAt: validateDateTime(input.occurredAt, "発生日時"),
    createdAt: validateDateTime(input.createdAt, "登録日時"),
  };

  switch (input.type) {
    case "casual_interview_applied":
    case "casual_interview_scheduled":
    case "casual_interview_completed":
      return { ...base, type: input.type };
    case "resume_submitted":
      return {
        ...base,
        type: input.type,
        resumeId: requiredText(input.resumeId, "職務経歴書ID"),
      };
    case "selection_scheduled":
    case "selection_completed":
      return {
        ...base,
        type: input.type,
        round: positiveInteger(input.round, "選考回数"),
      };
    case "offer_received": {
      const event: OfferReceived = { ...base, type: input.type };
      if (input.position !== undefined)
        event.position = requiredText(input.position, "ポジション");
      if (input.annualSalary !== undefined)
        event.annualSalary = positiveNumber(input.annualSalary, "年収");
      return event;
    }
    case "rejected": {
      const event: Rejected = { ...base, type: input.type };
      if (input.reason !== undefined)
        event.reason = requiredText(input.reason, "不採用理由");
      return event;
    }
    default:
      throw new ValidationError(
        `未知のイベント種別です: ${String((input as CareerEvent).type)}`,
      );
  }
}

function buildNote(input: Note): Note {
  return {
    id: requiredText(input.id, "ノートID"),
    companyId: requiredText(input.companyId, "企業ID"),
    title: requiredText(input.title, "タイトル"),
    body: requiredText(input.body, "本文"),
    createdAt: validateDateTime(input.createdAt, "登録日時"),
    updatedAt: validateDateTime(input.updatedAt, "更新日時"),
  };
}

function buildResume(input: Resume): Resume {
  return {
    id: requiredText(input.id, "職務経歴書ID"),
    name: requiredText(input.name, "職務経歴書名"),
    size: positiveInteger(input.size, "ファイルサイズ"),
    createdAt: validateDateTime(input.createdAt, "登録日時"),
    updatedAt: validateDateTime(input.updatedAt, "更新日時"),
  };
}

function buildResumeSubmission(input: ResumeSubmission): ResumeSubmission {
  return {
    id: requiredText(input.id, "提出履歴ID"),
    companyId: requiredText(input.companyId, "企業ID"),
    resumeId: requiredText(input.resumeId, "職務経歴書ID"),
    submittedAt: validateDateTime(input.submittedAt, "提出日時"),
    createdAt: validateDateTime(input.createdAt, "登録日時"),
  };
}

function validateWebsite(value: string | null): string | null {
  if (value === null) return null;
  return optionalUrl(value) ?? null;
}

function validateDateTime(value: string, fieldName: string): string {
  return isoDateTime(requiredText(value, fieldName), fieldName);
}

function validatePdf(content: Uint8Array): void {
  if (
    content.byteLength < 5 ||
    new TextDecoder("ascii").decode(content.subarray(0, 5)) !== "%PDF-"
  ) {
    throw new ValidationError("PDF形式のファイルを指定してください。");
  }
}

function construct<T>(factory: () => T): Result<T, ValidationError> {
  try {
    return ok(factory());
  } catch (error) {
    if (error instanceof ValidationError) return err(error);
    throw error;
  }
}
