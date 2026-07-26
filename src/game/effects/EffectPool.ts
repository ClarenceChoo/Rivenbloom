export type EffectPoolOptions<TInput, TMember> = {
  readonly capacity: number;
  readonly create: (index: number) => TMember;
  readonly activate: (member: TMember, input: TInput) => void;
  readonly deactivate: (member: TMember) => void;
};

export class EffectPool<TInput, TMember> {
  private readonly available: TMember[];
  private readonly active = new Set<TMember>();
  private disposed = false;
  private drops = 0;

  public constructor(private readonly options: EffectPoolOptions<TInput, TMember>) {
    const capacity =
      Number.isInteger(options.capacity) && options.capacity > 0 ? options.capacity : 0;
    this.available = Array.from({ length: capacity }, (_, index) =>
      options.create(index)
    ).reverse();
  }

  public get capacity(): number {
    return this.available.length + this.active.size;
  }

  public get activeCount(): number {
    return this.active.size;
  }

  public get droppedCount(): number {
    return this.drops;
  }

  public spawn(input: TInput): TMember | undefined {
    if (this.disposed) return undefined;
    const member = this.available.pop();
    if (member === undefined) {
      this.drops += 1;
      return undefined;
    }
    this.active.add(member);
    this.options.activate(member, input);
    return member;
  }

  public release(member: TMember): void {
    if (!this.active.delete(member)) return;
    this.options.deactivate(member);
    if (!this.disposed) this.available.push(member);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const member of [...this.active]) {
      this.active.delete(member);
      this.options.deactivate(member);
    }
    this.available.length = 0;
  }
}
