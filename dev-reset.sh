#!/bin/bash

echo "========================================="
echo "  🧹 Scaaf Dev Bootstrap (Pro Version)"
echo "  - Kills old processes"
echo "  - Cleans lock files"
echo "  - Validates env vars"
echo "  - Starts pnpm dev"
echo "========================================="
echo ""

###########################################
# 1) 환경 변수 필수 목록 정의
###########################################
REQUIRED_ENV_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "SUPABASE_DB_PASSWORD"

  "MAILGUN_API_BASE_URL"
  "MAILGUN_API_KEY"
  "MAILGUN_DOMAIN"
  "MAILGUN_SMTP_LOGIN"
  "MAILGUN_SMTP_PASSWORD"
  "MAILGUN_INGRESS_SECRET"

  "HOST_DOMAIN"
  "INBOUND_WEBHOOK_URL"

  "OPENAI_API_KEY"
)

echo "🔍 Checking .env.local file..."
if [ ! -f ".env.local" ]; then
  echo "❌ ERROR: .env.local 파일이 프로젝트 루트에 존재하지 않습니다."
  echo "   파일 생성 후 다시 실행하세요."
  exit 1
fi

###########################################
# 2) 환경변수 값 검증 함수
###########################################
check_env_var() {
  local VAR_NAME=$1
  local VAR_VALUE=$(grep -E "^$VAR_NAME=" .env.local | sed "s/$VAR_NAME=//")

  if [ -z "$VAR_VALUE" ]; then
    echo "❌ Missing: $VAR_NAME"
    return 1
  else
    echo "✔ $VAR_NAME OK"
    return 0
  fi
}

###########################################
# 3) 모든 필수 변수 검증 실행
###########################################
echo ""
echo "🔍 Validating required environment variables..."
MISSING_COUNT=0

for VAR in "${REQUIRED_ENV_VARS[@]}"; do
  check_env_var "$VAR"
  if [ $? -ne 0 ]; then
    MISSING_COUNT=$((MISSING_COUNT+1))
  fi
done

if [ $MISSING_COUNT -gt 0 ]; then
  echo ""
  echo "🚫 총 $MISSING_COUNT 개의 환경변수가 누락되었습니다."
  echo "💡 .env.local 파일 확인 후 다시 실행하세요."
  exit 1
fi

echo ""
echo "✅ All required environment variables present!"
echo ""

###########################################
# 4) Next.js dev 실행 중인 경우 종료
###########################################
echo "🔍 Checking for running Next.js processes..."
PIDS=$(ps aux | grep "next dev" | grep -v grep | awk '{print $2}')

if [ -z "$PIDS" ]; then
  echo "✔ No running next dev processes."
else
  echo "⚠ Found: $PIDS → Killing..."
  kill -9 $PIDS
  echo "✔ Processes terminated."
fi

###########################################
# 5) Lock 파일 정리
###########################################
echo ""
echo "🧹 Cleaning .next lock and build artifacts..."

if [ -f ".next/dev/lock" ]; then
  rm -f .next/dev/lock
  echo "✔ Removed .next/dev/lock"
fi

rm -rf .next
echo "✔ Reset .next directory"

###########################################
# 6) 서버 실행
###########################################
echo ""
echo "🚀 Starting pnpm dev..."
pnpm dev
