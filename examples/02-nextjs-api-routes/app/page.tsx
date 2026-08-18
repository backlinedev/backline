export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Next.js API Routes Example</h1>
      <p>This is a minimal Next.js app with API routes for Backline testing.</p>
      <h2>Available API Routes:</h2>
      <ul>
        <li><code>GET /api/hello</code> - Simple hello endpoint</li>
        <li><code>GET /api/users</code> - Get all users</li>
        <li><code>GET /api/users/:id</code> - Get user by ID</li>
        <li><code>POST /api/users</code> - Create a new user</li>
        <li><code>POST /api/search</code> - Search with query</li>
      </ul>
    </main>
  );
}
