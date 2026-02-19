'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, SendHorizonal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface BusinessChatbotProps {
  context: unknown;
  loading: boolean;
}

const QUICK_PROMPTS = [
  'What is the current business situation right now?',
  'What should the team do today first?',
  'Summarize pending services and collections risk.',
  'What daily activities should I track before day-end?',
];

export function BusinessChatbot({ context, loading }: BusinessChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'I can help with current status, daily priorities, pending services, and payment follow-ups. Ask a question to begin.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const canSend = question.trim().length > 0 && !sending;

  const history = useMemo(() => messages.slice(-8), [messages]);

  const sendQuestion = async (prompt?: string) => {
    const nextQuestion = (prompt ?? question).trim();
    if (!nextQuestion || sending) return;

    const userMessage: ChatMessage = { role: 'user', content: nextQuestion };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setQuestion('');
    setSending(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nextQuestion,
          context,
          history,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Chatbot request failed.');
      }

      const answer = typeof payload.answer === 'string' && payload.answer.trim().length > 0
        ? payload.answer.trim()
        : 'I could not generate a response for that question.';

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected chatbot error.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Business Chat Assistant
          {loading && <Badge variant="secondary">Refreshing data...</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 max-h-80 overflow-y-auto space-y-3">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {message.role === 'assistant' ? 'Assistant' : 'You'}
              </p>
              <div className="rounded-md border bg-background p-2 text-sm whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          ))}
          {sending && (
            <p className="text-xs text-muted-foreground">Assistant is thinking...</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => sendQuestion(prompt)}
              disabled={sending}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about current situation, today priorities, pending services, collections, or risks..."
            rows={3}
            disabled={sending}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={() => sendQuestion()} disabled={!canSend}>
              Ask Assistant
              <SendHorizonal className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
