import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow">CHALIZE / MLBB SCOUTING</p>
          <h1>
            Find impact that
            <span> basic KDA misses.</span>
          </h1>
          <p className="home-lead">
            A private scouting and scrim workspace for turning tournament exports
            and match input into role-adjusted player evidence, draft patterns,
            and reviewable decisions.
          </p>
          <div className="home-actions">
            <Link className="primary-link" href="/scouting">
              Open scouting workspace <span>→</span>
            </Link>
            <Link className="home-text-link" href="/scrims">
              Track a scrim
            </Link>
            <span className="local-note">
              <i />
              Private access · synced across devices
            </span>
          </div>
        </div>

        <div className="hero-scorecard" aria-label="Scouting methodology preview">
          <div className="scorecard-head">
            <span>PLAYER EVIDENCE</span>
            <span>ROLE: GOLD</span>
          </div>
          <div className="scorecard-player">
            <span>CL</span>
            <div>
              <strong>Role-adjusted profile</strong>
              <small>Same-role benchmark · sample checked</small>
            </div>
            <b>81.4</b>
          </div>
          <div className="scorecard-bars">
            <PreviewBar label="Damage efficiency" value={88} />
            <PreviewBar label="Pressure" value={74} />
            <PreviewBar label="Survival" value={67} />
            <PreviewBar label="Versatility" value={71} />
          </div>
          <div className="scorecard-signal">
            <span>UNDERVALUED SIGNAL</span>
            <p>Impact runs ahead of surface stats.</p>
          </div>
        </div>
      </section>

      <section className="principle-grid">
        <article>
          <span>01</span>
          <h2>Raw data first</h2>
          <p>Player and team match records are the source of truth—not manually prepared summaries.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Compare the role</h2>
          <p>Gold laners are measured against Gold laners. Roamers are not punished for low farm.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Show uncertainty</h2>
          <p>Small samples, unstable role inference, and incomplete draft rows are visible before review.</p>
        </article>
      </section>

      <section className="home-next">
        <div>
          <p className="eyebrow">BUILT FOR REVIEW</p>
          <h2>Evidence first. Coach decision last.</h2>
        </div>
        <p>
          The system highlights profiles worth investigating. It does not auto-label
          a player as good, bad, overrated, or ready to sign.
        </p>
      </section>

      <section className="home-scrim-callout">
        <div>
          <p className="eyebrow">NOW LIVE / SCRIM TRACKER</p>
          <h2>One session. Any number of games.</h2>
          <p>
            Enter every game manually, sync it to the private team workspace,
            and build player performance plus opponent playstyle history over time.
          </p>
        </div>
        <Link className="primary-link" href="/scrims">
          New scrim session <span>→</span>
        </Link>
      </section>
    </div>
  );
}

function PreviewBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <i><b style={{ width: `${value}%` }} /></i>
      <strong>{value}</strong>
    </div>
  );
}
