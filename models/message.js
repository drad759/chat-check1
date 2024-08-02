const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    contactEmail: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    roomName: { type: String, required: true }
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
