const express = require("express");
const app = express();
app.use(express.json());

const ITEMS = [
  { id: 1, name: "Widget", price: 9.99, rating: 4.2 },
  { id: 2, name: "Gadget", price: 19.99, rating: 3.8 },
  { id: 3, name: "Gizmo", price: 14.5, rating: 4.7 },
];

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/items", (req, res) => {
  res.json({ items: ITEMS });
});

function computeScore(item) {
  const priceScore = 10 - item.price / 5;
  const ratingScore = item.rating * 2;
  return Number((priceScore * 0.4 + ratingScore * 0.6).toFixed(2));
}

app.post("/score", (req, res) => {
  const { itemId } = req.body;
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item) {
    return res.status(404).json({ error: "item not found" });
  }
  res.json({ itemId: item.id, name: item.name, score: computeScore(item) });
});

app.listen(4000, () => console.log("test app on :4000"));
