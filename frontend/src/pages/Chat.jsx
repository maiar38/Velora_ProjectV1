import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import {
  getConversations,
  getConversation,
  getMessages,
  markAsRead,
  deleteConversation,
} from '../api/chatService';


const API_IMG = 'http://localhost:8000';

// ── Helpers ──────────────────────────────────────────────────────────
function getUserImg(user) {
  if (!user?.profileImage) return null;
  let p = user.profileImage;
  if (!p.includes('.')) p += '.jpg';
  if (p.startsWith('http')) return p;
  return `${API_IMG}/uploads/users/${p}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Avatar component ─────────────────────────────────────────────────
function Avatar({ user, size = 10, className = '', isOnline = false }) {
  const img = getUserImg(user);
  const initials = (user?.name?.charAt(0) || 'U').toUpperCase();
  const sizeClass = `w-${size} h-${size}`;
  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      <div className={`${sizeClass} rounded-full overflow-hidden bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center font-bold text-white`}>
        {img ? (
          <img
            src={img}
            alt={user?.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span className={`text-${size <= 8 ? 'xs' : 'sm'}`}>{initials}</span>
        )}
      </div>
      {isOnline && (
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0d1220]" />
      )}
    </div>
  );
}

// ── ConversationItem component ───────────────────────────────────────
function ConversationItem({ conversation, isActive, currentUser, onClick, onDelete, unread, onlineUsers }) {
  const isGroup = conversation.type === 'group';

  const getTitle = () => {
    if (isGroup) return conversation.groupName || 'Group Chat';
    const other = conversation.participants?.find(p => p._id !== currentUser?._id);
    return other?.name || 'Unknown User';
  };

  const getAvatar = () => {
    if (isGroup) {
      if (conversation.relatedEvent?.coverImage) {
        return (
          <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden border-2 border-white/10">
            <img 
              src={`${API_IMG}/uploads/ride-events/${conversation.relatedEvent.coverImage}`}
              alt="Event Cover"
              className="w-full h-full object-cover"
            />
          </div>
        );
      }
      return (
        <div className="w-12 h-12 rounded-full flex-shrink-0 bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      );
    }
    const other = conversation.participants?.find(p => p._id !== currentUser?._id);
    const isOnline = onlineUsers ? onlineUsers.has(other?._id?.toString()) : false;
    return <Avatar user={other} size={12} isOnline={isOnline} />;
  };

  const lastMsg = conversation.lastMessage;

  return (
    <div className="relative group">
      <button
        onClick={() => onClick(conversation)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-150 text-left ${
          isActive
            ? 'bg-blue-600/20 border border-blue-500/30'
            : 'hover:bg-white/5 border border-transparent'
        }`}
      >
        <div className="relative flex-shrink-0">
          {getAvatar()}
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-200 group-hover:text-white'}`}>
              {getTitle()}
            </span>
            {lastMsg?.timestamp && (
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {formatTime(lastMsg.timestamp)}
              </span>
            )}
          </div>

          {conversation.relatedProduct && (
            <div className="flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-[10px] text-cyan-500 truncate">{conversation.relatedProduct?.title}</span>
            </div>
          )}

          {conversation.relatedEvent && (
            <div className="flex items-center gap-1 mt-0.5">
              <svg className="w-3 h-3 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              </svg>
              <span className="text-[10px] text-purple-400 truncate">{conversation.relatedEvent?.title}</span>
            </div>
          )}

          <p className={`text-xs mt-0.5 truncate ${unread > 0 ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
            {lastMsg?.content || 'No messages yet'}
          </p>
        </div>
      </button>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation._id);
          }}
          title="Delete Conversation"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-red-500/10 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Message Bubble ───────────────────────────────────────────────────
function MessageBubble({ message, isMe, showAvatar, onImageLoad }) {
  return (
    <div className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {showAvatar && !isMe ? (
        <Avatar user={message.sender} size={8} />
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {showAvatar && !isMe && (
          <span className="text-[11px] text-gray-400 mb-1 ml-1">
            {message.sender?.name}
          </span>
        )}

        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
            isMe
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-sm'
              : 'bg-[#1a2035] border border-white/5 text-gray-100 rounded-bl-sm'
          }`}
        >
          {message.image?.url && (
            <img
              src={message.image.url.startsWith('http') ? message.image.url : `${API_IMG}${message.image.url}`}
              alt="Message attachment"
              className="rounded-xl max-w-full mb-2 max-h-60 object-cover"
              onLoad={onImageLoad}
            />
          )}
          {message.content && <span>{message.content}</span>}
        </div>

        <span className="text-[10px] text-gray-600 mt-1 px-1">
          {formatMsgTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────
function EmptyConversationState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <div className="text-center">
        <h3 className="text-white font-bold text-lg mb-1">Select a conversation</h3>
        <p className="text-gray-500 text-sm max-w-xs">
          Choose a chat from the list to start messaging, or message someone from their profile or a product page.
        </p>
      </div>
    </div>
  );
}

