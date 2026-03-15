<!-- OMC:START -->
<!-- OMC:VERSION:4.8.2 -->

# oh-my-claudecode - Intelligent Multi-Agent Orchestration

You are running with oh-my-claudecode (OMC), a multi-agent orchestration layer for Claude Code.
Coordinate specialized agents, tools, and skills so work is completed accurately and efficiently.

<operating_principles>
- Delegate specialized work to the most appropriate agent.
- Prefer evidence over assumptions: verify outcomes before final claims.
- Choose the lightest-weight path that preserves quality.
- Consult official docs before implementing with SDKs/frameworks/APIs.
</operating_principles>

<delegation_rules>
Delegate for: multi-file changes, refactors, debugging, reviews, planning, research, verification.
Work directly for: trivial ops, small clarifications, single commands.
Route code to `executor` (use `model=opus` for complex work). Uncertain SDK usage → `document-specialist` (repo docs first; Context Hub / `chub` when available, graceful web fallback otherwise).
</delegation_rules>

<model_routing>
`haiku` (quick lookups), `sonnet` (standard), `opus` (architecture, deep analysis).
Direct writes OK for: `~/.claude/**`, `.omc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`.
</model_routing>

<agent_catalog>
Prefix: `oh-my-claudecode:`. See `agents/*.md` for full prompts.

explore (haiku), analyst (opus), planner (opus), architect (opus), debugger (sonnet), executor (sonnet), verifier (sonnet), tracer (sonnet), security-reviewer (sonnet), code-reviewer (opus), test-engineer (sonnet), designer (sonnet), writer (haiku), qa-tester (sonnet), scientist (sonnet), document-specialist (sonnet), git-master (sonnet), code-simplifier (opus), critic (opus)
</agent_catalog>

<tools>
External AI: `/team N:executor "task"`, `omc team N:codex|gemini "..."`, `omc ask <claude|codex|gemini>`, `/ccg`
OMC State: `state_read`, `state_write`, `state_clear`, `state_list_active`, `state_get_status`
Teams: `TeamCreate`, `TeamDelete`, `SendMessage`, `TaskCreate`, `TaskList`, `TaskGet`, `TaskUpdate`
Notepad: `notepad_read`, `notepad_write_priority`, `notepad_write_working`, `notepad_write_manual`
Project Memory: `project_memory_read`, `project_memory_write`, `project_memory_add_note`, `project_memory_add_directive`
Code Intel: LSP (`lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics`, etc.), AST (`ast_grep_search`, `ast_grep_replace`), `python_repl`
</tools>

<skills>
Invoke via `/oh-my-claudecode:<name>`. Trigger patterns auto-detect keywords.

Workflow: `autopilot`, `ralph`, `ultrawork`, `team`, `ccg`, `ultraqa`, `omc-plan`, `ralplan`, `sciomc`, `external-context`, `deepinit`, `deep-interview`, `ai-slop-cleaner`
Keyword triggers: "autopilot"→autopilot, "ralph"→ralph, "ulw"→ultrawork, "ccg"→ccg, "ralplan"→ralplan, "deep interview"→deep-interview, "deslop"/"anti-slop"/cleanup+slop-smell→ai-slop-cleaner, "deep-analyze"→analysis mode, "tdd"→TDD mode, "deepsearch"→codebase search, "ultrathink"→deep reasoning, "cancelomc"→cancel. Team orchestration is explicit via `/team`.
Utilities: `ask-codex`, `ask-gemini`, `cancel`, `note`, `learner`, `omc-setup`, `mcp-setup`, `hud`, `omc-doctor`, `omc-help`, `trace`, `release`, `project-session-manager`, `skill`, `writer-memory`, `ralph-init`, `configure-notifications`, `learn-about-omc` (`trace` is the evidence-driven tracing lane)
</skills>

<team_pipeline>
Stages: `team-plan` → `team-prd` → `team-exec` → `team-verify` → `team-fix` (loop).
Fix loop bounded by max attempts. `team ralph` links both modes.
</team_pipeline>

<verification>
Verify before claiming completion. Size appropriately: small→haiku, standard→sonnet, large/security→opus.
If verification fails, keep iterating.
</verification>

<execution_protocols>
Broad requests: explore first, then plan. 2+ independent tasks in parallel. `run_in_background` for builds/tests.
Keep authoring and review as separate passes: writer pass creates or revises content, reviewer/verifier pass evaluates it later in a separate lane.
Never self-approve in the same active context; use `code-reviewer` or `verifier` for the approval pass.
Before concluding: zero pending tasks, tests passing, verifier evidence collected.
</execution_protocols>

<hooks_and_context>
Hooks inject `<system-reminder>` tags. Key patterns: `hook success: Success` (proceed), `[MAGIC KEYWORD: ...]` (invoke skill), `The boulder never stops` (ralph/ultrawork active).
Persistence: `<remember>` (7 days), `<remember priority>` (permanent).
Kill switches: `DISABLE_OMC`, `OMC_SKIP_HOOKS` (comma-separated).
</hooks_and_context>

<cancellation>
`/oh-my-claudecode:cancel` ends execution modes. Cancel when done+verified or blocked. Don't cancel if work incomplete.
</cancellation>

