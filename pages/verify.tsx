import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { ApolloClient, InMemoryCache, gql, useMutation } from "@apollo/client";

// Apollo Client 설정
const client = new ApolloClient({
  uri: "/api/graphql",
  cache: new InMemoryCache(),
});

const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token)
  }
`;

export default function VerifyEmailPage() {
  const router = useRouter();
  const { token } = router.query;
  const [verifyEmail] = useMutation(VERIFY_EMAIL, { client });

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // 라우터가 준비되고 토큰이 있을 때만 실행
    if (router.isReady) {
      if (token && typeof token === "string") {
        console.log("🔍 인증 토큰:", token);
        handleEmailVerification(token);
      } else {
        setStatus("error");
        setMessage("인증 토큰이 없거나 유효하지 않습니다. URL을 확인해주세요.");
      }
    }
  }, [router.isReady, token]);

  const handleEmailVerification = async (verificationToken: string) => {
    try {
      console.log("🚀 이메일 인증 시작...");

      const { data } = await verifyEmail({
        variables: { token: verificationToken },
        errorPolicy: "all",
      });

      console.log("✅ 인증 성공:", data);

      setStatus("success");
      setMessage("🎉 이메일 인증이 완료되었습니다! 이제 로그인할 수 있습니다.");

      // 3초 후 메인페이지로 리다이렉트
      setIsRedirecting(true);
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (error: any) {
      console.error("❌ 인증 실패:", error);

      setStatus("error");

      let errorMessage = "이메일 인증에 실패했습니다.";

      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        errorMessage = error.graphQLErrors[0].message;
      } else if (error.networkError) {
        errorMessage = "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
      }

      setMessage(errorMessage);
    }
  };

  const handleRetry = () => {
    if (token && typeof token === "string") {
      setStatus("loading");
      setMessage("");
      handleEmailVerification(token);
    }
  };

  const goToHome = () => {
    router.push("/");
  };

  return (
    <>
      <div className="verify-container">
        <div className="verify-card">
          {/* 로딩 상태 */}
          {status === "loading" && (
            <div className="status-content">
              <div className="loading-spinner">
                <div className="spinner"></div>
              </div>
              <h2>이메일 인증 중...</h2>
              <p>잠시만 기다려주세요.</p>
            </div>
          )}

          {/* 성공 상태 */}
          {status === "success" && (
            <div className="status-content success">
              <div className="success-icon">✅</div>
              <h2>인증 완료!</h2>
              <p>{message}</p>
              {isRedirecting && (
                <p className="redirect-notice">
                  3초 후 자동으로 메인페이지로 이동합니다...
                </p>
              )}
              <div className="button-group">
                <button onClick={goToHome} className="btn btn-primary">
                  지금 이동하기
                </button>
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {status === "error" && (
            <div className="status-content error">
              <div className="error-icon">❌</div>
              <h2>인증 실패</h2>
              <p>{message}</p>

              <div className="error-help">
                <h4>문제 해결 방법:</h4>
                <ul>
                  <li>인증 링크가 1시간 내에 사용되었는지 확인하세요</li>
                  <li>이메일의 링크를 완전히 복사했는지 확인하세요</li>
                  <li>만료된 경우 다시 회원가입을 진행해주세요</li>
                </ul>
              </div>

              <div className="button-group">
                {token && (
                  <button onClick={handleRetry} className="btn btn-secondary">
                    다시 시도
                  </button>
                )}
                <button onClick={goToHome} className="btn btn-primary">
                  메인페이지로 이동
                </button>
              </div>
            </div>
          )}
        </div>
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

        .verify-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .verify-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 3rem 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        .status-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .loading-spinner {
          margin-bottom: 1rem;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(102, 126, 234, 0.1);
          border-left: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .success-icon,
        .error-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        .status-content h2 {
          color: #333;
          margin: 0 0 1rem 0;
          font-size: 1.8rem;
          font-weight: 600;
        }

        .status-content p {
          color: #666;
          margin: 0 0 1rem 0;
          line-height: 1.6;
          font-size: 1rem;
        }

        .redirect-notice {
          color: #999;
          font-size: 0.9rem;
          font-style: italic;
          margin-top: 0.5rem;
        }

        .error-help {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
          text-align: left;
          border-left: 4px solid #ffc107;
        }

        .error-help h4 {
          color: #333;
          margin: 0 0 1rem 0;
          font-size: 1rem;
        }

        .error-help ul {
          margin: 0;
          padding-left: 1.5rem;
        }

        .error-help li {
          color: #666;
          margin: 0.5rem 0;
          line-height: 1.4;
        }

        .button-group {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .btn {
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          cursor: pointer;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-block;
          min-width: 140px;
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

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .btn-primary:hover {
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-secondary:hover {
          box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
        }

        @media (max-width: 768px) {
          .verify-container {
            padding: 1rem;
          }

          .verify-card {
            padding: 2rem 1.5rem;
          }

          .button-group {
            flex-direction: column;
            align-items: center;
          }

          .btn {
            width: 100%;
            max-width: 200px;
          }
        }
      `}</style>
    </>
  );
}
