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

    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
  }
}
