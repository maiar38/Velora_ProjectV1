const Conversation = require("./conversation.model");
const Message = require("./message.model");
const asyncHandler = require("express-async-handler");
const ApiError = require("../../../shared/errors/ApiError");
const ApiFeatures = require("../../../shared/utils/apiFeatures");

/**
 * @desc Start Direct Conversation
 * @route POST /api/v1/community/chat/conversations
 * @access Protected
 */
exports.startConversation = asyncHandler(async (req, res, next) => {
    const { participantId, relatedProduct } = req.body;

    if (participantId === req.user._id.toString()) {
        return next(new ApiError("Cannot start conversation with yourself", 400));
    }

    // Sort participants so [A,B] and [B,A] always produce the same document
    const participants = [req.user._id.toString(), participantId.toString()].sort();

    const filter = {
        type: "direct",
        participants: { $all: participants, $size: 2 },
        relatedProduct: relatedProduct || null
    };

    let conversation = await Conversation.findOne(filter);

    if (conversation) {
        return res.status(200).json({
            status: "success",
            message: "Conversation exists",
            data: { conversation }
        });
    }

    // Create new conversation
    conversation = await Conversation.create({
        type: "direct",
        participants,
        relatedProduct: relatedProduct || null,
        isActive: true
    });

    res.status(201).json({
        status: "success",
        message: "Conversation started",
        data: { conversation }
    });
});

/**
 * @desc Get My Conversations
 * @route GET /api/v1/community/chat/conversations
 * @access Protected
 */
exports.getConversations = asyncHandler(async (req, res) => {
    // Fetch ALL conversations for the user (don't exclude deletedBy in query)
    let conversations = await Conversation.find({ 
        participants: req.user._id, 
        isActive: true
    })
        .populate("participants", "name profileImage rank")
        .populate("relatedProduct", "title images price")
        .populate("relatedEvent", "title coverImage startDate")
        .sort({ "lastMessage.timestamp": -1, "updatedAt": -1 });

    // Smart filter: hide conversations the user deleted UNLESS a new message
    // arrived after the deletion timestamp
    const userId = req.user._id.toString();
    conversations = conversations.filter(conv => {
        const deleteRecord = conv.deletedBy?.find(
            d => d.user?.toString() === userId
        );
        if (!deleteRecord) return true; // not deleted — show it

        // Deleted — only show if a new message arrived AFTER deletion
        if (conv.lastMessage?.timestamp) {
            return new Date(conv.lastMessage.timestamp) > new Date(deleteRecord.deletedAt);
        }
        return false; // deleted and no new messages — hide it
    });

    res.status(200).json({
        status: "success",
        results: conversations.length,
        data: { conversations }
    });
});

/**
 * @desc Get Conversation Details
 * @route GET /api/v1/community/chat/conversations/:id
 * @access Protected
 */
exports.getConversation = asyncHandler(async (req, res, next) => {
    const conversation = await Conversation.findOne({
        _id: req.params.id,
        participants: req.user._id
    })
    .populate("participants", "name profileImage rank isVerified")
    .populate("relatedProduct", "title images price")
    .populate("relatedEvent", "title coverImage startDate");

    if (!conversation) {
        return next(new ApiError("Conversation not found", 404));
    }

    res.status(200).json({
        status: "success",
        data: { conversation }
    });
});

/**
 * @desc Get Messages
 * @route GET /api/v1/community/chat/conversations/:id/messages
 * @access Protected
 */
