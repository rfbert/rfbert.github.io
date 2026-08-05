import { execFileSync } from 'node:child_process';

/**
 * When the site was last changed, resolved once at build time.
 *
 * Prefers the last commit date, so a rebuild that changes nothing does not
 * advertise itself as an update. Falls back to build time outside a git
 * checkout (or if git is unavailable), which is the honest answer there.
 */
function lastCommitISO(): string {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const iso = lastCommitISO() || new Date().toISOString();

/** Machine-readable, for <time datetime>. */
export const updatedISO = iso.slice(0, 10);

/** Human-readable, e.g. "5 Aug 2026". */
export const updatedLabel = new Date(iso).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
