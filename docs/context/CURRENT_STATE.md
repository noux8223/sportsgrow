# Sports Grow 현재 상태

> **작성일**: 2026-11-18
> **기준**: `main` `a927a51`
> 숫자와 미커밋 목록이 저장소와 다르면 저장소를 따릅니다. 이 파일을 워커가 고치지 않습니다. 코디네이터가 상태가 바뀐 뒤에 고칩니다.

---

## 저장소

- 원격 `https://github.com/noux8223/sportsgrow.git`, 브랜치 `main`.
- 로컬 HEAD는 `a927a51`입니다. 메시지: 로그인 시간, 초상 동의, 활성화 게이트, 주간 리포트 동의, 통계 수집 설정을 설계에 맞춘다.
- 그 부모 `50f6d5c`는 학원 월 구독 파일럿 API입니다. `cd76f6f`는 데모 원장을 역할 화면이 공유합니다.
- 정본 폴더는 `langchain_ai_vision/sportsgrow`입니다. `lanhchain_ai_vision`은 그 폴더를 가리키는 바로가기입니다.
- 제품 설계는 `docs/상용화-유료배포-설계서.md`입니다. PR 17개의 상당 부분이 `50f6d5c` 한 커밋에 들어가 있습니다. 설계서의 Open Questions는 대표 결정이 아니라 문서에 적힌 기본값입니다.

## 작업 트리

`a927a51`에 아래가 들어 있습니다. 작업 트리에 남은 서버 수정은 없습니다.

| 파일 | 내용 |
| --- | --- |
| `server/src/identity.ts` | 없는 이메일도 argon2 검증 후 같은 401 |
| `server/test/login-timing.test.ts` | 로그인 시간 테스트 |
| `server/src/media.ts` | 호출자 본인의 초상 동의, 직원 삭제는 열린 티켓 |
| `server/test/media-auth.test.ts` | 사진 권한 테스트 |
| `server/src/routes.ts` | 초안이 아니면 활성화 409, 다른 선수 초대는 멤버십 유지 |
| `server/test/roster-gates.test.ts` | 활성화와 초대 테스트 |
| `server/src/reports.ts` | 최근 `report_email` 동의가 허용된 선수만 주간 리포트 |
| `server/test/weekly-consent.test.ts` | 주간 리포트 동의 테스트 |
| `docker-compose.yml` | `pg_stat_statements.track=top` |
| `server/migrations/010_goals_unique.sql` | `goals_athlete_metric` 인덱스 삭제 한 줄. 테이블 UNIQUE는 유지 |

마이그레이션 010은 적용하지 않았습니다. `track=top`은 컨테이너를 다시 만들기 전에는 실행 중인 데이터베이스에 반영되지 않습니다. 다시 만들지 않았습니다.

## 로컬 데이터베이스

컨테이너 이름은 `sportsgrow-db-1`입니다. 이미지 `postgres:16`, 포트 5432, 볼륨 `sportsgrow_pg`. 준비 확인은 `docker exec sportsgrow-db-1 pg_isready -U sportsgrow_migrate -d sportsgrow`입니다.

## 에이전트

규칙 정본은 루트 `AGENTS.md`입니다. 워커 기동은 `docs/ops/multi_agent_setup.md`입니다. 빌더는 `deepseek/deepseek-v4.1-flash`, 리뷰어는 `z-ai/glm-5.3-flash`입니다.

## 손대지 않는 것

같은 Mac의 `refac_bid_box` 워크트리와 Docker 스택(app, worker, db, redis, meilisearch)은 이 저장소 작업의 대상이 아닙니다.
