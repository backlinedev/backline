import { NextResponse } from 'next/server';

const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'user' }
];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = parseInt(params.id);
  const user = users.find(u => u.id === userId);

  if (user) {
    return NextResponse.json({
      user,
      timestamp: Date.now()
    });
  } else {
    return NextResponse.json(
      {
        error: 'User not found',
        timestamp: Date.now()
      },
      { status: 404 }
    );
  }
}
