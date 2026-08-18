const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    version: '1.0.0'
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  const users = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', status: 'active', department: 'Engineering' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', status: 'active', department: 'Sales' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'user', status: 'inactive', department: 'Marketing' }
  ];

  res.json({
    users,
    count: users.length,
    page: 1,
    timestamp: Date.now()
  });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const users = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', status: 'active', department: 'Engineering' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', status: 'active', department: 'Sales' },
    { id: 3, name: 'Carol White', email: 'carol@example.com', role: 'user', status: 'inactive', department: 'Marketing' }
  ];

  const user = users.find(u => u.id === userId);

  if (user) {
    res.json({
      data: user,
      success: true,
      timestamp: Date.now()
    });
  } else {
    res.status(404).json({
      error: 'User not found',
      success: false,
      timestamp: Date.now()
    });
  }
});

// Create user
app.post('/api/users', (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: 'Name and email are required',
      timestamp: Date.now()
    });
  }

  const newUser = {
    id: Math.floor(Math.random() * 10000),
    name,
    email,
    role: role || 'user',
    status: 'active',
    department: 'General'
  };

  res.status(201).json({
    data: newUser,
    message: 'User created successfully',
    success: true,
    timestamp: Date.now()
  });
});

// Search endpoint
app.post('/api/search', (req, res) => {
  const { query, limit = 10 } = req.body;

  const results = [
    { id: 1, title: 'Express Tutorial', relevance: 0.95 },
    { id: 2, title: 'Node.js Best Practices', relevance: 0.87 },
    { id: 3, title: 'REST API Design', relevance: 0.76 }
  ].filter(item =>
    query ? item.title.toLowerCase().includes(query.toLowerCase()) : true
  ).slice(0, limit);

  res.json({
    results,
    query,
    total: results.length,
    timestamp: Date.now()
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Express API listening at http://0.0.0.0:${port}`);
});
