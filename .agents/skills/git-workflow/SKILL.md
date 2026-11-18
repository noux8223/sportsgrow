---
name: git-workflow
description: Sports Grow 변경을 커밋하거나 푸시할 때 사용합니다. 사용자가 커밋이나 푸시를 요청한 뒤에 읽습니다.
---

# Git

원격은 `https://github.com/noux8223/sportsgrow.git`, 브랜치 `main`입니다. Pull Request를 만들지 않습니다.

## 시점

커밋과 푸시는 사용자가 그 작업을 말한 다음에만 합니다. 워커의 완료 보고는 커밋 지시가 아닙니다.

## 메시지

기존 이력처럼 한국어 한 문장입니다. 예: `학원 월 구독 파일럿을 같은 출처의 API로 붙이고 데모 화면은 그대로 둔다.`

## 빼는 파일

- `.commandcode/`
- `.orca/`
- `node_modules/`, `server/node_modules/`, `server/dist/`
- `server/.env`
- `infra/*.tfstate`, `infra/*.tfplan`

넣기 전에 `git status`와 `git diff`로 범위를 확인합니다. 다른 작업의 미커밋 파일이 있으면 그 파일을 이번 커밋에 섞지 않고 사용자에게 범위를 말합니다.

푸시 뒤에는 `git status`가 `main`과 `origin/main`이 같다고 보이는지 확인합니다.
