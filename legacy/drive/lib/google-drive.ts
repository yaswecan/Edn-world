import { google, drive_v3 } from 'googleapis';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { normalizeSegments, pathKey, safeFolderName } from './path-utils.mjs';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';

type DriveFolder = { id: string; name: string; viaShortcut?: boolean };

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function getDrive(): drive_v3.Drive {
  const clientEmail = getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getRequiredEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATED_USER || undefined
  });

  return google.drive({ version: 'v3', auth });
}

export async function getFolderInfo(drive: drive_v3.Drive, folderId: string) {
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id,name,mimeType,parents,driveId,shortcutDetails(targetId,targetMimeType)',
    supportsAllDrives: true
  });

  const file = response.data;
  if (!file.id) throw new Error(`Dossier inaccessible : ${folderId}`);
  return file;
}

export async function resolveFolderReference(drive: drive_v3.Drive, folderId: string) {
  const info = await getFolderInfo(drive, folderId);

  if (info.mimeType === FOLDER_MIME) {
    return {
      id: info.id!,
      name: info.name || '(sans nom)',
      viaShortcut: false,
      driveId: info.driveId || null
    };
  }

  if (
    info.mimeType === SHORTCUT_MIME &&
    info.shortcutDetails?.targetId &&
    info.shortcutDetails?.targetMimeType === FOLDER_MIME
  ) {
    const target = await getFolderInfo(drive, info.shortcutDetails.targetId);
    return {
      id: target.id!,
      name: target.name || info.name || '(sans nom)',
      viaShortcut: true,
      driveId: target.driveId || null
    };
  }

  throw new Error(
    `GOOGLE_DRIVE_ELEVES_FOLDER_ID ne pointe pas vers un dossier Drive (type reçu : ${info.mimeType || 'inconnu'}).`
  );
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Liste les éléments d'un dossier parent.
 *
 * PATCH SHARED DRIVE :
 * - supportsAllDrives: true
 * - includeItemsFromAllDrives: true
 * - si le parent a un driveId, corpora='drive' + driveId
 *
 * Cela permet de lister correctement les enfants d'un dossier situé dans un
 * Drive partagé, et pas seulement dans My Drive.
 */
async function listChildrenRaw(
  drive: drive_v3.Drive,
  parentId: string,
  fields: string,
  orderBy = 'name'
) {
  const parentInfo = await getFolderInfo(drive, parentId);
  const sharedDriveId = parentInfo.driveId || undefined;

  const output: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${escapeDriveQuery(parentId)}' in parents and trashed = false`,
      fields: `nextPageToken, files(${fields})`,
      pageSize: 1000,
      pageToken,
      orderBy,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(sharedDriveId
        ? {
            corpora: 'drive' as const,
            driveId: sharedDriveId
          }
        : {})
    });

    output.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return output;
}

/**
 * Liste les dossiers navigables d'un parent.
 * Supporte les vrais dossiers Drive et les raccourcis vers des dossiers.
 */
export async function listChildFolders(
  drive: drive_v3.Drive,
  parentId: string
): Promise<DriveFolder[]> {
  const files = await listChildrenRaw(
    drive,
    parentId,
    'id,name,mimeType,driveId,shortcutDetails(targetId,targetMimeType)'
  );

  const folders: DriveFolder[] = [];

  for (const file of files) {
    if (!file.name) continue;

    if (file.mimeType === FOLDER_MIME && file.id) {
      folders.push({ id: file.id, name: file.name });
      continue;
    }

    const targetId = file.shortcutDetails?.targetId;
    const targetMimeType = file.shortcutDetails?.targetMimeType;

    if (
      file.mimeType === SHORTCUT_MIME &&
      targetId &&
      targetMimeType === FOLDER_MIME
    ) {
      folders.push({
        id: targetId,
        name: file.name,
        viaShortcut: true
      });
    }
  }

  return folders;
}

export async function listRawChildren(drive: drive_v3.Drive, parentId: string) {
  const files = await listChildrenRaw(
    drive,
    parentId,
    'id,name,mimeType,driveId,shortcutDetails(targetId,targetMimeType)'
  );

  return files.map((file) => ({
    id: file.id || '',
    name: file.name || '(sans nom)',
    mimeType: file.mimeType || '(inconnu)',
    driveId: file.driveId || null,
    shortcutTargetId: file.shortcutDetails?.targetId || null,
    shortcutTargetMimeType: file.shortcutDetails?.targetMimeType || null
  }));
}

export async function getStudentsRoot(drive: drive_v3.Drive) {
  const rootId = getRequiredEnv('GOOGLE_DRIVE_ELEVES_FOLDER_ID');
  return resolveFolderReference(drive, rootId);
}

export async function listStudents(drive: drive_v3.Drive) {
  const root = await getStudentsRoot(drive);
  return listChildFolders(drive, root.id);
}

export async function findChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
): Promise<DriveFolder | null> {
  const children = await listChildFolders(drive, parentId);
  return children.find((child) => child.name === name) || null;
}

export async function createFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
) {
  const response = await drive.files.create({
    requestBody: {
      name: safeFolderName(name),
      mimeType: FOLDER_MIME,
      parents: [parentId]
    },
    fields: 'id,name,driveId',
    supportsAllDrives: true
  });

  if (!response.data.id || !response.data.name) {
    throw new Error(`Impossible de créer le dossier ${name}`);
  }

  return {
    id: response.data.id,
    name: response.data.name
  };
}

export async function discoverPathsForStudent(
  drive: drive_v3.Drive,
  studentFolderId: string,
  maxDepth = 5
): Promise<string[][]> {
  const output: string[][] = [];

  async function walk(parentId: string, prefix: string[], depth: number) {
    if (depth >= maxDepth) return;

    const children = await listChildFolders(drive, parentId);

    for (const child of children) {
      const next = [...prefix, child.name];
      output.push(next);
      await walk(child.id, next, depth + 1);
    }
  }

  await walk(studentFolderId, [], 0);
  return output;
}

