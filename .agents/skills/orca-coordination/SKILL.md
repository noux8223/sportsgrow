---
name: orca-coordination
description: Sports Grow에서 Orca 워커로 구현과 리뷰를 나눌 때 사용합니다. 병렬 작업, Command Code 빌더와 GLM 리뷰어, 공유 데이터베이스가 포함되면 기동 전에 읽습니다.
---

# Orca 조율

도구 사용법은 `orca skills get orchestration`이 정본입니다. 이 저장소의 모델과 기동 명령은 `docs/ops/multi_agent_setup.md`가 정본입니다.

## 언제

수정 파일이 겹치거나, 리뷰가 구현 다음에 오거나, 같은 Postgres를 테스트가 쓰면 이 스킬을 사용합니다. 한 사람의 짧은 읽기는 대상이 아닙니다.

## 나누기

1. `orca orchestration run-create`로 Run을 만듭니다.
2. 구현 Task와 리뷰 Task를 만듭니다. 리뷰의 `--deps`는 그 구현 Task입니다.
3. 스펙은 `.agents/templates/task_capsule.yaml`의 항목을 채웁니다.
4. 파일이 다른 구현 Task만 동시에 띄웁니다.
5. 리뷰는 구현 `worker_done`과 diff를 확인한 다음에 띄웁니다.

빌더 모델은 `deepseek/deepseek-v4.1-flash`입니다. 리뷰어 모델은 `z-ai/glm-5.3-flash`입니다. 둘 다 Command Code이고 effort는 `high`입니다.

## 기동

`worker-start --agent command-code`에는 `--model`을 붙일 수 없습니다. `docs/ops/multi_agent_setup.md` 2장의 `terminal create`와 `dispatch --inject`를 씁니다. `--skip-onboarding`을 빼지 않습니다.

작업 트리는 이 저장소 하나입니다. 자식 워크트리를 만들지 않습니다.

## 공유 데이터베이스

각 워커는 자기 테스트 파일만 실행하고 풀을 닫습니다. 전체 스위트는 코디네이터가 마지막에 한 번만 돌립니다. 컨테이너를 올리거나 마이그레이션을 적용하지 않습니다. 데이터베이스가 꺼져 있으면 사용자에게 묻고, 허용되면 기존 `sportsgrow-db-1`만 `docker start`합니다.

## 보고

워커에게 변경 파일, 실행한 명령, 통과와 실패 건수, 하지 않은 일을 적게 합니다. 코디네이터는 그 문장만 보고 완료로 두지 않고 diff를 봅니다.
