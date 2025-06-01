import { ApolloServer } from "apollo-server-micro";
import { gql } from "apollo-server-micro";
import { NextApiRequest, NextApiResponse } from "next";

// 데이터베이스 함수들
import {
  initializeDatabase,
  createUser,
  findUserByEmailForAuth,
  findUserById,
  verifyUserEmail,
  saveRefreshToken,
  findUserByRefreshToken,
  removeRefreshToken,
  getAllPosts,
  createPost,
  deletePost,
  cleanupExpiredTokens,
} from "../../lib/database";

// 인증 유틸리티
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getUserIdFromAuthHeader,
  generateVerificationToken,
  sendVerificationEmail,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../../lib/auth";

// GraphQL 스키마 정의
const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    username: String!
    isVerified: Boolean!
    createdAt: String!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    authorId: ID!
    authorUsername: String!
    createdAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type RegisterResponse {
    success: Boolean!
    message: String!
    emailSent: Boolean!
  }

  type Query {
    # 사용자 정보
    me: User

    # 게시글
    posts: [Post!]!

    # 시스템 상태
    health: String!
  }

  type Mutation {
    # 인증 관련
    register(
      email: String!
      username: String!
      password: String!
    ): RegisterResponse!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    logout: Boolean!
    verifyEmail(token: String!): Boolean!

    # 게시글 관련
    createPost(title: String!, content: String!): Post!
    deletePost(id: ID!): Boolean!

    # 시스템 관리
    cleanupTokens: Int!
  }
