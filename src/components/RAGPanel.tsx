import { useState } from 'react';
import { Send, Loader2, BookOpen, ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RAGResponse } from '@/types/search';
import { cn } from '@/lib/utils';

interface RAGPanelProps {
  isLocked: boolean;
  ragResponse: RAGResponse | null;
  isGenerating: boolean;
  onAsk: (question: string) => void;
}

export function RAGPanel({ isLocked, ragResponse, isGenerating, onAsk }: RAGPanelProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && isLocked) {
      onAsk(question);
    }
  };

  if (!isLocked) {
    return (
      <div className="glass-panel rounded-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">RAG Gate Locked</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Lock an evidence bundle to enable AI-assisted answers. Generation only occurs with explicitly approved sources — no hallucinations, no data leakage.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Ask Your Sources</h3>
          <p className="text-xs text-muted-foreground">RAG enabled with locked evidence bundle</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about the locked sources..."
            className="w-full h-12 pl-4 pr-14 bg-secondary/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            disabled={isGenerating}
          />
          <Button
            type="submit"
            size="icon"
            variant="glow"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            disabled={!question.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      {ragResponse && (
        <div className="space-y-4 animate-slide-up">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border">
            <p className="text-sm leading-relaxed">{ragResponse.answer}</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Citations</span>
            </div>
            <div className="space-y-2">
              {ragResponse.citations.map((citation) => (
                <div
                  key={citation.citation}
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-mono font-medium">
                      {citation.citation}
                    </span>
                    <a
                      href={citation.location}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                    >
                      {citation.location}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {citation.excerpt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
