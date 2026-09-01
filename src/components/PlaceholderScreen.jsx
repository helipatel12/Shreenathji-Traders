// Shared "not built yet" screen for nav destinations whose real
// phase hasn't started. Design.md §7's empty-state voice applies here
// too — this isn't a dead end, it says what's coming and when.
//
// Card styling per design.md's 2026-07-24 switch to a modern SaaS
// look (§1, §4) — white rounded card with a soft shadow, not the
// original ledger-paper hairline row.

export default function PlaceholderScreen({ titleGu, titleEn, phaseLabel, description }) {
  return (
    <div>
      <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
        {titleGu}
      </p>
      <h1 className="font-display text-heading text-ink font-semibold mt-1 mb-6">
        {titleEn}
      </h1>

      <div className="card px-5 py-5 max-w-md">
        <p className="text-caption text-accent font-semibold uppercase tracking-wide">
          {phaseLabel}
        </p>
        <p className="text-body text-ink mt-2">{description}</p>
      </div>
    </div>
  )
}
