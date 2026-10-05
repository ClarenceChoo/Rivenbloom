export type EffectLease<Value> = Readonly<{
  value: Value;
  release: () => boolean;
}>;

type Entry<Value> = {
  value: Value;
  active: boolean;
  generation: number;
};

export class EffectPool<Value> {
  private readonly entries: Entry<Value>[] = [];
  private disposed = false;

  public constructor(
    private readonly capacity: number,
    private readonly create: () => Value,
    private readonly onRelease: (value: Value) => void = () => undefined,
  ) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('Pool capacity must be a positive safe integer.');
    }
  }

  public acquire(prepare: (value: Value) => void = () => undefined): EffectLease<Value> | null {
    if (this.disposed) return null;
    let entry = this.entries.find(({ active }) => !active);
    if (entry === undefined) {
      if (this.entries.length >= this.capacity) return null;
      entry = { value: this.create(), active: false, generation: 0 };
      this.entries.push(entry);
    }
    entry.active = true;
    entry.generation += 1;
    const generation = entry.generation;
    try {
      prepare(entry.value);
    } catch (error) {
      entry.active = false;
      this.onRelease(entry.value);
      throw error;
    }
    return Object.freeze({
      value: entry.value,
      release: () => this.release(entry, generation),
    });
  }

  public dispose(): boolean {
    if (this.disposed) return false;
    this.disposed = true;
    for (const entry of this.entries) {
      if (!entry.active) continue;
      entry.active = false;
      this.onRelease(entry.value);
    }
    return true;
  }

  private release(entry: Entry<Value>, generation: number): boolean {
    if (this.disposed || !entry.active || entry.generation !== generation) return false;
    entry.active = false;
    this.onRelease(entry.value);
    return true;
  }
}
