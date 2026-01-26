import { useState } from 'react';
import { Send, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RAGResponse } from '@/types/siftops';

interface AskPanelProps {
  isLocked: boolean;
  ragResponse: RAGResponse | null;
  isAsking: boolean;
  onAsk: (question: string) => void;
}

export function AskPanel({ isLocked, ragResponse, isAsking, onAsk }: AskPanelProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && isLocked) {
      onAsk(question);
    }
  };

  if (!isLocked) {
    return (
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-1">RAG Disabled</h3>
            <p className="text-xs text-muted-foreground">
              Lock an evidence bundle to enable AI-assisted answers. Generation only uses explicitly approved sources.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">Ask Your Sources</h3>
        <p className="text-xs text-muted-foreground">
          RAG enabled with locked evidence bundle
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the locked sources..."
            rows={2}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            disabled={isAsking}
          />
          <Button
            type="submit"
            disabled={!question.trim() || isAsking}
            className="self-end"
          >
            {isAsking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {ragResponse && (
        <div className="space-y-4 animate-slide-up">
          {/* Answer */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Answer</h4>
            <div className="p-3 rounded-lg bg-secondary text-sm text-foreground leading-relaxed">
              {ragResponse.answer}
            </div>
          </div>

          {/* Citations */}
          {ragResponse.citations.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Citations</h4>
              <div className="space-y-2">
                {ragResponse.citations.map((citation) => (
                  <div
                    key={citation.citation}
                    className="p-3 rounded-lg border border-border bg-background"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-mono font-medium">
                        {citation.citation}
                      </span>
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                      >
                        {citation.url}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {citation.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
