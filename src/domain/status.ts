import type { CareerEvent, CurrentStatus } from "./models";

const NOT_STARTED: CurrentStatus = { code: "not_started", label: "未着手" };

export function calculateCurrentStatus(events: readonly CareerEvent[]): CurrentStatus {
  const latest = [...events].sort(compareEvents).at(-1);
  if (!latest) return NOT_STARTED;

  switch (latest.type) {
    case "casual_interview_applied":
      return { code: "casual_interview_applied", label: "カジュアル面談応募済み" };
    case "casual_interview_scheduled":
      return { code: "casual_interview_waiting", label: "カジュアル面談待ち" };
    case "casual_interview_completed":
      return { code: "casual_interview_follow_up", label: "カジュアル面談後" };
    case "resume_submitted":
      return { code: "document_screening_waiting", label: "書類選考待ち" };
    case "selection_scheduled":
      return { code: "selection_waiting", label: `${latest.round}次選考待ち` };
    case "selection_completed":
      return { code: "selection_result_waiting", label: `${latest.round}次選考結果待ち` };
    case "offer_received":
      return { code: "offer_received", label: "内定" };
    case "rejected":
      return { code: "rejected", label: "不採用" };
  }
}

export function compareEvents(left: CareerEvent, right: CareerEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}
