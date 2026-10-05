'use client';

import React, { FormEvent, useMemo, useState } from 'react';

type Subject = {
  name: string;
  availableStudents: number;
  totalStudents: number;
  coverage: number;
};

type FolderPath = {
  path: string;
  segments: string[];
  availableStudents: number;
  totalStudents: number;
  coverage: number;
};

type Student = { id: string; name: string };
type UploadItem = { file: File; relativePath: string };

type DistributionResult = {
  subjectName: string;
  destinationPath: string;
  extraPath: string;
  total: number;
  success: number;
  errors: number;
  results: Array<{
    student: string;
    status: 'success' | 'error';
    created?: number;
    skipped?: number;
    message?: string;
  }>;
};

type SubmissionScan = {
  subjectName: string;
  destinationPath: string;
  workPath: string;
  total: number;
  submitted: number;
  empty: number;
  notSubmitted: number;
  errors: number;
  results: Array<{
    studentId: string;
    student: string;
    status: 'submitted' | 'empty' | 'not_submitted' | 'error';
    fileCount: number;
    latestModifiedTime: string | null;
    message?: string;
  }>;
};

export default function Home() {
  const [password, setPassword] = useState('');
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectName, setSubjectName] = useState('');
  const [folders, setFolders] = useState<FolderPath[]>([]);
  const [destinationPath, setDestinationPath] = useState('');
  const [extraPath, setExtraPath] = useState('');
  const [createMissing, setCreateMissing] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [warning, setWarning] = useState('');
  const [rootInfo, setRootInfo] = useState<{name:string; authMode:string; viaShortcut?:boolean} | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DistributionResult | null>(null);

  const [activeTab, setActiveTab] = useState<'distribute' | 'submissions'>('distribute');
  const [workPath, setWorkPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [submissionScan, setSubmissionScan] = useState<SubmissionScan | null>(null);
  const [submissionSelectedIds, setSubmissionSelectedIds] = useState<string[]>([]);

  const selectedSubject = useMemo(() => subjects.find((s) => s.name === subjectName), [subjects, subjectName]);
  const selectedFolder = useMemo(() => folders.find((f) => f.path === destinationPath), [folders, destinationPath]);

  async function loadStructure() {
    setError('');
    setWarning('');
    setResult(null);
    setLoadingStructure(true);
    try {
      const response = await fetch('/api/folders', { headers: { 'x-app-password': password } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de lire ELEVES.');
      const loadedStudents: Student[] = data.studentList || [];
      setStudentList(loadedStudents);
      setSelectedStudentIds(loadedStudents.map((student) => student.id));
      setSubjects(data.subjects || []);
      setRootInfo(data.root || null);
      setWarning(data.warning || '');
      setFolders([]);
      setDestinationPath('');

      const first = data.subjects?.[0]?.name || '';
      setSubjectName(first);
      if (first) await loadFoldersForSubject(first);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoadingStructure(false);
    }
  }

  async function loadFoldersForSubject(subject: string) {
    if (!subject) {
      setFolders([]);
      setDestinationPath('');
      return;
    }
    setError('');
    setWarning('');
    setLoadingFolders(true);
    try {
      const response = await fetch(`/api/folders?subject=${encodeURIComponent(subject)}`, {
        headers: { 'x-app-password': password }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de lire la matière.');
      if (data.studentList) setStudentList(data.studentList);
      setSubjects(data.subjects || []);
      setRootInfo(data.root || null);
      setFolders(data.folders || []);
      setWarning(data.warning || '');
      setDestinationPath(data.folders?.[0]?.path || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
      setFolders([]);
      setDestinationPath('');
    } finally {
      setLoadingFolders(false);
    }
  }

  async function onSubjectChange(value: string) {
    setSubjectName(value);
    setDestinationPath('');
    await loadFoldersForSubject(value);
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }
  function selectAllStudents() { setSelectedStudentIds(studentList.map((student) => student.id)); }
  function clearStudents() { setSelectedStudentIds([]); }
  function addUploads(fileList: FileList | null, preserveFolders: boolean) {
    if (!fileList) return;
    setUploads(Array.from(fileList).map((file) => ({
      file,
      relativePath: preserveFolders ? ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name) : file.name
    })));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult(null);
    if (!selectedStudentIds.length) return setError('Sélectionne au moins un élève.');
    if (!subjectName) return setError('Choisis une matière.');
    if (!destinationPath) return setError('Choisis un dossier dans la matière.');
    if (!uploads.length && !extraPath.trim()) return setError('Ajoute un fichier/dossier ou une arborescence à créer.');

    setSending(true);
    try {
      const form = new FormData();
      form.set('subjectName', subjectName);
      form.set('destinationPath', destinationPath);
      form.set('extraPath', extraPath);
      form.set('studentIds', JSON.stringify(selectedStudentIds));
      form.set('createMissing', String(createMissing));
      form.set('skipExisting', String(skipExisting));
      for (const upload of uploads) { form.append('files', upload.file); form.append('relativePaths', upload.relativePath); }

      const response = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'x-app-password': password },
        body: form
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Échec de la distribution.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSending(false);
    }
  }


  async function scanSubmissions() {
    setError('');
    setSubmissionScan(null);
    if (!selectedStudentIds.length) return setError('Sélectionne au moins un élève.');
    if (!subjectName || !destinationPath) return setError('Choisis une matière et le dossier de rendu.');

    setScanning(true);
    try {
      const response = await fetch('/api/submissions/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': password
        },
        body: JSON.stringify({
          subjectName,
          destinationPath,
          workPath,
          studentIds: selectedStudentIds
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de collecter les rendus.');
      setSubmissionScan(data);
      setSubmissionSelectedIds(
        data.results.filter((r: SubmissionScan['results'][number]) => r.status === 'submitted').map((r: SubmissionScan['results'][number]) => r.studentId)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setScanning(false);
    }
  }

  async function downloadSubmissions() {
    if (!submissionSelectedIds.length) return setError('Aucun rendu sélectionné à télécharger.');
    setDownloading(true);
    setError('');
    try {
      const response = await fetch('/api/submissions/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': password
        },
        body: JSON.stringify({
          subjectName,
          destinationPath,
          workPath,
          studentIds: submissionSelectedIds
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Impossible de générer le ZIP.');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || 'rendus.zip';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setDownloading(false);
    }
  }

  function toggleSubmissionStudent(id: string) {
    setSubmissionSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  }


  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">PORTAIL PROFESSEUR</div>
        <h1>Documents & rendus</h1>
        <p className="lead">
          Distribue les documents aux bons élèves, puis collecte leurs rendus en un ZIP organisé automatiquement par élève.
        </p>

        <div className="grid two">
          <label className="field">
            <span>Mot de passe de l'application</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
          <div className="field actionField">
            <span>Élèves et matières</span>
            <button className="secondary" type="button" onClick={loadStructure} disabled={loadingStructure}>
              {loadingStructure ? 'Lecture de ELEVES…' : 'Lire ELEVES'}
            </button>
          </div>
        </div>

        {rootInfo && (
          <div className="info">
            Drive lu : <strong>{rootInfo.name}</strong> · {rootInfo.authMode}{rootInfo.viaShortcut ? ' · raccourci résolu' : ''}
          </div>
        )}
        {studentList.length > 0 && <div className="info">✓ {studentList.length} élèves détectés · {subjects.length} matière(s) trouvée(s).</div>}
        {warning && <div className="result partial">⚠️ {warning}</div>}
        {error && <div className="result error">❌ {error}</div>}

        <div className="tabs">
          <button type="button" className={activeTab === 'distribute' ? 'tab active' : 'tab'} onClick={() => setActiveTab('distribute')}>Distribuer</button>
          <button type="button" className={activeTab === 'submissions' ? 'tab active' : 'tab'} onClick={() => setActiveTab('submissions')}>Récupérer les rendus</button>
        </div>

        {activeTab === 'distribute' ? (
        <>
        <form onSubmit={submit}>
          <div className="field">
            <div className="fieldHeader"><span>1. Élèves ciblés</span><div className="inlineActions"><button type="button" className="mini" onClick={selectAllStudents}>Tous</button><button type="button" className="mini" onClick={clearStudents}>Aucun</button></div></div>
            <div className="studentPicker">
              {studentList.map((student) => <label className="studentCheck" key={student.id}><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} /><span>{student.name}</span></label>)}
            </div>
            <small>{selectedStudentIds.length}/{studentList.length} élève(s) sélectionné(s)</small>
          </div>
          <label className="field">
            <span>2. Matière</span>
            <select value={subjectName} onChange={(e) => onSubjectChange(e.target.value)} disabled={!subjects.length || loadingFolders}>
              {!subjects.length && <option value="">Charge d'abord ELEVES</option>}
              {subjects.map((subject) => (
                <option key={subject.name} value={subject.name}>
                  {subject.name} — {subject.availableStudents}/{subject.totalStudents} élèves
                </option>
              ))}
            </select>
          </label>

          {selectedSubject && selectedSubject.coverage < 1 && (
            <div className="coverage warn">
              Cette matière existe chez <strong>{selectedSubject.availableStudents}/{selectedSubject.totalStudents}</strong> élèves.
            </div>
          )}

          <label className="field">
            <span>3. Dossier dans la matière</span>
            <select value={destinationPath} onChange={(e) => setDestinationPath(e.target.value)} disabled={!folders.length || loadingFolders}>
              {loadingFolders && <option value="">Lecture des dossiers…</option>}
              {!loadingFolders && !folders.length && <option value="">Aucun dossier chargé</option>}
              {folders.map((folder) => (
                <option key={folder.path} value={folder.path}>
                  {folder.path} — {folder.availableStudents}/{folder.totalStudents} élèves
                </option>
              ))}
            </select>
          </label>

          {selectedFolder && (
            <div className={selectedFolder.coverage === 1 ? 'coverage good' : 'coverage warn'}>
              Destination : <strong>{subjectName} / {selectedFolder.path}</strong><br />
              Présente chez <strong>{selectedFolder.availableStudents}/{selectedFolder.totalStudents}</strong> élèves.
            </div>
          )}

          <label className="field">
            <span>4. Arborescence supplémentaire à créer <small>(facultatif)</small></span>
            <input value={extraPath} onChange={(e) => setExtraPath(e.target.value)} placeholder="Ex. BC04 - CSS3 / Séance 01 / Ressources" />
            <small>Utilise « / » pour créer plusieurs niveaux de dossiers.</small>
          </label>
          <div className="grid two">
            <label className="field upload"><span>5A. Fichier(s)</span><input type="file" multiple onChange={(e) => addUploads(e.target.files, false)} /><small>Plusieurs fichiers possibles.</small></label>
            <label className="field upload"><span>5B. Dossier complet</span><input type="file" multiple {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(e) => addUploads(e.target.files, true)} /><small>L'arborescence interne est conservée.</small></label>
          </div>
          {uploads.length > 0 && <div className="treePreview"><strong>{uploads.length} fichier(s) prêt(s)</strong>{uploads.slice(0,30).map((upload,index)=><div key={`${upload.relativePath}-${index}`}>📄 {upload.relativePath}</div>)}{uploads.length>30&&<div>… et {uploads.length-30} autre(s)</div>}</div>}

          <div className="checks">
            <label><input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} /> Créer les matières/dossiers absents chez certains élèves</label>
            <label><input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} /> Ne pas dupliquer un fichier déjà présent</label>
          </div>

          <button className="primary" disabled={sending || !subjectName || !destinationPath || !selectedStudentIds.length}>
            {sending ? 'Distribution en cours…' : `Distribuer à ${selectedStudentIds.length} élève(s)`}
          </button>
        </form>

        {result && (
          <div className={result.errors ? 'result partial' : 'result success'}>
            <h2>{result.errors ? 'Distribution partielle' : 'Distribution terminée'}</h2>
            <p><strong>{result.success}/{result.total}</strong> élèves servis.</p>
            <p className="muted">
              {result.subjectName} / {result.destinationPath}{result.extraPath ? ` / ${result.extraPath}` : ''}
            </p>
            {result.results.filter((r) => r.status === 'error').map((r) => (
              <div key={r.student}>❌ <strong>{r.student}</strong> — {r.message}</div>
            ))}
          </div>
        )}
        </>
        ) : (
          <div className="submissionsPanel">
            <div className="field">
              <div className="fieldHeader">
                <span>1. Élèves à vérifier</span>
                <div className="inlineActions">
                  <button type="button" className="mini" onClick={selectAllStudents}>Tous</button>
                  <button type="button" className="mini" onClick={clearStudents}>Aucun</button>
                </div>
              </div>
              <div className="studentPicker">
                {studentList.map((student) => (
                  <label className="studentCheck" key={student.id}>
                    <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                    <span>{student.name}</span>
                  </label>
                ))}
              </div>
              <small>{selectedStudentIds.length}/{studentList.length} élève(s) vérifié(s)</small>
            </div>

            <label className="field">
              <span>2. Matière</span>
              <select value={subjectName} onChange={(e) => onSubjectChange(e.target.value)} disabled={!subjects.length || loadingFolders}>
                {!subjects.length && <option value="">Charge d'abord ELEVES</option>}
                {subjects.map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}
              </select>
            </label>

            <label className="field">
              <span>3. Dossier de rendu</span>
              <select value={destinationPath} onChange={(e) => setDestinationPath(e.target.value)} disabled={!folders.length || loadingFolders}>
                {!folders.length && <option value="">Aucun dossier chargé</option>}
                {folders.map((folder) => <option key={folder.path} value={folder.path}>{folder.path}</option>)}
              </select>
              <small>Choisis par exemple « 03 - À rendre ».</small>
            </label>

            <label className="field">
              <span>4. Travail / sous-dossier <small>(facultatif)</small></span>
              <input value={workPath} onChange={(e) => setWorkPath(e.target.value)} placeholder="Ex. BC04 - CSS3 - Appliquer un style à une interface web" />
              <small>Laisse vide si les fichiers sont déposés directement dans le dossier choisi.</small>
            </label>

            <button type="button" className="primary" onClick={scanSubmissions} disabled={scanning || !selectedStudentIds.length || !subjectName || !destinationPath}>
              {scanning ? 'Collecte en cours…' : `Collecter les rendus de ${selectedStudentIds.length} élève(s)`}
            </button>

            {submissionScan && (
              <div className="submissionResults">
                <div className="statsGrid">
                  <div className="stat good"><strong>{submissionScan.submitted}</strong><span>Rendus</span></div>
                  <div className="stat warn"><strong>{submissionScan.empty}</strong><span>Dossiers vides</span></div>
                  <div className="stat bad"><strong>{submissionScan.notSubmitted}</strong><span>Non rendus</span></div>
                  <div className="stat"><strong>{submissionScan.errors}</strong><span>Erreurs</span></div>
                </div>

                <div className="fieldHeader submissionHeader">
                  <strong>Copies détectées</strong>
                  <div className="inlineActions">
                    <button type="button" className="mini" onClick={() => setSubmissionSelectedIds(submissionScan.results.filter((r) => r.status === 'submitted').map((r) => r.studentId))}>Tous les rendus</button>
                    <button type="button" className="mini" onClick={() => setSubmissionSelectedIds([])}>Aucun</button>
                  </div>
                </div>

                <div className="submissionList">
                  {submissionScan.results.map((row) => (
                    <label key={row.studentId} className={`submissionRow ${row.status}`}>
                      <input
                        type="checkbox"
                        disabled={row.status !== 'submitted'}
                        checked={submissionSelectedIds.includes(row.studentId)}
                        onChange={() => toggleSubmissionStudent(row.studentId)}
                      />
                      <div className="submissionName"><strong>{row.student}</strong><span>{row.fileCount} fichier(s){row.latestModifiedTime ? ` · ${new Date(row.latestModifiedTime).toLocaleString('fr-FR')}` : ''}</span></div>
                      <span className="statusBadge">
                        {row.status === 'submitted' ? 'Rendu' : row.status === 'empty' ? 'Dossier vide' : row.status === 'not_submitted' ? 'Non rendu' : 'Erreur'}
                      </span>
                    </label>
                  ))}
                </div>

                <button type="button" className="primary" onClick={downloadSubmissions} disabled={downloading || !submissionSelectedIds.length}>
                  {downloading ? 'Création du ZIP…' : `Télécharger ${submissionSelectedIds.length} rendu(s) (.zip)`}
                </button>
                <small className="downloadHint">Le ZIP contient un dossier par élève et un fichier _rapport.csv. Les Google Docs/Sheets/Slides sont exportés automatiquement.</small>
              </div>
            )}
          </div>
        )}

      </section>
    </main>
  );
}
