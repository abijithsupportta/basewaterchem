import { NextRequest, NextResponse } from 'next/server';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatbotRequest {
  question?: string;
  context?: unknown;
  history?: ChatMessage[];
}

function buildFallbackAnswer(question: string, context: unknown, reason: string): string {
  const contextObj = (context && typeof context === 'object') ? (context as Record<string, unknown>) : null;
  const totals = (contextObj?.totals && typeof contextObj.totals === 'object')
    ? (contextObj.totals as Record<string, unknown>)
    : null;

  const summary: string[] = [];
  if (totals) {
    const totalServices = totals.totalServices;
    const pendingOverdueServices = totals.pendingOverdueServices;
    const pendingPayments = totals.pendingPayments;

    if (typeof totalServices === 'number') {
      summary.push(`Total services in scope: ${totalServices}`);
    }
    if (typeof pendingOverdueServices === 'number') {
      summary.push(`Overdue/pending services: ${pendingOverdueServices}`);
    }
    if (typeof pendingPayments === 'number') {
      summary.push(`Pending payments count: ${pendingPayments}`);
    }
  }

  const lines = [
    `AI provider issue: ${reason}. I am giving a fallback response.`,
    `Your question: "${question}"`,
    summary.length > 0
      ? `Current snapshot: ${summary.join(' | ')}`
      : 'Current dashboard snapshot is not available in this chat context.',
    'Suggested next actions:',
    '1) Prioritize overdue services first.',
    '2) Follow up pending payments with due-date and amount list.',
    '3) Re-run this question in 1-2 minutes when quota resets.',
  ];

  return lines.join('\n');
}

function normalizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<ChatMessage>;
      return (
        (candidate.role === 'user' || candidate.role === 'assistant')
        && typeof candidate.content === 'string'
      );
    })
    .slice(-8)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 2000),
    }));
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { message: 'OPENROUTER_API_KEY is not configured.' } },
        { status: 500 }
      );
    }

    const model = process.env.OPENROUTER_MODEL || 'openrouter/auto';
    const body = (await request.json()) as ChatbotRequest;
    const question = (body.question || '').trim();

    if (!question) {
      return NextResponse.json(
        { success: false, error: { message: 'Question is required.' } },
        { status: 400 }
      );
    }

    const history = normalizeHistory(body.history);
    const serializedContext = JSON.stringify(body.context ?? {}, null, 2).slice(0, 12000);

    const systemPrompt = [
      'You are a business operations assistant for Base Water Chemicals service manager.',
      'Answer using the provided business context and chat history only.',
      'Focus on current situation, today activities, pending work, collections, and practical next actions.',
      'If data is missing, clearly state what is unavailable.',
      'Keep answers concise and actionable.',
    ].join(' ');

    const userPayload = [
      'Business context JSON:',
      serializedContext,
      '',
      `User question: ${question}`,
    ].join('\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      { role: 'user', content: userPayload },
    ];

    const openRouterResponse = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Base Water Chemicals Service Manager',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 700,
        }),
      }
    );

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('[OpenRouter API Error]', openRouterResponse.status, errorText);

      if (openRouterResponse.status === 429) {
        return NextResponse.json(
          {
            success: true,
            answer: buildFallbackAnswer(question, body.context, 'OpenRouter quota/rate-limit reached'),
            fallback: true,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          answer: buildFallbackAnswer(question, body.context, `OpenRouter returned ${openRouterResponse.status}`),
          fallback: true,
        },
        { status: 502 }
      );
    }

    const data = await openRouterResponse.json() as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          reasoning?: string;
          reasoning_details?: Array<{ summary?: string; type?: string }>;
        };
        reasoning?: string;
        text?: string;
      }>;
    };

    const firstChoice = data.choices?.[0] as {
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
        reasoning?: string;
        reasoning_details?: Array<{ summary?: string; type?: string }>;
      };
      reasoning?: string;
      text?: string;
    } | undefined;
    const rawContent = firstChoice?.message?.content;
    const answerFromMessage = Array.isArray(rawContent)
      ? rawContent.map((part) => part?.text || '').join('').trim()
      : (rawContent || '').trim();
    const answerFromText = (firstChoice?.text || '').trim();
    const reasoningSummary = (firstChoice?.message?.reasoning_details || [])
      .map((item) => item?.summary || '')
      .join('\n')
      .trim();
    const answerFromReasoning = (
      firstChoice?.message?.reasoning ||
      firstChoice?.reasoning ||
      reasoningSummary
    )?.trim() || '';
    const answer = answerFromMessage || answerFromText || answerFromReasoning;

    return NextResponse.json({
      success: true,
      answer: answer || 'No response generated. Please try again with a more specific question.',
    });
  } catch (error) {
    console.error('[Chatbot Error]', error);
    return NextResponse.json(
      {
        success: true,
        answer: buildFallbackAnswer('Unable to process question', null, 'Unexpected chatbot error'),
        fallback: true,
      },
      { status: 200 }
    );
  }
}
