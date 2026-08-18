const express = require("express");
const app = express();
app.use(express.json());

const USERS = [
  {
    id: 1,
    name: "Ada",
    profile: {
      settings: { theme: "midnight", notifications: true },
      roles: ["admin", "editor"],
    },
  },
  {
    id: 2,
    name: "Grace",
    profile: {
      settings: { theme: "light", notifications: false },
      roles: ["viewer", "reviewer"],
    },
  },
];

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/users", (req, res) => {
  res.json({ users: USERS });
});

app.get("/users/:id", (req, res) => {
  const user = USERS.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

function summarize(user) {
  return {
    id: user.id,
    roleCount: user.profile.roles.length,
    theme: user.profile.settings.theme,
  };
}

app.get("/users/:id/summary", (req, res) => {
  const user = USERS.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(summarize(user));
});

app.listen(4000, () => console.log("test-app2 on :4000"));
