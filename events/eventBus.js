const { EventEmitter } = require("events");

// Singleton event bus for in-process pub/sub
class EventBus extends EventEmitter {}

module.exports = new EventBus();


