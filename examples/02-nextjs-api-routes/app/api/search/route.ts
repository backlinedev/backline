import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { query, limit = 10 } = body;

  const results = [
    { id: 1, title: 'Next.js App Router Guide', relevance: 0.95 },
    { id: 2, title: 'API Routes Best Practices', relevance: 0.87 },
    { id: 3, title: 'Server Components Deep Dive', relevance: 0.76 }
  ].filter(item =>
    query ? item.title.toLowerCase().includes(query.toLowerCase()) : true
  ).slice(0, limit);

  return NextResponse.json({
    results,
    query,
    total: results.length,
    timestamp: Date.now()
  });
}
