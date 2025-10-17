const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Order = require("../models/order");
const Item = require("../models/item");

// GET current user's orders
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate("items.item", "name price")
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
});

router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Items array is required" });
    }

    // Validate and hydrate items with current price
    const hydratedItems = await Promise.all(
      items.map(async (entry, index) => {
        const { item, quantity } = entry || {};
        if (!item || typeof quantity !== "number" || quantity <= 0) {
          const error = new Error(`Invalid item at index ${index}`);
          error.statusCode = 400;
          throw error;
        }

        const dbItem = await Item.findById(item);
        if (!dbItem) {
          const error = new Error(`Item not found at index ${index}`);
          error.statusCode = 404;
          throw error;
        }

        return {
          item: dbItem._id,
          quantity,
          price: dbItem.price,
        };
      })
    );

    const totalAmount = hydratedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const order = await Order.create({
      user: req.user._id,
      items: hydratedItems,
      totalAmount,
    });

    const created = await Order.findById(order._id).populate("items.item", "name price");

    res.status(201).json({ success: true, order: created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;