exports.getMessages = asyncHandler(async (req, res, next) => {
    // Check if participant
    const conversation = await Conversation.findOne({
        _id: req.params.id,
        participants: req.user._id
    });

    if (!conversation) {
        return next(new ApiError("Conversation not found", 404));
    }

    // Find if this user has deleted the conversation, and get the deletedAt timestamp
    const deleteRecord = conversation.deletedBy?.find(
        (d) => d.user?.toString() === req.user._id.toString()
    );
    const visibleFrom = deleteRecord ? deleteRecord.deletedAt : null;

    // Build message query - only show messages after deletedAt (if user deleted)
    const msgFilter = {
        conversation: req.params.id,
        isDeleted: false,
        ...(visibleFrom ? { createdAt: { $gt: visibleFrom } } : {})
    };

    const features = new ApiFeatures(
        Message.find(msgFilter).populate("sender", "name profileImage"),
        req.query
    );

    await features.paginate();

    // Sort newest first (frontend reverses for display)
    features.query = features.query.sort("-createdAt");

    const messages = await features.query;

    res.status(200).json({
        status: "success",
        pagination: features.paginationResult,
        results: messages.length,
        data: { messages }
    });
});

/**
 * @desc Send Message (REST fallback)
 * @route POST /api/v1/community/chat/conversations/:id/messages
 * @access Protected
 */
exports.sendMessage = asyncHandler(async (req, res, next) => {
    const { content } = req.body;
    const image = req.body.image; // Assume middleware sets this

    if (!content?.trim() && !image) {
        return next(new ApiError("Message must contain text or image", 400));
    }

    const conversation = await Conversation.findOne({
        _id: req.params.id,
        participants: req.user._id
    });

    if (!conversation) {
        return next(new ApiError("Conversation not found", 404));
    }

    const message = await Message.create({
        conversation: conversation._id,
        sender: req.user._id,
        content: content?.trim(),
        image: image ? { url: image } : undefined,
        readBy: [req.user._id]
    });

    await Conversation.updateOne(
        {
            _id: conversation._id
        },
        {
            $set: {
                lastMessage: {
                    content: content?.trim() || "Image",
                    sender: req.user._id,
                    timestamp: new Date()
                }
            }
        }
    );

    res.status(201).json({
        status: "success",
        data: { message }
    });
});

/**
 * @desc Mark Conversation as Read
 * @route PATCH /api/v1/community/chat/conversations/:id/read
 * @access Protected
 */
exports.markAsRead = asyncHandler(async (req, res, next) => {
    const conversation = await Conversation.findOne({
        _id: req.params.id,
        participants: req.user._id
    });

    if (!conversation) {
        return next(new ApiError("Conversation not found", 404));
    }

    await Message.updateMany(
        { conversation: conversation._id, readBy: { $ne: req.user._id }, isDeleted: false },
        { $addToSet: { readBy: req.user._id } }
    );

    res.status(200).json({
        status: "success",
        message: "Messages marked as read"
    });
});

/**
 * @desc Get Unread Messages Count
 * @route GET /api/v1/community/chat/unread-count
 * @access Protected
 */
exports.getUnreadMessageCount = asyncHandler(async (req, res) => {
    // Find all conversations where user is a participant
    const conversations = await Conversation.find({ participants: req.user._id }).select('_id');
    const conversationIds = conversations.map(c => c._id);

    // Count messages in these conversations where user is not in readBy
    const count = await Message.countDocuments({
        conversation: { $in: conversationIds },
        readBy: { $ne: req.user._id }
    });

    res.status(200).json({
        status: "success",
        data: { count }
    });
});

/**
 * @desc Delete (Hide) Conversation
 * @route DELETE /api/v1/community/chat/conversations/:id
 * @access Protected
 */
exports.deleteConversation = asyncHandler(async (req, res, next) => {
    // Remove any existing delete record for this user, then add a fresh one with current timestamp
    const conversation = await Conversation.findOneAndUpdate(
        { _id: req.params.id, participants: req.user._id },
        {
            $pull: { deletedBy: { user: req.user._id } }
        },
        { new: true }
    );

    if (!conversation) {
        return next(new ApiError("Conversation not found", 404));
    }

    // Now push the new record with current timestamp
    await Conversation.updateOne(
        { _id: req.params.id },
        {
            $push: {
                deletedBy: {
                    user: req.user._id,
                    deletedAt: new Date()
                }
            }
        }
    );

    res.status(200).json({
        status: "success",
        message: "Conversation deleted successfully"
    });
});
