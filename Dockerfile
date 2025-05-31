# Dockerfile
FROM node:18-alpine

WORKDIR /app

# SQLite 및 빌드 도구 설치
RUN apk add --no-cache sqlite python3 make g++

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 데이터 디렉토리 생성
RUN mkdir -p /app/data

# Next.js 빌드
RUN npm run build

# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["npm", "start"]