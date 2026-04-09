import Link from "next/link";
import { appCapabilities, plannedUpgrades } from "@/lib/config/app-config";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Trade3 Proof Camera</p>
        <h1>Vercel-first image authenticity, built to evolve later.</h1>
        <p className="lede">
          The MVP captures a mobile photo, produces a watermarked derivative,
          protects the private provenance bundle with password-based encryption,
          and verifies authenticity from a signed public record.
        </p>
        <div className="actions">
          <Link href="/create" className="button primary">
            Create Proof
          </Link>
          <Link href="/verify" className="button secondary">
            Verify Image
          </Link>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>MVP capabilities</h2>
          <ul>
            {appCapabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>Planned upgrades</h2>
          <ul>
            {plannedUpgrades.map((upgrade) => (
              <li key={upgrade}>{upgrade}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
