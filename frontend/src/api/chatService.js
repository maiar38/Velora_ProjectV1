import axiosInstance from './axios';

// ==========================================
// CONVERSATIONS API
// ==========================================

/**
 * Get all conversations for the current user
 */
export const getConversations = async (params = {}) => {
  const { data } = await axiosInstance.get('/community/chat/conversations', { params });
  return data;
};

/**
 * Start or get an existing direct conversation
 * @param {string} participantId - The other user's ID
 * @param {string|null} relatedProduct - Optional product ID for marketplace chats
 */
export const startConversation = async (participantId, relatedProduct = null) => {
  const payload = { participantId };
  if (relatedProduct) payload.relatedProduct = relatedProduct;
  const { data } = await axiosInstance.post('/community/chat/conversations', payload);
  return data;
};

/**
 * Get a single conversation by ID
 */
export const getConversation = async (id) => {
  const { data } = await axiosInstance.get(`/community/chat/conversations/${id}`);
  return data;
};

/**
 * Get messages in a conversation (paginated)
 * @param {string} conversationId
 * @param {object} params - { page, limit }
 */
export const getMessages = async (conversationId, params = {}) => {
  const { data } = await axiosInstance.get(
    `/community/chat/conversations/${conversationId}/messages`,
    { params }
  );
  return data;
};

/**
 * Send a message via REST (fallback — prefer socket)
 * @param {string} conversationId
 * @param {object} payload - { content, image }
 */
export const sendMessageREST = async (conversationId, payload) => {
  const { data } = await axiosInstance.post(
    `/community/chat/conversations/${conversationId}/messages`,
    payload
  );
  return data;
};

/**
 * Mark a conversation as read
 */
export const markAsRead = async (conversationId) => {
  const { data } = await axiosInstance.patch(
    `/community/chat/conversations/${conversationId}/read`
  );
  return data;
};

/**
 * Get total unread message count across all conversations
 */
export const getUnreadCount = async () => {
  const { data } = await axiosInstance.get('/community/chat/unread-count');
  return data;
};

/**
 * Delete (hide) a conversation
 */
export const deleteConversation = async (conversationId) => {
  const { data } = await axiosInstance.delete(`/community/chat/conversations/${conversationId}`);
  return data;
};
