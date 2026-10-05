import { NextRequest, NextResponse } from 'next/server';
import { assertAppPassword } from '../../../lib/auth';
import {
  discoverPathsInsideSubject,
  getDrive,
  getStudentsRoot,
  listChildFolders,
  listRawChildren,
  listStudents
} from '../../../lib/google-drive';
import { mergeStudentPaths } from '../../../lib/path-utils.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function friendlyGoogleError(error: unknown) {
  const anyError = error as any;
  const status = anyError?.response?.status || anyError?.code;
  const apiMessage =
    anyError?.response?.data?.error?.message ||
    anyError?.errors?.[0]?.message ||
    anyError?.message;

  if (status === 403) {
    return `Google Drive refuse l'accès (403). Vérifie que ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'le compte de service'} est au minimum Contributeur sur le Drive partagé / dossier ELEVES.`;
  }

  if (status === 404) {
    return 'Dossier ELEVES introuvable ou inaccessible (404). Vérifie GOOGLE_DRIVE_ELEVES_FOLDER_ID.';
  }

  if (String(apiMessage || '').includes('unauthorized_client')) {
    return 'Google refuse l’impersonation (unauthorized_client). Si tu utilises le compte de service directement, laisse GOOGLE_IMPERSONATED_USER vide.';
  }

  if (String(apiMessage || '').includes('invalid_grant')) {
    return 'Authentification Google invalide (invalid_grant). Vérifie GOOGLE_PRIVATE_KEY et GOOGLE_IMPERSONATED_USER.';
  }

  return apiMessage || 'Erreur Google Drive inconnue.';
}

function mergeNames(perStudentNames: string[][]) {
  const totalStudents = perStudentNames.length;
  const counts = new Map<string, number>();

  for (const names of perStudentNames) {
    for (const name of new Set(names)) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, availableStudents]) => ({
      name,
      availableStudents,
      totalStudents,
      coverage: totalStudents ? availableStudents / totalStudents : 0
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function GET(request: NextRequest) {
  try {
    assertAppPassword(request);

    const drive = getDrive();
    const root = await getStudentsRoot(drive);

    console.log('[DRIVE] Root ELEVES', {
      id: root.id,
      name: root.name,
      driveId: root.driveId,
      viaShortcut: root.viaShortcut,
      serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      impersonatedUser: process.env.GOOGLE_IMPERSONATED_USER || null
    });

    const rawRootChildren = await listRawChildren(drive, root.id);
    console.log('[DRIVE] Enfants bruts du dossier ELEVES', rawRootChildren);

    const students = await listStudents(drive);
    console.log(
      '[DRIVE] Dossiers élèves détectés',
      students.map((student) => ({ name: student.name, id: student.id }))
    );

    if (!students.length) {
      return NextResponse.json({
        students: 0,
        studentList: [],
        subjects: [],
        folders: [],
        root: {
          id: root.id,
          name: root.name,
          viaShortcut: root.viaShortcut,
          driveId: root.driveId,
          authMode: process.env.GOOGLE_IMPERSONATED_USER
            ? `Utilisateur Workspace : ${process.env.GOOGLE_IMPERSONATED_USER}`
            : `Compte de service : ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(inconnu)'}`
        },
        warning: rawRootChildren.length
          ? `Le dossier « ${root.name} » contient ${rawRootChildren.length} élément(s), mais aucun n'est reconnu comme dossier élève. Consulte debugItems et le terminal VS Code.`
          : `Le dossier « ${root.name} » est accessible mais Google Drive API retourne 0 enfant pour ce compte. Vérifie que le compte de service a accès au Drive partagé qui contient réellement les dossiers élèves.`,
        debugItems: rawRootChildren.slice(0, 50)
      });
    }

    const subject = (request.nextUrl.searchParams.get('subject') || '').trim();

    // Matières directement à l'intérieur de chaque dossier élève.
    const subjectSettled = await Promise.allSettled(
      students.map(async (student) => {
        const folders = await listChildFolders(drive, student.id);
        console.log(`[DRIVE] Matières de ${student.name}`, folders.map((f) => f.name));
        return folders.map((folder) => folder.name);
      })
    );

    const subjectsByStudent = subjectSettled.map((entry, index) => {
      if (entry.status === 'fulfilled') return entry.value;
      console.error(`[DRIVE] Impossible de lire les matières de ${students[index]?.name}`, entry.reason);
      return [];
    });

    const subjects = mergeNames(subjectsByStudent);

    if (!subject) {
      return NextResponse.json({
        students: students.length,
        studentList: students.map((student) => ({ id: student.id, name: student.name })),
        subjects,
        folders: [],
        root: {
          id: root.id,
          name: root.name,
          viaShortcut: root.viaShortcut,
          driveId: root.driveId,
          authMode: process.env.GOOGLE_IMPERSONATED_USER
            ? `Utilisateur Workspace : ${process.env.GOOGLE_IMPERSONATED_USER}`
            : `Compte de service : ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(inconnu)'}`
        },
        debug: {
          students: students.map((s) => s.name),
          rawRootChildren: rawRootChildren.slice(0, 50)
        }
      });
    }

    const rawDepth = Number(process.env.DRIVE_DISCOVERY_MAX_DEPTH || '5');
    const maxDepth = Math.min(
      7,
      Math.max(1, Number.isFinite(rawDepth) ? rawDepth : 5)
    );

    const folderSettled = await Promise.allSettled(
      students.map((student) =>
        discoverPathsInsideSubject(drive, student.id, subject, maxDepth)
      )
    );

    const pathsByStudent = folderSettled.map((entry) =>
      entry.status === 'fulfilled' ? entry.value : []
    );

    const failedStudents = folderSettled
      .map((entry, index) =>
        entry.status === 'rejected' ? students[index].name : null
      )
      .filter(Boolean);

    return NextResponse.json({
      students: students.length,
      studentList: students.map((student) => ({ id: student.id, name: student.name })),
      subjects,
      folders: mergeStudentPaths(pathsByStudent),
      root: {
        id: root.id,
        name: root.name,
        viaShortcut: root.viaShortcut,
        driveId: root.driveId,
        authMode: process.env.GOOGLE_IMPERSONATED_USER
          ? `Utilisateur Workspace : ${process.env.GOOGLE_IMPERSONATED_USER}`
          : `Compte de service : ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(inconnu)'}`
      },
      failedStudents,
      warning: failedStudents.length
        ? `${failedStudents.length} dossier(s) élève n'ont pas pu être analysés.`
        : undefined
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Mot de passe de l’application incorrect.' },
        { status: 401 }
      );
    }

    console.error('GET /api/folders', error);
    return NextResponse.json(
      { error: friendlyGoogleError(error) },
      { status: 500 }
    );
  }
}
