import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiArrowLeft, FiUserPlus, FiUserCheck, FiMessageCircle, FiUsers, FiX, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Friends = () => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('friends');

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await fetch('/api/v1/users/friends', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const friendsData = await response.json();
        setFriends(friendsData);
        setOnlineFriends(friendsData.filter(friend => friend.status === 'online'));
      }
    } catch (error) {
      console.error('Failed to fetch friends:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await fetch('/api/v1/users/friend-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const requests = await response.json();
        setFriendRequests(requests);
      }
    } catch (error) {
      console.error('Failed to fetch friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (username) => {
    try {
      const response = await fetch('/api/v1/users/friend-request', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username })
      });

      if (response.ok) {
        toast.success('Запрос в друзья отправлен');
      } else {
        const error = await response.json();
        toast.error(error.message);
      }
    } catch (error) {
      console.error('Send friend request error:', error);
      toast.error('Ошибка при отправке запроса');
    }
  };

  const handleAcceptFriend = async (requestId) => {
    try {
      const response = await fetch(`/api/v1/users/friend-request/${requestId}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Друг добавлен');
        fetchFriends();
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Accept friend error:', error);
      toast.error('Ошибка при добавлении друга');
    }
  };

  const handleDeclineFriend = async (requestId) => {
    try {
      const response = await fetch(`/api/v1/users/friend-request/${requestId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Запрос отклонён');
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Decline friend error:', error);
      toast.error('Ошибка при отклонении запроса');
    }
  };

  const handleRemoveFriend = async (friendId) => {
    try {
      const response = await fetch(`/api/v1/users/friends/${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Друг удалён');
        fetchFriends();
      }
    } catch (error) {
      console.error('Remove friend error:', error);
      toast.error('Ошибка при удалении друга');
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Неизвестно';

    const date = new Date(lastSeen);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'только что';
    } else if (diffInHours < 24) {
      return `${diffInHours} ч назад`;
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Друзья
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'friends'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <FiUsers size={16} />
                <span>Друзья ({friends.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'requests'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <FiUserPlus size={16} />
                <span>Запросы ({friendRequests.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('online')}
                className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium border-b-2 ${
                  activeTab === 'online'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Онлайн ({onlineFriends.length})</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'friends' && (
          <div className="space-y-4">
            {friends.length === 0 ? (
              <div className="text-center py-12">
                <FiUsers size={48} className="mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  У вас пока нет друзей
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Начните добавлять пользователей в друзья для защищенного общения
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <div key={friend._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white text-lg font-bold">
                              {friend.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                          friend.status === 'online' ? 'bg-green-500' :
                          friend.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}></div>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/profile/${friend.username}`}
                            className="font-semibold text-gray-900 dark:text-white hover:underline"
                          >
                            {friend.username}
                          </Link>
                          {friend.isDeveloper && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <FiLock className="mr-1" size={10} />
                              Developer
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {friend.status === 'online' ? 'Онлайн' :
                           friend.status === 'away' ? 'Отошёл' :
                           `Был(а) ${formatLastSeen(friend.lastSeen)}`}
                        </p>
                        {friend.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {friend.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/chat/${friend.username}`}
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
                      >
                        <FiLock size={16} />
                        <span>E2E Чат</span>
                      </Link>
                      <button
                        onClick={() => handleRemoveFriend(friend._id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Удалить из друзей"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            {friendRequests.length === 0 ? (
              <div className="text-center py-12">
                <FiUserPlus size={48} className="mx-auto text-gray-400 mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Нет новых запросов
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Когда кто-то захочет добавить вас в друзья, запрос появится здесь
                </p>
              </div>
            ) : (
              friendRequests.map((request) => (
                <div key={request._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                        {request.avatar ? (
                          <img
                            src={request.avatar}
                            alt={request.username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white text-lg font-bold">
                            {request.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <Link
                          to={`/profile/${request.username}`}
                          className="font-semibold text-gray-900 dark:text-white hover:underline"
                        >
                          {request.username}
                        </Link>
                        {request.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {request.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleAcceptFriend(request._id)}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2"
                      >
                        <FiUserCheck size={16} />
                        <span>Принять</span>
                      </button>
                      <button
                        onClick={() => handleDeclineFriend(request._id)}
                        className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'online' && (
          <div className="space-y-4">
            {onlineFriends.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiUsers size={32} className="text-gray-400" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Никто не онлайн
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Ваши друзья сейчас не в сети
                </p>
              </div>
            ) : (
              onlineFriends.map((friend) => (
                <div key={friend._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.username}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white text-lg font-bold">
                              {friend.username.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/profile/${friend.username}`}
                            className="font-semibold text-gray-900 dark:text-white hover:underline"
                          >
                            {friend.username}
                          </Link>
                          {friend.isDeveloper && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              <FiLock className="mr-1" size={10} />
                              Developer
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                          Онлайн
                        </p>
                        {friend.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {friend.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/chat/${friend.username}`}
                        className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors flex items-center space-x-2"
                      >
                        <FiLock size={16} />
                        <span>E2E Чат</span>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Friends;
