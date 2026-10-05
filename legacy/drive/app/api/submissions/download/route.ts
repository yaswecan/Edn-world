import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { assertAppPassword } from '../../../../lib/auth';
import {
  downloadDriveFile,
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

function safeZipName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'sans-nom';
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

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

    if (!subjectName || !destinationPath || !requestedIds.length) {
      return NextResponse.json({ error: 'Paramètres de collecte incomplets.' }, { status: 400 });
    }

    const drive = getDrive();
    const allStudents = await listStudents(drive);
    const requested = new Set(requestedIds);
    const students = allStudents.filter((student) => requested.has(student.id));
    const zip = new JSZip();

    const report: string[][] = [[
      'eleve', 'statut', 'nombre_fichiers', 'derniere_modification'
    ]];

    for (const student of students) {
      let status = 'NON_RENDU';
      let fileCount = 0;
      let latest = '';

      try {
        const subject = await findChildFolder(drive, student.id, subjectName);
        if (subject) {
          let folderId = await resolvePath(drive, subject.id, normalizeSegments(destinationPath), false);
          if (workPath.trim()) {
            folderId = await resolvePath(drive, folderId, normalizeSegments(workPath), false);
          }

          const files = await listFilesRecursive(drive, folderId);
          fileCount = files.length;
          status = files.length ? 'RENDU' : 'DOSSIER_VIDE';
          latest = files.map((f) => f.modifiedTime || '').sort().at(-1) || '';

          if (files.length) {
            const studentFolder = zip.folder(safeZipName(student.name))!;
            for (const file of files) {
              try {
                const downloaded = await downloadDriveFile(drive, file.id, file.name, file.mimeType);
                const parts = normalizeSegments(file.relativePath);
                if (parts.length) parts[parts.length - 1] = downloaded.name;
                studentFolder.file(parts.join('/'), downloaded.buffer);
              } catch (error) {
                const msg = error instanceof Error ? error.message : 'Erreur téléchargement';
                studentFolder.file(`_ERREUR_${safeZipName(file.name)}.txt`, msg);
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        if (!/introuvable/i.test(message)) status = `ERREUR: ${message}`;
      }

      report.push([student.name, status, String(fileCount), latest]);
    }

    const csv = '\uFEFF' + report.map((row) => row.map(csvCell).join(';')).join('\r\n');
    zip.file('_rapport.csv', csv);

    const content = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const filename = safeZipName(
      `Rendus_${subjectName}_${workPath || destinationPath}_${new Date().toISOString().slice(0,10)}.zip`
    );

    return new NextResponse(Buffer.from(content), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (error: any) {
    if (error?.message === 'Mot de passe invalide.') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur inconnue' }, { status: 500 });
  }
}
