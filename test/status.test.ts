import { describe, expect, test } from "bun:test";
import type { CareerEvent } from "../src/domain/models";
import { calculateCurrentStatus } from "../src/domain/status";

function event(overrides: Partial<CareerEvent> & Pick<CareerEvent, "type">): CareerEvent {
  return {
    id: crypto.randomUUID(),
    companyId: "company-1",
    occurredAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as CareerEvent;
}

describe("calculateCurrentStatus", () => {
  test("履歴がなければ未着手になる", () => {
    expect(calculateCurrentStatus([])).toEqual({ code: "not_started", label: "未着手" });
  });

  test("最新の事実から待ち状態を導出する", () => {
    const events: CareerEvent[] = [
      event({ type: "resume_submitted", resumeId: "resume-1", occurredAt: "2026-02-01T00:00:00.000Z" }),
      event({ type: "selection_scheduled", round: 2, occurredAt: "2026-03-01T00:00:00.000Z" }),
    ];

    expect(calculateCurrentStatus(events)).toEqual({ code: "selection_waiting", label: "2次選考待ち" });
  });

  test("入力順ではなく発生日時で最新イベントを決める", () => {
    const events: CareerEvent[] = [
      event({ type: "offer_received", occurredAt: "2026-04-01T00:00:00.000Z" }),
      event({ type: "rejected", occurredAt: "2026-03-01T00:00:00.000Z" }),
    ];

    expect(calculateCurrentStatus(events).code).toBe("offer_received");
  });
});
