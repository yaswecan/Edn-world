export function normalizeSegments(path) {
  if (!path) return [];
  const input = Array.isArray(path) ? path : String(path).split('/');
  return input.map((part) => String(part).trim()).filter(Boolean);
}

export function pathKey(segments) {
  return normalizeSegments(segments).join(' / ');
}

export function mergeStudentPaths(studentPathLists) {
  const totalStudents = studentPathLists.length;
  const counts = new Map();

  for (const paths of studentPathLists) {
    const unique = new Set(paths.map((p) => pathKey(p)).filter(Boolean));
    for (const key of unique) counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([path, availableStudents]) => ({
      path,
      segments: normalizeSegments(path),
      availableStudents,
      totalStudents,
      coverage: totalStudents === 0 ? 0 : availableStudents / totalStudents
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'fr'));
}

export function safeFolderName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}
