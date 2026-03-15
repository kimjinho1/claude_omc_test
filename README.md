# oh-my-claudecode (OMC) 사용 가이드

Claude Code에 멀티 에이전트 오케스트레이션 레이어를 추가하는 플러그인입니다.

---

## 목차

1. [설치](#1-설치)
2. [명령어 목록](#2-명령어-목록)
3. [명령어 상세](#3-명령어-상세)
4. [워크플로우 패턴](#4-워크플로우-패턴)
5. [팀 온보딩](#5-팀-온보딩)
6. [업데이트](#6-업데이트)

---

## 1. 설치

```bash
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode
/omc-setup    # OMC 환경 설정
/omc-doctor   # 설치 완료 후 확인
```

---

## 2. 명령어 목록

| 명령어 | 한 줄 요약 |
|--------|-----------|
| `team` | N개 에이전트 병렬 실행 |
| `omc team` | 외부 AI(codex/gemini) 워커 실행 |
| `ccg` | Codex + Gemini 동시 실행 |
| `autopilot` | 완전 자율 실행 |
| `ralph` | 완료까지 무한 반복 |
| `ulw` | 최대 병렬화 |
| `plan` | 계획 인터뷰 |
| `ralplan` | 반복적 계획 합의 |
| `deep-interview` | 요구사항 명확화 |

---

## 3. 명령어 상세

### `team` — 병렬 에이전트 오케스트레이션

여러 에이전트를 동시에 띄워서 작업을 병렬 처리합니다.

```bash
/team 3:executor "fix all TypeScript errors"
```

> `3:executor` = executor 역할의 에이전트 3개를 생성

---

### `omc team` — 외부 AI CLI 워커 (codex / gemini / claude)

tmux 분할 창에서 외부 AI 모델을 워커로 띄웁니다.

```bash
omc team 2:codex "security review"
```

---

### `ccg` — Codex + Gemini 동시 실행

두 모델에게 한 번에 같은 작업을 맡깁니다.

```bash
/ccg review this PR
```

---

### `autopilot` — 완전 자율 실행

지시만 하면 끝까지 알아서 처리합니다. 개입 불필요.

```bash
autopilot: build a todo app
```

---

### `ralph` — 지속 모드 (완료될 때까지 반복)

architect가 검증 완료할 때까지 포기하지 않고 계속 실행합니다.

```bash
ralph: refactor auth
```

---

### `ulw` — 최대 병렬화

에이전트를 최대한 많이 띄워서 가장 빠르게 처리합니다.

```bash
ulw fix all errors
```

---

### `plan` — 계획 인터뷰

코드 작성 전에 인터뷰 방식으로 요구사항을 정리합니다.

```bash
plan the API
```

---

### `ralplan` — 반복적 계획 합의

계획을 반복 수정하며 합의점을 찾습니다.

```bash
ralplan this feature
```

---

### `deep-interview` — 소크라테스식 요구사항 명확화

막연한 아이디어를 질문으로 구체화합니다. 실행 전 숨겨진 가정을 드러냅니다.

```bash
deep-interview "vague idea"
```

---

## 4. 워크플로우 패턴

### 🚀 Full-Auto from PRD — PRD 기반 자동 빌드

**언제:** 요구사항 문서(PRD)가 있고, 처음부터 병렬로 전부 만들어야 할 때

```bash
/ralplan "review my PRD"       # Planner + Architect + Critic이 합의한 계획 수립
/team N:executor "build app"   # Claude 에이전트 병렬 빌드
# Codex / Gemini 워커가 필요하면 /omc-teams 사용
/ralph                         # Architect 검증 완료까지 반복
```

---

### ⚡ No-Brainer — 단순 작업

**언제:** 명확하고 간단한 작업, 계획이 필요 없을 때

```bash
/autopilot "build a todo app"    # 바로 실행
/ultrawork "fix all lint errors" # 에이전트 분산 처리
/ralph "refactor auth module"    # 완료까지 반복
```

---

### 🔧 Fix / Debugging — 버그 수정

**언제:** 뭔가 깨졌을 때, 안정적인 수정이 필요할 때

```bash
/plan     # 원인 분석 + 수정 전략 수립
/ralph    # 검증 통과할 때까지 수정 반복
/ultraqa  # E2E / 스모크 테스트 실행
```

> 복잡한 버그는 `/plan` 대신 `/ralplan` 먼저

---

### 🧩 Parallel Issues — 여러 티켓 동시 처리

**언제:** 이슈/티켓이 여러 개, 동시에 처리해야 할 때

```bash
/omc-teams N:architect  # 아키텍트가 전체 계획 수립
/omc-teams N:executor   # 각 이슈를 별도 worktree에서 병렬 처리 → PR 제출
/ralplan                # PR 머지 후 충돌 해소
/ralph                  # 전체 마무리
/ultraqa                # 최종 테스트
```

---

## 5. 팀 온보딩

이 레포는 `.claude/` 설정이 git으로 공유됩니다. 클론 후 Claude Code가 즉시 팀 규칙을 따릅니다.

### 신규 팀원 시작 방법

```bash
git clone https://github.com/kimjinho1/claude_omc_test.git
cd claude_omc_test

# Claude Code 플러그인 설치 (최초 1회)
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode
/omc-setup
```

> 이후 Claude Code를 열면 팀 규칙(브랜치 전략, 커밋 컨벤션 등)이 자동 적용됩니다.

### 자동 적용 항목

| 항목 | 내용 |
|------|------|
| **브랜치 경고** | `main`에서 작업 시 경고 메시지 출력 |
| **보안 검사** | 파일에 API 키·토큰 패턴 감지 시 경고 |
| **커밋 후 알림** | lint/format 실행 안내 |
| **작업 완료 로그** | `~/.claude/task-log.txt`에 완료 이력 기록 |

### 개인 설정 (git 미추적)

개인 설정은 `.claude/settings.local.json`에 저장하세요. 이 파일은 `.gitignore`에 포함되어 팀과 공유되지 않습니다.

```json
{
  "permissions": {
    "allow": ["...개인 허용 명령어..."]
  }
}
```

---

## 6. 업데이트

```bash
/plugin marketplace update omc
/omc-setup
# 문제 발생 시
/omc-doctor
```
