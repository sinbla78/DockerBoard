import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import * as nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

// 환경 변수 및 설정
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "your-super-secret-jwt-key-please-change-in-production";
const ACCESS_TOKEN_EXPIRES = "15m"; // 15분
const REFRESH_TOKEN_EXPIRES = "7d"; // 7일

// SMTP 설정
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// =================== 비밀번호 관련 ===================

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// =================== JWT 토큰 관련 ===================

export function generateAccessToken(userId: number): string {
  return jwt.sign({ userId, type: "access" }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function generateRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });
}

export function verifyAccessToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== "access") {
      return null;
    }
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== "refresh") {
      return null;
    }
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}

// Authorization 헤더에서 사용자 ID 추출
export function getUserIdFromAuthHeader(authHeader?: string): number | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = verifyAccessToken(token);
  return decoded?.userId || null;
}

// =================== 이메일 인증 토큰 ===================

export function generateVerificationToken(): string {
  return uuidv4().replace(/-/g, ""); // UUID에서 하이픈 제거
}

// =================== 입력 검증 ===================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return { valid: false, message: "비밀번호는 8자 이상이어야 합니다." };
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return {
      valid: false,
      message:
        "비밀번호는 대문자, 소문자, 숫자를 각각 하나 이상 포함해야 합니다.",
    };
  }

  return { valid: true };
}

export function validateUsername(username: string): {
  valid: boolean;
  message?: string;
} {
  if (username.length < 3) {
    return { valid: false, message: "사용자명은 3자 이상이어야 합니다." };
  }

  if (username.length > 20) {
    return { valid: false, message: "사용자명은 20자 이하여야 합니다." };
  }

  if (!/^[a-zA-Z0-9_가-힣]+$/.test(username)) {
    return {
      valid: false,
      message: "사용자명은 영문, 숫자, 언더스코어, 한글만 사용할 수 있습니다.",
    };
  }

  return { valid: true };
}

// =================== 이메일 발송 ===================

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  // SMTP 설정 확인
  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.warn("⚠️ SMTP 설정이 없어 이메일을 발송하지 않습니다.");
    return { success: false, error: "SMTP 설정이 필요합니다." };
  }

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    // 이메일 연결 테스트
    await transporter.verify();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const verificationUrl = `${appUrl}/verify?token=${token}`;

    const mailOptions = {
      from: `"게시판 서비스" <${SMTP_CONFIG.auth.user}>`,
      to: email,
      subject: "🎉 이메일 인증을 완료해주세요! (1시간 내)",
      html: generateEmailTemplate(username, verificationUrl),
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ 인증 이메일 발송 성공:", email);

    return { success: true };
  } catch (error: any) {
    console.error("❌ 이메일 발송 실패:", error.message);
    return { success: false, error: error.message };
  }
}

function generateEmailTemplate(
  username: string,
  verificationUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>이메일 인증</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              
              <!-- 헤더 -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">🎉 환영합니다!</h1>
                  <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">안녕하세요, ${username}님!</p>
                </td>
              </tr>
              
              <!-- 본문 -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">⏰ 이메일 인증이 필요합니다</h2>
                  
                  <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                    계정을 활성화하기 위해 아래 버튼을 클릭하여 이메일 인증을 완료해주세요.
                  </p>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="color: #856404; margin: 0; font-size: 14px;">
                      ⚠️ <strong>중요:</strong> 이 인증 링크는 <strong>1시간 후에 자동으로 만료</strong>됩니다.
                    </p>
                  </div>
                  
                  <!-- 인증 버튼 -->
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${verificationUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); 
                              color: white; padding: 15px 30px; text-decoration: none; 
                              border-radius: 25px; font-weight: bold; font-size: 16px;
                              box-shadow: 0 4px 15px rgba(81, 207, 102, 0.3);">
                      ✅ 이메일 인증하기
                    </a>
                  </div>
                  
                  <p style="color: #999; font-size: 14px; text-align: center; margin: 20px 0 0 0;">
                    버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:
                  </p>
                  
                  <div style="background: #f8f9fa; border-radius: 5px; padding: 10px; margin: 10px 0; word-break: break-all;">
                    <code style="color: #666; font-size: 12px;">${verificationUrl}</code>
                  </div>
                </td>
              </tr>
              
              <!-- 푸터 -->
              <tr>
                <td style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="color: #999; margin: 0; font-size: 12px;">
                    이 이메일은 자동으로 발송되었습니다. 답장하지 마세요.
                  </p>
                  <p style="color: #999; margin: 5px 0 0 0; font-size: 12px;">
                    © 2024 게시판 서비스. All rights reserved.
                  </p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
