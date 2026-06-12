export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

export function embedToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

export function bufferToEmbed(buf: Buffer): Float32Array {
  const ab = new ArrayBuffer(buf.byteLength);
  Buffer.from(buf).copy(Buffer.from(ab));
  return new Float32Array(ab);
}

export function indexMarkdown(
  content: string,
  meta: { source: string; role?: import("./types.js").ChunkRole },
): Array<{ source: string; role: import("./types.js").ChunkRole; text: string; line: number }> {
  const role = meta.role ?? "narrative";
  const lines = content.split("\n");
  const chunks: Array<{ source: string; role: import("./types.js").ChunkRole; text: string; line: number }> = [];

  let currentHeading = "";
  let currentBuf: string[] = [];
  let currentStartLine = 0;

  const flush = () => {
    if (currentBuf.length === 0) return;
    const text = currentHeading
      ? `${currentHeading}\n\n${currentBuf.join("\n").trim()}`
      : currentBuf.join("\n").trim();
    if (text.length > 0) {
      chunks.push({
        source: meta.source,
        role,
        text,
        line: currentStartLine + 1,
      });
    }
    currentBuf = [];
    currentStartLine = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = /^(#+)\s+(.+)$/.exec(line);
    if (headingMatch) {
      flush();
      currentHeading = `${headingMatch[1]} ${headingMatch[2]}`;
      currentStartLine = i;
      currentBuf.push(line);
    } else {
      if (currentBuf.length === 0) currentStartLine = i;
      currentBuf.push(line);
    }
  }
  flush();

  if (chunks.length === 0 && content.trim().length > 0) {
    chunks.push({ source: meta.source, role, text: content.trim(), line: 1 });
  }

  return chunks;
}

export function bm25Score(
  queryTerms: string[],
  docTerms: string[],
  avgDocLen: number,
  docFreqs: Map<string, number>,
  totalDocs: number,
  k1 = 1.5,
  b = 0.75,
): number {
  if (queryTerms.length === 0 || docTerms.length === 0 || totalDocs === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTerms) tf.set(t, (tf.get(t) ?? 0) + 1);
  const docLen = docTerms.length;
  let score = 0;
  for (const qt of queryTerms) {
    const tfVal = tf.get(qt) ?? 0;
    if (tfVal === 0) continue;
    const df = docFreqs.get(qt) ?? 0;
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
    const norm = tfVal * (k1 + 1);
    const denom = tfVal + k1 * (1 - b + b * (docLen / avgDocLen));
    score += idf * (norm / denom);
  }
  return score;
}
