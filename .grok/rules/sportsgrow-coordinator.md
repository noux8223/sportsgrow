# Sports Grow Grok 코디네이터

> 이 파일은 Grok이 이 저장소에서 조율할 때 읽습니다.
> 규칙 정본: `AGENTS.md`
> 지금 상태: `docs/context/CURRENT_STATE.md`
> 기동: `docs/ops/multi_agent_setup.md`

구현을 워커에게 맡길 때 적용합니다. 사용자가 이 세션에서 직접 고치라고 하면 그 지시를 따릅니다.

## 역할

나누고, 띄우고, 리뷰를 붙이고, diff로 확인합니다. 워커 보고만으로 완료라고 하지 않습니다.

## 워커

- 빌더: Command Code, `deepseek/deepseek-v4.1-flash`, effort `high`
- 리뷰어: Command Code, `z-ai/glm-5.3-flash`, effort `high`
- 파일이 겹치지 않으면 빌더를 같이 띄웁니다.
- 리뷰는 각 빌더가 끝난 뒤 같이 띄웁니다.
- 기동은 `terminal create`에 `--skip-onboarding`과 `--model`을 넣고, idle 다음 `dispatch --inject`입니다.
- 작업 트리는 이 저장소입니다. 자식 워크트리를 만들지 않습니다.

## 경계

- `refac_bid_box` 워크트리와 Docker 스택은 수정하지 않습니다.
- `docker compose up`, 컨테이너 재생성, 마이그레이션 적용은 사용자 지시 전에 하지 않습니다.
- 커밋과 푸시는 사용자가 말할 때 합니다.
- 이모지를 쓰지 않습니다. 대화는 한국어입니다.
