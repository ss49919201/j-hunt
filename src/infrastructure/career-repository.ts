import type { Database } from "bun:sqlite";
import {
  newCareerEvent,
  newCompany,
  newNote,
  newResume,
  newResumeSubmission,
  reconstructCareerEvent,
  reconstructCompany,
  reconstructNote,
  reconstructResume,
  reconstructResumeSubmission,
  reconstructResumeWithContent,
  type NewCareerEventInput,
  type CareerEvent,
  type CareerEventType,
  type Company,
  type Note,
  type Resume,
  type ResumeSubmission,
  type ResumeWithContent,
} from "../domain/models";
import { unwrap } from "../domain/result";
import { ValidationError } from "../domain/validation";
import { openDatabase } from "./database";

export class NotFoundError extends Error {
  override name = "NotFoundError";
}

export class ConflictError extends Error {
  override name = "ConflictError";
}

interface CompanyRow {
  id: string;
  name: string;
  website: string | null;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  id: string;
  company_id: string;
  type: CareerEventType;
  occurred_at: string;
  round: number | null;
  payload: string;
  created_at: string;
}

interface NoteRow {
  id: string;
  company_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface ResumeRow {
  id: string;
  name: string;
  content: Uint8Array;
  size: number;
  created_at: string;
  updated_at: string;
}

interface ResumeSubmissionRow {
  id: string;
  company_id: string;
  resume_id: string;
  submitted_at: string;
  created_at: string;
}

type AddCareerEventInput = Exclude<
  NewCareerEventInput,
  { type: "resume_submitted" }
>;

export class CareerRepository {
  private readonly database: Database;

  constructor(path: string) {
    this.database = openDatabase(path);
  }

  close(): void {
    this.database.close();
  }

  addCompany(name: string, website: string | null): Company {
    const company = unwrap(newCompany({ name, website }));
    try {
      this.database
        .query<void, [string, string, string | null, string, string]>(
          "INSERT INTO companies (id, name, website, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          company.id,
          company.name,
          company.website,
          company.createdAt,
          company.updatedAt,
        );
    } catch (error) {
      throw translateConstraintError(
        error,
        `企業「${company.name}」は既に登録されています。`,
      );
    }
    return company;
  }

  listCompanies(): Company[] {
    return this.database
      .query<CompanyRow, []>(
        "SELECT * FROM companies ORDER BY name COLLATE NOCASE",
      )
      .all()
      .map(mapCompany);
  }

  findCompany(reference: string): Company {
    return mapCompany(
      resolveReference<CompanyRow>(
        this.database,
        "companies",
        reference,
        "企業",
      ),
    );
  }

  updateCompany(
    id: string,
    changes: { name?: string; website?: string | null },
  ): Company {
    const current = this.findCompany(id);
    const updated = unwrap(
      reconstructCompany({
        ...current,
        name: changes.name === undefined ? current.name : changes.name,
        website:
          changes.website === undefined ? current.website : changes.website,
        updatedAt: new Date().toISOString(),
      }),
    );
    try {
      this.database
        .query<void, [string, string | null, string, string]>(
          "UPDATE companies SET name = ?, website = ?, updated_at = ? WHERE id = ?",
        )
        .run(updated.name, updated.website, updated.updatedAt, current.id);
    } catch (error) {
      throw translateConstraintError(
        error,
        `企業「${updated.name}」は既に登録されています。`,
      );
    }
    return updated;
  }

  deleteCompany(id: string): void {
    const company = this.findCompany(id);
    this.database
      .query<void, [string]>("DELETE FROM companies WHERE id = ?")
      .run(company.id);
  }

  companyRelatedCount(id: string): number {
    const company = this.findCompany(id);
    const row = this.database
      .query<{ count: number }, [string, string, string]>(
        `SELECT
          (SELECT count(*) FROM events WHERE company_id = ?) +
          (SELECT count(*) FROM notes WHERE company_id = ?) +
          (SELECT count(*) FROM resume_submissions WHERE company_id = ?) AS count`,
      )
      .get(company.id, company.id, company.id);
    return row?.count ?? 0;
  }

