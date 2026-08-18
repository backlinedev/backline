import { NextResponse } from 'next/server';

const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'user' }
];

export async function GET() {
  return NextResponse.json({
    users,
    total: users.length,
    timestamp: Date.now()
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, role } = body;

  if (!name || !email) {
    return NextResponse.json(
      {
        error: 'Name and email are required',
        timestamp: Date.now()
      },
      { status: 400 }
    );
  }

  const newUser = {
    id: Math.floor(Math.random() * 10000),
    name,
    email,
    role: role || 'user'
  };

  return NextResponse.json(
    {
      user: newUser,
      message: 'User created successfully',
      timestamp: Date.now()
    },
    { status: 201 }
  );
}
