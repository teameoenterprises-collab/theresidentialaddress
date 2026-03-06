---
name: creating-skills
description: Generates high-quality, predictable, and efficient .agent/skills/ directories based on user requirements. Use when building new automated workflows for agents.
---

# AntiGravity Skill Creator

## 1. Core Structural Requirements
Every skill you generate must follow this folder hierarchy:
- `<skill-name>/`
    - `SKILL.md` (Required: Main logic and instructions)
    - `scripts/` (Optional: Helper scripts)
    - `examples/` (Optional: Reference implementations)
    - `resources/` (Optional: Templates or assets)

## 2. YAML Frontmatter Standards
The `SKILL.md` must start with YAML frontmatter:
- **name**: Gerund form (e.g., `testing-code`). Max 64 chars. Lowercase, numbers, and hyphens only.
- **description**: Third person. Specifically mention triggers/keywords.

## 3. Writing Principles
- **Conciseness**: Focus only on unique logic.
- **Progressive Disclosure**: Keep under 500 lines. Link to secondary files if needed.
- **Degrees of Freedom**: 
    - Bullet Points: Heuristics
    - Code Blocks: Templates
    - Specific Bash: Low-freedom/Fragile ops

## 4. Workflow
1. **Checklists**: Copyable/updatable tracking.
2. **Validation**: Plan-Validate-Execute.
3. **Error Handling**: Instructions as black boxes (--help).

## 5. Implementation Workflow
Trigger a skill creation by saying: "Based on my skill creator instructions, build me a skill for [Task]."
