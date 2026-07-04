const { protectSocket } = require("../../../shared/middlewares/authSocket.middleware");
const Conversation = require("./conversation.model");
const Message = require("./message.model");

// Track online users globally (in-memory for single instance)
const onlineUsers = new Map(); // userId -> connectionCount

module.exports = (io) => {
    // Socket Authentication
    io.use(protectSocket);

    io.on("connection", (socket) => {
        const userId = socket.user._id.toString();
        console.log(`User connected to chat: ${userId}`);

        // Join personal room for user-specific notifications
        socket.join(`user_${userId}`);

        // Update online status
        const count = onlineUsers.get(userId) || 0;
        onlineUsers.set(userId, count + 1);
        
        // Broadcast to everyone if user just came online
        if (count === 0) {
            io.emit("user_online", userId);
        }
        
        // Send the current list of online users to the newly connected user
        socket.emit("online_users", Array.from(onlineUsers.keys()));

        socket.on("join_conversation", async (conversationId) => {
            try {
                // Verify user is part of conversation
                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    participants: socket.user._id
                });

                if (!conversation) {
                    return socket.emit("chat_error", { message: "Conversation not found" });
                }
                socket.join(conversationId);
                console.log(`User ${userId} joined conversation ${conversationId}`);
                socket.emit("conversation_joined", { conversationId });
            } catch (err) {
                socket.emit("chat_error", { message: "Failed to join" });
            }
        });

        socket.on("leave_conversation", (conversationId) => {
            socket.leave(conversationId);
            socket.emit("conversation_left", { conversationId });
        });

        socket.on("send_message", async (data) => {
            try {
                const { conversationId, content } = data;
                if (!conversationId || !content?.trim()) return;

                const conversation = await Conversation.findOne({
                    _id: conversationId,
                    participants: socket.user._id
                });

                if (!conversation) {
                    return socket.emit("chat_error", { message: "Conversation not found" });
                }

                const message = await Message.create({
                    conversation: conversationId,
                    sender: socket.user._id,
                    content: content.trim(),
                    readBy: [socket.user._id]
                });

                await message.populate("sender", "name profileImage");

                await Conversation.updateOne(
                    { _id: conversationId },
                    {
                        $set: {
                            lastMessage: {
                                content: content.trim(),
                                sender: socket.user._id,
                                timestamp: new Date()
                            }
                        }
                    }
                );

                // Emit to all users in the conversation room
                io.to(conversationId).emit("new_message", message);

                // For users who are offline/not in the room, we could send notifications here
                conversation.participants.forEach(participantId => {
                    if (participantId.toString() !== userId) {
                        io.to(`user_${participantId}`).emit("new_chat_notification", {
                            conversationId,
                            message: "New message received",
                            sender: { _id: userId, name: socket.user.name }
                        });
                    }
                });
            } catch (error) {
                console.error("Socket send_message error:", error);
            }
        });

        socket.on("typing", async (data) => {
            try {
                const { conversationId, isTyping } = data;
                const exists = await Conversation.exists({
                    _id: conversationId,
                    participants: socket.user._id
                });

                if (!exists) return;

                socket.to(conversationId).emit("user_typing", {
                    conversationId,
                    userId,
                    name: socket.user.name,
                    isTyping
                });
            } catch {
                socket.emit("chat_error", { message: "Typing failed" });
            }
        });

        socket.on("disconnect", () => {
            console.log(`User disconnected from chat: ${userId}`);
            const currentCount = onlineUsers.get(userId) || 0;
            if (currentCount <= 1) {
                onlineUsers.delete(userId);
                io.emit("user_offline", userId);
            } else {
                onlineUsers.set(userId, currentCount - 1);
            }
        });
    });
};
