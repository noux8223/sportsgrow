# Sports Grow 다중 에이전트 기동

> **작성일**: 2026-11-18
> 도구 계약의 정본은 `orca skills get orchestration`입니다. 이 문서는 그 도구를 이 저장소에서 쓰는 방법입니다.

---

## 1. 모델

| 역할 | 에이전트 | 모델 | effort |
| --- | --- | --- | --- |
| 구현 | Command Code (`command-code`) | `deepseek/deepseek-v4.1-flash` | `high` |
| 리뷰 | Command Code | `z-ai/glm-5.3-flash` | `high` |

Orca 에이전트 id는 `command-code`입니다. `cmd`는 같은 바이너리의 별칭이라 `--agent cmd`는 거절됩니다. `orca orchestration worker-start`에 `--model`을 붙이면 Command Code가 거절합니다.

기본 모델 설정 파일 `/Users/kwanbum/.commandcode/config.json`은 워커를 띄운 뒤 원래 값으로 되돌립니다. 저장해 둔 기본값은 `deepseek/deepseek-v4-flash`입니다. 모델은 기동 인자로 넘기고, 설정 파일을 작업 중에 바꿔 두지 않습니다.

## 2. 기동

감독 경로인 `worker-start`는 이 모델 핀을 표현하지 못합니다. 그래서 이 저장소는 터미널을 만든 뒤 스펙을 주입합니다. 이 경로는 비감독입니다. `worker-release`가 그 터미널을 소유하지 않을 수 있습니다. 끝나면 `orca terminal list`로 창을 확인하고, 그 작업의 창만 닫습니다. `--tab`으로 닫지 않습니다.

작업 위치는 이 저장소 루트입니다. `--worktree current`에 해당합니다. 자식 워크트리를 만들지 않습니다.

```text
orca terminal create --worktree path:<이 저장소 루트> --title "<작업 이름>" \
  --command "command-code --trust --yolo --skip-onboarding --model <모델> --effort high" --json

orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 70000 --json

orca orchestration dispatch --task <task_id> --to <handle> --inject
```

`--skip-onboarding`이 없으면 Taste 화면의 `No prompts found in sessions`에서 멈춥니다. `--trust '--yolo'`처럼 따옴표가 인자로 들어가면 `--yolo`가 플래그가 되지 않습니다.

`tui-idle` 뒤 화면이 질문 프롬프트인지 확인한 다음 inject합니다. inject가 `ok`여도 화면을 한 번 읽어 스펙이 들어갔는지 확인합니다.

독립 Task의 터미널은 같이 만들고, 각자 idle이면 같이 inject합니다. 리뷰 터미널은 그 빌더의 `worker_done` 다음에 만듭니다.

## 3. Capsule

양식은 `.agents/templates/task_capsule.yaml`입니다. Task 스펙에 목표, 허용 파일, 금지, 검증 명령, 완료 조건을 넣습니다. 워커에게 저장소 루트를 벗어나지 말라고 적습니다.

리뷰 스펙은 빌더가 고친 파일만 보게 하고, 그 작업의 `git diff`와 그 테스트 파일 실행을 요구합니다. 리뷰어의 허용 쓰기 목록은 비웁니다.

## 4. 병렬

한 번에 띄울 조건은 수정 파일이 서로 다르다는 것입니다. 같은 파일은 한 워커만 씁니다.

공유 데이터베이스가 있으므로 각 워커는 자기 `server/test/<file>.test.ts`만 실행합니다. 전체 `npm test`는 코디네이터가 워커가 끝난 뒤 필요하면 한 번 돌립니다.

## 5. 완료

워커 보고는 주장입니다. 코디네이터는 diff와 테스트 출력을 확인합니다. 리뷰가 통과해도 사용자가 커밋을 말하기 전에는 커밋하지 않습니다.

비감독 워커가 질문 프롬프트에서 기다리면 `orca orchestration send`가 도착하지 않을 수 있습니다. 그때는 `orca terminal send --terminal <handle> --text "<답>" --enter`로 전달합니다.

## 6. 상태 말

| 말 | 근거 |
| --- | --- |
| 등록됨 | Run과 Task가 있고 Dispatch는 없음 |
| 진행 중 | 터미널이 살아 있고 스펙을 받은 뒤 작업 중 |
| 리뷰 통과 | 리뷰어 보고와 테스트 출력이 있음 |
| 커밋됨 | `git log`와 `git status`가 그 사실을 보여 줌 |

터미널이 조용하다는 이유만으로 완료라고 하지 않습니다.
