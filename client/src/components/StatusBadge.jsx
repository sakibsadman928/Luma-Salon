const MAP = {
  NOW_SERVING: ['Now serving', 'b-serving'],
  WAITING: ['Waiting', 'b-waiting'],
  AWAITING_SCHEDULED_TIME: ['Awaiting scheduled time', 'b-neutral'],
  DUE: ['Due now', 'b-due'],
  APPOINTMENT_OVERDUE: ['Appointment overdue', 'b-overdue'],
  COMPLETED: ['Completed', 'b-done'],
  CANCELLED: ['Cancelled', 'b-cancel'],
  NO_SHOW: ['No-show', 'b-cancel'],
};
export default function StatusBadge({ status }) {
  const [label, cls] = MAP[status] || [status, 'b-neutral'];
  return <span className={`badge ${cls}`}>{label}</span>;
}