<worktree_paths>
State: `.omc/state/`, `.omc/state/sessions/{sessionId}/`, `.omc/notepad.md`, `.omc/project-memory.json`, `.omc/plans/`, `.omc/research/`, `.omc/logs/`
</worktree_paths>

## Setup

Say "setup omc" or run `/oh-my-claudecode:omc-setup`.

<!-- OMC:END -->

<!-- TEAM:START -->
## 팀 공통 규칙

<team_branch_strategy>
### 브랜치 전략
- `main` / `master`에 직접 커밋 금지 — 반드시 브랜치 생성 후 PR
- 브랜치 네이밍: `feature/`, `fix/`, `chore/`, `docs/`
- 예시: `feature/login`, `fix/null-pointer`, `docs/readme-update`
</team_branch_strategy>

<team_commit_convention>
### 커밋 메시지 (Conventional Commits)
형식: `<type>: <description>`

| type | 용도 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `chore` | 빌드/설정/패키지 |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |

예시: `feat: 사용자 로그인 기능 추가`
</team_commit_convention>

<team_pr_policy>
### PR 정책
- 작업 완료 시 반드시 PR 생성 (`gh pr create`)
- PR 제목은 커밋 메시지 형식 준수
- 본문에 포함 필수: Summary(변경 내용), Test plan(테스트 방법)
- 관련 이슈 있으면 본문에 `Closes #이슈번호` 추가
</team_pr_policy>

<team_test_policy>
### 테스트 정책
- 코드 변경 시 관련 테스트 실행 후 커밋
- 테스트 실패 상태로 PR 금지
</team_test_policy>

<team_security>
### 보안
- `.env`, API 키, 비밀번호, 토큰을 코드에 하드코딩 금지
- 민감한 값은 `.env` 또는 시크릿 매니저 사용
- `.env` 파일은 절대 git 커밋 금지 (`.gitignore` 확인)
</team_security>
<!-- TEAM:END -->

<!-- WORKFLOW:START -->
## 레드마인 개발 워크플로우

레드마인 일감 번호와 내용이 제공되면 아래 순서를 **반드시** 따른다.

<workflow_trigger>
### 트리거 조건
다음 중 하나에 해당하면 이 워크플로우를 시작한다:
- "레드마인 #숫자" 또는 "일감 #숫자" 형태의 입력
- 레드마인 티켓 내용이 붙여넣기된 경우
</workflow_trigger>

<workflow_step1_analysis>
### Step 1: 일감 분석
1. 제공된 내용을 분석하여 다음을 파악한다:
   - 문제/요구사항의 핵심
   - 영향받는 코드 영역
   - 네트워크 장비 연동 여부
2. 부족한 정보가 있으면 **명확히 목록화하여 요청**한다:
   - 연동 장비 매뉴얼 또는 명령어 정리 파일
   - 관련 코드 파일 경로
   - 기타 컨텍스트
3. 필요한 정보가 모두 갖춰질 때까지 Step 2로 넘어가지 않는다.
</workflow_step1_analysis>

<workflow_step2_planning>
### Step 2: 개발 기획서 작성
아래 형식으로 기획서를 작성하고 **사용자 피드백을 기다린다**:

```
## 개발 기획: 레드마인 #{번호}

### 문제 요약
{분석한 내용}

### 구현 방법
{접근 방식 설명}

### 예상 변경 파일
- {파일 경로}: {변경 내용}

### 테스트 전략
- 단위 테스트: {대상}
- 통합 테스트: {대상}
- 수동 테스트 필요: 네트워크 장비 연동 후 개발자 직접 확인

### 브랜치명
feature/redmine-{번호} 또는 fix/redmine-{번호}
```

피드백을 받은 후 수정하고, **"시작"** 또는 **"진행"** 승인을 받으면 Step 3으로 넘어간다.
</workflow_step2_planning>

<workflow_step3_development>
### Step 3: 개발 진행
1. 브랜치 생성: `git checkout -b feature/redmine-{번호}` (또는 fix/)
2. 개발 원칙:
   - **모든 구현 코드에 테스트 코드를 함께 작성**
   - 테스트 프레임워크 없으면 프로젝트 언어/스택에 맞게 제안 후 구축
   - 작은 단위로 나눠서 커밋 (기능 단위)
3. 각 커밋 전 **반드시 diff를 보여주고 승인을 받는다**:

```
📝 커밋 준비: {커밋 메시지}

변경 내용:
{git diff 요약}

커밋할까요? [승인/수정 요청]
```

승인받은 후에만 `git commit`을 실행한다.
</workflow_step3_development>

<workflow_step4_pr>
### Step 4: PR 생성
모든 커밋이 승인되면 PR을 생성한다:

```bash
gh pr create \
  --title "feat: 레드마인 #{번호} {제목}" \
  --body "## Summary
{변경 내용 요약}

## Redmine
레드마인 #{번호}

## Test plan
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 네트워크 장비 연동 후 개발자 직접 테스트 필요"
```
</workflow_step4_pr>

<workflow_notes>
### 주의사항
- 실제 장비 연동 테스트는 자동화 불가 — 개발자가 직접 수행
- 커밋 승인 없이 절대 `git commit` 실행 금지
- 기획 승인 없이 절대 개발 시작 금지
- 매뉴얼/명령어 파일은 필요할 때마다 요청, 미리 가정하지 않음
</workflow_notes>
<!-- WORKFLOW:END -->
