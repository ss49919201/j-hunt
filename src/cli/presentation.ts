import type { CareerEvent, Company, Note, Resume, ResumeSubmission } from "../domain/models";

const EVENT_LABELS: Record<CareerEvent["type"], string> = {
  casual_interview_applied: "カジュアル面談応募",
  casual_interview_scheduled: "カジュアル面談日程確定",
  casual_interview_completed: "カジュアル面談実施",
  resume_submitted: "書類送付",
  selection_scheduled: "選考日程確定",
  selection_completed: "選考実施",
  offer_received: "内定",
  rejected: "不採用",
};

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function formatCompany(company: Company, status: string): string {
  return [
    `ID:       ${company.id}`,
    `企業名:   ${company.name}`,
    `Web:      ${company.website ?? "-"}`,
    `状態:     ${status}`,
    `登録日時: ${formatDate(company.createdAt)}`,
    `更新日時: ${formatDate(company.updatedAt)}`,
  ].join("\n");
}

export function formatEvent(event: CareerEvent): string {
  const details: string[] = [];
  if (event.type === "selection_scheduled" || event.type === "selection_completed") details.push(`${event.round}次`);
  if (event.type === "resume_submitted") details.push(`resume=${shortId(event.resumeId)}`);
  if (event.type === "offer_received" && event.position) details.push(event.position);
  if (event.type === "offer_received" && event.annualSalary) details.push(`年収=${event.annualSalary.toLocaleString("ja-JP")}`);
  if (event.type === "rejected" && event.reason) details.push(event.reason);
  return `${formatDate(event.occurredAt)}\t${EVENT_LABELS[event.type]}${details.length ? ` (${details.join(", ")})` : ""}\t${shortId(event.id)}`;
}

export function formatNote(note: Note): string {
  return `${shortId(note.id)}\t${note.title}\t${formatDate(note.updatedAt)}\n${note.body}`;
}

export function formatResume(resume: Resume): string {
  return `${shortId(resume.id)}\t${resume.name}\t${formatBytes(resume.size)}\t${formatDate(resume.createdAt)}`;
}

export function formatSubmission(submission: ResumeSubmission, resumes: readonly Resume[]): string {
  const resume = resumes.find((candidate) => candidate.id === submission.resumeId);
  return `${formatDate(submission.submittedAt)}\t${resume?.name ?? shortId(submission.resumeId)}\t${shortId(submission.id)}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
