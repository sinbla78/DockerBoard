import { useState, useEffect } from "react";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  useMutation,
  gql,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

// 타입 정의
interface User {
  id: string;
  email: string;
  username: string;
  isVerified: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorUsername: string;
  createdAt: string;
}

// Apollo Client 설정 함수
const createApolloClient = (token?: string) => {
  const httpLink = createHttpLink({
    uri: "/api/graphql",
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : "",
      },
    };
  });

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: "all",
      },
      query: {
        errorPolicy: "all",
      },
    },
  });
};

// 초기 클라이언트 생성
let client = createApolloClient();

// 로고 컴포넌트
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

// GraphQL 쿼리 및 뮤테이션
const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      username
      isVerified
    }
  }
`;

const GET_POSTS = gql`
  query GetPosts {
    posts {
      id
      title
      content
      authorId
      authorUsername
      createdAt
    }
  }
`;

const REGISTER = gql`
  mutation Register($email: String!, $username: String!, $password: String!) {
    register(email: $email, username: $username, password: $password) {
      success
      message
      emailSent
    }
  }
`;

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        id
        email
        username
        isVerified
      }
    }
  }
`;

const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!) {
    createPost(title: $title, content: $content) {
      id
      title
      content
      authorId
      authorUsername
      createdAt
    }
  }
`;

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id)
  }
`;

const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

