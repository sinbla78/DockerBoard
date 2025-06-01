import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

// 데이터베이스 연결 및 초기화
export async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    // 데이터 디렉토리 생성
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 데이터베이스 연결
    const dbPath = path.join(dataDir, 'auth_board.db');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // 사용자 테이블 생성
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_token TEXT UNIQUE,
        verification_expires DATETIME,
        refresh_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 게시글 테이블 생성
    await db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
      );
    `);

    // 인덱스 생성
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
      CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
    `);

    console.log('✅ 데이터베이스 초기화 완료:', dbPath);
    return db;
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
}

// 타입 정의
export interface User {
  id: number;
  email: string;
  username: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
  authorUsername: string;
  createdAt: string;
}

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
  verificationToken: string;
}

// =================== 사용자 관련 함수들 ===================

// 사용자 생성
export async function createUser(userData: CreateUserData): Promise<User> {
  const database = await initializeDatabase();
  
  try {
    const result = await database.run(`
      INSERT INTO users (email, username, password_hash, verification_token, verification_expires)
      VALUES (?, ?, ?, ?, datetime('now', '+1 hour'))
    `, [userData.email, userData.username, userData.passwordHash, userData.verificationToken]);

    const user = await database.get(`
      SELECT id, email, username, is_verified as isVerified, created_at as createdAt
      FROM users WHERE id = ?
    `, [result.lastID]);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isVerified: Boolean(user.isVerified),
      createdAt: user.createdAt
    };
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('email')) {
        throw new Error('이미 사용 중인 이메일입니다.');
      }
      if (error.message.includes('username')) {
        throw new Error('이미 사용 중인 사용자명입니다.');
      }
    }
    throw new Error('사용자 생성에 실패했습니다.');
  }
}

// 이메일로 사용자 찾기 (로그인용 - 비밀번호 포함)
export async function findUserByEmailForAuth(email: string): Promise<any | null> {
  const database = await initializeDatabase();
  
  return await database.get(`
    SELECT id, email, username, password_hash as passwordHash, 
           is_verified as isVerified, created_at as createdAt
    FROM users WHERE email = ?
  `, [email]);
}

// ID로 사용자 찾기
export async function findUserById(id: number): Promise<User | null> {
  const database = await initializeDatabase();
  
  const user = await database.get(`
    SELECT id, email, username, is_verified as isVerified, created_at as createdAt
    FROM users WHERE id = ?
  `, [id]);

  return user ? {
    id: user.id,
    email: user.email,
    username: user.username,
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt
  } : null;
}

// 이메일 인증 처리
export async function verifyUserEmail(token: string): Promise<boolean> {
  const database = await initializeDatabase();
  
  const result = await database.run(`
    UPDATE users 
    SET is_verified = TRUE, 
        verification_token = NULL, 
        verification_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE verification_token = ? 
      AND verification_expires > datetime('now')
      AND is_verified = FALSE
  `, [token]);

  return (result.changes || 0) > 0;
}

// Refresh Token 저장
export async function saveRefreshToken(userId: number, refreshToken: string): Promise<void> {
  const database = await initializeDatabase();
  
  await database.run(`
    UPDATE users 
    SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [refreshToken, userId]);
}

// Refresh Token으로 사용자 찾기
export async function findUserByRefreshToken(refreshToken: string): Promise<User | null> {
  const database = await initializeDatabase();
  
  const user = await database.get(`
    SELECT id, email, username, is_verified as isVerified, created_at as createdAt
    FROM users WHERE refresh_token = ?
  `, [refreshToken]);

  return user ? {
    id: user.id,
    email: user.email,
    username: user.username,
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt
  } : null;
}

// Refresh Token 삭제 (로그아웃)
export async function removeRefreshToken(userId: number): Promise<void> {
  const database = await initializeDatabase();
  
  await database.run(`
    UPDATE users 
    SET refresh_token = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [userId]);
}

// 만료된 인증 토큰 정리
export async function cleanupExpiredTokens(): Promise<number> {
  const database = await initializeDatabase();
  
  const result = await database.run(`
    UPDATE users 
    SET verification_token = NULL, 
        verification_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE verification_expires < datetime('now')
      AND is_verified = FALSE
  `);

  return result.changes || 0;
}

// =================== 게시글 관련 함수들 ===================

// 모든 게시글 조회
export async function getAllPosts(): Promise<Post[]> {
  const database = await initializeDatabase();
  
  const posts = await database.all(`
    SELECT 
      p.id, 
      p.title, 
      p.content, 
      p.author_id as authorId,
      u.username as authorUsername,
      p.created_at as createdAt
    FROM posts p
    JOIN users u ON p.author_id = u.id
    ORDER BY p.created_at DESC
  `);

  return posts.map(post => ({
    id: post.id,
    title: post.title,
    content: post.content,
    authorId: post.authorId,
    authorUsername: post.authorUsername,
    createdAt: post.createdAt
  }));
}

// 게시글 생성
export async function createPost(title: string, content: string, authorId: number): Promise<Post> {
  const database = await initializeDatabase();
  
  const result = await database.run(`
    INSERT INTO posts (title, content, author_id)
    VALUES (?, ?, ?)
  `, [title, content, authorId]);

  const post = await database.get(`
    SELECT 
      p.id, 
      p.title, 
      p.content, 
      p.author_id as authorId,
      u.username as authorUsername,
      p.created_at as createdAt
    FROM posts p
    JOIN users u ON p.author_id = u.id
    WHERE p.id = ?
  `, [result.lastID]);

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    authorId: post.authorId,
    authorUsername: post.authorUsername,
    createdAt: post.createdAt
  };
}

// 게시글 삭제
export async function deletePost(postId: number, authorId: number): Promise<boolean> {
  const database = await initializeDatabase();
  
  const result = await database.run(`
    DELETE FROM posts 
    WHERE id = ? AND author_id = ?
  `, [postId, authorId]);

  return (result.changes || 0) > 0;
}