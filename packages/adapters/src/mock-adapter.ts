export class MockAdapter<TResponse> {
  readonly invocations: string[] = [];

  constructor(private readonly response: TResponse) {}

  async execute(action: string): Promise<TResponse> {
    this.invocations.push(action);
    return this.response;
  }
}