---
name: pilot-server
description: Sports Grow 파일럿 API를 고칠 때 사용합니다. server/의 Fastify, TypeScript, pg SQL, 마이그레이션 초안, server/test가 대상입니다.
---

# 파일럿 서버

규칙 정본은 루트 `AGENTS.md`입니다. 이 스킬은 `server/` 작업 절차만 적습니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `server/src/index.ts` | 앱 부트, 캐시 헤더, 구독 읽기 게이트 |
| `server/src/identity.ts` | 로그인, 세션, argon2 |
| `server/src/routes.ts` | 조직, 로스터, 초대, 활성화, 기록 |
| `server/src/media.ts` | 사진 업로드와 삭제 |
| `server/src/reports.ts` | 주간 리포트와 메일 outbox |
| `server/src/jobs.ts` | 서울 기준 일일 잡 |
| `server/src/db.ts` | `pool`과 `jobPool` |
| `server/migrations/` | 번호 SQL. 적용은 별도 지시 |
| `server/test/` | 노드 테스트 러너 |

SQL은 `pg`의 `$1` 자리표시자입니다. ORM을 도입하지 않습니다.

## 테스트

맡은 파일만 실행합니다.

```bash
cd server && node --import tsx --test test/<file>.test.ts
```

테스트가 끝나면 `pool`, `jobPool`, 테스트가 만든 유지 풀을 `end`합니다. 만든 조직, 사용자, 감사 행은 테스트 안에서 지웁니다.

전체 `npm test`는 워커가 동시에 돌리지 않습니다.

타입 확인이 필요하면 `cd server && npx tsc -p tsconfig.json --noEmit`입니다.

## 응답

`/api` 응답은 `Cache-Control: no-store`입니다. 인증 실패 본문은 계정 존재 여부를 가르지 않습니다. 다른 조직의 자원은 404입니다. 구독 때문에 거절할 때는 402를 쓰고, 좌석과 상태 전이는 409와 기존 에러 코드를 유지합니다.

웹훅 라우트는 501 `provider_unconfigured`입니다. PG SDK를 넣지 않습니다.
