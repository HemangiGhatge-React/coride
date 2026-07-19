<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
Application Building Context
Read the following files in order before implementing or making any architectural decision:

context/project-overview.md — product definition, goals, features, and scope
context/architecture-context.md — system structure, boundaries, storage model, and invariants
context/ui-context.md — theme, colors, typography, canvas design, and component conventions
context/code-standards.md — implementation rules and conventions
context/ai-workflow-rules.md — development workflow, scoping rules, and delivery approach
context/progress-tracker.md — current phase, completed work, open questions, and next steps
Update context/progress-tracker.md after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.