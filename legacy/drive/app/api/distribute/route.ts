import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { assertAppPassword } from '../../../lib/auth';
import { createFolder, findChildFolder, getDrive, listStudents, resolvePath, uploadBuffer } from '../../../lib/google-drive';
import { normalizeSegments, safeFolderName } from '../../../lib/path-utils.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function cleanRelativePath(value: string) {
  return normalizeSegments(
    value.replace(/\\/g, '/').split('/').filter((segment) => segment && segment !== '.' && segment !== '..')
  );
}

export async function POST(request: NextRequest) {
  try {
    assertAppPassword(request);
    const form = await request.formData();

    const subjectName = safeFolderName(String(form.get('subjectName') || ''));
    const destinationPath = String(form.get('destinationPath') || '');
    const extraPath = String(form.get('extraPath') || '');
    const createMissing = String(form.get('createMissing') || 'false') === 'true';
    const skipExisting = String(form.get('skipExisting') || 'true') !== 'false';
    const destinationSegments = normalizeSegments(destinationPath);
    const extraSegments = normalizeSegments(extraPath);

    let selectedIds: string[] = [];
    try {
      const parsed = JSON.parse(String(form.get('studentIds') || '[]'));
      if (Array.isArray(parsed)) selectedIds = parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
    } catch {
      return NextResponse.json({ error: 'Sélection des élèves invalide.' }, { status: 400 });
    }

    const files = form.getAll('files').filter((item): item is File => item instanceof File && item.size > 0);
    const relativePaths = form.getAll('relativePaths').map((item) => String(item || ''));

    if (!selectedIds.length) return NextResponse.json({ error: 'Sélectionne au moins un élève.' }, { status: 400 });
    if (!subjectName) return NextResponse.json({ error: 'Choisis une matière.' }, { status: 400 });
    if (!destinationSegments.length) return NextResponse.json({ error: 'Choisis un dossier de destination.' }, { status: 400 });
    if (!files.length && !extraSegments.length) return NextResponse.json({ error: 'Ajoute des fichiers ou une arborescence à créer.' }, { status: 400 });

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: 'Le total des fichiers dépasse 4 Mo, limite de cette version Vercel.' }, { status: 400 });
    }

    const payloads = await Promise.all(files.map(async (file, index) => ({
      name: file.name,
      type: file.type || 'application/octet-stream',
      buffer: Buffer.from(await file.arrayBuffer()),
      relativeSegments: cleanRelativePath(relativePaths[index] || file.name)
    })));

    const drive = getDrive();
    const allStudents = await listStudents(drive);
    const selectedStudents = allStudents.filter((student) => selectedIds.includes(student.id));
    if (!selectedStudents.length) return NextResponse.json({ error: 'Aucun élève sélectionné n’a été retrouvé dans ELEVES.' }, { status: 400 });

    const results: Array<{ student: string; status: 'success' | 'error'; created?: number; skipped?: number; message?: string }> = [];
    const CONCURRENCY = 4;

    for (let index = 0; index < selectedStudents.length; index += CONCURRENCY) {
      const batch = selectedStudents.slice(index, index + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (student) => {
        try {
          let subject = await findChildFolder(drive, student.id, subjectName);
          if (!subject && createMissing) subject = await createFolder(drive, student.id, subjectName);
          if (!subject) throw new Error(`Matière introuvable : ${subjectName}`);

          let baseTargetId = await resolvePath(drive, subject.id, destinationSegments, createMissing);
          if (extraSegments.length) baseTargetId = await resolvePath(drive, baseTargetId, extraSegments, true);

          let created = 0;
          let skipped = 0;

          for (const payload of payloads) {
            // Pour un dossier uploadé, webkitRelativePath contient par ex.
            // "Mon dossier/Sous-dossier/fichier.pdf". On recrée tous les parents.
            const segments = payload.relativeSegments.length ? payload.relativeSegments : [payload.name];
            const fileName = segments[segments.length - 1] || payload.name;
            const folderSegments = segments.slice(0, -1);
            const fileTargetId = folderSegments.length
              ? await resolvePath(drive, baseTargetId, folderSegments, true)
              : baseTargetId;

            const upload = await uploadBuffer(drive, fileTargetId, fileName, payload.type, payload.buffer, skipExisting);
            if (upload.status === 'created') created += 1;
            else skipped += 1;
          }

          return { student: student.name, status: 'success' as const, created, skipped };
        } catch (error) {
          return { student: student.name, status: 'error' as const, message: error instanceof Error ? error.message : 'Erreur inconnue' };
        }
      }));
      results.push(...batchResults);
    }

    const success = results.filter((result) => result.status === 'success').length;
    return NextResponse.json({
      subjectName,
      destinationPath: destinationSegments.join(' / '),
      extraPath: extraSegments.join(' / '),
      total: selectedStudents.length,
      success,
      errors: selectedStudents.length - success,
      results
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });
    }
    console.error('POST /api/distribute', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur inconnue' }, { status: 500 });
  }
}
