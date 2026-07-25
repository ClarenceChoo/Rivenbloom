export type ServiceToken<T> = {
  readonly id: symbol;
  readonly name: string;
  readonly service?: T;
};

export function createServiceToken<T>(name: string): ServiceToken<T> {
  return { id: Symbol(name), name };
}

type RegisteredService = {
  readonly value: unknown;
};

export class ServiceRegistry {
  private readonly services = new Map<symbol, RegisteredService>();

  public register<T>(token: ServiceToken<T>, service: T): void {
    this.services.set(token.id, { value: service });
  }

  public get<T>(token: ServiceToken<T>): T {
    const service = this.services.get(token.id);
    if (service === undefined) {
      throw new Error(`Service not registered: ${token.name}`);
    }

    return service.value as T;
  }
}
