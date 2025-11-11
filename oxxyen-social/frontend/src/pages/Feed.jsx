import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiHeart, FiMessageCircle, FiShare, FiArrowLeft } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPosts();
  }, [page]);

  const fetchPosts = async () => {
    try {
      const response = await fetch(`/api/v1/posts/feed?page=${page}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const postsData = await response.json();
        if (page === 1) {
          setPosts(postsData);
        } else {
          setPosts(prev => [...prev, ...postsData]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      toast.error('Ошибка загрузки ленты');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`/api/v1/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // Update local state
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {
                  ...post,
                  isLikedBy: !post.isLikedBy,
                  likeCount: post.isLikedBy ? post.likeCount - 1 : post.likeCount + 1
                }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Like error:', error);
      toast.error('Ошибка лайка');
    }
  };

  const handleRepost = async (postId) => {
    try {
      const response = await fetch(`/api/v1/posts/${postId}/repost`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Репост добавлен');
        fetchPosts(); // Refresh feed
      }
    } catch (error) {
      console.error('Repost error:', error);
      toast.error('Ошибка репоста');
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
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

  if (loading && posts.length === 0) {
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                to="/dashboard"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiArrowLeft size={20} />
              </Link>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Лента
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Лента пуста
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Подпишитесь на пользователей, чтобы видеть их посты
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div key={post._id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-start space-x-3">
                  <Link to={`/profile/${post.author.username}`}>
                    <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                      {post.author.avatar ? (
                        <img
                          src={post.author.avatar}
                          alt={post.author.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {post.author.username.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <Link
                        to={`/profile/${post.author.username}`}
                        className="font-semibold text-gray-900 dark:text-white hover:underline"
                      >
                        {post.author.username}
                      </Link>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(post.createdAt)}
                      </span>
                    </div>

                    <p className="text-gray-900 dark:text-white mb-3 whitespace-pre-wrap">
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

                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-6">
                        <button
                          onClick={() => handleLike(post._id)}
                          className={`flex items-center space-x-1 text-sm ${
                            post.isLikedBy ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                          }`}
                        >
                          <FiHeart size={16} className={post.isLikedBy ? 'fill-current' : ''} />
                          <span>{post.likeCount}</span>
                        </button>

                        <button className="flex items-center space-x-1 text-sm text-gray-500 hover:text-blue-500">
                          <FiMessageCircle size={16} />
                          <span>{post.commentCount}</span>
                        </button>

                        <button
                          onClick={() => handleRepost(post._id)}
                          className="flex items-center space-x-1 text-sm text-gray-500 hover:text-green-500"
                        >
                          <FiShare size={16} />
                          <span>{post.repostCount}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {posts.length >= 20 && (
              <div className="text-center">
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  className="bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Загрузить ещё
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
