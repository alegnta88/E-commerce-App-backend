const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Item = require("../models/item");
const Cart = require("../models/cart");
const bus = require("../events/handlers");

async function recalculateCartTotals(cart) {
  let total = 0;
  for (const line of cart.items) {
    const dbItem = await Item.findById(line.item);
    if (!dbItem) continue;
    total += (dbItem.price || 0) * (line.quantity || 0);
  }
  cart.totalPrice = total;
}

// Get current user's cart
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
      .populate("items.item", "name price stock image")
      .lean();
    return res.json({ success: true, cart: cart || { items: [], totalPrice: 0 } });
  } catch (err) {
    next(err);
  }
});

// Add item to cart
// Body: { item: ObjectId, quantity: Number }
router.post("/items", authMiddleware, async (req, res, next) => {
  try {
    const { item, quantity } = req.body || {};
    if (!item || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Invalid item or quantity" });
    }

    const dbItem = await Item.findOne({ _id: item, $or: [{ isActive: true }, { isActive: { $exists: false } }] });
    if (!dbItem) return res.status(404).json({ success: false, message: "Item not found" });

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const existing = cart.items.find((l) => String(l.item) === String(dbItem._id));
    const newQty = (existing ? existing.quantity : 0) + quantity;
    if (existing) {
      existing.quantity = newQty;
    } else {
      cart.items.push({ item: dbItem._id, quantity });
    }

    await recalculateCartTotals(cart);
    await cart.save();

    const populated = await Cart.findById(cart._id).populate("items.item", "name price stock image");
    bus.emit("cart.updated", { userId: req.user._id, itemsCount: populated.items.length, totalPrice: populated.totalPrice });
    res.status(201).json({ success: true, cart: populated });
  } catch (err) {
    next(err);
  }
});

// Update quantity of a cart line
// Body: { quantity: Number }
router.patch("/items/:itemId", authMiddleware, async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body || {};
    if (typeof quantity !== "number" || quantity < 0) {
      return res.status(400).json({ success: false, message: "Invalid quantity" });
    }

    const dbItem = await Item.findById(itemId);
    if (!dbItem) return res.status(404).json({ success: false, message: "Item not found" });

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const line = cart.items.find((l) => String(l.item) === String(itemId));
    if (!line) return res.status(404).json({ success: false, message: "Item not in cart" });

    if (quantity === 0) {
      cart.items = cart.items.filter((l) => String(l.item) !== String(itemId));
    } else {
      line.quantity = quantity;
    }

    await recalculateCartTotals(cart);
    await cart.save();

    const populated = await Cart.findById(cart._id).populate("items.item", "name price stock image");
    bus.emit("cart.updated", { userId: req.user._id, itemsCount: populated.items.length, totalPrice: populated.totalPrice });
    res.json({ success: true, cart: populated });
  } catch (err) {
    next(err);
  }
});

// Remove an item from cart
router.delete("/items/:itemId", authMiddleware, async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

    const before = cart.items.length;
    cart.items = cart.items.filter((l) => String(l.item) !== String(itemId));
    if (cart.items.length === before) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }

    await recalculateCartTotals(cart);
    await cart.save();
    const populated = await Cart.findById(cart._id).populate("items.item", "name price stock image");
    bus.emit("cart.updated", { userId: req.user._id, itemsCount: populated.items.length, totalPrice: populated.totalPrice });
    res.json({ success: true, cart: populated });
  } catch (err) {
    next(err);
  }
});

// Clear cart
router.delete("/", authMiddleware, async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });
    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();
    bus.emit("cart.updated", { userId: req.user._id, itemsCount: cart.items.length, totalPrice: cart.totalPrice });
    res.json({ success: true, cart });
  } catch (err) {
    next(err);
  }
});

module.exports = router;