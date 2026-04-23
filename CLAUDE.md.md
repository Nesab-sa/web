Always use /model opusplan first for planning to reduce fast quota burn, then execute efficiently and conservatively.

You are working inside Claude Cowork on the Nesab ecosystem. Treat this as a production financial AI project inside a real published product, not a demo, not a toy, and not a greenfield rebuild.

Core operating rules:
1. Preserve existing systems first.
2. Never replace the old AI directly unless explicitly instructed.
3. Build the new AI in parallel first.
4. Prefer minimal safe changes.
5. Reuse what already exists before proposing rewrites.
6. Ask before deleting, replacing, publishing, or breaking current flows.
7. If unclear, ask one short direct question only.
8. Be concise and execution-focused.
9. If making changes, list touched files first.
10. If there is security, production, financial, or deployment risk, stop and ask before proceeding.

Project identity:
- Product name: Nesab
- This is a real live application with AI already visible inside the product.
- The AI is already integrated into the application UI, but the current AI architecture was originally built separately for security reasons and then embedded into the pages/app rather than deeply merged into the application core.
- The goal is to upgrade Nesab AI into a very strong production-grade financial assistant inside Nesab, with high-quality answers, strong context handling, and safe structured tool usage.
- Important: build on top of the current system. Do not restart from scratch unless explicitly requested.

Primary project paths on Windows desktop:

1) App project
Path:
C:\Users\Admin\OneDrive\Desktop\Desktop-app
GitHub:
https://github.com/Nesab-sa/app
Netlify:
https://app.netlify.com/projects/nesab-app/overview

2) Web project
Path:
C:\Users\Admin\OneDrive\Desktop\Desktop-web
GitHub:
https://github.com/Nesab-sa/web
Netlify:
https://app.netlify.com/projects/nesab-web/overview

Website / domain details:
- Main website: www.nesab.sa
- Main branded domain exists.
- Hosting/domain provider includes Sahara / cPanel.
- cPanel:
  https://sl31.sahara.net.sa:2083/

AI-related local items:
- AI files/folders are inside:
  C:\Users\Admin\OneDrive\Desktop\Desktop-app
- Old AI file:
  nesab-ai (JavaScript)
- New AI project:
  Nesab.Ai

OpenAI details:
- OpenAI platform:
  https://platform.openai.com/home
- Assistant name in OpenAI:
  Nesab Ai

Current technical understanding:
- The application appears to use Flutter Web on the frontend.
- Firebase Hosting is in use.
- Firebase Authentication is in use.
- Firestore and/or realtime Firebase channels are in use.
- There is an internal admin/settings area for AI configuration.
- A Claude API Key field appeared in the internal AI settings, which suggests the system is already designed to support configurable AI providers or key management.

Important architecture reality:
- The current AI is not directly connected to the live app through an exposed frontend API key.
- This separation is intentional for security reasons.
- Never place provider API keys in frontend code, Flutter Web code, JavaScript bundles, or public config files.
- All AI provider keys must remain server-side only.

Current backend/API discovery:
- A working backend endpoint already exists on the Nesab domain:
  https://api.nesab.sa/tools/calc.php
- It returned:
  {
    "total_deductions":0,
    "deduction_ratio":0,
    "remaining_salary":0,
    "status":"within_limit"
  }
- This confirms there is already a working backend PHP tool on the Nesab API subdomain.
- Treat calc.php and similar financial calculators as existing backend business tools that should be reused, not rewritten without reason.

Strategic objective:
- Upgrade Nesab AI inside the real product.
- Build on the current app, current pages, current AI placement, and current calculators.
- Reuse existing financial calculators such as calc.php as tools.
- Improve model quality, reasoning quality, structured outputs, and tool orchestration.
- Keep security strong and keys isolated server-side.
- Move fast, but do not destabilize production.

Preferred implementation direction:
- Keep current frontend/app structure.
- Route AI requests through a secure backend path on Nesab domain.
- Preferred AI/API domain path currently being prepared:
  https://api.nesab.sa/chat
- Prefer a backend-mediated architecture:
  App/UI -> Nesab backend API -> AI provider + internal calculator tools -> structured response back to app
- Use existing PHP backend endpoints where practical instead of rebuilding everything in a new stack.
- Reuse calc.php and related calculators as tools callable by the AI layer.
- If a better route is needed, propose it incrementally, not as a full rewrite.

Execution priorities:
1. Inspect the existing AI integration in Desktop-app first.
2. Identify how old AI is currently injected or called.
3. Preserve old AI behavior while building the new path.
4. Identify all reusable calculator endpoints/files.
5. Build the new AI path around existing backend tools.
6. Keep outputs structured and easy to consume by the app.
7. Prefer secure backend orchestration over frontend intelligence.
8. Favor the fastest safe path to launch.

Tooling and integration guidance:
- If AI provider integration is needed, prefer production-grade provider usage through backend only.
- Design AI responses to support structured JSON where needed.
- Treat finance calculators as deterministic backend tools and the model as orchestration + explanation.
- The model should explain and coordinate; the backend should calculate.
- Never move financial business logic into the frontend if a backend calculator already exists.

Migration rules:
- Do not replace the old AI before the new AI path is tested.
- Run old and new in parallel when possible.
- Prefer additive rollout, internal testing, and staged replacement.
- If proposing changes to production routing, clearly separate:
  - current behavior
  - proposed behavior
  - rollback path

Working style:
- Start with inspection and mapping before edits.
- Use the local folders as the source of truth first.
- Cross-check with GitHub only when needed.
- Do not assume undocumented architecture.
- If uncertain, inspect files before making claims.

Output style:
- No fluff.
- No unnecessary explanation.
- State exactly what you are doing.
- Show concrete next steps.
- If editing files, list touched files first.
- If blocked, ask one short direct question only.

Definition of success:
- A strong production-grade Nesab AI built on existing infrastructure.
- Secure server-side AI integration.
- Reuse of existing calculator backend tools like calc.php.
- No exposed keys.
- No unnecessary rebuild.
- Faster path to launch with professional architecture.