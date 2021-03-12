export class Unsubscribable {
  unsubscribed?: boolean;
  unsubscribeFn: () => void;

  constructor(unsubscribeFn: () => void) {
    this.unsubscribeFn = unsubscribeFn;
    this.unsubscribe = this.unsubscribe.bind(this);
  }

  unsubscribe(): void {
    if (!this.unsubscribed) {
      this.unsubscribed = true;
      this.unsubscribeFn();
    }
  }
}
