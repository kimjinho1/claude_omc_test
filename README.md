# OMC TEST
## 1. 설치
```
/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
/plugin install oh-my-claudecode
/omc-setup # OMC 환경 설정
/omc-doctor #설치 완료 후 확인
```

## 2. 명령어
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

#### 1. `team` — 병렬 에이전트 오케스트레이션
여러 에이전트를 동시에 띄워서 작업을 병렬 처리한다.
```
/team 3:executor "fix all TypeScript errors"
```
> `3:executor` = executor 역할의 에이전트 3개를 생성


#### 2. `omc team` — 외부 AI CLI 워커 (codex / gemini / claude)
tmux 분할 창에서 외부 AI 모델을 워커로 띄운다.
```
omc team 2:codex "security review"
```

#### 3. `ccg` — Codex + Gemini 동시 실행
두 모델에게 한 번에 같은 작업을 맡긴다.
```
/ccg review this PR
```

#### 4. `autopilot` — 완전 자율 실행
지시만 하면 끝까지 알아서 처리한다. 개입 불필요.
```
autopilot: build a todo app
```

#### 5. `ralph` — 지속 모드 (완료될 때까지 반복)
architect가 검증 완료할 때까지 포기하지 않고 계속 돌린다.
```
ralph: refactor auth
```

#### 6. `ulw` — 최대 병렬화
에이전트를 최대한 많이 띄워서 가장 빠르게 처리한다.
```
ulw fix all errors
```

#### 7. `plan` — 계획 인터뷰
코드 작성 전에 인터뷰 방식으로 요구사항을 정리한다.
```
plan the API
```

#### 8. `ralplan` — 반복적 계획 합의
계획을 반복 수정하며 합의점을 찾는다.
```
ralplan this feature
```

#### 9. `deep-interview` — 소크라테스식 요구사항 명확화
막연한 아이디어를 질문으로 구체화한다. 실행 전 숨겨진 가정을 드러낸다.
```
deep-interview "vague idea"
```

## 3. 사용 예시 - OMC 워크플로우 패턴
#### 🚀 Full-Auto from PRD — PRD 기반 자동 빌드
**언제:** 요구사항 문서(PRD)가 있고, 처음부터 병렬로 전부 만들어야 할 때

```
/ralplan "review my PRD"        # Planner + Architect + Critic이 합의한 계획 수립
/teams N:executor "build app"   # Claude 에이전트 병렬 빌드
# Codex / Gemini 워커가 필요하면 /omc-teams 사용
/ralph                           # Architect 검증 완료까지 반복
```

#### ⚡ No-Brainer — 단순 작업
**언제:** 명확하고 간단한 작업, 계획 필요 없을 때

```
/autopilot "build a todo app"   # 바로 실행
/ultrawork "fix all lint errors" # 에이전트 분산 처리
/ralph "refactor auth module"    # 완료까지 반복
```

#### 🔧 Fix / Debugging — 버그 수정
**언제:** 뭔가 깨졌을 때, 안정적인 수정이 필요할 때
```
/plan        # 원인 분석 + 수정 전략 수립
/ralph       # 검증 통과할 때까지 수정 반복
/ultraqa     # E2E / 스모크 테스트 실행
```
> 복잡한 버그는 `/plan` 대신 `/ralplan` 먼저

#### 🧩 Parallel Issues — 여러 티켓 동시 처리
**언제:** 이슈/티켓이 여러 개, 동시에 처리해야 할 때
```
/omc-teams N:architect  # 아키텍트가 전체 계획 수립
/omc-teams N:executor   # 각 이슈를 별도 worktree에서 병렬 처리 → PR 제출
/ralplan                 # PR 머지 후 충돌 해소
/ralph + /ultrawork      # 전체 마무리
/ultraqa                 # 최종 테스트
```

## 4. 업데이트
```
/plugin marketplace update omc
/omc-setup
문제 발생 시 -> /omc-doctor
```