  addEvent(input: AddCareerEventInput): CareerEvent {
    const company = this.findCompany(input.companyId);
    return this.insertEvent({ ...input, companyId: company.id });
  }

  listEvents(companyId: string): CareerEvent[] {
    const company = this.findCompany(companyId);
    return this.database
      .query<EventRow, [string]>(
        "SELECT * FROM events WHERE company_id = ? ORDER BY occurred_at, created_at, id",
      )
      .all(company.id)
      .map(mapEvent);
  }

  addNote(companyId: string, title: string, body: string): Note {
    const company = this.findCompany(companyId);
    const note = unwrap(
      newNote({
        companyId: company.id,
        title,
        body,
      }),
    );
    this.database
      .query<void, [string, string, string, string, string, string]>(
        "INSERT INTO notes (id, company_id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        note.id,
        note.companyId,
        note.title,
        note.body,
        note.createdAt,
        note.updatedAt,
      );
    return note;
  }

  listNotes(companyId: string): Note[] {
    const company = this.findCompany(companyId);
    return this.database
      .query<NoteRow, [string]>(
        "SELECT * FROM notes WHERE company_id = ? ORDER BY created_at, id",
      )
      .all(company.id)
      .map(mapNote);
  }

  findNote(reference: string): Note {
    return mapNote(
      resolveIdPrefix<NoteRow>(this.database, "notes", reference, "ノート"),
    );
  }

  updateNote(id: string, changes: { title?: string; body?: string }): Note {
    const current = this.findNote(id);
    const updated = unwrap(
      reconstructNote({
        ...current,
        title: changes.title === undefined ? current.title : changes.title,
        body: changes.body === undefined ? current.body : changes.body,
        updatedAt: new Date().toISOString(),
      }),
    );
    this.database
      .query<void, [string, string, string, string]>(
        "UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ?",
      )
      .run(updated.title, updated.body, updated.updatedAt, current.id);
    return updated;
  }

  deleteNote(id: string): void {
    const note = this.findNote(id);
    this.database
      .query<void, [string]>("DELETE FROM notes WHERE id = ?")
      .run(note.id);
  }

  addResume(name: string, content: Uint8Array): Resume {
    const resume = unwrap(newResume({ name, content }));
    try {
      this.database
        .query<void, [string, string, Uint8Array, string, string]>(
          "INSERT INTO resumes (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          resume.id,
          resume.name,
          content,
          resume.createdAt,
          resume.updatedAt,
        );
    } catch (error) {
      throw translateConstraintError(
        error,
        `職務経歴書「${resume.name}」は既に登録されています。`,
      );
    }
    return resume;
  }

  listResumes(): Resume[] {
    return this.database
      .query<ResumeRow, []>(
        "SELECT id, name, length(content) AS size, created_at, updated_at FROM resumes ORDER BY created_at DESC",
      )
      .all()
      .map(mapResume);
  }

  findResume(reference: string): Resume {
    const row = resolveReference<ResumeRow>(
      this.database,
      "resumes",
      reference,
      "職務経歴書",
      "id, name, length(content) AS size, created_at, updated_at",
    );
    return mapResume(row);
  }

  getResumeContent(reference: string): ResumeWithContent {
    const resume = this.findResume(reference);
    const row = this.database
      .query<ResumeRow, [string]>(
        "SELECT id, name, content, length(content) AS size, created_at, updated_at FROM resumes WHERE id = ?",
      )
      .get(resume.id);
    if (!row) throw new NotFoundError("職務経歴書が見つかりません。");
    return unwrap(
      reconstructResumeWithContent({ ...mapResume(row), content: row.content }),
    );
  }

