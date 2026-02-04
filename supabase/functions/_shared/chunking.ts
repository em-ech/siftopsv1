/**
 * Standardized text chunking for consistent embedding quality.
 *
 * Configuration:
 * - CHUNK_SIZE: 1000 characters per chunk
 * - CHUNK_OVERLAP: 150 characters overlap between chunks
 * - Splits on sentence boundaries when possible
 */

export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 150;

// Sentence ending patterns
const SENTENCE_ENDINGS = /[.!?]+[\s\n]+/g;

/**
 * Split text into chunks with overlap, preferring sentence boundaries.
 *
 * @param text - The text to chunk
 * @param maxChars - Maximum characters per chunk (default: 1000)
 * @param overlap - Characters to overlap between chunks (default: 150)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  maxChars: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): string[] {
  // Normalize whitespace
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  // If text is shorter than chunk size, return as single chunk
  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);

    // If we're not at the end of the text, try to find a sentence boundary
    if (end < normalized.length) {
      const segment = normalized.slice(start, end);

      // Find the last sentence ending in this segment
      let lastSentenceEnd = -1;
      let match: RegExpExecArray | null;

      // Reset regex state
      SENTENCE_ENDINGS.lastIndex = 0;

      while ((match = SENTENCE_ENDINGS.exec(segment)) !== null) {
        // Only consider it if it's in the second half of the chunk
        // (to avoid very short chunks)
        if (match.index > maxChars / 2) {
          lastSentenceEnd = match.index + match[0].length;
        }
      }

      // If we found a sentence boundary, use it
      if (lastSentenceEnd > 0) {
        end = start + lastSentenceEnd;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Move start position for next chunk, accounting for overlap
    if (end >= normalized.length) {
      break;
    }

    // Calculate next start position with overlap
    start = end - overlap;

    // Make sure we're making forward progress
    if (start <= chunks.length > 0 ? end - maxChars : 0) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Convert HTML to plain text.
 * Strips tags, decodes entities, and normalizes whitespace.
 */
export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prepare text for embedding by combining title and content.
 * Truncates to a reasonable length for embedding models.
 */
export function prepareForEmbedding(
  title: string,
  content: string,
  maxLength: number = 1500
): string {
  const combined = [title, content].filter(Boolean).join("\n\n");
  return combined.slice(0, maxLength);
}
