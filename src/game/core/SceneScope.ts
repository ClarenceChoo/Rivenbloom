export type Cleanup = () => void;

export class SceneScope {
  private readonly cleanups: Cleanup[] = [];
  private disposed = false;

  public add(cleanup: Cleanup): void {
    if (this.disposed) {
      cleanup();
      return;
    }

    this.cleanups.push(cleanup);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    const errors: unknown[] = [];

    while (this.cleanups.length > 0) {
      const cleanup = this.cleanups.pop();
      if (cleanup === undefined) {
        continue;
      }

      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more scene cleanups failed');
    }
  }
}
