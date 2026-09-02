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
  code:
    | "not_started"
    | "casual_interview_applied"
    | "casual_interview_waiting"
    | "casual_interview_follow_up"
    | "document_screening_waiting"
    | "selection_waiting"
    | "selection_result_waiting"
    | "offer_received"
    | "rejected";
  label: string;
}
