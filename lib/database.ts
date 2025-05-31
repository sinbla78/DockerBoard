import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import fs from "fs";

let db: Database | null = null;

// 데이터베이스 연결
export async function openDB(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    // 데이터 디렉토리가 없으면 생성
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 데이터베이스 파일 경로
    const dbPath = path.join(dataDir, "board.db");

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // 테이블이 없으면 생성
    await db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 초기 데이터가 없으면 샘플 데이터 추가
    const count = await db.get("SELECT COUNT(*) as count FROM posts");
    if (count.count === 0) {
      await db.run(`
        INSERT INTO posts (title, content, author) 
        VALUES 
          ('첫 번째 게시글', '안녕하세요! 이것은 첫 번째 게시글입니다.', '관리자'),
          ('SQLite 연결 완료!', 'SQLite 데이터베이스가 성공적으로 연결되었습니다. 이제 데이터가 영구 저장됩니다!', '시스템')
      `);
    }

    console.log("✅ SQLite 데이터베이스 연결 성공:", dbPath);
    return db;
  } catch (error) {
    console.error("❌ 데이터베이스 연결 실패:", error);
    throw error;
  }
}

// 게시글 타입 정의
export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string;
}

// 모든 게시글 조회
export async function getAllPosts(): Promise<Post[]> {
  try {
    const database = await openDB();
    const posts = await database.all(`
      SELECT id, title, content, author, created_at as createdAt 
      FROM posts 
      ORDER BY created_at DESC
    `);

    return posts.map((post) => ({
      ...post,
      id: post.id.toString(),
      createdAt: post.createdAt,
    }));
  } catch (error) {
    console.error("❌ 게시글 조회 실패:", error);
    return [];
  }
}

// 게시글 하나 조회
export async function getPostById(id: string): Promise<Post | null> {
  try {
    const database = await openDB();
    const post = await database.get(
      `
      SELECT id, title, content, author, created_at as createdAt 
      FROM posts 
      WHERE id = ?
    `,
      [id]
    );

    if (!post) return null;

    return {
      ...post,
      id: post.id.toString(),
      createdAt: post.createdAt,
    };
  } catch (error) {
    console.error("❌ 게시글 조회 실패:", error);
    return null;
  }
}

// 새 게시글 추가
export async function createPost(
  title: string,
  content: string,
  author: string
): Promise<Post> {
  try {
    const database = await openDB();
    const result = await database.run(
      `
      INSERT INTO posts (title, content, author) 
      VALUES (?, ?, ?)
    `,
      [title, content, author]
    );

    const newPost = await database.get(
      `
      SELECT id, title, content, author, created_at as createdAt 
      FROM posts 
      WHERE id = ?
    `,
      [result.lastID]
    );

    return {
      ...newPost,
      id: newPost.id.toString(),
      createdAt: newPost.createdAt,
    };
  } catch (error) {
    console.error("❌ 게시글 생성 실패:", error);
    throw new Error("게시글 생성에 실패했습니다.");
  }
}

// 게시글 삭제
export async function deletePost(id: string): Promise<boolean> {
  try {
    const database = await openDB();
    const result = await database.run(
      `
      DELETE FROM posts WHERE id = ?
    `,
      [id]
    );

    return (result.changes || 0) > 0;
  } catch (error) {
    console.error("❌ 게시글 삭제 실패:", error);
    return false;
  }
}

// 게시글 수정
export async function updatePost(
  id: string,
  title?: string,
  content?: string
): Promise<Post | null> {
  try {
    const database = await openDB();

    const updates: string[] = [];
    const values: any[] = [];

    if (title) {
      updates.push("title = ?");
      values.push(title);
    }

    if (content) {
      updates.push("content = ?");
      values.push(content);
    }

    if (updates.length === 0) {
      return getPostById(id);
    }

    values.push(id);

    await database.run(
      `
      UPDATE posts 
      SET ${updates.join(", ")} 
      WHERE id = ?
    `,
      values
    );

    return getPostById(id);
  } catch (error) {
    console.error("❌ 게시글 수정 실패:", error);
    return null;
  }
}
