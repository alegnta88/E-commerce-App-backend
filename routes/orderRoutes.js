const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/authorizeRoles");
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

// ADMIN: list all orders
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

// ADMIN: update order status; restock on cancel
// Body: { status: "pending|paid|shipped|delivered|cancelled" }
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

    // If cancelling and previous status was not cancelled, restock items
    if (status === "cancelled" && order.status !== "cancelled") {
      const session = await Item.startSession();
      session.startTransaction();
      try {
        for (const line of order.items) {
          const dbItem = await Item.findById(line.item).session(session);
          if (!dbItem) continue;
          dbItem.stock += line.quantity;
          await dbItem.save({ session });
        }
        order.status = status;
        await order.save({ session });
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }
    } else {
      order.status = status;
      await order.save();
    }

    const populated = await Order.findById(order._id)
      .populate("user", "name email")
      .populate("items.item", "name price");
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

    // Use a transaction to validate stock and decrement atomically
    const session = await Item.startSession();
    session.startTransaction();
    try {
      const hydratedItems = [];
      for (let index = 0; index < items.length; index++) {
        const { item, quantity } = items[index] || {};
        if (!item || typeof quantity !== "number" || quantity <= 0) {
          const error = new Error(`Invalid item at index ${index}`);
          error.statusCode = 400;
          throw error;
        }

        const dbItem = await Item.findOne({ _id: item, isActive: true }).session(session);
        if (!dbItem) {
          const error = new Error(`Item not found at index ${index}`);
          error.statusCode = 404;
          throw error;
        }

        if (dbItem.stock < quantity) {
          const error = new Error(`Insufficient stock for item at index ${index}`);
          error.statusCode = 400;
          throw error;
        }

        dbItem.stock -= quantity;
        await dbItem.save({ session });

        hydratedItems.push({
          item: dbItem._id,
          quantity,
          price: dbItem.price,
        });
      }

      const totalAmount = hydratedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

      const order = await Order.create([
        {
          user: req.user._id,
          items: hydratedItems,
          totalAmount,
        },
      ], { session });

      await session.commitTransaction();
      session.endSession();

      const created = await Order.findById(order[0]._id).populate("items.item", "name price");
      res.status(201).json({ success: true, order: created });
    } catch (txnErr) {
      await session.abortTransaction();
      session.endSession();
      throw txnErr;
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;