/** Découvre uniquement les dossiers à l'intérieur d'une matière donnée. */
export async function discoverPathsInsideSubject(
  drive: drive_v3.Drive,
  studentFolderId: string,
  subjectName: string,
  maxDepth = 4
): Promise<string[][]> {
  const subject = await findChildFolder(drive, studentFolderId, subjectName);
  if (!subject) return [];
  return discoverPathsForStudent(drive, subject.id, maxDepth);
}

export async function resolvePath(
  drive: drive_v3.Drive,
  startFolderId: string,
  segments: string[],
  createMissing: boolean
) {
  let parentId = startFolderId;
  const normalized = normalizeSegments(segments);

  for (let index = 0; index < normalized.length; index += 1) {
    const segment = normalized[index];
    let folder = await findChildFolder(drive, parentId, segment);

    if (!folder && createMissing) {
      folder = await createFolder(drive, parentId, segment);
    }

    if (!folder) {
      throw new Error(
        `Dossier introuvable : ${pathKey(normalized.slice(0, index + 1))}`
      );
    }

    parentId = folder.id;
  }

  return parentId;
}

export async function ensureChildFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
) {
  const safe = safeFolderName(name);
  if (!safe) return parentId;

  const existing = await findChildFolder(drive, parentId, safe);
  return existing?.id || (await createFolder(drive, parentId, safe)).id;
}

export async function fileExists(
  drive: drive_v3.Drive,
  parentId: string,
  name: string
) {
  const parentInfo = await getFolderInfo(drive, parentId);
  const sharedDriveId = parentInfo.driveId || undefined;

  const response = await drive.files.list({
    q: `'${escapeDriveQuery(parentId)}' in parents and name='${escapeDriveQuery(name)}' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: 1,
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(sharedDriveId
      ? {
          corpora: 'drive' as const,
          driveId: sharedDriveId
        }
      : {})
  });

  return Boolean((response.data.files || []).length);
}

export async function uploadBuffer(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
  mimeType: string,
  buffer: Buffer,
  skipExisting = true
) {
  if (skipExisting && (await fileExists(drive, parentId, name))) {
    return { status: 'skipped' as const };
  }

  const response = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId]
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from([buffer])
    },
    fields: 'id,name,driveId',
    supportsAllDrives: true
  });

  if (!response.data.id) {
    throw new Error(`Échec de l'upload : ${name}`);
  }

  return {
    status: 'created' as const,
    id: response.data.id
  };
}


export type DriveTreeEntry = {
  id: string;
  name: string;
  mimeType: string;
  relativePath: string;
  modifiedTime?: string | null;
  size?: number | null;
};

/** Liste fichiers + dossiers d'un parent, Shared Drives inclus. */
export async function listChildren(
  drive: drive_v3.Drive,
  parentId: string
) {
  return listChildrenRaw(
    drive,
    parentId,
    'id,name,mimeType,modifiedTime,size,driveId,shortcutDetails(targetId,targetMimeType)'
  );
}

/** Parcourt récursivement un dossier de rendu et retourne uniquement les fichiers. */
export async function listFilesRecursive(
  drive: drive_v3.Drive,
  folderId: string,
  prefix: string[] = []
): Promise<DriveTreeEntry[]> {
  const children = await listChildren(drive, folderId);
  const output: DriveTreeEntry[] = [];

  for (const child of children) {
    if (!child.id || !child.name) continue;

    if (child.mimeType === FOLDER_MIME) {
      output.push(...await listFilesRecursive(drive, child.id, [...prefix, child.name]));
      continue;
    }

    if (
      child.mimeType === SHORTCUT_MIME &&
      child.shortcutDetails?.targetId &&
      child.shortcutDetails?.targetMimeType === FOLDER_MIME
    ) {
      output.push(...await listFilesRecursive(
        drive,
        child.shortcutDetails.targetId,
        [...prefix, child.name]
      ));
      continue;
    }

    output.push({
      id: child.shortcutDetails?.targetId || child.id,
      name: child.name,
      mimeType: child.shortcutDetails?.targetMimeType || child.mimeType || 'application/octet-stream',
      relativePath: [...prefix, child.name].join('/'),
      modifiedTime: child.modifiedTime || null,
      size: child.size ? Number(child.size) : null
    });
  }

  return output;
}

const GOOGLE_EXPORTS: Record<string, { mimeType: string; extension: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    extension: '.pdf'
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx'
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extension: '.pptx'
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    extension: '.pdf'
  }
};

/** Télécharge un fichier Drive. Les Docs/Sheets/Slides natifs sont exportés. */
export async function downloadDriveFile(
  drive: drive_v3.Drive,
  fileId: string,
  name: string,
  mimeType: string
): Promise<{ buffer: Buffer; name: string }> {
  const exportSpec = GOOGLE_EXPORTS[mimeType];

  if (exportSpec) {
    const response = await drive.files.export(
      { fileId, mimeType: exportSpec.mimeType },
      { responseType: 'arraybuffer' }
    );
    const base = name.replace(/\.[^/.]+$/, '');
    return {
      buffer: Buffer.from(response.data as ArrayBuffer),
      name: `${base}${exportSpec.extension}`
    };
  }

  if (mimeType.startsWith('application/vnd.google-apps.')) {
    throw new Error(`Type Google Drive non exportable automatiquement : ${mimeType}`);
  }

  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );

  return {
    buffer: Buffer.from(response.data as ArrayBuffer),
    name
  };
}