  submitResume(
    resumeReference: string,
    companyReference: string,
    submittedAt: string,
  ): ResumeSubmission {
    const resume = this.findResume(resumeReference);
    const company = this.findCompany(companyReference);
    const submission = unwrap(
      newResumeSubmission({
        companyId: company.id,
        resumeId: resume.id,
        submittedAt,
      }),
    );

    this.database.transaction(() => {
      this.database
        .query<void, [string, string, string, string, string]>(
          "INSERT INTO resume_submissions (id, company_id, resume_id, submitted_at, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          submission.id,
          submission.companyId,
          submission.resumeId,
          submission.submittedAt,
          submission.createdAt,
        );
      this.insertResumeSubmittedEvent(submission);
    })();
    return submission;
  }

  listResumeSubmissions(companyReference: string): ResumeSubmission[] {
    const company = this.findCompany(companyReference);
    return this.database
      .query<ResumeSubmissionRow, [string]>(
        "SELECT * FROM resume_submissions WHERE company_id = ? ORDER BY submitted_at, created_at, id",
      )
      .all(company.id)
      .map(mapResumeSubmission);
  }

  resumeSubmissionCount(resumeReference: string): number {
    const resume = this.findResume(resumeReference);
    return (
      this.database
        .query<{ count: number }, [string]>(
          "SELECT count(*) AS count FROM resume_submissions WHERE resume_id = ?",
        )
        .get(resume.id)?.count ?? 0
    );
  }

  deleteResume(resumeReference: string, force: boolean): void {
    const resume = this.findResume(resumeReference);
    const count = this.resumeSubmissionCount(resume.id);
    if (count > 0 && !force) {
      throw new ConflictError(
        `この職務経歴書には${count}件の提出履歴があります。削除するには--forceを指定してください。`,
      );
    }
    this.database.transaction(() => {
      if (force) {
        this.database
          .query<void, [string]>(
            "DELETE FROM events WHERE type = 'resume_submitted' AND json_extract(payload, '$.resumeId') = ?",
          )
          .run(resume.id);
        this.database
          .query<void, [string]>(
            "DELETE FROM resume_submissions WHERE resume_id = ?",
          )
          .run(resume.id);
      }
      this.database
        .query<void, [string]>("DELETE FROM resumes WHERE id = ?")
        .run(resume.id);
    })();
  }

  private insertEvent(input: NewCareerEventInput): CareerEvent {
    const event = unwrap(newCareerEvent(input));
    const round = "round" in event ? event.round : null;
    const payload: Record<string, unknown> = {};
    if (event.type === "offer_received") {
      if (event.position !== undefined) payload.position = event.position;
      if (event.annualSalary !== undefined)
        payload.annualSalary = event.annualSalary;
    }
    if (event.type === "rejected" && event.reason !== undefined) {
      payload.reason = event.reason;
    }
    if (event.type === "resume_submitted") {
      payload.resumeId = event.resumeId;
    }
    this.database
      .query<
        void,
        [string, string, CareerEventType, string, number | null, string, string]
      >(
        "INSERT INTO events (id, company_id, type, occurred_at, round, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        event.id,
        event.companyId,
        event.type,
        event.occurredAt,
        round,
        JSON.stringify(payload),
        event.createdAt,
      );
    return event;
  }

