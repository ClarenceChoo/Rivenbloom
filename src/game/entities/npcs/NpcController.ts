import type { DialogueContext } from '../../dialogue/DialogueController';

export type NpcDialogueRule = {
  readonly dialogueId: string;
  readonly when?: (context: DialogueContext) => boolean;
};

export class NpcController {
  public constructor(
    public readonly actorId: string,
    private readonly rules: readonly NpcDialogueRule[]
  ) {
    if (rules.length === 0) {
      throw new Error(`NPC "${actorId}" needs at least one dialogue rule.`);
    }
    if (rules[rules.length - 1]?.when !== undefined) {
      throw new Error(`NPC "${actorId}" needs an unconditional fallback dialogue rule.`);
    }
  }

  public dialogueFor(context: DialogueContext): string {
    const matched = this.rules.find(({ when }) => when === undefined || when(context));
    if (matched === undefined) {
      throw new Error(`NPC "${this.actorId}" resolved no dialogue rule.`);
    }
    return matched.dialogueId;
  }
}

const silentBloomStage = (context: DialogueContext): string | undefined =>
  context.questStages['silent-bloom'];

/** Wren's Rest villagers with stage-conditional conversations. */
export const createVillageNpcs = (): readonly NpcController[] => [
  new NpcController('sela-quill', [
    {
      dialogueId: 'sela-route-restored',
      when: (context) => silentBloomStage(context) === 'restore-hollow-choir'
    },
    {
      dialogueId: 'sela-arch-awakened',
      when: (context) => silentBloomStage(context) === 'wake-listening-arch'
    },
    { dialogueId: 'sela-silent-bloom' }
  ]),
  new NpcController('orin-fen', [{ dialogueId: 'orin-first-reforge' }]),
  new NpcController('piri-moss', [{ dialogueId: 'piri-root-memory' }])
];
