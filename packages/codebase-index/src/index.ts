import type { CodeIndexOpts, CodeSearchOpts, CodeIndexBuildResult, CodeSearchResult } from "./types.js";
import { scanAndIndex } from "./scanner.js";
import { searchCodebase } from "./search.js";
import { CodebaseWatcher, type WatchOpts } from "./watcher.js";

export class CodebaseIndex {
  private readonly opts: CodeIndexOpts;
  private watcher: CodebaseWatcher | null = null;

  constructor(opts: CodeIndexOpts) {
    this.opts = opts;
  }

  async build(rootDir: string = this.opts.memoryStore.dbHandle ? "" : ""): Promise<CodeIndexBuildResult> {
    if (!rootDir) {
      throw new Error("CodebaseIndex.build requires rootDir");
    }
    return scanAndIndex(rootDir, this.opts);
  }

  search(query: string, opts: CodeSearchOpts = {}): Promise<CodeSearchResult[]> {
    return searchCodebase(this.opts.memoryStore, query, opts);
  }

  startWatch(rootDir: string, watchOpts: Omit<WatchOpts, "onChange"> & { onChange?: (files: string[]) => void | Promise<void> }): void {
    if (this.watcher) return;
    const onChange = watchOpts.onChange ?? ((files: string[]) => this.build(rootDir).then(() => undefined));
    this.watcher = new CodebaseWatcher({
      debounceMs: watchOpts.debounceMs,
      signal: watchOpts.signal,
      onChange,
    });
    this.watcher.start(rootDir);
  }

  async stopWatch(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }
  }
}

export { scanAndIndex } from "./scanner.js";
export { searchCodebase } from "./search.js";
export { CodebaseWatcher, type WatchOpts } from "./watcher.js";
export type {
  CodeIndexOpts,
  CodeIndexEntry,
  CodeIndexBuildResult,
  CodeSearchOpts,
  CodeSearchResult,
} from "./types.js";
export { DEFAULT_REGEX_BOOST, DEFAULT_CODE_INDEX_SOURCE_PREFIX } from "./types.js";
