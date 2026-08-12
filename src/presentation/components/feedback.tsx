export interface ActionFeedback {
  status: "idle" | "success" | "blocked" | "error";
  message: string;
}

export const idleFeedback: ActionFeedback = { status: "idle", message: "" };

export function FeedbackBanner({ feedback }: { feedback: ActionFeedback }) {
  if (feedback.status === "idle") {
    return null;
  }
  const tones: Record<Exclude<ActionFeedback["status"], "idle">, string> = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    blocked: "bg-amber-50 text-amber-800 ring-amber-200",
    error: "bg-red-50 text-red-800 ring-red-200",
  };
  return (
    <div
      role="status"
      className={`rounded-md px-3 py-2 text-sm ring-1 ring-inset ${tones[feedback.status]}`}
    >
      {feedback.message}
    </div>
  );
}
