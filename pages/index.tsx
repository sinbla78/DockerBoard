import { useState, useEffect } from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  useMutation,
  gql,
} from "@apollo/client";

// Apollo Client 설정
const client = new ApolloClient({
  uri: "/api/graphql",
  cache: new InMemoryCache(),
});

// 간단한 로고 SVG 컴포넌트
const Logo = () => (
  <div className="logo">
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="20"
        cy="20"
        r="18"
        fill="url(#gradient)"
        stroke="#fff"
        strokeWidth="2"
      />
      <path
        d="M12 16h16v2H12v-2zm0 4h16v2H12v-2zm0 4h12v2H12v-2z"
        fill="white"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
      </defs>
    </svg>
    <span className="logo-text">게시판</span>
  </div>
);

// GraphQL 쿼리와 뮤테이션
const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      author
      createdAt
    }
  }
`;

const ADD_POST = gql`
  mutation AddPost($title: String!, $content: String!, $author: String!) {
    addPost(title: $title, content: $content, author: $author) {
      id
      title
      content
      author
      createdAt
    }
  }
`;

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

// 게시글 컴포넌트
function PostList() {
  const { loading, error, data, refetch } = useQuery(GET_POSTS);
  const [addPost] = useMutation(ADD_POST);
  const [deletePost] = useMutation(DELETE_POST);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    author: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPost({
        variables: formData,
      });
      setFormData({ title: "", content: "", author: "" });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error("Error adding post:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      try {
        await deletePost({ variables: { id } });
        refetch();
      } catch (err) {
        console.error("Error deleting post:", err);
      }
    }
  };

  if (loading) return <div className="loading">로딩 중...</div>;
  if (error) return <div className="error">에러: {error.message}</div>;

  return (
    <>
      <div className="app">
        <header className="header">
          <div className="container">
            <Logo />
            <button
              className="btn-primary"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "✕ 취소" : "✏️ 글쓰기"}
            </button>
          </div>
        </header>

        <main className="main">
          {showForm && (
            <div className="form-container">
              <form onSubmit={handleSubmit} className="post-form">
                <h3>✍️ 새 글 작성</h3>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="📝 제목을 입력하세요"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="👤 작성자 이름"
                    value={formData.author}
                    onChange={(e) =>
                      setFormData({ ...formData, author: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <textarea
                    placeholder="💭 내용을 입력하세요"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    required
                  />
                </div>
                <button type="submit" className="btn-submit">
                  🚀 작성하기
                </button>
              </form>
            </div>
          )}

          <div className="posts-container">
            <div className="posts-header">
              <h2>📋 게시글 목록</h2>
              <span className="posts-count">
                {data?.posts?.length || 0}개의 게시글
              </span>
            </div>

            <div className="posts">
              {data?.posts?.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  <h3>아직 게시글이 없습니다</h3>
                  <p>첫 번째 게시글을 작성해보세요!</p>
                </div>
              ) : (
                data?.posts?.map((post: any) => (
                  <div key={post.id} className="post">
                    <div className="post-header">
                      <h3 className="post-title">{post.title}</h3>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(post.id)}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    <div className="post-meta">
                      <span className="author">👤 {post.author}</span>
                      <span className="date">
                        🕐 {new Date(post.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <p className="post-content">{post.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          color: #333;
        }

        .app {
          min-height: 100vh;
        }

        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
        }

        .header .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 1.5rem;
          color: #333;
        }

        .logo-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .main {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-danger {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 10px rgba(255, 107, 107, 0.3);
        }

        .btn-danger:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
        }

        .form-container {
          margin-bottom: 2rem;
        }

        .post-form {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 2rem;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .post-form h3 {
          margin-bottom: 1.5rem;
          color: #333;
          font-size: 1.3rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .post-form input,
        .post-form textarea {
          width: 100%;
          padding: 1rem;
          border: 2px solid rgba(102, 126, 234, 0.1);
          border-radius: 12px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.8);
        }

        .post-form input:focus,
        .post-form textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          background: white;
        }

        .post-form textarea {
          height: 120px;
          resize: vertical;
          font-family: inherit;
        }

        .btn-submit {
          background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 25px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(81, 207, 102, 0.3);
          width: 100%;
        }

        .btn-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(81, 207, 102, 0.4);
        }

        .posts-container {
          margin-top: 2rem;
        }

        .posts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding: 0 0.5rem;
        }

        .posts-header h2 {
          color: white;
          font-size: 1.5rem;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .posts-count {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          backdrop-filter: blur(10px);
        }

        .posts {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .post {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 1.5rem;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }

        .post:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          gap: 1rem;
        }

        .post-title {
          color: #333;
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1.4;
          flex: 1;
        }

        .post-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          color: #666;
        }

        .post-content {
          color: #555;
          line-height: 1.6;
          font-size: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .empty-state h3 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 1.3rem;
        }

        .empty-state p {
          color: #666;
        }

        .loading,
        .error {
          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 16px;
          margin: 2rem 0;
        }

        .error {
          color: #ff6b6b;
          border: 2px solid rgba(255, 107, 107, 0.2);
        }

        .loading {
          color: #667eea;
        }

        @media (max-width: 768px) {
          .header .container {
            padding: 1rem;
          }

          .main {
            padding: 1rem;
          }

          .logo {
            font-size: 1.2rem;
          }

          .post-form {
            padding: 1.5rem;
          }

          .posts-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .post-meta {
            flex-direction: column;
            gap: 0.5rem;
          }
        }
      `}</style>
    </>
  );
}

export default function Home() {
  return (
    <ApolloProvider client={client}>
      <PostList />
    </ApolloProvider>
  );
}
