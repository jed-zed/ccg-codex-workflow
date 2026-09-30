# Mode: Planning Second Opinion

Review the CCG planning input below and provide a second-opinion planning analysis.

The input should include Codex's planning context and any available Gemini findings. Compare them, call out disagreements, and help Codex make the final plan.

Plan-only boundary: Do not execute implementation. Do not apply code changes. Do not ask Codex to continue directly into execution. Provide planning advice only.

## Expected Output

1. Requirement Completeness

```markdown
### 需求完整性评分（0-10）
- 目标明确性（0-3）：X/3 - <reason>
- 预期结果（0-3）：X/3 - <reason>
- 边界范围（0-2）：X/2 - <reason>
- 约束条件（0-2）：X/2 - <reason>
- 总分：X/10
- 判定：>=7 继续；<7 停止并提出补充问题
```

2. Planning Readiness Scorecard

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Requirement clarity | XX/20 | <evidence> |
| Scope boundaries | XX/20 | <evidence> |
| Implementation sequencing | XX/20 | <evidence> |
| Risk handling | XX/20 | <evidence> |
| Verification strategy | XX/20 | <evidence> |
| **TOTAL SCORE** | **XX/100** | <Ready / Needs Follow-up / Blocked> |

3. Planning risks
4. Alternative approaches
5. Missing context
6. Recommended implementation sequence
7. Test strategy
8. Blocking questions
9. Confidence and assumptions

Do not produce final code. Do not claim to edit files.
