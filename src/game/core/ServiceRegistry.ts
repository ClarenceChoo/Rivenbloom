export class ServiceRegistry<Services extends object> {
  private readonly services = new Map<keyof Services, Services[keyof Services]>();

  public register<ServiceName extends keyof Services>(
    serviceName: ServiceName,
    service: Services[ServiceName],
  ): void {
    if (this.services.has(serviceName)) {
      throw new Error(`Service "${String(serviceName)}" is already registered.`);
    }

    this.services.set(serviceName, service);
  }

  public get<ServiceName extends keyof Services>(serviceName: ServiceName): Services[ServiceName] {
    if (!this.services.has(serviceName)) {
      throw new Error(`Service "${String(serviceName)}" is not registered.`);
    }

    return this.services.get(serviceName) as Services[ServiceName];
  }
}
