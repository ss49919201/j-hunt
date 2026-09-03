import type { CareerEvent, CurrentStatus } from "./models";

const NOT_STARTED: CurrentStatus = { label: "未着手" };

export function calculateCurrentStatus(
  events: readonly CareerEvent[],
): CurrentStatus {
  function compareEvents(left: CareerEvent, right: CareerEvent): number {
    return (
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
    );
  }

  const latest = [...events].sort(compareEvents).at(-1);
  if (!latest) return NOT_STARTED;

  switch (latest.type) {
    case "casual_interview_applied":
      return {
        label: "カジュアル面談応募済み",
      };
    case "casual_interview_scheduled":
      return { label: "カジュアル面談待ち" };
    case "casual_interview_completed":
      return { label: "カジュアル面談後" };
    case "resume_submitted":
      return { label: "書類選考待ち" };
    case "selection_scheduled":
      return { label: `${latest.round}次選考待ち` };
    case "selection_completed":
      return {
        label: `${latest.round}次選考結果待ち`,
      };
    case "offer_received":
      return { label: "内定" };
    case "rejected":
      return { label: "不採用" };
  }
}
