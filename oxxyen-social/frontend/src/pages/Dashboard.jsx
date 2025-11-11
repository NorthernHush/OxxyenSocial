import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMessageSquare, FiUsers, FiSettings, FiLogOut, FiMoon, FiSun, FiLock, FiShield } from 'react-icons/fi';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Load chats and friends
    fetchChats();
    fetchFriends();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/v1/chats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/v1/users/friends', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const createDirectChat = async (friendId) => {
    try {
      const response = await fetch('/api/v1/chats/direct', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ participantId: friendId })
      });

      if (response.ok) {
        const chat = await response.json();
        // Navigate to chat or refresh chats
        fetchChats();
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                OXXYEN SOCIAL
              </h1>
              <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                <FiShield size={16} />
                <span className="text-sm font-medium">E2E Encrypted</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {darkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
              </button>
              <Link
                to="/settings"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiSettings size={20} />
              </Link>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiLogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {user?.username}
                </h2>
                {user?.isDeveloper && (
                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mt-1">
                    <FiShield className="mr-1" size={12} />
                    Developer
                  </div>
                )}
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                  {user?.description || 'Нет описания'}
                </p>
                <div className="mt-4 space-y-2">
                  <Link
                    to={`/profile/${user?.username}`}
                    className="block w-full bg-primary-500 text-white py-2 px-4 rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Мой профиль
                  </Link>
                  <Link
                    to="/feed"
                    className="block w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Лента
                  </Link>
                  <Link
                    to="/friends"
                    className="block w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Друзья ({friends.length})
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Chats and Friends */}
          <div className="lg:col-span-3 space-y-8">
            {/* Friends Online */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <FiUsers className="mr-2" />
                  Друзья онлайн
                </h3>
                <Link
                  to="/friends"
                  className="text-primary-600 hover:text-primary-500 text-sm font-medium"
                >
                  Все друзья
                </Link>
              </div>

              {friends.length === 0 ? (
                <div className="text-center py-4">
                  <FiUsers className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Нет друзей. <Link to="/friends" className="text-primary-600 hover:text-primary-500">Найти друзей</Link>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {friends.slice(0, 6).map((friend) => (
                    <div
                      key={friend._id}
                      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => createDirectChat(friend._id)}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {friend.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {friend.username}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Онлайн
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <FiLock className="mr-2 text-green-500" />
                  Защищенные чаты
                </h3>
                <button className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors">
                  Новый чат
                </button>
              </div>

              {chats.length === 0 ? (
                <div className="text-center py-8">
                  <FiMessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    Нет чатов
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Начните защищенное общение с друзьями
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chats.map((chat) => (
                    <Link
                      key={chat._id}
                      to={`/chat/${chat._id}`}
                      className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center">
                          <FiLock className="text-white" size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {chat.name || 'Личный чат'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {chat.lastMessage?.content || 'Нет сообщений'}
                          </p>
                        </div>
                        <div className="text-xs text-gray-400">
                          E2E
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
