---
name: dev-servers
description: 세션에서 브라우저로 Sports Grow 화면을 확인할 때 API, 로그인한 웹, 루트 정적 서버를 엽니다. 화면 검증의 첫 단계로 사용합니다.
---

# 개발 서버

화면을 브라우저로 보는 세션은 다른 확인보다 먼저 이 스킬을 실행합니다. 이미 떠 있는 포트는 다시 띄우지 않고, 이 스킬이 띄운 프로세스만 종료합니다.

저장소 루트에서 실행합니다.

```bash
node scripts/dev-servers.mjs
node scripts/dev-servers.mjs status
```

`status`는 포트와 준비 상태만 출력하고 서버와 데이터베이스를 시작하지 않습니다.

종료는 이 스킬이 기록한 프로세스만 대상으로 합니다.

```bash
node scripts/dev-servers.mjs stop
```

## 주소

| 이름 | 주소 | 역할 |
| --- | --- | --- |
| API | http://127.0.0.1:3000 | Fastify. 준비 확인은 `GET /api/health` |
| 로그인한 웹 | http://127.0.0.1:5173 | Vite. `/api`는 127.0.0.1:3000으로 프록시 |
| 루트 화면 | http://127.0.0.1:8765 | 저장소 루트의 정적 HTML. 데모 비밀번호는 `grow1234` |

`mobile/`의 Expo는 이 스킬이 켜지 않습니다. 시뮬레이터는 별도 지시가 있을 때만 엽니다.

## 데이터베이스

스크립트는 `sportsgrow-db-1`이 꺼져 있고 호스트 5432가 비어 있을 때만 `docker start sportsgrow-db-1`을 실행합니다. `docker compose up`, 재시작, 컨테이너 재생성, 마이그레이션 적용은 하지 않습니다.

## 결과

표준 출력은 JSON입니다. `state`가 `already_running`이면 기존 프로세스를 유지한 것입니다. `health`가 `ok`이면 브라우저를 열 수 있습니다. `timeout`이면 `/tmp/sportsgrow-dev/<이름>.log`를 보고, 포트를 점유한 다른 프로세스는 종료하지 않습니다.

## 브라우저에서 볼 경로

- 로그인한 웹: `http://127.0.0.1:5173/`. 로그인, 역할 홈, 로그아웃.
- 루트 데모: `http://127.0.0.1:8765/login.html` 다음 역할 화면. `js/env.js`의 `api`가 꺼져 있으면 데모 원장입니다.
- API만 볼 때: `http://127.0.0.1:3000/api/health`.

루트 HTML은 Fastify가 제공하지 않습니다. 3000번만 열고 역할 HTML을 찾지 않습니다.
