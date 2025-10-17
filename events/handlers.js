const bus = require("./eventBus");

bus.on("order.created", (payload) => {
  console.log("[EDA] order.created", {
    orderId: payload.orderId,
    userId: payload.userId,
    totalAmount: payload.totalAmount,
    itemsCount: payload.items?.length || 0,
  });
});

bus.on("order.statusChanged", (payload) => {
  console.log("[EDA] order.statusChanged", payload);
});

bus.on("cart.updated", (payload) => {
  console.log("[EDA] cart.updated", { userId: payload.userId, items: payload.itemsCount, total: payload.totalPrice });
});

bus.on("item.stockChanged", (payload) => {
  console.log("[EDA] item.stockChanged", payload);
});

module.exports = bus;