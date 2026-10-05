import { DialogueController } from '../dialogue/DialogueController';
import type { DialogueContext, DialoguePage } from '../dialogue/DialogueController';
import { deepFreeze, immutableClone } from '../data/immutability';
import type { ContentRegistry, DialogueChoiceId, NpcDefinition, ShopOfferId } from '../data/types';
import type { SaveV1 } from '../saves/SaveSchema';
import { ShopController } from '../ui/ShopController';
import { applyProgressionTransaction, claimProgressionReward } from './WorldProgression';
import type { ProgressionEvent } from './WorldProgression';

export type WorldModalChoice = Readonly<{ choiceId: DialogueChoiceId; text: string }>;
export type WorldModalOffer = Readonly<{
  offerId: ShopOfferId;
  displayName: string;
  description: string;
  price: number;
  available: boolean;
  reason: string | null;
}>;

export type WorldModalState = Readonly<{
  sessionId: number;
  revision: number;
  mode: 'dialogue' | 'shop';
  actorId: string;
  speaker: string;
  copy: string;
  choices: readonly WorldModalChoice[];
  offers: readonly WorldModalOffer[];
  error: string | null;
}>;

export type WorldModalCommand =
  | Readonly<{
      kind: 'choose';
      sessionId: number;
      revision: number;
      choiceId: DialogueChoiceId;
    }>
  | Readonly<{
      kind: 'purchase';
      sessionId: number;
      revision: number;
      offerId: ShopOfferId;
    }>
  | Readonly<{ kind: 'close'; sessionId: number; revision: number }>;

export type WorldDomainEvent =
  | Readonly<{
      sequence: number;
      kind: 'progression';
      event: ProgressionEvent;
    }>
  | Readonly<{
      sequence: number;
      kind: 'checkpoint-activated' | 'death-restored';
      checkpointId: string;
    }>;

export type WorldModalOpenResult =
  | Readonly<{ kind: 'opened'; state: WorldModalState }>
  | Readonly<{ kind: 'rejected'; reason: string }>;

export type WorldModalIssueResult = Readonly<{
  kind: 'updated' | 'closed' | 'rejected' | 'ignored';
  state: WorldModalState | null;
  save: SaveV1 | null;
  events: readonly WorldDomainEvent[];
}>;

export type WorldModalCommitToken = object;

export type WorldModalPrepareResult =
  | Readonly<{ kind: 'prepared'; token: WorldModalCommitToken; save: SaveV1 | null }>
  | Readonly<{ kind: 'ignored'; state: WorldModalState | null }>;

type ActiveModal = {
  npc: NpcDefinition;
  state: WorldModalState;
  page: DialoguePage;
  context: DialogueContext;
};

type PendingModal = Readonly<{
  token: WorldModalCommitToken;
  originalActive: ActiveModal;
  responseKind: Exclude<WorldModalIssueResult['kind'], 'ignored'>;
  state: WorldModalState | null;
  save: SaveV1 | null;
  events: readonly ProgressionEvent[];
  nextActive: ActiveModal | null;
  dialogueCommand:
    Readonly<{ kind: 'choose'; choiceId: DialogueChoiceId }> | Readonly<{ kind: 'close' }> | null;
}>;

const EMPTY_EVENTS = Object.freeze([]) as readonly WorldDomainEvent[];

export class WorldModalController {
  private dialogue: DialogueController;
  private readonly shops: ShopController;
  private active: ActiveModal | null = null;
  private nextSessionId = 1;
  private nextEventSequence = 1;
  private pending: PendingModal | null = null;
  private disposed = false;

  public constructor(private readonly registry: ContentRegistry) {
    this.dialogue = new DialogueController(registry.dialogue);
    this.shops = new ShopController(registry.shopOffers);
  }

  public get snapshot(): WorldModalState | null {
    return this.active?.state ?? null;
  }

  public openNpc(spawnId: string, save: SaveV1): WorldModalOpenResult {
    if (this.disposed) return { kind: 'rejected', reason: 'Modal controller is disposed.' };
    const npc = this.registry.npcs.find((candidate) => candidate.spawnId === spawnId);
    if (npc === undefined) return { kind: 'rejected', reason: 'Unknown NPC.' };
    this.dialogue.close();
    const context = dialogueContext(save);
    const result = this.dialogue.start(npc.dialogueId, context);
    if (result.kind !== 'started') {
      return { kind: 'rejected', reason: 'This conversation is unavailable.' };
    }
    const state = dialogueState(
      this.nextSessionId,
      1,
      npc,
      result.page,
      speakerName(this.registry, result.page.speakerActorId),
      null,
    );
    this.nextSessionId += 1;
    this.active = { npc, state, page: result.page, context: immutableClone(context) };
    return { kind: 'opened', state };
  }

