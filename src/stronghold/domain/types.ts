export const ROLES = ['economy', 'production', 'army', 'defenses'] as const;
export type Role = typeof ROLES[number];
export const PHRASE_LENGTHS = ['short', 'medium', 'long', 'extra-long'] as const;
export type PhraseLength = typeof PHRASE_LENGTHS[number];
export type Point = { x: number; y: number };
export type UnitKind = 'worker' | 'builder' | 'warrior' | 'archer' | 'catapult' | 'invader';
export type ArmyUnitKind = 'warrior' | 'archer' | 'catapult';
export const UPGRADE_TARGETS = ['economy', 'warrior', 'archer', 'catapult', 'tower-1', 'tower-2', 'tower-3'] as const;
export type UpgradeTarget = typeof UPGRADE_TARGETS[number];
export type BuildingKind = 'castle' | 'enemy-base' | 'relay' | 'barracks' | 'tower' | 'wall';
export type Phase = 'playing' | 'tier-up' | 'won' | 'lost';
export type WorldEvent = 'peace' | 'left-hand' | 'vowels' | 'numbers' | 'symbols' | 'code';
export type Action = 'resources' | 'worker' | 'relay' | 'barracks' | 'warrior' | 'archer' | 'catapult' | 'builder' | 'tower' | 'wall' | 'upgrade';
export type Unit = Point & {
  id: number; kind: UnitKind; hp: number; maxHp: number;
  destination: Point | null; cooldown: number; task: number | null;
  formation: ArmyUnitKind | null; attackTarget: Point | null;
};
export type Building = Point & {
  id: number; kind: BuildingKind; hp: number; maxHp: number;
  tier: number; progress: number; cooldown: number; enemy: boolean; attackTarget: Point | null; ownerId: string | null;
};
export type ResourceNode = Point & { id: number; rich: boolean; remaining: number };
export type ResourceChunk = Point & { id: number; amount: number; target: number | null; carrier: number | null };
export type Participant = {
  id: string; name: string; color: string; role: Role; simulated: boolean;
  action: Action; phrase: string; typed: string; phraseId: number;
  completed: number; ready: boolean; contribution: number; typingCredit: number;
  constructionTier: number; upgradeTarget: UpgradeTarget; actionPhrases: number; work: number; length: PhraseLength;
};
export type TaskSelection = Pick<Participant, 'action' | 'constructionTier' | 'upgradeTarget'>;
export type TaskProgress = Pick<Participant, 'work' | 'actionPhrases'>;
export type RoleTasks = { selection: TaskSelection; length: PhraseLength; progress: Record<string, TaskProgress> };
export type StrongholdEvent = { id: number; elapsed: number; playerId: string | null; text: string };
export type StrongholdState = {
  phase: Phase; tier: number; elapsed: number; wave: number; waveIn: number;
  resources: number; event: WorldEvent; eventIn: number;
  players: Participant[]; units: Unit[]; buildings: Building[];
  nodes: ResourceNode[]; chunks: ResourceChunk[]; nextId: number;
  upgrades: Record<'economy' | 'production' | 'defenses', number>;
  technology: Record<UpgradeTarget, number>;
  rally: Point; message: string; events: StrongholdEvent[];
  roleTasks: Record<Role, RoleTasks>; computersPaused: boolean;
};
export type StrongholdSnapshot = Omit<StrongholdState, 'players' | 'nextId'> & {
  selfId: string;
  players: (Omit<Participant, 'typingCredit'> & { progress: number })[];
};
export type StrongholdCommand =
  | { type: 'ROLE'; role: Role }
  | { type: 'ACTION'; action: Action; tier?: number; upgrade?: UpgradeTarget }
  | { type: 'LENGTH'; length: PhraseLength }
  | { type: 'COMPUTERS'; paused: boolean }
  | { type: 'TYPE'; phraseId: number; text: string }
  | { type: 'READY'; ready: boolean }
  | { type: 'PLACE'; kind: 'relay' | 'barracks' | 'tower' | 'wall'; point: Point }
  | { type: 'MOVE'; ids: number[]; point: Point }
  | { type: 'RALLY'; point: Point };
export interface StrongholdConnection {
  subscribe(listener: (snapshot: StrongholdSnapshot) => void): () => void;
  send(command: StrongholdCommand): Promise<void>;
  setActive(active: boolean): void;
  restart(): void;
  dispose(): void;
}
