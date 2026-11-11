import { Target, Zap, ShieldCheck } from "lucide-react";
export function Mark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 36 36" fill="none">
        <path
          d="m7 10 11 16L29 10M12 10l6 9 6-9"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
export function Meter({ value, label }: { value: number; label?: string }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function DraftNote() {
  return (
    <span className="draft-note">
      <ShieldCheck size={13} /> Ellenőrzésre váró tananyag
    </span>
  );
}

export function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
export function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="card stat-card">
      {icon}
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
export function DailyCard({ daily }: { daily: number }) {
  const percent = Math.min(100, (daily / 30) * 100);
  return (
    <section className="card daily-card">
      <div className="section-heading">
        <h2>A mai kis lépés</h2>
        <Target size={20} />
      </div>
      <div className="daily-inner">
        <div
          className="goal-ring"
          style={{
            background: `conic-gradient(var(--green) ${percent}%, #283748 0)`,
          }}
        >
          <span>
            <Zap size={24} />
            <b>
              {daily}
              <small>/ 30 XP</small>
            </b>
          </span>
        </div>
        <div>
          <span className="tag">NAPI CÉL</span>
          <h3>{daily >= 30 ? "Mára megvagy!" : "Csak néhány perc."}</h3>
          <p>
            {daily >= 30
              ? "A mai lépést már megtetted."
              : "Egy rövid lecke is elég a lendülethez."}
          </p>
        </div>
      </div>
      <div className="daily-bottom">
        <span className="green-dot" />{" "}
        {daily >= 30
          ? "Szép munka! Holnap is várunk."
          : "Ma is tegyél valamit magadért."}
      </div>
    </section>
  );
}