// 메인 앱 컴포넌트
function BoardApp() {
  // 상태 관리
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [showAuthForm, setShowAuthForm] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showPostForm, setShowPostForm] = useState<boolean>(false);
  const [apolloClient, setApolloClient] = useState(() => createApolloClient());

  // 폼 상태
  const [authForm, setAuthForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  const [postForm, setPostForm] = useState({
    title: "",
    content: "",
  });

  // GraphQL 훅
  const { data: userData, refetch: refetchUser } = useQuery(GET_ME, {
    skip: !accessToken,
    client: apolloClient,
  });

  const {
    data: postsData,
    loading: postsLoading,
    refetch: refetchPosts,
  } = useQuery(GET_POSTS, {
    client: apolloClient,
  });

  const [register, { loading: registerLoading }] = useMutation(REGISTER, {
    client: apolloClient,
  });
  const [login, { loading: loginLoading }] = useMutation(LOGIN, {
    client: apolloClient,
  });
  const [createPostMutation, { loading: createPostLoading }] = useMutation(
    CREATE_POST,
    { client: apolloClient }
  );
  const [deletePostMutation] = useMutation(DELETE_POST, {
    client: apolloClient,
  });
  const [logoutMutation] = useMutation(LOGOUT, { client: apolloClient });

  // 로컬 스토리지에서 토큰 복원
  useEffect(() => {
    const savedToken = localStorage.getItem("accessToken");
    const savedUser = localStorage.getItem("user");

    if (savedToken && savedUser) {
      setAccessToken(savedToken);
      setUser(JSON.parse(savedUser));

      // Apollo Client 업데이트 (토큰 포함)
      setApolloClient(createApolloClient(savedToken));
    }
  }, []);

  // 토큰 변경시 Apollo Client 업데이트
  useEffect(() => {
    if (accessToken) {
      setApolloClient(createApolloClient(accessToken));
    } else {
      setApolloClient(createApolloClient());
    }
  }, [accessToken]);

  // 사용자 데이터 업데이트
  useEffect(() => {
    if (userData?.me) {
      setUser(userData.me);
      localStorage.setItem("user", JSON.stringify(userData.me));
    }
  }, [userData]);

  // 회원가입 처리
  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const { data } = await register({
        variables: {
          email: authForm.email,
          username: authForm.username,
          password: authForm.password,
        },
      });

      if (data.register.success) {
        alert(data.register.message);
        setAuthForm({ email: "", username: "", password: "" });
        setShowAuthForm(false);
        setAuthMode("login");
      } else {
        alert(data.register.message);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "회원가입에 실패했습니다.";
      alert(errorMessage);
    }
  };

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const { data } = await login({
        variables: {
          email: authForm.email,
          password: authForm.password,
        },
      });

      const {
        accessToken: newAccessToken,
        refreshToken,
        user: newUser,
      } = data.login;

      // 상태 업데이트
      setAccessToken(newAccessToken);
      setUser(newUser);

      // 로컬 스토리지 저장
      localStorage.setItem("accessToken", newAccessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(newUser));

      // 폼 초기화
      setAuthForm({ email: "", username: "", password: "" });
      setShowAuthForm(false);

      // 사용자 정보 다시 가져오기
      setTimeout(() => {
        refetchUser();
      }, 100);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "로그인에 실패했습니다.";
      alert(errorMessage);
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      await logoutMutation();
    } catch (error) {
      console.error("로그아웃 API 호출 실패:", error);
    } finally {
      // 로컬 상태 초기화
      setUser(null);
      setAccessToken("");

      // 로컬 스토리지 정리
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
  };

  // 게시글 작성
  const handleCreatePost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!postForm.title.trim() || !postForm.content.trim()) {
      alert("제목과 내용을 모두 입력해주세요.");
      return;
    }

    if (!accessToken) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      await createPostMutation({
        variables: {
          title: postForm.title.trim(),
          content: postForm.content.trim(),
        },
      });

      // 성공 시 폼 초기화 및 게시글 목록 새로고침
      setPostForm({ title: "", content: "" });
      setShowPostForm(false);
      refetchPosts();
    } catch (error) {
      console.error("게시글 작성 오류:", error);
      const errorMessage =
        error instanceof Error ? error.message : "게시글 작성에 실패했습니다.";
      alert(errorMessage);
    }
  };

  // 게시글 삭제
  const handleDeletePost = async (postId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      await deletePostMutation({
        variables: { id: postId },
      });

      refetchPosts();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "게시글 삭제에 실패했습니다.";
      alert(errorMessage);
    }
  };

  return (
    <>
      <div className="app">
        {/* 헤더 */}
        <header className="header">
          <div className="container">
            <Logo />

            <div className="header-actions">
              {user ? (
                <>
                  <span className="user-info">
                    안녕하세요, <strong>{user.username}</strong>님!
                    {!user.isVerified && (
                      <span className="unverified">⚠️ 미인증</span>
                    )}
                  </span>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowPostForm(!showPostForm)}
                  >
                    {showPostForm ? "✕ 취소" : "✏️ 글쓰기"}
                  </button>
                  <button className="btn btn-secondary" onClick={handleLogout}>
                    🚪 로그아웃
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAuthForm(!showAuthForm)}
                >
                  {showAuthForm ? "✕ 닫기" : "🔐 로그인"}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="main">
          {/* 인증 폼 */}
          {showAuthForm && !user && (
            <div className="auth-section">
              <div className="auth-tabs">
                <button
                  className={`tab ${authMode === "login" ? "active" : ""}`}
                  onClick={() => setAuthMode("login")}
                >
                  로그인
                </button>
                <button
                  className={`tab ${authMode === "register" ? "active" : ""}`}
                  onClick={() => setAuthMode("register")}
                >
                  회원가입
                </button>
              </div>

              <form
                onSubmit={authMode === "login" ? handleLogin : handleRegister}
                className="auth-form"
              >
                <h3>{authMode === "login" ? "🔐 로그인" : "🎉 회원가입"}</h3>

                <div className="form-group">
                  <input
                    type="email"
                    placeholder="📧 이메일"
                    value={authForm.email}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, email: e.target.value })
                    }
                    required
                  />
                </div>

                {authMode === "register" && (
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="👤 사용자명"
                      value={authForm.username}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, username: e.target.value })
                      }
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <input
                    type="password"
                    placeholder="🔒 비밀번호"
                    value={authForm.password}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, password: e.target.value })
                    }
                    required
                  />
                </div>

                {authMode === "register" && (
                  <div className="form-help">
                    <small>
                      • 비밀번호는 8자 이상, 대소문자와 숫자 포함
                      <br />• 회원가입 후 이메일 인증이 필요합니다
                    </small>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-submit"
                  disabled={
                    authMode === "login" ? loginLoading : registerLoading
                  }
                >
                  {authMode === "login"
                    ? loginLoading
                      ? "로그인 중..."
                      : "🚀 로그인"
                    : registerLoading
                    ? "가입 중..."
                    : "✨ 회원가입"}
                </button>
              </form>
            </div>
          )}

          {/* 게시글 작성 폼 */}
          {showPostForm && user && user.isVerified && (
            <div className="post-form-section">
              <form onSubmit={handleCreatePost} className="post-form">
                <h3>✍️ 새 글 작성</h3>

                <div className="form-group">
                  <input
                    type="text"
                    placeholder="📝 제목을 입력하세요"
                    value={postForm.title}
                    onChange={(e) =>
                      setPostForm({ ...postForm, title: e.target.value })
                    }
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-group">
                  <textarea
                    placeholder="💭 내용을 입력하세요"
                    value={postForm.content}
                    onChange={(e) =>
                      setPostForm({ ...postForm, content: e.target.value })
                    }
                    maxLength={10000}
                    rows={5}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-submit"
                  disabled={createPostLoading}
                >
                  {createPostLoading ? "작성 중..." : "🚀 게시글 작성"}
                </button>
              </form>
            </div>
          )}

          {/* 미인증 사용자 안내 */}
          {user && !user.isVerified && (
            <div className="unverified-notice">
              <h3>⚠️ 이메일 인증이 필요합니다</h3>
              <p>게시글을 작성하려면 먼저 이메일 인증을 완료해주세요.</p>
              <p>인증 이메일을 확인하거나, 스팸 폴더를 확인해보세요.</p>
            </div>
          )}

          {/* 게시글 목록 */}
          <div className="posts-section">
            <div className="posts-header">
              <h2>📋 게시글 목록</h2>
              <span className="posts-count">
                {postsData?.posts?.length || 0}개의 게시글
              </span>
            </div>

            {postsLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>게시글을 불러오는 중...</p>
              </div>
            ) : (
              <div className="posts">
                {postsData?.posts?.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <h3>아직 게시글이 없습니다</h3>
                    <p>첫 번째 게시글을 작성해보세요!</p>
                  </div>
                ) : (
                  postsData?.posts?.map((post: Post) => (
                    <div key={post.id} className="post">
                      <div className="post-header">
                        <h3 className="post-title">{post.title}</h3>
                        {user && user.id === post.authorId && (
                          <button
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeletePost(post.id)}
                            title="삭제"
                          >
                            🗑️
                          </button>
                        )}
                      </div>

                      <div className="post-meta">
                        <span className="author">👤 {post.authorUsername}</span>
                        <span className="date">
                          🕐 {new Date(post.createdAt).toLocaleString("ko-KR")}
                        </span>
                      </div>

                      <p className="post-content">{post.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
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

        /* 헤더 스타일 */
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

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .user-info {
          color: #333;
          font-size: 0.9rem;
        }

        .unverified {
          color: #f39c12;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        }

        /* 메인 콘텐츠 */
        .main {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }

        /* 버튼 스타일 */
        .btn {
          border: none;
          padding: 10px 20px;
          border-radius: 20px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }

        .btn-secondary {
          background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
        }

        .btn-danger {
          background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
          color: white;
          box-shadow: 0 2px 10px rgba(255, 107, 107, 0.3);
        }

        .btn-submit {
          background: linear-gradient(135deg, #51cf66 0%, #40c057 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(81, 207, 102, 0.3);
          width: 100%;
          padding: 12px 24px;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        /* 인증 폼 스타일 */
        .auth-section {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .auth-tabs {
          display: flex;
          margin-bottom: 1.5rem;
          background: #f8f9fa;
          border-radius: 10px;
          padding: 4px;
        }

        .tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 500;
        }

        .tab.active {
          background: white;
          color: #667eea;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .auth-form h3 {
          margin-bottom: 1.5rem;
          color: #333;
          text-align: center;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .auth-form input,
        .post-form input,
        .post-form textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid rgba(102, 126, 234, 0.1);
          border-radius: 10px;
          font-size: 16px;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.8);
        }

        .auth-form input:focus,
        .post-form input:focus,
        .post-form textarea:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          background: white;
        }

        .form-help {
          margin-bottom: 1rem;
          padding: 10px;
          background: #e3f2fd;
          border-radius: 6px;
          border-left: 4px solid #2196f3;
        }

        .form-help small {
          color: #1976d2;
          line-height: 1.4;
        }

        /* 게시글 폼 스타일 */
        .post-form-section {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 2rem;
          margin-bottom: 2rem;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .post-form h3 {
          margin-bottom: 1.5rem;
          color: #333;
          text-align: center;
        }

        .post-form textarea {
          resize: vertical;
          min-height: 120px;
          font-family: inherit;
        }

        /* 미인증 안내 */
        .unverified-notice {
          background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
          border: 1px solid #ffc107;
          border-radius: 15px;
          padding: 2rem;
          text-align: center;
          margin-bottom: 2rem;
        }

        .unverified-notice h3 {
          color: #856404;
          margin-bottom: 1rem;
        }

        .unverified-notice p {
          color: #856404;
          margin: 0.5rem 0;
        }

        /* 게시글 목록 스타일 */
        .posts-section {
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
          white-space: pre-wrap;
        }

        /* 빈 상태 및 로딩 */
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

        .loading {
          text-align: center;
          padding: 2rem;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(102, 126, 234, 0.1);
          border-left: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* 반응형 디자인 */
        @media (max-width: 768px) {
          .header .container {
            padding: 1rem;
            flex-direction: column;
            gap: 1rem;
          }

          .main {
            padding: 1rem;
          }

          .header-actions {
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
          }

          .user-info {
            text-align: center;
          }

          .auth-tabs {
            flex-direction: column;
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

          .post-header {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </>
  );
}

// 최상위 앱 컴포넌트
export default function Home() {
  return <BoardApp />;
}
