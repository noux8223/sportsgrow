# Sports Grow 현재 상태

> **작성일**: 2026-11-18
> **기준**: 최신 커밋은 `git rev-parse HEAD`, 미커밋 변경은 `git status --short`로 확인합니다. 이 파일은 해시를 HEAD로 박지 않습니다.
> 숫자와 미커밋 목록이 저장소와 다르면 저장소를 따릅니다. 이 파일을 워커가 고치지 않습니다. 코디네이터가 상태가 바뀐 뒤에 고칩니다.

---

## 저장소

- 원격 `https://github.com/noux8223/sportsgrow.git`, 브랜치 `main`.
- `a927a51`은 로그인 시간, 초상 동의, 활성화 게이트, 주간 리포트 동의, 통계 수집 설정입니다.
- 그 위 커밋이 에이전트 규칙, 스킬, 이 상태 문서입니다. 최신 해시는 이 파일에 박지 않고 `git rev-parse HEAD`로 확인합니다.
- `50f6d5c`는 학원 월 구독 파일럿 API이고, `cd76f6f`는 데모 원장입니다.
- 정본 폴더는 `langchain_ai_vision/sportsgrow`입니다. `lanhchain_ai_vision`은 그 폴더를 가리키는 바로가기입니다.
- 제품 설계는 `docs/상용화-유료배포-설계서.md`입니다. PR 17개의 상당 부분이 `50f6d5c` 한 커밋에 들어가 있습니다. 설계서의 Open Questions는 대표 결정이 아니라 문서에 적힌 기본값입니다.

## 작업 트리

이 문서와 함께 들어간 변경은 아래와 같습니다. 그 이후의 미커밋 여부는 `git status --short`로 확인합니다.

- `web/`은 Vite React 로그인 골격이고 세션은 쿠키입니다. 루트 HTML을 대체하지 않습니다.
- `mobile/`은 Expo 골격이고 세션은 Bearer입니다.
- `server/src/identity.ts`는 로그인 `user.platformStaff`를 넣고, `x-sg-client: native`일 때만 `sessionToken`을 반환합니다. 웹은 HttpOnly 쿠키 `sg_session`입니다.
- `server/src/jobs.ts`는 수락되지 않은 초대의 가장 늦은 만료가 14일을 넘긴, `child_account` 허용이 없는 `draft`만 지웁니다.
- 루트 HTML은 Pretendard를 `css/fonts/pretendard.css`로 읽고, `index.html` 푸터의 관리자 로그인 링크는 없습니다.
- `js/api-dashboard.js`는 API 영역을 `.app` 안에 두거나, 파일럿 빌드의 `main.sg-api-loading` 자리에 둡니다.
- `server/scripts/build-pilot.mjs`는 그 역할 페이지에 `css/app.css`를 다시 둡니다.

`a927a51`에 들어간 서버 맞춤은 로그인 시간, 초상 동의, 활성화 게이트, 주간 리포트 동의, 통계 수집 설정입니다.

마이그레이션 010은 적용하지 않았습니다. `track=top`은 컨테이너를 다시 만들기 전에는 실행 중인 데이터베이스에 반영되지 않습니다. 다시 만들지 않았습니다.

## 클라이언트

| 위치 | 기술 | 범위 |
| --- | --- | --- |
| 루트 | vanilla HTML/CSS/JS IIFE | 파일럿 화면입니다. `env.api === false`이면 데모 원장 `sportsgrow.demo.v1` |
| `web/` | Vite, React 19, TypeScript, `credentials: 'include'` 쿠키 | 로그인한 웹 골격. 루트 HTML 대체 아님 |
| `mobile/` | Expo, React Native, Expo Router, `expo-secure-store` Bearer | 모바일 골격. 루트 HTML 대체 아님 |

API는 `server/`의 Node 22, TypeScript, Fastify, PostgreSQL 16입니다. Next.js, NestJS, Redis, ORM은 파일럿 경로가 아닙니다.

## 로컬 데이터베이스

컨테이너 이름은 `sportsgrow-db-1`입니다. 이미지 `postgres:16`, 포트 5432, 볼륨 `sportsgrow_pg`. 준비 확인은 `docker exec sportsgrow-db-1 pg_isready -U sportsgrow_migrate -d sportsgrow`입니다.

## 에이전트

규칙 정본은 루트 `AGENTS.md`입니다. 워커 기동은 `docs/ops/multi_agent_setup.md`입니다. 빌더는 `deepseek/deepseek-v4.1-flash`, 리뷰어는 `z-ai/glm-5.3-flash`입니다.

## 손대지 않는 것

같은 Mac의 `refac_bid_box` 워크트리와 Docker 스택(app, worker, db, redis, meilisearch)은 이 저장소 작업의 대상이 아닙니다.
