import { NextRequest, NextResponse } from 'next/server';
import { assertAppPassword } from '../../../../lib/auth';
import {
  findChildFolder,
  getDrive,
  listFilesRecursive,
  listStudents,
  resolvePath
} from '../../../../lib/google-drive';
import { normalizeSegments, safeFolderName } from '../../../../lib/path-utils.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    assertAppPassword(request);
    const body = await request.json();

    const subjectName = safeFolderName(String(body.subjectName || ''));
    const destinationPath = String(body.destinationPath || '');
    const workPath = String(body.workPath || '');
    const requestedIds = Array.isArray(body.studentIds)
      ? body.studentIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    if (!subjectName) return NextResponse.json({ error: 'Choisis une matière.' }, { status: 400 });
    if (!destinationPath) return NextResponse.json({ error: 'Choisis le dossier À rendre.' }, { status: 400 });
    if (!requestedIds.length) return NextResponse.json({ error: 'Sélectionne au moins un élève.' }, { status: 400 });

    const drive = getDrive();
    const allStudents = await listStudents(drive);
    const requested = new Set(requestedIds);
    const students = allStudents.filter((student) => requested.has(student.id));

    const results = await Promise.all(students.map(async (student) => {
      try {
        const subject = await findChildFolder(drive, student.id, subjectName);
        if (!subject) {
          return { studentId: student.id, student: student.name, status: 'not_submitted', files: [], fileCount: 0, latestModifiedTime: null };
        }

        let folderId = await resolvePath(drive, subject.id, normalizeSegments(destinationPath), false);
        if (workPath.trim()) {
          folderId = await resolvePath(drive, folderId, normalizeSegments(workPath), false);
        }

        const files = await listFilesRecursive(drive, folderId);
        const latestModifiedTime = files
          .map((file) => file.modifiedTime)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) || null;

        return {
          studentId: student.id,
          student: student.name,
          status: files.length ? 'submitted' : 'empty',
          fileCount: files.length,
          latestModifiedTime,
          files: files.map((file) => ({
            id: file.id,
            name: file.name,
            relativePath: file.relativePath,
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime
          }))
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        if (/introuvable/i.test(message)) {
          return { studentId: student.id, student: student.name, status: 'not_submitted', files: [], fileCount: 0, latestModifiedTime: null };
        }
        return { studentId: student.id, student: student.name, status: 'error', files: [], fileCount: 0, latestModifiedTime: null, message };
      }
    }));

    const submitted = results.filter((r) => r.status === 'submitted').length;
    const empty = results.filter((r) => r.status === 'empty').length;
    const notSubmitted = results.filter((r) => r.status === 'not_submitted').length;
    const errors = results.filter((r) => r.status === 'error').length;

    return NextResponse.json({
      subjectName,
      destinationPath,
      workPath,
      total: results.length,
      submitted,
      empty,
      notSubmitted,
      errors,
      results
    });
  } catch (error: any) {
    if (error?.message === 'Mot de passe invalide.') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur inconnue' }, { status: 500 });
  }
}
