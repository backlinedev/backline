const express = require("express");
const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/greeting", (req, res) => {
  res.json({ message: "hello test world", version: 4 });
});

app.listen(4000, () => console.log("test app on :4000"));
