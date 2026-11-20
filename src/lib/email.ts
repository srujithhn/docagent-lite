const PROVIDERS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "rediffmail.com"];

/** Damerau–Levenshtein distance includes adjacent transpositions such as gmial. */
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  const at = (i: number, j: number) => rows[i]?.[j] ?? 0;
  for (let i = 0; i <= a.length; i++) {
    const row = rows[i];
    if (row) row[0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    const row = rows[0];
    if (row) row[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      let cost = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cost = Math.min(cost, at(i - 2, j - 2) + 1);
      }
      const row = rows[i];
      if (row) row[j] = cost;
    }
  }
  return at(a.length, b.length);
}

/** Suggest only a uniquely closest common provider; never modify the local part. */
export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim();
  const parts = trimmed.split("@");
  const [local, rawDomain] = parts;
  if (parts.length !== 2 || !local || !rawDomain || /\s/.test(trimmed)) return null;
  const domain = rawDomain.toLowerCase();
  if (PROVIDERS.includes(domain) || domain.length > 30) return null;
  const candidates = PROVIDERS.map((provider) => ({ provider, distance: editDistance(domain, provider) }))
    .filter(({ distance }) => distance <= 2)
    .sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  if (!best || candidates[1]?.distance === best.distance) return null;
  return `${local}@${best.provider}`;
}