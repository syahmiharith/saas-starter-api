export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function uniqueSlug(base: string) {
  const slug = slugify(base) || 'workspace';
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}

