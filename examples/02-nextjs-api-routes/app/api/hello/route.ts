import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Hello from Next.js API Routes!',
    timestamp: Date.now(),
    version: '1.0.0'
  });
}
