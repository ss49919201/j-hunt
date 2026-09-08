import { describe, expect, test } from "bun:test";
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
  type CareerEvent,
  type Company,
  type Note,
  type Resume,
  type ResumeSubmission,
} from "../src/domain/models";
import { ValidationError } from "../src/domain/validation";

const createdAt = "2026-09-05T00:00:00.000Z";

describe("domain model construction", () => {
  test("new*はIDと日時を補い、入力を検証して初期構築する", () => {
    const company = newCompany({
      name: "  Example株式会社  ",
      website: "https://example.com",
    });
    expect(company.ok).toBe(true);
    if (company.ok) {
      expect(company.value).toMatchObject({
        name: "Example株式会社",
        website: "https://example.com/",
      });
      expect(company.value.id).not.toBe("");
      expect(company.value.createdAt).toBe(company.value.updatedAt);
    }

    const event = newCareerEvent({
      type: "selection_scheduled",
      companyId: "company-id",
      occurredAt: createdAt,
      round: 2,
    });
    expect(event).toMatchObject({
      ok: true,
      value: { type: "selection_scheduled", round: 2 },
    });

    const note = newNote({
      companyId: "company-id",
      title: "  面談メモ  ",
      body: "  本文  ",
    });
    expect(note).toMatchObject({
      ok: true,
      value: { title: "面談メモ", body: "本文" },
    });

    const resume = newResume({
      name: " 職務経歴書 ",
      content: new TextEncoder().encode("%PDF-1.7"),
    });
    expect(resume).toMatchObject({
      ok: true,
      value: { name: "職務経歴書", size: 8 },
    });

    const submission = newResumeSubmission({
      companyId: "company-id",
      resumeId: "resume-id",
      submittedAt: createdAt,
    });
    expect(submission).toMatchObject({
      ok: true,
      value: { companyId: "company-id", resumeId: "resume-id" },
    });
  });

  test("new*はvalidation errorをthrowせずResultのerrorで返す", () => {
    const company = newCompany({ name: "   " });

    expect(company.ok).toBe(false);
    if (!company.ok) {
      expect(company.error).toEqual(
        new ValidationError("企業名は空にできません。"),
      );
    }

    expect(
      newResume({
        name: "職務経歴書",
        content: new TextEncoder().encode("plain text"),
      }),
    ).toMatchObject({
      ok: false,
      error: new ValidationError("PDF形式のファイルを指定してください。"),
    });
  });

  test("reconstruct*は永続化済みの属性を検証して再構築する", () => {
    const company: Company = {
      id: "company-id",
      name: " Example株式会社 ",
      website: null,
      createdAt,
      updatedAt: createdAt,
    };
    const event: CareerEvent = {
      id: "event-id",
      companyId: company.id,
      type: "offer_received",
      occurredAt: createdAt,
      position: " Engineer ",
      annualSalary: 700,
      createdAt,
    };
    const note: Note = {
      id: "note-id",
      companyId: company.id,
      title: " title ",
      body: " body ",
      createdAt,
      updatedAt: createdAt,
    };
    const resume: Resume = {
      id: "resume-id",
      name: " resume ",
      size: 100,
      createdAt,
      updatedAt: createdAt,
    };
    const submission: ResumeSubmission = {
      id: "submission-id",
      companyId: company.id,
      resumeId: resume.id,
      submittedAt: createdAt,
      createdAt,
    };

    expect(reconstructCompany(company)).toMatchObject({
      ok: true,
      value: { id: "company-id", name: "Example株式会社" },
    });
    expect(reconstructCareerEvent(event)).toMatchObject({
      ok: true,
      value: { id: "event-id", position: "Engineer" },
    });
    expect(reconstructNote(note)).toMatchObject({
      ok: true,
      value: { id: "note-id", title: "title", body: "body" },
    });
    expect(reconstructResume(resume)).toMatchObject({
      ok: true,
      value: { id: "resume-id", name: "resume" },
    });
    expect(reconstructResumeSubmission(submission)).toMatchObject({
      ok: true,
      value: { id: "submission-id" },
    });
  });

  test("reconstruct*は不正な永続化値をResultのerrorで返す", () => {
    const result = reconstructCareerEvent({
      id: "event-id",
      companyId: "company-id",
      type: "selection_completed",
      occurredAt: createdAt,
      round: 0,
      createdAt,
    });

    expect(result).toMatchObject({
      ok: false,
      error: new ValidationError("選考回数には1以上の整数を指定してください。"),
    });
  });
});
