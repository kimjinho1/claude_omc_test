# Deep Interview Spec: 팀 공유 Claude 설정

## Metadata
- Interview ID: shared-claude-config-20260316
- Rounds: 4
- Final Ambiguity Score: 16%
- Type: brownfield
- Generated: 2026-03-16
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| 차원 | 점수 | 가중치 | 기여 |
|------|------|--------|------|
| 목표 명확도 | 0.90 | 40% | 0.36 |
| 제약 명확도 | 0.80 | 30% | 0.24 |
| 성공 기준 | 0.80 | 30% | 0.24 |
| **총 명확도** | | | **0.84** |
| **모호도** | | | **16%** |

## Goal
팀 레포를 클론하면 **별도 설정 없이 즉시** 모든 팀원의 Claude가 동일하게 동작하도록, 공유 설정(CLAUDE.md 규칙 + 커밋 후 lint/format 훅)을 git으로 추적한다.

## Constraints
- `.claude/CLAUDE.md` — git 추적 (팀 공유 규칙)
- `.claude/settings.json` — git 추적 (공유 훅 설정)
- `.claude/settings.local.json` — git 제외 (개인 설정: 모델 선호도, API 키, 로컬 경로 등)
- `.omc/` — git 제외 (로컬 AI 상태 파일)
- 새 팀원이 onboarding 스크립트나 추가 설치 없이 바로 사용 가능해야 함

## Non-Goals
- 개인 API 키, 모델 선호도 등 개인 설정은 공유하지 않음
- Claude Code 자체 설치 자동화는 범위 외 (별도 onboarding 문서로 처리)

## Acceptance Criteria
- [ ] `git clone` 후 `.claude/CLAUDE.md`가 존재하고 팀 규칙이 적용됨
- [ ] `git clone` 후 `.claude/settings.json`이 존재하고 커밋 후 lint/format 훅이 동작함
- [ ] `.claude/settings.local.json`은 git에 추적되지 않음 (gitignore 확인)
- [ ] `.omc/`는 git에 추적되지 않음
- [ ] `git status`에서 `.claude/settings.local.json`이 나타나지 않음

## Implementation Plan

### 1. `.gitignore` 수정
`.claude/`를 통째로 무시하던 것을 변경:
```
# 기존 (제거)
.claude/

# 변경 후
.claude/settings.local.json
.omc/
```

### 2. `.claude/settings.json` 생성 (공유 훅)
커밋 후 lint/format을 자동 실행하는 훅 설정:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "# 커밋 완료 감지 후 lint/format 실행"
          }
        ]
      }
    ]
  }
}
```
> 실제 lint/format 명령어는 프로젝트 기술스택에 맞게 설정

### 3. `.claude/CLAUDE.md` git 추적
현재 `.gitignore`에서 제외되어 있으므로, 수정 후 커밋에 포함

### 4. README 업데이트
onboarding 섹션에 "Claude Code 사용 시 자동으로 팀 설정이 적용됩니다" 안내 추가

## Technical Context
- 현재 `.claude/CLAUDE.md`: OMC 설정 포함 (5020 bytes)
- 현재 `.claude/settings.local.json`: 로컬 전용 설정 존재
- 현재 `.gitignore`: `.claude/`와 `.omc/` 전체를 무시 중 → 수정 필요

## Interview Transcript
<details>
<summary>전체 Q&A (4 라운드)</summary>

### Round 1
**Q:** 공유하고 싶은 지침의 종류가 어떤 건가요?
**A:** CLAUDE.md 규칙, 훅(Hook) 자동화
**모호도:** 62%

### Round 2
**Q:** 훅 자동화에서 원하는 게 구체적으로 어떤 건가요?
**A:** 커밋 후 lint/format
**모호도:** 48%

### Round 3
**Q:** 신규 직원이 레포를 클론했을 때, 어떤 상태면 '성공'이라고 할 수 있어요?
**A:** Claude가 즉시 동일하게 동작
**모호도:** 30%

### Round 4 (Contrarian Mode)
**Q:** 개인 설정(API 키, 모델 선호도 등)은 어떻게 할까요?
**A:** git에서 완전 제외
**모호도:** 16% ✓

</details>
