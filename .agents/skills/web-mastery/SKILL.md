---
name: web-mastery
description: Expert guidelines for editing, maintaining, and deploying web projects. Focuses on HTML/CSS consistency, UI/UX Pro Max integration, and production deployment safety. Use when editing the core website files.
---

# Web Mastery Skill

## When to use this skill
- Updating service pages (`llc-formation.html`, `bank-assistance.html`, etc.).
- Applying the "Liquid Glass" design system from UI/UX Pro Max.
- Deploying changes to the production environment.

## Workflow

- [ ] **Research**: Read `style.css` before any HTML changes to ensure class consistency.
- [ ] **Development**: Implement changes locally in the temporary scratch directory.
- [ ] **UI/UX Audit**: Ensure all clickable elements have `cursor-pointer` and smooth transitions.
- [ ] **Validation**: Run `grep` or a manual check for broken links and semantic HTML errors.
- [ ] **Deployment**: Use the `deploy_website` tool with a descriptive commit message.

## Instructions

### 1. CSS Standards
- Always use utility classes first.
- If creating new styles, use the `:root` variables defined in `style.css`.
- Avoid inline styles at all costs.

### 2. UI/UX Pro Max Integration
- Replace standard emojis with Lucide SVG icons.
- Ensure all sections have proper vertical padding (`padding: 80px 0`).
- Use the `glass-card` class for feature lists.

### 3. Deployment Safety
- Never deploy without a successful local build check.
- Commit messages MUST follow the format: `feat: [description]` or `fix: [description]`.

## Resources
- [Service Page Template](resources/service_page_template.html)
- [Icon Reference](resources/lucide_icons.md)
