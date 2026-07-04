import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getUnreadCount } from '../api/chatService';

const ChatContext = createContext(null);

const SOCKET_URL = 'http://localhost:8000';

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // conversationListeners: Map<conversationId, callback[]>
  const conversationListeners = useRef(new Map());
  const typingListeners = useRef(new Map());
  const chatNotificationListeners = useRef([]);

  // ── Connect Socket ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('[ChatContext] Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[ChatContext] Socket disconnected');
    });

    newSocket.on('connect_error', (err) => {
      console.error('[ChatContext] Connection error:', err.message);
    });

    // Global new message listener → update unread badge + notify conversation listeners
    newSocket.on('new_message', (message) => {
      const convId = message.conversation;
      const listeners = conversationListeners.current.get(convId) || [];
      listeners.forEach((cb) => cb(message));
    });

    // Notification for messages when user is NOT in the conversation room
    newSocket.on('new_chat_notification', (data) => {
      setUnreadCount((prev) => prev + 1);
      // Notify all registered listeners (e.g. Chat.jsx to reload conversation)
      const listeners = chatNotificationListeners.current || [];
      listeners.forEach((cb) => cb(data));
    });

    // Typing events
    newSocket.on('user_typing', (data) => {
      const listeners = typingListeners.current.get(data.conversationId) || [];
      listeners.forEach((cb) => cb(data));
    });

    // Online status events
    newSocket.on('online_users', (usersArray) => {
      setOnlineUsers(new Set(usersArray));
    });

    newSocket.on('user_online', (userId) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    });

    newSocket.on('user_offline', (userId) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    setSocket(newSocket);

    // Fetch initial unread count
    fetchUnreadCount();

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setOnlineUsers(new Set());
    };
  }, [isAuthenticated, user]);

  // ── Fetch Unread Count ─────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data?.data?.count ?? 0);
    } catch {
      // silently fail
    }
  }, []);

  // ── Join a conversation room ───────────────────────────────────────
  const joinConversation = useCallback((conversationId) => {
    if (!socket) return;
    socket.emit('join_conversation', conversationId);
  }, [socket]);

  // ── Leave a conversation room ──────────────────────────────────────
  const leaveConversation = useCallback((conversationId) => {
    if (!socket) return;
    socket.emit('leave_conversation', conversationId);
  }, [socket]);

  // ── Send message via socket ────────────────────────────────────────
  const sendMessage = useCallback((conversationId, content) => {
    if (!socket) return;
    socket.emit('send_message', { conversationId, content });
  }, [socket]);

  // ── Emit typing ───────────────────────────────────────────────────
  const emitTyping = useCallback((conversationId, isTyping) => {
    if (!socket) return;
    socket.emit('typing', { conversationId, isTyping });
  }, [socket]);

  // ── Register listener for a conversation's new messages ───────────
  const onNewMessage = useCallback((conversationId, callback) => {
    const listeners = conversationListeners.current.get(conversationId) || [];
    conversationListeners.current.set(conversationId, [...listeners, callback]);

    return () => {
      const current = conversationListeners.current.get(conversationId) || [];
      conversationListeners.current.set(
        conversationId,
        current.filter((cb) => cb !== callback)
      );
    };
  }, []);

  // ── Register listener for typing in a conversation ────────────────
  const onTyping = useCallback((conversationId, callback) => {
    const listeners = typingListeners.current.get(conversationId) || [];
    typingListeners.current.set(conversationId, [...listeners, callback]);

    return () => {
      const current = typingListeners.current.get(conversationId) || [];
      typingListeners.current.set(
        conversationId,
        current.filter((cb) => cb !== callback)
      );
    };
  }, []);

  // ── Reset unread count (call when chat page is open) ──────────────
  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // ── Register listener for incoming chat notifications ─────────────
  const onChatNotification = useCallback((callback) => {
    chatNotificationListeners.current = [...chatNotificationListeners.current, callback];
    return () => {
      chatNotificationListeners.current = chatNotificationListeners.current.filter(cb => cb !== callback);
    };
  }, []);

  const value = {
    socket,
    unreadCount,
    onlineUsers,
    joinConversation,
    leaveConversation,
    sendMessage,
    emitTyping,
    onNewMessage,
    onTyping,
    onChatNotification,
    fetchUnreadCount,
    resetUnreadCount,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};

export default ChatContext;