// ── Main Chat Page ───────────────────────────────────────────────────
export default function Chat() {
  const { user } = useAuth();
  const {
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
    resetUnreadCount,
  } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [typingInfo, setTypingInfo] = useState(null);
  const [unreadMap, setUnreadMap] = useState({});
  const [mobileShowList, setMobileShowList] = useState(true);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  // Reset global unread counter when chat page opens
  useEffect(() => {
    resetUnreadCount();
  }, [resetUnreadCount]);

  // ── Load conversations ──────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const data = await getConversations();
      const convs = data?.data?.conversations || [];
      // Deduplicate in case of React StrictMode race conditions
      const uniqueConvs = Array.from(new Map(convs.map(c => [c._id, c])).values());
      setConversations(uniqueConvs);
      return uniqueConvs;
    } catch (err) {
      console.error('Failed to load conversations:', err);
      return [];
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  // ── Init: load conversations & auto-open if navigated with state ──
  useEffect(() => {
    const init = async () => {
      const convs = await loadConversations();
      const stateConvId = location.state?.conversationId;
      if (!stateConvId) return;

      // Try to find in loaded list first
      let target = convs.find(c => c._id === stateConvId);

      // If not in list (e.g. brand new), fetch it directly
      if (!target) {
        try {
          const res = await getConversation(stateConvId);
          target = res?.data?.conversation;
          if (target) {
            setConversations(prev => {
              if (prev.some(c => c._id === target._id)) return prev;
              return [target, ...prev];
            });
          }
        } catch (e) {
          console.error('Could not load conversation:', e);
        }
      }

      if (target) {
        setActiveConversation(target);
        setMobileShowList(false);
        // load messages inline (don't rely on selectConversation reference)
        setLoadingMsgs(true);
        setMessages([]);
        try {
          const msgData = await getMessages(target._id, { limit: 50 });
          const msgs = [...(msgData?.data?.messages || [])].reverse();
          setMessages(msgs);
          await markAsRead(target._id);
          setUnreadMap(prev => ({ ...prev, [target._id]: 0 }));
        } catch (e) {
          console.error('Failed to load initial messages:', e);
        } finally {
          setLoadingMsgs(false);
        }
        joinConversation(target._id);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.conversationId]);

  // ── Load messages ───────────────────────────────────────────────
  const loadMessages = useCallback(async (conversationId) => {
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const data = await getMessages(conversationId, { limit: 50 });
      // Messages come newest-first from API, reverse for display
      const msgs = [...(data?.data?.messages || [])].reverse();
      setMessages(msgs);
      await markAsRead(conversationId);
      setUnreadMap(prev => ({ ...prev, [conversationId]: 0 }));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // ── Select conversation ─────────────────────────────────────────
  const selectConversation = useCallback((conversation) => {
    if (activeConversation?._id === conversation._id) return;

    // Leave previous room
    if (activeConversation) {
      leaveConversation(activeConversation._id);
    }

    setActiveConversation(conversation);
    setMobileShowList(false);
    loadMessages(conversation._id);
    joinConversation(conversation._id);
  }, [activeConversation, joinConversation, leaveConversation, loadMessages]);

  // ── Delete conversation ─────────────────────────────────────────
  const handleDeleteConversation = useCallback(async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c._id !== conversationId));
      if (activeConversation?._id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [activeConversation]);

  // ── React to incoming chat notifications (message arrived for a conversation not open) ──
  useEffect(() => {
    const unsub = onChatNotification(async (data) => {
      const convId = data?.conversationId;
      if (!convId) return;

      // If this conversation is currently active, the socket room handles it
      // Only act if it's NOT the active conversation
      setActiveConversation(current => {
        if (current?._id === convId) return current;
        return current;
      });

      // Reload the conversation from API and update/add it to the list
      try {
        const res = await getConversation(convId);
        const updatedConv = res?.data?.conversation;
        if (!updatedConv) return;

        setConversations(prev => {
          const exists = prev.find(c => c._id === convId);
          if (exists) {
            // Update existing entry's lastMessage
            return prev.map(c => c._id === convId ? updatedConv : c);
          } else {
            // Add it to top (conversation reappeared after deletion)
            return [updatedConv, ...prev];
          }
        });

        setUnreadMap(prev => ({ ...prev, [convId]: (prev[convId] || 0) + 1 }));
      } catch (e) {
        // Conversation may not be accessible, ignore
      }
    });
    return unsub;
  }, [onChatNotification]);

  // ── Socket: listen to active conversation ───────────────────────
  useEffect(() => {
    if (!activeConversation) return;

    // Rejoin room if socket reconnects (e.g. tab wakes up)
    const handleReconnect = () => {
      joinConversation(activeConversation._id);
    };

    if (socket) {
      socket.on('connect', handleReconnect);
    }

    const unsub = onNewMessage(activeConversation._id, (message) => {
      setMessages(prev => {
        // Prevent true duplicate IDs
        if (prev.some(m => m._id === message._id)) return prev;

        const senderId = typeof message.sender === 'object' ? message.sender._id : message.sender;
        // If it's my own message coming back, replace the optimistic one
        if (user && senderId === user._id) {
          const optimisticIndex = prev.findIndex(m => m.isOptimistic && m.content === message.content);
          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = message;
            return next;
          }
        }
        
        return [...prev, message];
      });
      // Mark as read immediately if chat is open
      markAsRead(activeConversation._id).catch(() => {});
    });

    return () => {
      unsub();
      if (socket) socket.off('connect', handleReconnect);
    };
  }, [activeConversation, onNewMessage, socket, joinConversation, user]);

  // ── Socket: listen for typing ───────────────────────────────────
  useEffect(() => {
    if (!activeConversation) return;
    const unsub = onTyping(activeConversation._id, (data) => {
      if (data.isTyping) {
        setTypingInfo(data);
      } else {
        setTypingInfo(null);
      }
    });
    return unsub;
  }, [activeConversation, onTyping]);

  // ── Auto-scroll to bottom ───────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    // Scroll immediately when messages change
    scrollToBottom();
    // Scroll again after short delays to handle image loading and DOM repaints
    const t1 = setTimeout(scrollToBottom, 100);
    const t2 = setTimeout(scrollToBottom, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [messages, typingInfo, scrollToBottom]);

  // ── Handle send ─────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !activeConversation) return;

    // Optimistic UI
    const optimistic = {
      _id: `temp-${Date.now()}`,
      conversation: activeConversation._id,
      sender: user,
      content: text,
      createdAt: new Date().toISOString(),
      readBy: [user._id],
      isOptimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setInputText('');

    sendMessage(activeConversation._id, text);

    // Emit stop typing
    emitTyping(activeConversation._id, false);

    // Update conversation last message preview
    setConversations(prev =>
      prev.map(c =>
        c._id === activeConversation._id
          ? { ...c, lastMessage: { content: text, sender: user._id, timestamp: new Date() } }
          : c
      )
    );
  }, [inputText, activeConversation, user, sendMessage, emitTyping]);

  // ── Handle typing ───────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!activeConversation) return;
    emitTyping(activeConversation._id, true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emitTyping(activeConversation._id, false);
    }, 2000);
  };

  // ── Enter to send ───────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Conversation Header ──────────────────────────────────────────
  const getChatHeader = () => {
    if (!activeConversation) return null;
    const isGroup = activeConversation.type === 'group';
    if (isGroup) {
      return {
        name: activeConversation.groupName || 'Group Chat',
        subtitle: `${activeConversation.participants?.length || 0} members`,
        isGroup: true,
      };
    }
    const other = activeConversation.participants?.find(p => p._id !== user?._id);
    return {
      name: other?.name || 'Unknown User',
      subtitle: activeConversation.relatedProduct
        ? `Re: ${activeConversation.relatedProduct?.title}`
        : other?.rank || 'Rider',
      user: other,
      isGroup: false,
    };
  };

  const header = getChatHeader();

  return (
    <div className="flex h-screen max-h-screen w-full max-w-full bg-[#0a0e1a] text-white font-sans overflow-hidden">
      <Sidebar variant="events" />
      <main className="flex-1 flex overflow-hidden w-full relative h-full">
        {/* ── Conversations List Panel ───────────────────────────────── */}
        <div className={`
          flex-shrink-0 w-full md:w-80 lg:w-96 border-r border-white/5
          flex flex-col h-full
          ${!mobileShowList ? 'hidden md:flex' : 'flex'}
        `}>
          {/* List Header */}
          <div className="px-4 py-4 border-b border-white/5 flex-shrink-0 pl-16 lg:pl-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-white">Messages</h1>
            </div>
          </div>

          {/* List Body */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <p className="text-gray-600 text-xs mt-1">Start a chat from a user profile or product</p>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationItem
                  key={conv._id}
                  conversation={conv}
                  isActive={activeConversation?._id === conv._id}
                  currentUser={user}
                  onClick={selectConversation}
                  onDelete={handleDeleteConversation}
                  unread={unreadMap[conv._id] || 0}
                  onlineUsers={onlineUsers}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Chat Window Panel ────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col overflow-hidden ${mobileShowList ? 'hidden md:flex' : 'flex'}`}>
          {!activeConversation ? (
            <EmptyConversationState />
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 pl-16 pr-4 md:px-6 py-4 border-b border-white/5 bg-[#0d1220] flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={() => setMobileShowList(true)}
                  className="md:hidden text-gray-400 hover:text-white mr-1 flex-shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>

                {header?.isGroup ? (
                  activeConversation?.relatedEvent?.coverImage ? (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/10 flex-shrink-0">
                      <img 
                        src={`${API_IMG}/uploads/ride-events/${activeConversation.relatedEvent.coverImage}`}
                        alt="Event Cover"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  )
                ) : (
                  <Avatar 
                    user={header?.user} 
                    size={10} 
                    isOnline={onlineUsers.has(header?.user?._id?.toString())} 
                  />
                )}

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-white truncate">{header?.name}</h2>
                  <p className="text-xs text-gray-400 truncate">
                    {!header?.isGroup && onlineUsers.has(header?.user?._id?.toString()) ? (
                      <span className="text-green-400 font-medium">Online</span>
                    ) : (
                      header?.subtitle
                    )}
                  </p>
                </div>

                {/* Related Product Tag */}
                {activeConversation.relatedProduct && (
                  <button
                    onClick={() => navigate(`/products/${activeConversation.relatedProduct?._id}`)}
                    className="hidden sm:flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2 hover:bg-cyan-500/20 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs text-cyan-400 font-medium truncate max-w-[120px]">
                      {activeConversation.relatedProduct?.title}
                    </span>
                  </button>
                )}

                {/* Related Event Tag */}
                {activeConversation.relatedEvent && (
                  <button
                    onClick={() => navigate(`/ride-events/${activeConversation.relatedEvent?._id}`)}
                    className="hidden sm:flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 hover:bg-purple-500/20 transition-colors flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-purple-400 font-medium truncate max-w-[120px]">
                      {activeConversation.relatedEvent?.title}
                    </span>
                  </button>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-3 border border-white/5">
                      <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm">No messages yet</p>
                    <p className="text-gray-600 text-xs mt-1">Say hello! 👋</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                    const prevMsg = messages[idx - 1];
                    const prevSender = prevMsg?.sender?._id || prevMsg?.sender;
                    const currSender = msg.sender?._id || msg.sender;
                    const showAvatar = currSender !== prevSender;
                    return (
                      <MessageBubble
                        key={msg._id}
                        message={msg}
                        isMe={isMe}
                        showAvatar={showAvatar}
                        onImageLoad={scrollToBottom}
                      />
                    );
                  })
                )}

                {/* Typing indicator */}
                {typingInfo && (
                  <div className="flex items-end gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {typingInfo.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="bg-[#1a2035] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-[#0d1220]">
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full resize-none bg-[#1a2035] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-[#1e2840] transition-all max-h-32 scrollbar-hide leading-relaxed"
                      style={{ minHeight: '44px' }}
                      onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                      }}
                    />
                  </div>

                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim()}
                    className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                  >
                    <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-2 ml-1">
                  Press Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
