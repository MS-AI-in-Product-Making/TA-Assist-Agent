export class MockAdapter<TResponse> {
  constructor(private readonly response: TResponse) {}

  async execute(action: string): Promise<TResponse> {
    void action;
    return this.response;
  }
}