  private insertResumeSubmittedEvent(submission: ResumeSubmission): void {
    this.insertEvent({
      type: "resume_submitted",
      companyId: submission.companyId,
      occurredAt: submission.submittedAt,
      resumeId: submission.resumeId,
    });
  }
}

function resolveReference<Row extends { id: string; name: string }>(
  database: Database,
  table: "companies" | "resumes",
  reference: string,
  label: string,
  columns = "*",
): Row {
  const exactRow = database
    .query<Row, [string, string]>(
      `SELECT ${columns} FROM ${table} WHERE id = ? OR name = ? COLLATE NOCASE LIMIT 1`,
    )
    .get(reference, reference);
  if (exactRow) return exactRow;
  return resolveIdPrefix<Row>(database, table, reference, label, columns);
}

function resolveIdPrefix<Row extends { id: string }>(
  database: Database,
  table: "companies" | "notes" | "resumes",
  reference: string,
  label: string,
  columns = "*",
): Row {
  const matches = database
    .query<Row, [string]>(
      `SELECT ${columns} FROM ${table} WHERE id LIKE ? ORDER BY id LIMIT 2`,
    )
    .all(`${reference}%`);
  if (matches.length === 0)
    throw new NotFoundError(`${label}「${reference}」が見つかりません。`);
  if (matches.length > 1)
    throw new ConflictError(
      `${label}ID「${reference}」は複数件に一致します。より長いIDを指定してください。`,
    );
  return matches[0]!;
}

function mapCompany(row: CompanyRow): Company {
  return unwrap(
    reconstructCompany({
      id: row.id,
      name: row.name,
      website: row.website,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

function mapEvent(row: EventRow): CareerEvent {
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(row.payload);
    if (!isRecord(parsed)) throw new Error("payload is not an object");
    payload = parsed;
  } catch {
    throw new ValidationError(`イベント${row.id}のpayloadが破損しています。`);
  }
  const base = {
    id: row.id,
    companyId: row.company_id,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
  switch (row.type) {
    case "casual_interview_applied":
    case "casual_interview_scheduled":
    case "casual_interview_completed":
      return unwrap(reconstructCareerEvent({ ...base, type: row.type }));
    case "resume_submitted": {
      if (typeof payload.resumeId !== "string")
        throw new ValidationError(`イベント${row.id}にresumeIdがありません。`);
      return unwrap(
        reconstructCareerEvent({
          ...base,
          type: row.type,
          resumeId: payload.resumeId,
        }),
      );
    }
    case "selection_scheduled":
    case "selection_completed": {
      if (row.round === null)
        throw new ValidationError(`イベント${row.id}にroundがありません。`);
      return unwrap(
        reconstructCareerEvent({ ...base, type: row.type, round: row.round }),
      );
    }
    case "offer_received": {
      if (
        payload.position !== undefined &&
        typeof payload.position !== "string"
      )
        throw new ValidationError(`イベント${row.id}のpositionが不正です。`);
      if (
        payload.annualSalary !== undefined &&
        typeof payload.annualSalary !== "number"
      )
        throw new ValidationError(
          `イベント${row.id}のannualSalaryが不正です。`,
        );
      return unwrap(
        reconstructCareerEvent({
          ...base,
          type: row.type,
          ...(payload.position === undefined
            ? {}
            : { position: payload.position }),
          ...(payload.annualSalary === undefined
            ? {}
            : { annualSalary: payload.annualSalary }),
        }),
      );
    }
    case "rejected": {
      if (payload.reason !== undefined && typeof payload.reason !== "string")
        throw new ValidationError(`イベント${row.id}のreasonが不正です。`);
      return unwrap(
        reconstructCareerEvent({
          ...base,
          type: row.type,
          ...(payload.reason === undefined ? {} : { reason: payload.reason }),
        }),
      );
    }
    default:
      throw new ValidationError(`未知のイベント種別です: ${String(row.type)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapNote(row: NoteRow): Note {
  return unwrap(
    reconstructNote({
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

function mapResume(row: ResumeRow): Resume {
  return unwrap(
    reconstructResume({
      id: row.id,
      name: row.name,
      size: row.size,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
  );
}

function mapResumeSubmission(row: ResumeSubmissionRow): ResumeSubmission {
  return unwrap(
    reconstructResumeSubmission({
      id: row.id,
      companyId: row.company_id,
      resumeId: row.resume_id,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
    }),
  );
}

function translateConstraintError(error: unknown, message: string): Error {
  if (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed")
  )
    return new ConflictError(message);
  return error instanceof Error ? error : new Error(String(error));
}