  public issue(command: WorldModalCommand, save: SaveV1): WorldModalIssueResult {
    const prepared = this.prepare(command, save);
    if (prepared.kind === 'ignored') {
      return result('ignored', prepared.state, null, EMPTY_EVENTS);
    }
    return this.commit(prepared.token);
  }

  public prepare(command: WorldModalCommand, save: SaveV1): WorldModalPrepareResult {
    const active = this.active;
    if (
      this.disposed ||
      this.pending !== null ||
      active === null ||
      command.sessionId !== active.state.sessionId ||
      command.revision !== active.state.revision
    ) {
      return deepFreeze({ kind: 'ignored', state: this.snapshot });
    }
    if (command.kind === 'close') {
      return this.stage(active, 'closed', null, null, [], null, { kind: 'close' });
    }
    if (command.kind === 'purchase') return this.preparePurchase(active, command.offerId, save);
    return this.prepareChoice(active, command.choiceId, save);
  }

  public commit(token: WorldModalCommitToken): WorldModalIssueResult {
    const pending = this.pendingFor(token);
    if (pending === null) return result('ignored', this.snapshot, null, EMPTY_EVENTS);
    this.pending = null;
    if (pending.dialogueCommand?.kind === 'choose') {
      const committed = this.dialogue.choose(pending.dialogueCommand.choiceId);
      if (committed.kind === 'rejected') {
        this.active = pending.originalActive;
        return this.reject(pending.originalActive, 'That choice is unavailable.');
      }
    } else if (pending.dialogueCommand?.kind === 'close') {
      this.dialogue.close();
    }
    this.active = pending.nextActive;
    return result(
      pending.responseKind,
      pending.state,
      pending.save,
      this.sequenceEvents(pending.events),
    );
  }

  public fail(token: WorldModalCommitToken, message: string): WorldModalIssueResult {
    const pending = this.pendingFor(token);
    if (pending === null) return result('ignored', this.snapshot, null, EMPTY_EVENTS);
    this.pending = null;
    this.active = pending.originalActive;
    return this.reject(pending.originalActive, message);
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.dialogue.dispose();
    this.pending = null;
    this.active = null;
    this.disposed = true;
    return true;
  }

  private prepareChoice(
    active: ActiveModal,
    choiceId: DialogueChoiceId,
    save: SaveV1,
  ): WorldModalPrepareResult {
    if (active.state.mode !== 'dialogue') {
      return this.stageReject(active, 'That dialogue choice is no longer available.');
    }
    const choice = this.dialogue.preview(choiceId);
    if (choice.kind === 'rejected') return this.stageReject(active, 'That choice is unavailable.');
    let candidate = save;
    let changed = false;
    const events: ProgressionEvent[] = [];
    if (choice.effects.length > 0) {
      const progression = applyProgressionTransaction(candidate, { commands: choice.effects });
      if (progression.kind === 'rejected') {
        return this.stageReject(active, progressionError(progression.reason));
      }
      candidate = progression.save;
      if (progression.kind === 'accepted') {
        changed = true;
        events.push(...progression.events);
      }
    }
    if (choice.rewardId !== null) {
      const reward = claimProgressionReward(candidate, choice.rewardId);
      if (reward.kind === 'rejected') {
        return this.stageReject(active, progressionError(reward.reason));
      }
      candidate = reward.save;
      if (reward.kind === 'accepted') {
        changed = true;
        events.push(...reward.events);
      }
    }
    const saveCandidate = changed ? candidate : null;
    if (choice.kind === 'page') {
      const state = dialogueState(
        active.state.sessionId,
        active.state.revision + 1,
        active.npc,
        choice.page,
        speakerName(this.registry, choice.page.speakerActorId),
        null,
      );
      return this.stage(
        active,
        'updated',
        state,
        saveCandidate,
        events,
        { ...active, state, page: choice.page },
        { kind: 'choose', choiceId },
      );
    }
    if (active.npc.shopId !== null && !choiceId.endsWith('-leave')) {
      const state = this.shopState(active, active.state.revision + 1, saveCandidate ?? save, null);
      return this.stage(
        active,
        'updated',
        state,
        saveCandidate,
        events,
        { ...active, state },
        { kind: 'choose', choiceId },
      );
    }
    return this.stage(active, 'closed', null, saveCandidate, events, null, {
      kind: 'choose',
      choiceId,
    });
  }

