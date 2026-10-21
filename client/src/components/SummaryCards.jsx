export default function SummaryCards({ summary, activeService }) {
  const cards = [
    { label: 'Waiting', value: summary.waiting, hint: 'in the queue' },
    { label: 'Due appointments', value: summary.dueAppointments, hint: summary.overdueAppointments ? `${summary.overdueAppointments} overdue` : 'none overdue', warn: summary.overdueAppointments > 0 },
    { label: 'Completed', value: summary.completed, hint: 'today' },
    { label: 'Now serving', value: activeService ? activeService.tokenNumber : '—', hint: activeService ? activeService.customerName : 'nobody in service', accent: Boolean(activeService) },
  ];
  return (
    <section className="summary" aria-label="Queue summary">
      {cards.map((c) => (
        <div key={c.label} className={`stat ${c.accent ? 'stat-accent' : ''} ${c.warn ? 'stat-warn' : ''}`}>
          <div className="stat-label">{c.label}</div>
          <div className="stat-value">{c.value}</div>
          <div className="stat-hint">{c.hint}</div>
        </div>
      ))}
    </section>
  );
}
