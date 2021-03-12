export class Disposable {
  disposed?: boolean;
  disposeFn: () => void;

  constructor(disposeFn: () => void) {
    this.disposeFn = disposeFn;
    this.dispose = this.dispose.bind(this);
  }

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.disposeFn();
    }
  }
}
