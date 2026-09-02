import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { calculateCurrentStatus } from "../src/domain/status";
import { CareerRepository, ConflictError } from "../src/infrastructure/career-repository";

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");

describe("CareerRepository", () => {
  let repository: CareerRepository;

  beforeEach(() => {
    repository = new CareerRepository(":memory:");
  });

  afterEach(() => {
    repository.close();
  });

  test("企業に現在状態を保存せずイベントから導出する", () => {
    const company = repository.addCompany("Example株式会社", "https://example.com/");
    repository.addEvent({
      type: "selection_scheduled",
      companyId: company.id,
      occurredAt: "2026-09-10T01:00:00.000Z",
      round: 2,
    });

    expect(company).not.toHaveProperty("status");
    expect(calculateCurrentStatus(repository.listEvents(company.id)).label).toBe("2次選考待ち");
  });

  test("PDFのバイナリをSQLiteへ保存して復元できる", () => {
    const resume = repository.addResume("職務経歴書 v1", PDF);
    const restored = repository.getResumeContent(resume.id);

    expect(restored.name).toBe("職務経歴書 v1");
    expect(restored.content).toEqual(PDF);
    expect(restored.size).toBe(PDF.byteLength);
  });

  test("職務経歴書提出とイベントを同じ操作で記録する", () => {
    const company = repository.addCompany("Example株式会社", null);
    const resume = repository.addResume("職務経歴書 v2", PDF);
    const submission = repository.submitResume(resume.id, company.id, "2026-09-02T12:00:00.000Z");

    expect(repository.listResumeSubmissions(company.id)).toEqual([submission]);
    expect(repository.listEvents(company.id)).toEqual([
      expect.objectContaining({
        type: "resume_submitted",
        resumeId: resume.id,
        occurredAt: "2026-09-02T12:00:00.000Z",
      }),
    ]);
  });

  test("提出済み職務経歴書は通常削除できずforceで関連事実ごと削除する", () => {
    const company = repository.addCompany("Example株式会社", null);
    const resume = repository.addResume("職務経歴書 v3", PDF);
    repository.submitResume(resume.id, company.id, "2026-09-02T12:00:00.000Z");

    expect(() => repository.deleteResume(resume.id, false)).toThrow(ConflictError);
    repository.deleteResume(resume.id, true);

    expect(repository.listResumes()).toHaveLength(0);
    expect(repository.listResumeSubmissions(company.id)).toHaveLength(0);
    expect(repository.listEvents(company.id)).toHaveLength(0);
  });
});
