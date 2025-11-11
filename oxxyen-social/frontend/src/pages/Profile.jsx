import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiEdit, FiUserPlus, FiUserCheck, FiCamera, FiSettings, FiMessageCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Profile = () => {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    description: '',
    isPrivate: false,
    isDeveloper: false,
    developerSignature: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchPosts();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/v1/users/${username}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setProfileUser(userData);
        setIsOwnProfile(userData._id === currentUser._id);

        // Check if current user is following this user
        setIsFollowing(currentUser.following?.includes(userData._id));

        // Initialize edit form
        setEditForm({
          description: userData.description || '',
          isPrivate: userData.isPrivate || false,
          isDeveloper: userData.isDeveloper || false,
          developerSignature: userData.developerSignature || ''
        });
      } else {
        toast.error('Пользователь не найден');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast.error('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await fetch(`/api/v1/posts/user/${username}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const postsData = await response.json();
        setPosts(postsData);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  };

  const handleFollow = async () => {
    try {
      const response = await fetch(`/api/v1/users/${username}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        toast.success(isFollowing ? 'Подписка отменена' : 'Подписка оформлена');
        fetchProfile(); // Refresh profile data
      } else {
        const data = await response.json();
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Follow error:', error);
      toast.error('Ошибка подписки');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/v1/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        toast.success('Профиль обновлён');
        setIsEditing(false);
        fetchProfile();
      } else {
        const data = await response.json();
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Edit profile error:', error);
      toast.error('Ошибка обновления профиля');
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('banner', file);

    try {
      const response = await fetch('/api/v1/users/me/banner', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('Баннер загружен');
        fetchProfile();
      } else {
        toast.error('Ошибка загрузки баннера');
      }
    } catch (error) {
      console.error('Banner upload error:', error);
      toast.error('Ошибка загрузки баннера');
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/v1/users/me/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        toast.success('Аватар загружен');
        fetchProfile();
      } else {
        toast.error('Ошибка загрузки аватара');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Ошибка загрузки аватара');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Пользователь не найден
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Возможно, профиль приватный или не существует
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Profile Banner */}
      <div className="relative h-64 bg-gradient-to-r from-purple-500 to-blue-600">
        {profileUser.banner && (
          <img
            src={profileUser.banner}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        )}
        {isOwnProfile && (
          <div className="absolute top-4 right-4">
            <label className="flex items-center space-x-2 bg-black/50 text-white px-3 py-2 rounded-lg cursor-pointer hover:bg-black/70 transition-colors">
              <FiCamera size={16} />
              <span>Изменить баннер</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-8 -mt-16 relative z-10">
          <div className="flex items-start space-x-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800">
                {profileUser.avatar ? (
                  <img
                    src={profileUser.avatar}
                    alt={profileUser.username}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-3xl font-bold">
                    {profileUser.username.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {isOwnProfile && (
                <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full cursor-pointer hover:bg-primary-600 transition-colors">
                  <FiCamera size={14} />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profileUser.username}
                  </h1>
                  {profileUser.isDeveloper && (
                    <span className="developer-badge">
                      <span>Разработчик</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {!isOwnProfile && (
                    <Link
                      to={`/chat/${profileUser.username}`}
                      className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      <FiMessageCircle size={16} />
                      <span>Написать</span>
                    </Link>
                  )}

                  {isOwnProfile ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="flex items-center space-x-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        <FiEdit size={16} />
                        <span>Редактировать</span>
                      </button>
                      <Link
                        to="/settings"
                        className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        <FiSettings size={16} />
                        <span>Настройки</span>
                      </Link>
                    </div>
                  ) : (
                    <button
                      onClick={handleFollow}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isFollowing
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                          : 'bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700'
                      }`}
                    >
                      {isFollowing ? <FiUserCheck size={16} /> : <FiUserPlus size={16} />}
                      <span>{isFollowing ? 'Отписаться' : 'Подписаться'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Developer Signature */}
              {profileUser.isDeveloper && profileUser.developerSignature && (
                <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mt-2">
                  {profileUser.developerSignature}
                </p>
              )}

              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {profileUser.description || 'Нет описания'}
              </p>

              <div className="mt-4 flex space-x-6 text-sm text-gray-600 dark:text-gray-400">
                <span>
                  <strong className="text-gray-900 dark:text-white">{profileUser.followers?.length || 0}</strong> подписчиков
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-white">{profileUser.following?.length || 0}</strong> подписок
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-white">{profileUser.friends?.length || 0}</strong> друзей
                </span>
                <span>
                  <strong className="text-gray-900 dark:text-white">{posts.length}</strong> постов
                </span>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          {isEditing && isOwnProfile && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Описание
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="input-field resize-none"
                    rows={3}
                    placeholder="Расскажите о себе..."
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editForm.isPrivate}
                      onChange={(e) => setEditForm({...editForm, isPrivate: e.target.checked})}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Приватный профиль</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editForm.isDeveloper}
                      onChange={(e) => setEditForm({...editForm, isDeveloper: e.target.checked})}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Аккаунт разработчика</span>
                  </label>
                </div>

                {editForm.isDeveloper && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Подпись разработчика
                    </label>
                    <input
                      type="text"
                      value={editForm.developerSignature}
                      onChange={(e) => setEditForm({...editForm, developerSignature: e.target.value})}
                      className="input-field"
                      placeholder="Ваша подпись как разработчика..."
                      maxLength={100}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-4">
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Сохранить изменения
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="btn-secondary"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Posts */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Посты
          </h2>

          {posts.length === 0 ? (
            <div className="card text-center">
              <p className="text-gray-600 dark:text-gray-400">
                {isOwnProfile ? 'У вас пока нет постов' : 'У пользователя нет постов'}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post._id} className="card animate-fade-in">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {profileUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {profileUser.username}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <p className="text-gray-900 dark:text-white mb-3">
                      {post.content}
                    </p>
                    {post.media && post.media.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 mb-3">
                        {post.media.map((media, index) => (
                          <div key={index}>
                            {media.type === 'image' ? (
                              <img
                                src={media.url}
                                alt="Post media"
                                className="rounded-lg max-w-full h-auto"
                              />
                            ) : (
                              <video
                                src={media.url}
                                controls
                                className="rounded-lg max-w-full h-auto"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{post.likeCount} лайков</span>
                      <span>{post.commentCount} комментариев</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
