export class SceneScope {
  private cleanups: Array<() => void> = [];
  private disposed = false;

  public add(cleanup: () => void): void {
    if (this.disposed) {
      throw new Error('SceneScope has already been disposed.');
    }

    this.cleanups.push(cleanup);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    const cleanups = this.cleanups;
    this.cleanups = [];
    const errors: unknown[] = [];

    for (const cleanup of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error: unknown) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'SceneScope cleanup failed.');
    }
  }
}
