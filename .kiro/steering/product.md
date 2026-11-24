---
inclusion: always
---

# GhostStack — Product Context

## Product

GhostStack is a local-first, card-based micro-app creator inspired by the creative philosophy of Apple's HyperCard. It is not intended to be a pixel-perfect HyperCard clone.

Users create a stack of cards, place visual elements on cards, define constrained behaviors, preview the result, and export a standalone application.

## Intended MVP Demonstration

One reusable editor/runtime foundation should demonstrate two different applications:

1. An interactive learning or branching-quiz experience.
2. A recipe collection or lightweight inventory application.

The goal is to prove that GhostStack is a reusable creation environment, not a one-off demo.

## Product Principles

- Local-first project ownership.
- Core editing and runtime features work without AI or internet.
- AI is optional and assists through structured, reviewable project changes.
- User approval is required before an AI-proposed batch mutates the active project.
- Visual behavior blocks and GhostScript edit the same canonical constrained JSON AST.
- Exported applications are independent of the GhostStack editor and AI providers.
- Prefer a coherent, polished end-to-end workflow over a large collection of unfinished features.

## Scope Discipline

Use `docs/PRD.md` as the authority for feature priority and acceptance criteria. Do not promote P1/P2 ideas into MVP scope without approval.

Do not invent user accounts, cloud sync, payments, arbitrary JavaScript execution, or AI requirements that are not in the approved PRD.

## Hackathon Context

GhostStack is being developed for Kiroween 2026. The project must demonstrate meaningful use of Kiro and retain the `.kiro/` directory at the repository root. The final repository must be public and include an open-source license selected by the project owner.
