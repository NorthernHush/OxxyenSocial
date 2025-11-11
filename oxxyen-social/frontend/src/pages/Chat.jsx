import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSend, FiArrowLeft, FiLock } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import {
  generateSessionKey,
  encryptMessage,
  decryptMessage,
  decryptSessionKey,
  importRSAPublicKey
} from '../utils/e2eEncryption';

const Chat = () => {
  const { chatId } = useParams();
  const { user, socket, privateKey } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionKeys, setSessionKeys] = useState(new Map());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchChat();
    fetchMessages();

    if (socket) {
      socket.emit('join_chat', chatId);

      socket.on('new_message', async (message) => {
        // Decrypt message if it's E2E encrypted
        if (message.encryptedContent && privateKey) {
          try {
            let sessionKey = sessionKeys.get(message.chat);

            // If no session key cached, try to decrypt it
            if (!sessionKey && message.sessionKey) {
              sessionKey = await decryptSessionKey(message.sessionKey, privateKey);
              setSessionKeys(prev => new Map(prev.set(message.chat, sessionKey)));
            }

            if (sessionKey) {
              const decryptedContent = await decryptMessage(
                message.encryptedContent,
                sessionKey,
                message.iv
              );
              message.content = decryptedContent;
            }
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            message.content = '[Не удалось расшифровать сообщение]';
          }
        }

        setMessages(prev => [...prev, message]);
        scrollToBottom();
      });

      return () => {
        socket.emit('leave_chat', chatId);
        socket.off('new_message');
      };
    }
  }, [chatId, socket, privateKey, sessionKeys]);

  const fetchChat = async () => {
    try {
      const response = await fetch(`/api/v1/chats/${chatId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const chatData = await response.json();
        setChat(chatData);
      }
    } catch (error) {
      console.error('Failed to fetch chat:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/v1/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const messagesData = await response.json();

        // Decrypt messages
        const decryptedMessages = await Promise.all(
          messagesData.map(async (message) => {
            if (message.encryptedContent && privateKey) {
              try {
                let sessionKey = sessionKeys.get(message.chat);

                if (!sessionKey && message.sessionKey) {
                  sessionKey = await decryptSessionKey(message.sessionKey, privateKey);
                  setSessionKeys(prev => new Map(prev.set(message.chat, sessionKey)));
                }

                if (sessionKey) {
                  const decryptedContent = await decryptMessage(
                    message.encryptedContent,
                    sessionKey,
                    message.iv
                  );
                  return { ...message, content: decryptedContent };
                }
              } catch (error) {
                console.error('Failed to decrypt message:', error);
                return { ...message, content: '[Не удалось расшифровать сообщение]' };
              }
            }
            return message;
          })
        );

        setMessages(decryptedMessages);
        setLoading(false);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    try {
      let messageData = {
        chatId,
        type: 'text'
      };

      // E2E encryption for direct chats
      if (chat?.type === 'direct' && privateKey) {
        let sessionKey = sessionKeys.get(chatId);

        // Generate new session key if none exists
        if (!sessionKey) {
          sessionKey = await generateSessionKey();
          setSessionKeys(prev => new Map(prev.set(chatId, sessionKey)));
        }

        // Encrypt message
        const { encryptedContent, iv, authTag } = await encryptMessage(newMessage.trim(), sessionKey);

        messageData = {
          ...messageData,
          encryptedContent,
          sessionKey,
          iv,
          authTag
        };
      } else {
        // Fallback to plain text (should not happen in production)
        messageData.content = newMessage.trim();
      }

      socket.emit('send_message', messageData);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiArrowLeft size={20} />
              </Link>
              <div className="flex items-center space-x-2">
                <FiLock size={16} className="text-green-500" />
                <div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {chat?.name || 'Личный чат'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {chat?.participants?.length || 0} участников • Защищено E2E
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message._id}
              className={`flex ${message.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.sender._id === user._id
                    ? 'bg-primary-500 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.sender._id !== user._id && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {message.sender.username}
                  </div>
                )}
                <div className="text-sm">{message.content}</div>
                <div
                  className={`text-xs mt-1 ${
                    message.sender._id === user._id
                      ? 'text-primary-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {formatTime(message.createdAt)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={sendMessage} className="flex space-x-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-primary-500 text-white p-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSend size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
