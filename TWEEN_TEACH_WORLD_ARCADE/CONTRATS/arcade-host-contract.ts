/**
 * Contrat logique indicatif, indépendant du framework et du transport.
 * Ce fichier ne crée aucune route, table, session ou autorisation.
 * Adapter aux types/services existants ; valider les réponses à l'exécution.
 * Les méthodes serveur déduisent l'identité de la session, jamais d'un userId fourni ici.
 */
export type GameId = 'code-station' | 'cyber-funk';
export type PeriodId = 'week' | 'month' | 'all_time';
export type ScopeRef = string; // Référence opaque issue des capacités serveur, non une autorisation.
export type AvatarId = string; // À valider dans le catalogue d'avatars autorisés.

export interface GradeView {
  id: string;
  label: string;
  division: string | null;
  iconAssetId: string | null;
}

/** DTO explicitement projeté : pas d'e-mail, de rôle, de classe, de note ou de dernière présence. */
export interface PlayerCard {
  publicId: string;
  handle: string;
  avatarId: AvatarId;
  grade: GradeView | null;
}

export interface ScopeOption {
  ref: ScopeRef;
  kind: 'class' | 'community';
  label: string;
}

export interface Capabilities {
  canEditOwnProfile: boolean;
  canRegisterExternalAccount: boolean;
  canChangePublicVisibility: boolean;
  canReadPublishedGrades: boolean;
  playerScopes: readonly ScopeOption[];
  leaderboardScopes: readonly ScopeOption[];
  leaderboardPeriods: readonly PeriodId[];
  leaderboardGames: readonly GameId[];
  combinedLeaderboardSupported: boolean;
}

export type SessionView =
  | { kind: 'guest'; capabilities: Capabilities }
  | {
      kind: 'authenticated';
      player: PlayerCard;
      emailVerification: 'verified' | 'pending' | 'not_required';
      capabilities: Capabilities;
    };

export interface ReadOptions { signal?: AbortSignal }

export interface GameView {
  id: GameId;
  title: string;
  description: string;
  imageAssetId: string;
  availability: 'playable' | 'resume_available' | 'auth_required' |
    'verification_required' | 'locked' | 'unavailable';
  accessHint: string | null; // Texte court autorisé, pas une trace d'erreur interne.
  progress: { label: string; completed: number; total: number } | null;
}

export interface PlayerQuery {
  scopeRef: ScopeRef;
  query?: string;
  cursor?: string;
  pageSize?: number; // Limite supérieure contrôlée côté serveur.
  sort?: 'handle' | 'grade';
}
export interface PlayerPage {
  items: readonly PlayerCard[];
  nextCursor: string | null;
  visibleTotal: number | null;
}
export interface PlayerDetail extends PlayerCard {
  achievements: readonly { id: string; title: string; iconAssetId: string | null }[];
}

export interface LeaderboardQuery {
  scopeRef: ScopeRef;
  period: PeriodId;
  gameId: GameId | 'combined'; // 'combined' uniquement si métrique commune réellement supportée.
}
export interface LeaderboardEntry {
  rank: number;
  player: PlayerCard;
  score: number;
  tied: boolean;
}
export type LeaderboardView =
  | { kind: 'unavailable'; reason: 'metric_missing' | 'validation_missing' | 'temporarily_unavailable' }
  | {
      kind: 'ready';
      items: readonly LeaderboardEntry[]; // Invariant runtime impératif : 0 <= length <= 5.
      metric: { id: string; label: string; unit: string | null };
      period: { id: PeriodId; timeZone: string; startInclusive: string | null; endExclusive: string | null };
      computedAt: string;
      ownPosition: { rank: number; score: number; tied: boolean } | null; // Uniquement identité courante.
      // Aucun curseur, aucune liste supplémentaire, aucun voisin hors Top 5.
    };

export interface OwnProfile extends PlayerCard {
  visibility: 'private' | 'community';
  communityRankingParticipation: boolean;
  completedMissionCount: number | null;
}
export interface ProfilePatch {
  handle?: string;
  avatarId?: AvatarId;
  visibility?: 'private' | 'community';
  communityRankingParticipation?: boolean;
  // Pas de grade, de rôle, de compteur XP ou d'affiliation scolaire modifiable par ce contrat.
}

export type GradeCatalogue =
  | { kind: 'unavailable' }
  | { kind: 'ready'; source: 'host'; entries: readonly GradeView[] };

export type LaunchDecision =
  | { kind: 'ready'; destination: string } // Destination issue du mapping hôte, validée avant navigation.
  | { kind: 'auth_required' }
  | { kind: 'verification_required' }
  | { kind: 'locked'; hint?: string }
  | { kind: 'unavailable' };

export interface ArcadeHostAdapter {
  getSession(options?: ReadOptions): Promise<SessionView>;
  listGames(options?: ReadOptions): Promise<readonly GameView[]>;
  listPlayers(query: PlayerQuery, options?: ReadOptions): Promise<PlayerPage>;
  getPlayer(publicId: string, scopeRef: ScopeRef, options?: ReadOptions): Promise<PlayerDetail>;
  getLeaderboard(query: LeaderboardQuery, options?: ReadOptions): Promise<LeaderboardView>;
  getOwnProfile(options?: ReadOptions): Promise<OwnProfile>;
  updateOwnProfile(patch: ProfilePatch): Promise<OwnProfile>;
  getGradeCatalogue(options?: ReadOptions): Promise<GradeCatalogue>;
  requestLaunch(gameId: GameId, options?: ReadOptions): Promise<LaunchDecision>;
}

/** Reprendre les écrans/actions d'authentification du dépôt plutôt que coder une seconde identité. */
export interface HostAccountNavigation {
  open(flow: 'sign_in' | 'register' | 'verify_email' | 'reset_password', resumeGameId?: GameId): void;
  signOut(): Promise<void>;
}

/**
 * Hors de ce contrat UI : validation de code/tentatives, récompenses et sauvegardes de moteur.
 * Elles restent dans les systèmes hôtes, avec contrôle serveur et déduplication métier.
 * Ni emitDemoComplete, ni setXP, ni setRole, ni markMissionCompleted sont exposés à l'UI.
 */
