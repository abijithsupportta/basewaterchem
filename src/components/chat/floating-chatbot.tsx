'use client';

import { useState } from 'react';
import { MessageCircle, SendHorizonal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const STARTER_PROMPTS = [
  'What is the current business situation?',
  'What should be today’s priority?',
  'Show likely risks in pending work.',
];

export function FloatingChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi! I can help with business status, daily priorities, and operations questions.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);

  const sendQuestion = async (preset?: string) => {
    const nextQuestion = (preset ?? question).trim();
    if (!nextQuestion || sending) return;

    const nextHistory = [...messages, { role: 'user' as const, content: nextQuestion }];
    setMessages(nextHistory);
    setQuestion('');
    setSending(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nextQuestion,
          history: messages.slice(-8),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || 'Chat request failed.');
      }

      const answer = typeof payload.answer === 'string' && payload.answer.trim().length > 0
        ? payload.answer.trim()
        : 'No response generated.';

      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
          <Card className="shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Assistant Chat
                </span>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close chat">
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border bg-muted/20 p-3 max-h-72 overflow-y-auto space-y-3">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`}>
                    <p className="text-xs text-muted-foreground mb-1">{message.role === 'assistant' ? 'Assistant' : 'You'}</p>
                    <div className="rounded-md bg-background border p-2 text-sm whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}
                {sending && <p className="text-xs text-muted-foreground">Assistant is typing...</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sending}
                    onClick={() => sendQuestion(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask anything..."
                rows={3}
                disabled={sending}
              />

              <div className="flex justify-end">
                <Button type="button" onClick={() => sendQuestion()} disabled={sending || !question.trim()}>
                  Send
                  <SendHorizonal className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close assistant chat' : 'Open assistant chat'}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </>
  );
}
