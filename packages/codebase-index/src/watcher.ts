import chokidar, { type FSWatcher } from "chokidar";

export interface WatchOpts {
  debounceMs?: number;
  signal?: AbortSignal;
  onChange: (files: string[]) => void | Promise<void>;
}

export class CodebaseWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pending: Set<string> = new Set();
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private readonly debounceMs: number;
  private readonly onChange: (files: string[]) => void | Promise<void>;
  private readonly signal?: AbortSignal;

  constructor(opts: WatchOpts) {
    this.debounceMs = opts.debounceMs ?? 500;
    this.onChange = opts.onChange;
    this.signal = opts.signal;
  }

  start(rootDir: string): void {
    if (this.watcher) return;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.watcher = chokidar.watch(rootDir, {
      ignored: [
        /(^|[\\\/])\../,
        /node_modules/,
        /dist/,
        /coverage/,
        /\.pi-pro/,
      ],
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });
    this.watcher.on("add", (p) => this.queue(p));
    this.watcher.on("change", (p) => this.queue(p));
    this.watcher.on("unlink", (p) => this.queue(p));
    this.watcher.on("ready", () => {
      if (this.readyResolve) this.readyResolve();
    });
    if (this.signal) {
      this.signal.addEventListener("abort", () => this.stop());
    }
  }

  async waitReady(): Promise<void> {
    if (this.readyPromise) await this.readyPromise;
  }

  private queue(path: string): void {
    this.pending.add(path);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private async flush(): Promise<void> {
    const files = Array.from(this.pending);
    this.pending.clear();
    this.debounceTimer = null;
    try {
      await this.onChange(files);
    } catch {
      // swallow
    }
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