  private preparePurchase(
    active: ActiveModal,
    offerId: ShopOfferId,
    save: SaveV1,
  ): WorldModalPrepareResult {
    if (active.state.mode !== 'shop') {
      return this.stageReject(active, 'That offer is unavailable.');
    }
    const purchase = this.shops.purchase(save, offerId);
    if (purchase.kind !== 'accepted') {
      return this.stageReject(
        active,
        purchase.kind === 'rejected'
          ? progressionError(purchase.reason)
          : 'That offer is already claimed.',
      );
    }
    const state = this.shopState(active, active.state.revision + 1, purchase.save, null);
    return this.stage(active, 'updated', state, purchase.save, purchase.events, {
      ...active,
      state,
    });
  }

  private stageReject(active: ActiveModal, message: string): WorldModalPrepareResult {
    const state = deepFreeze({
      ...active.state,
      revision: active.state.revision + 1,
      error: message,
    });
    return this.stage(active, 'rejected', state, null, [], { ...active, state });
  }

  private stage(
    active: ActiveModal,
    responseKind: Exclude<WorldModalIssueResult['kind'], 'ignored'>,
    state: WorldModalState | null,
    save: SaveV1 | null,
    events: readonly ProgressionEvent[],
    nextActive: ActiveModal | null,
    dialogueCommand: PendingModal['dialogueCommand'] = null,
  ): WorldModalPrepareResult {
    const token = Object.freeze({});
    this.pending = {
      token,
      originalActive: active,
      responseKind,
      state,
      save,
      events,
      nextActive,
      dialogueCommand,
    };
    return deepFreeze({ kind: 'prepared', token, save });
  }

  private pendingFor(token: WorldModalCommitToken): PendingModal | null {
    const pending = this.pending;
    if (this.disposed || pending === null || pending.token !== token) return null;
    return pending;
  }

  private reject(active: ActiveModal, message: string): WorldModalIssueResult {
    const state = deepFreeze({
      ...active.state,
      revision: active.state.revision + 1,
      error: message,
    });
    this.active = { ...active, state };
    return result('rejected', state, null, EMPTY_EVENTS);
  }

  private shopState(
    active: ActiveModal,
    revision: number,
    save: SaveV1,
    error: string | null,
  ): WorldModalState {
    const shopId = active.npc.shopId;
    if (shopId === null) throw new Error('Shop state requires a shopkeeper.');
    const offers = this.registry.shopOffers
      .filter((offer) => offer.shopId === shopId)
      .map((offer): WorldModalOffer => {
        const quote = this.shops.quote(save, offer.offerId);
        return {
          offerId: offer.offerId,
          displayName: offer.displayName,
          description: offer.description,
          price: offer.price,
          available: quote.kind === 'available',
          reason: quote.kind === 'available' ? null : quote.reason,
        };
      });
    return deepFreeze({
      sessionId: active.state.sessionId,
      revision,
      mode: 'shop',
      actorId: active.npc.actorId,
      speaker: speakerName(this.registry, active.npc.actorId),
      copy: active.page.text,
      choices: [],
      offers,
      error,
    });
  }

  private sequenceEvents(events: readonly ProgressionEvent[]): readonly WorldDomainEvent[] {
    return deepFreeze(
      events.map((event) => ({
        sequence: this.nextEventSequence++,
        kind: 'progression' as const,
        event,
      })),
    );
  }
}

function dialogueState(
  sessionId: number,
  revision: number,
  npc: NpcDefinition,
  page: DialoguePage,
  speaker: string,
  error: string | null,
): WorldModalState {
  return deepFreeze({
    sessionId,
    revision,
    mode: 'dialogue',
    actorId: npc.actorId,
    speaker,
    copy: page.text,
    choices: page.choices.map(({ choiceId, text }) => ({ choiceId, text })),
    offers: [],
    error,
  });
}

function dialogueContext(save: SaveV1): DialogueContext {
  return immutableClone({
    quests: save.quests,
    defeatedBosses: save.worldProgress.defeatedBosses,
  });
}

function speakerName(registry: ContentRegistry, actorId: string): string {
  return registry.actors.find((actor) => actor.actorId === actorId)?.displayName ?? actorId;
}

function progressionError(reason: string): string {
  switch (reason) {
    case 'insufficient-currency':
      return 'You do not have enough currency for that offer.';
    case 'stack-full':
      return 'You cannot carry any more of that item.';
    case 'insufficient-item':
      return 'A required item is missing.';
    default:
      return 'That change could not be applied.';
  }
}

function result(
  kind: WorldModalIssueResult['kind'],
  state: WorldModalState | null,
  save: SaveV1 | null,
  events: readonly WorldDomainEvent[],
): WorldModalIssueResult {
  return deepFreeze({ kind, state, save, events });
}
