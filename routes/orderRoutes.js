const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
const Order = require("../models/order");
const Item = require("../models/item");
const bus = require("../events/handlers");

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

router.get("/admin", authMiddleware, authorizeRoles("admin"), async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("items.item", "name price")
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    next(err);
  }
});

router.patch("/:orderId/status", authMiddleware, authorizeRoles("admin"), async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body || {};
    const allowed = ["pending", "paid", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // No stock adjustments while stock functionality is disabled
    order.status = status;
    await order.save();

    const populated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.item", "name price");
    bus.emit("order.statusChanged", { orderId: order._id, status: order.status });
    res.json({ success: true, order: populated });
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

    const hydratedItems = [];
    for (let index = 0; index < items.length; index++) {
      const { item, quantity } = items[index] || {};
      if (!item || typeof quantity !== "number" || quantity <= 0) {
        const error = new Error(`Invalid item at index ${index}`);
        error.statusCode = 400;
        throw error;
      }
      const dbItem = await Item.findOne({
        _id: item,
        $or: [{ isActive: true }, { isActive: { $exists: false } }],
      });
      if (!dbItem) {
        const error = new Error(`Item not found at index ${index}`);
        error.statusCode = 404;
        throw error;
      }
      hydratedItems.push({ item: dbItem._id, quantity, price: dbItem.price });
    }

    const totalAmount = hydratedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const orderDoc = await Order.create({ user: req.user._id, items: hydratedItems, totalAmount });
    const created = await Order.findById(orderDoc._id).populate("items.item", "name price");
    bus.emit("order.created", { orderId: created._id, userId: req.user._id, totalAmount, items: hydratedItems });
    return res.status(201).json({ success: true, order: created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;