`;

// GraphQL 리졸버
const resolvers = {
  Query: {
    // 현재 로그인한 사용자 정보
    me: async (_: any, __: any, context: any) => {
      try {
        const userId = getUserIdFromAuthHeader(
          context.req.headers.authorization
        );
        if (!userId) return null;

        return await findUserById(userId);
      } catch (error) {
        console.error("me 쿼리 오류:", error);
        return null;
      }
    },

    // 모든 게시글 조회
    posts: async () => {
      try {
        return await getAllPosts();
      } catch (error) {
        console.error("게시글 조회 오류:", error);
        return [];
      }
    },

    // 시스템 상태 확인
    health: async () => {
      try {
        await initializeDatabase();
        return "OK";
      } catch (error) {
        return "ERROR";
      }
    },
  },

  Mutation: {
    // 회원가입
    register: async (
      _: any,
      {
        email,
        username,
        password,
      }: {
        email: string;
        username: string;
        password: string;
      }
    ) => {
      try {
        // 입력 검증
        if (!validateEmail(email)) {
          throw new Error("올바른 이메일 주소를 입력해주세요.");
        }

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
          throw new Error(usernameValidation.message);
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          throw new Error(passwordValidation.message);
        }

        // 비밀번호 해싱 및 토큰 생성
        const passwordHash = await hashPassword(password);
        const verificationToken = generateVerificationToken();

        // 사용자 생성
        const user = await createUser({
          email,
          username,
          passwordHash,
          verificationToken,
        });

        // 이메일 발송
        const emailResult = await sendVerificationEmail(
          email,
          username,
          verificationToken
        );

        return {
          success: true,
          message: emailResult.success
            ? "회원가입이 완료되었습니다! 이메일을 확인하여 계정을 인증해주세요. (1시간 내)"
            : "회원가입은 완료되었지만 이메일 발송에 실패했습니다. 관리자에게 문의해주세요.",
          emailSent: emailResult.success,
        };
      } catch (error: any) {
        console.error("회원가입 오류:", error);
        return {
          success: false,
          message: error.message || "회원가입에 실패했습니다.",
          emailSent: false,
        };
      }
    },

    // 로그인
    login: async (
      _: any,
      {
        email,
        password,
      }: {
        email: string;
        password: string;
      }
    ) => {
      try {
        // 사용자 찾기
        const user = await findUserByEmailForAuth(email);
        if (!user) {
          throw new Error("존재하지 않는 이메일입니다.");
        }

        // 비밀번호 확인
        const isValidPassword = await verifyPassword(
          password,
          user.passwordHash
        );
        if (!isValidPassword) {
          throw new Error("비밀번호가 올바르지 않습니다.");
        }

        // 이메일 인증 확인
        if (!user.isVerified) {
          throw new Error(
            "이메일 인증을 완료해주세요. 인증 이메일을 확인하세요."
          );
        }

        // 토큰 생성
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        // Refresh Token 저장
        await saveRefreshToken(user.id, refreshToken);

        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            isVerified: user.isVerified,
            createdAt: user.createdAt,
          },
        };
      } catch (error: any) {
        console.error("로그인 오류:", error);
        throw new Error(error.message || "로그인에 실패했습니다.");
      }
    },

    // 토큰 갱신
    refreshToken: async (
      _: any,
      { refreshToken }: { refreshToken: string }
    ) => {
      try {
        // Refresh Token 검증
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
          throw new Error("유효하지 않은 Refresh Token입니다.");
        }

        // 데이터베이스에서 사용자 확인
        const user = await findUserByRefreshToken(refreshToken);
        if (!user) {
          throw new Error("Refresh Token이 만료되었거나 유효하지 않습니다.");
        }

        // 새 토큰 생성
        const newAccessToken = generateAccessToken(user.id);
        const newRefreshToken = generateRefreshToken(user.id);

        // 새 Refresh Token 저장
        await saveRefreshToken(user.id, newRefreshToken);

        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user,
        };
      } catch (error: any) {
        console.error("토큰 갱신 오류:", error);
        throw new Error(error.message || "토큰 갱신에 실패했습니다.");
      }
    },

    // 로그아웃
    logout: async (_: any, __: any, context: any) => {
      try {
        const userId = getUserIdFromAuthHeader(
          context.req.headers.authorization
        );
        if (!userId) {
          return false;
        }

        await removeRefreshToken(userId);
        return true;
      } catch (error: any) {
        console.error("로그아웃 오류:", error);
        return false;
      }
    },

    // 이메일 인증
    verifyEmail: async (_: any, { token }: { token: string }) => {
      try {
        if (!token) {
          throw new Error("인증 토큰이 필요합니다.");
        }

        const success = await verifyUserEmail(token);
        if (!success) {
          throw new Error(
            "유효하지 않거나 만료된 인증 토큰입니다. 다시 회원가입을 진행해주세요."
          );
        }

        return true;
      } catch (error: any) {
        console.error("이메일 인증 오류:", error);
        throw new Error(error.message || "이메일 인증에 실패했습니다.");
      }
    },

    // 게시글 작성
    createPost: async (
      _: any,
      {
        title,
        content,
      }: {
        title: string;
        content: string;
      },
      context: any
    ) => {
      try {
        const userId = getUserIdFromAuthHeader(
          context.req.headers.authorization
        );
        if (!userId) {
          throw new Error("로그인이 필요합니다.");
        }

        // 사용자 확인
        const user = await findUserById(userId);
        if (!user) {
          throw new Error("유효하지 않은 사용자입니다.");
        }

        if (!user.isVerified) {
          throw new Error("이메일 인증을 완료해주세요.");
        }

        // 입력 검증
        if (!title || title.trim().length === 0) {
          throw new Error("제목을 입력해주세요.");
        }

        if (!content || content.trim().length === 0) {
          throw new Error("내용을 입력해주세요.");
        }

        if (title.length > 200) {
          throw new Error("제목은 200자 이하로 입력해주세요.");
        }

        if (content.length > 10000) {
          throw new Error("내용은 10,000자 이하로 입력해주세요.");
        }

        return await createPost(title.trim(), content.trim(), userId);
      } catch (error: any) {
        console.error("게시글 작성 오류:", error);
        throw new Error(error.message || "게시글 작성에 실패했습니다.");
      }
    },

    // 게시글 삭제
    deletePost: async (_: any, { id }: { id: string }, context: any) => {
      try {
        const userId = getUserIdFromAuthHeader(
          context.req.headers.authorization
        );
        if (!userId) {
          throw new Error("로그인이 필요합니다.");
        }

        const postId = parseInt(id);
        if (isNaN(postId)) {
          throw new Error("유효하지 않은 게시글 ID입니다.");
        }

        const success = await deletePost(postId, userId);
        if (!success) {
          throw new Error("게시글을 찾을 수 없거나 삭제 권한이 없습니다.");
        }

        return true;
      } catch (error: any) {
        console.error("게시글 삭제 오류:", error);
        throw new Error(error.message || "게시글 삭제에 실패했습니다.");
      }
    },

    // 만료된 토큰 정리 (관리자용)
    cleanupTokens: async () => {
      try {
        const cleanedCount = await cleanupExpiredTokens();
        console.log(`✅ 만료된 토큰 ${cleanedCount}개 정리 완료`);
        return cleanedCount;
      } catch (error: any) {
        console.error("토큰 정리 오류:", error);
        return 0;
      }
    },
  },
};

// Apollo Server 설정
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  debug: false, // 프로덕션에서 디버그 정보 숨기기
  logger: {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
  },
  context: ({ req, res }) => ({
    req,
    res,
  }),
  formatError: (error) => {
    console.error("GraphQL 오류:", error.message);
    return {
      message: error.message,
      code: error.extensions?.code,
      path: error.path,
    };
  },
  // 민감한 정보 로깅 방지
  formatResponse: (response, { request }) => {
    // 비밀번호가 포함된 요청의 변수를 마스킹
    if (request.query && request.variables) {
      const sensitiveFields = [
        "password",
        "newPassword",
        "oldPassword",
        "confirmPassword",
      ];

      for (const field of sensitiveFields) {
        if (request.variables[field]) {
          request.variables[field] = "***HIDDEN***";
        }
      }
    }
    return response;
  },
  // 플러그인으로 요청 로깅 제어
  plugins: [
    {
      async requestDidStart() {
        return {
          async didReceiveRequest(requestContext) {
            // 요청을 받자마자 민감한 정보 마스킹
            if (requestContext.request.variables) {
              const sensitiveFields = [
                "password",
                "newPassword",
                "oldPassword",
                "confirmPassword",
              ];

              for (const field of sensitiveFields) {
                if (requestContext.request.variables[field]) {
                  requestContext.request.variables[field] = "***MASKED***";
                }
              }
            }
          },
          async willSendResponse(requestContext) {
            // 응답 전에 민감한 정보 마스킹
            if (requestContext.request.variables) {
              const sensitiveFields = [
                "password",
                "newPassword",
                "oldPassword",
                "confirmPassword",
              ];

              for (const field of sensitiveFields) {
                if (requestContext.request.variables[field]) {
                  requestContext.request.variables[field] = "***MASKED***";
                }
              }
            }
          },
          async didResolveOperation(requestContext) {
            // 로그에서 민감한 정보 필터링 - 완전히 비활성화
            // console.log는 제거하여 로깅 자체를 막음
          },
        };
      },
    },
  ],
});

const startServer = apolloServer.start();

// API 핸들러
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS 설정
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.end();
    return;
  }

  // 데이터베이스 초기화
  try {
    await initializeDatabase();
  } catch (error) {
    console.error("데이터베이스 초기화 실패:", error);
    res.status(500).json({ error: "서버 초기화에 실패했습니다." });
    return;
  }

  await startServer;
  await apolloServer.createHandler({
    path: "/api/graphql",
  })(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};