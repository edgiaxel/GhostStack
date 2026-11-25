
# Product Requirements Document — GhostStack

**Status:** Approved by Product Owner (Nov 15, 2026)  
**Hackathon:** Kiroween 2026 — Resurrection  
**Repository:** `https://github.com/edgiaxel/GhostStack`  
**Submission deadline:** December 4, 2026, 2:00 PM Pacific

## 1. Read This First

GhostStack is a modern, extensible reincarnation of the HyperCard concept: a tool for creating interactive applications from connected cards.

This revision establishes five product principles:

1. **Cards are the application.** Users create screens, content, interactions, and navigation within a connected card-based project.
2. **AI is an integrated collaborator, not a mandatory dependency.** Users can work manually, with visual behavior blocks, or with AI agents and models.
3. **Projects belong to the user.** Projects are stored locally and can be saved, imported, exported, and moved through a portable `.gsp` project format.
4. **Changes must be recoverable.** Autosave, undo/redo, and checkpoints protect both manual and AI-assisted editing.
5. **The product has two delivery targets.** A browser application is the first implementation target; a desktop application is a planned first-class platform.

This document distinguishes the long-term product direction from the hackathon MVP. The MVP must demonstrate a complete, coherent creation workflow rather than attempting to implement every planned integration and export target.

## 2. Product Overview

### 2.1 Product vision

GhostStack is a local-first, card-based application authoring environment inspired by Apple HyperCard.

It combines a visual editor, a controlled behavior runtime, project portability, and flexible AI integration. Users should be able to create useful interactive applications without needing to build a conventional frontend from scratch.

GhostStack takes inspiration from HyperCard's relationship between cards, shared content, navigation, and behavior. It does not aim to reproduce HyperCard's original interface or implementation limitations.

### 2.2 Problem statement

Creating small interactive applications often requires users to learn a conventional programming environment, manage application structure, and connect UI elements to behavior.

Existing visual tools can simplify creation but may constrain users to a particular platform, workflow, or abstraction. AI coding tools can generate functionality, but they do not necessarily provide a purpose-built visual environment in which users can inspect, edit, approve, and recover generated changes.

GhostStack aims to combine direct visual authoring with controlled, inspectable application behavior and optional AI assistance.

### 2.3 Product principles

- Local-first by default.
- Portable, inspectable project data.
- No mandatory account or cloud service.
- AI-provider and agent independence.
- Explicit user approval before AI changes are applied.
- Recoverable changes and interruption-safe editing.
- Responsive output rather than fixed-size applications.
- Extensible architecture without unrestricted execution of generated code.

### 2.4 Intended use cases

Examples include:

- Interactive stories and presentations.
- Educational experiences and quizzes.
- Digital catalogs and product showcases.
- Recipe collections.
- Simple inventory and information interfaces.
- Small interactive utilities and prototypes.

These are examples of potential applications, not separate product requirements.

## 3. Users and Actors

### ACT-001 — Stack Creator

Creates and edits GhostStack projects. Uses the visual editor, behavior tools, project management, preview, and export features.

### ACT-002 — Application User

Uses an application created with GhostStack. Does not need access to the authoring interface.

### ACT-003 — AI Agent or Assistant

An external agent or integrated AI provider that can inspect project context and propose or perform approved changes through GhostStack's controlled interfaces.

### ACT-004 — AI Model Provider

A local or hosted inference service used for AI-assisted authoring. Examples include Ollama, vLLM, OpenAI-compatible services, and hosted API providers.

### ACT-005 — MCP Client

An external AI agent or application that connects to GhostStack through its Model Context Protocol interface, subject to the tools and permissions GhostStack exposes.

## 4. Core User Journey

1. The creator opens GhostStack in a browser or desktop application.
2. The creator creates a new Stack or imports a `.gsp` project.
3. The creator creates Cards and arranges their content on a responsive canvas.
4. The creator adds elements such as text, buttons, inputs, images, shapes, and lines.
5. The creator configures behavior using visual blocks or the constrained code editor.
6. The creator optionally connects an AI provider or external agent.
7. The creator describes a desired change.
8. GhostStack prepares a proposed plan showing affected Cards, elements, properties, and connections.
9. The creator reviews, modifies, approves, or rejects the plan.
10. GhostStack applies the approved changes and displays progress.
11. The creator reviews the result, accepts it, or rolls back the operation.
12. The creator previews the application.
13. The creator saves or exports the project as a `.gsp` file and can export a standalone web application.

## 5. Scope and Priorities

### 5.1 P0 — Hackathon MVP

The P0 scope is the smallest coherent product that demonstrates GhostStack's core identity.

- Stack and Card management.
- Responsive freeform Card editor.
- Core visual elements.
- Basic element ordering and selection.
- Card navigation.
- Behavior runtime and application state.
- Visual behavior blocks.
- Constrained code-based behavior authoring.
- AI integration architecture with at least one working provider path.
- MCP server interface with a limited, controlled tool set.
- AI planning, approval, execution, and operation reporting.
- Basic AI operation rollback.
- Local autosave and recovery.
- Undo/redo.
- Basic local version checkpoints.
- `.gsp` project import/export.
- Asset packaging and missing-asset handling.
- Preview mode.
- Standalone web application export.
- Browser-based application.

### 5.2 P1 — Post-MVP / Extended Release

- Tauri 2 desktop application.
- Additional local and hosted AI provider adapters.
- More MCP tools and agent integrations.
- Configurable AI fallback chains.
- Richer project version history and restore interface.
- Shared backgrounds and reusable Card templates.
- Card relationship graph.
- Full dockable and customizable workspace panels.
- Dedicated layer panel with visibility, locking, and grouping.
- More advanced responsive layout controls.
- Device preview simulator.
- Expanded element and asset management.
- Improved export configuration.
- More complete AI context and project understanding.

### 5.3 P2 — Future Direction

- Native application packaging for user-created projects, including Windows and Linux targets.
- Advanced animation and timeline editing.
- Brush and drawing tools.
- Advanced reusable component systems.
- Additional project storage backends.
- Optional cloud synchronization.
- Collaboration and shared editing.
- More advanced data collections and integrations.
- Expanded provider ecosystem and agent capabilities.

### 5.4 Out of scope for the current MVP

- Mandatory user accounts or authentication.
- Mandatory cloud storage.
- Payments or subscriptions.
- Marketplace.
- Real-time multi-user collaboration.
- Arbitrary unrestricted JavaScript execution from AI-generated output.
- Full compatibility with HyperTalk.
- Replacing a conventional IDE.
- Native mobile authoring application.
- Enterprise database and permission management.

## 6. Feature Requirements

### F-001 — Stack Management

**Priority:** P0

Creators can create, open, rename, save, and delete Stacks.

Acceptance criteria:
- A creator can create a new Stack.
- A Stack has a name and project identity.
- A creator can reopen a saved Stack.
- A creator can delete a Stack after confirmation.
- Stack data is represented in the portable project format.

### F-002 — Card Management

**Priority:** P0

Creators can create, rename, duplicate, reorder, and delete Cards.

Acceptance criteria:
- A Stack can contain multiple Cards.
- A creator can select a Card from the navigation list.
- Card order is preserved after saving and reopening.
- Deleting a Card removes its incoming and outgoing navigation references safely.
- GhostStack informs the creator when deleting a Card affects existing navigation.

### F-003 — Responsive Card Editor

**Priority:** P0

A freeform visual canvas allows creators to place and manipulate elements.

Acceptance criteria:
- Elements can be added, selected, moved, and resized.
- The canvas supports zooming and panning.
- Element positions and dimensions can be configured.
- Layouts can adapt to different viewport sizes.
- The editor does not impose one fixed output dimension on every application.
- Basic element ordering is available.

### F-004 — Interactive Elements

**Priority:** P0

The initial editor supports:
- Text.
- Buttons.
- Input fields.
- Images.
- Basic geometric shapes.
- Lines.

Acceptance criteria:
- Elements can be added and edited through the editor.
- Elements expose relevant properties.
- Elements can be selected, moved, resized, and removed.
- Image assets are referenced through the project asset system.
- Missing assets do not crash the application.

### F-005 — Card Navigation

**Priority:** P0

Creators can connect Cards through navigation behavior.

Acceptance criteria:
- A button or supported interaction can navigate to another Card.
- Navigation references are stored in the project.
- Deleting a referenced Card automatically removes invalid navigation references after warning the creator.
- The application does not retain broken navigation links after deletion.

### F-006 — Behavior Runtime

**Priority:** P0

GhostStack executes application behavior through a controlled runtime and registered actions.

Acceptance criteria:
- Supported UI events can trigger behavior.
- Actions are resolved through an explicit registry.
- The runtime can navigate between Cards and update application state.
- Unsupported or invalid actions are rejected.
- Runtime errors are reported without silently corrupting the project.

### F-007 — Application State

**Priority:** P0

Applications can maintain state while they are running.

Acceptance criteria:
- Supported input elements can read and update state.
- State can be referenced by supported behavior actions.
- State is isolated between separate application instances.
- Exported applications maintain their own runtime data.

### F-008 — Conditional Behavior

**Priority:** P0

Creators can define basic conditions and branching behavior.

Acceptance criteria:
- Supported conditions can evaluate application state.
- Behavior can branch based on a condition.
- Invalid expressions are rejected before execution.
- Conditional behavior works consistently in preview and exported applications.

### F-009 — AI-Assisted Authoring

**Priority:** P0

GhostStack supports AI-assisted project creation and editing without requiring one specific provider.

The AI integration layer must be designed to accommodate:
- Local inference services, including Ollama and vLLM.
- OpenAI-compatible API endpoints.
- Hosted model providers, including services such as OpenAI, Groq, and OpenRouter.
- External AI agents and development environments through MCP.
- Additional providers through adapters rather than changes to the core editor.

Acceptance criteria:
- The creator can configure an AI connection.
- Provider configuration is separate from the core editor.
- GhostStack can provide relevant Stack, Card, and element context to an authorized AI operation.
- AI-generated changes are represented as structured proposals.
- AI cannot directly bypass the behavior runtime or modify arbitrary project files.
- The creator can inspect and approve or reject proposed changes.
- The system reports provider and execution errors clearly.

**MVP implementation boundary:** The architecture must be provider-agnostic, but the initial release only needs a limited number of working adapters. An OpenAI-compatible endpoint and a local Ollama-compatible endpoint are recommended initial targets. Additional services should not be claimed as supported until tested.

### F-010 — AI Planning and Execution

**Priority:** P0

AI-assisted operations use an explicit planning and execution workflow.

Acceptance criteria:
- The creator submits a natural-language change request.
- GhostStack produces a plan before changing the project.
- The plan identifies affected Cards, elements, properties, behavior, and connections where applicable.
- The creator can revise the request or reject the plan.
- Execution begins only after approval.
- The creator can observe execution progress.
- The creator can cancel an operation where cancellation is supported.
- A completed operation produces a summary of changes.
- An operation can be reverted to its pre-execution state.
- Partial failures do not leave the project in an inconsistent state.

### F-011 — AI Agent Integration through MCP

**Priority:** P0

GhostStack exposes a controlled MCP server interface so compatible external agents can work with projects.

Acceptance criteria:
- MCP clients can discover the tools GhostStack exposes.
- Tools support a limited set of project inspection and editing operations.
- Every tool validates its inputs.
- Mutating operations respect project permissions and approval requirements.
- Agents cannot bypass the runtime's action registry.
- MCP errors are reported clearly.
- The MCP interface is documented for future agent integrations.

The MVP should prioritize a small, safe tool set over an unrestricted interface.

### F-012 — AI Provider Fallback

**Priority:** P1

GhostStack can use a configured sequence of providers when the primary provider becomes unavailable or reaches a limit.

Acceptance criteria:
- The creator can configure provider priority.
- A provider failure is identified and reported.
- A fallback is attempted only when configured and permitted.
- The active provider is visible to the creator.
- Cloud/local privacy boundaries are respected.
- The creator can disable automatic fallback.

A fallback must not silently send project data to a cloud provider when the creator expected local-only processing.

### F-013 — Behavior Validation

**Priority:** P0

Behavior definitions and AI proposals are validated before execution.

Acceptance criteria:
- Unknown actions are rejected.
- Invalid parameters are rejected.
- Invalid Card references are detected.
- Unsupported expressions are rejected.
- Validation errors identify the affected behavior or element.
- Invalid AI proposals cannot be applied.

### F-014 — Preview Mode

**Priority:** P0

Creators can run their Stack as an application without editor controls.

Acceptance criteria:
- Preview executes the same behavior model used by export.
- Navigation and state work in preview.
- Preview can be exited without losing project edits.
- Runtime errors are visible to the creator.

### F-015 — Local Persistence and Autosave

**Priority:** P0

GhostStack saves project changes locally and recovers from interrupted sessions.

Acceptance criteria:
- Project changes are automatically persisted.
- The creator can see whether the project is saved or has pending changes.
- The application can recover from an interrupted session using the latest valid local state.
- Autosave does not require an account or cloud connection.
- The system avoids overwriting a valid project with a partially applied AI operation.

### F-016 — Undo and Redo

**Priority:** P0

Creators can undo and redo supported editing operations.

Acceptance criteria:
- Manual edits can be undone and redone.
- Supported AI operations are represented as recoverable transactions.
- Undoing an AI operation restores the pre-operation project state.
- Redo reapplies the operation when the required data remains available.
- Undo/redo does not corrupt project assets or references.

### F-017 — Project Version Checkpoints

**Priority:** P0 basic / P1 expanded

GhostStack creates recoverable local checkpoints.

Acceptance criteria:
- A checkpoint can be created before a significant AI operation.
- A creator can restore a previous checkpoint.
- Restoring a checkpoint does not silently overwrite the only copy of the current project.
- Richer history browsing and comparison are deferred to P1.

### F-018 — GSP Project Format

**Priority:** P0

GhostStack uses `.gsp` as its portable project file extension.

Acceptance criteria:
- A project can be exported as a `.gsp` file.
- A `.gsp` file can be imported into a new GhostStack session.
- Project data and referenced assets are included or reliably referenced.
- The format has a version identifier.
- Unsupported future or past versions produce a clear compatibility message.
- Import validation rejects malformed project files.
- Projects can be moved between supported browser and desktop implementations.

### F-019 — Asset Management and Recovery

**Priority:** P0

Project assets are managed independently from the editor UI.

Acceptance criteria:
- Image assets can be added to a project.
- Assets are included in `.gsp` export.
- Missing assets are detected.
- The creator can relink a missing asset.
- If an asset remains unavailable, the application displays a safe fallback such as a placeholder, blank area, or configured solid-color background.
- Missing assets do not crash the editor or exported application.

### F-020 — Standalone Web Export

**Priority:** P0

Creators can export a Stack as a standalone web application.

Acceptance criteria:
- The export includes the application runtime and required assets.
- The exported application can run independently of the GhostStack editor.
- Application state is isolated to the exported application.
- Exported applications do not require synchronization with the original project.
- Missing assets do not crash the application.
- Exported behavior follows the same validation and runtime rules as preview.

### F-021 — Desktop Authoring Application

**Priority:** P1

GhostStack will have a desktop application using Tauri 2, reusing the web editor where practical.

Acceptance criteria:
- The desktop application can open and edit `.gsp` projects.
- Local project access is available through explicit user-controlled file operations.
- Browser and desktop project behavior remains consistent.
- The desktop application can be packaged for supported operating systems.

### F-022 — Customizable Workspace

**Priority:** P1

The editor supports configurable panels and workspace arrangements.

Acceptance criteria:
- Panels can be shown or hidden.
- Supported panels can be resized and rearranged.
- Workspace changes can be preserved between sessions.
- The default workspace remains usable without customization.

### F-023 — Card Relationship Graph

**Priority:** P1

Creators can inspect connections between Cards in a graph view.

Acceptance criteria:
- Cards appear as nodes.
- Navigation relationships appear as connections.
- Selecting a node opens the corresponding Card.
- Broken relationships are highlighted.
- The graph complements rather than replaces the Card navigation list.

### F-024 — Shared Backgrounds and Reusable Templates

**Priority:** P1

Creators can reuse background layouts or templates across Cards.

Acceptance criteria:
- A reusable background can be created.
- A background can be applied to multiple Cards.
- Editing a shared background has clearly defined effects on Cards using it.
- A creator can detach a Card from a shared background.

### F-025 — Layer Management

**Priority:** P1

A dedicated layer panel provides richer control over overlapping elements.

Acceptance criteria:
- Elements can be reordered.
- Layers can be hidden or locked.
- Supported elements can be grouped.
- Layer operations do not change behavior references unexpectedly.

### F-026 — Responsive Device Preview

**Priority:** P1

Creators can inspect application layouts at common viewport sizes.

Acceptance criteria:
- The creator can select a viewport preset.
- The preview reflects responsive layout behavior.
- The editor's own canvas controls remain separate from the application's responsive output.

## 7. Functional Requirements

- **FR-001:** A Stack contains Cards and project-level metadata.
- **FR-002:** Cards contain visual elements and behavior definitions.
- **FR-003:** Elements have configurable position, dimensions, appearance, and supported behavior.
- **FR-004:** Card navigation references must be validated.
- **FR-005:** Behavior execution uses registered actions and validated inputs.
- **FR-006:** Application state is isolated per running application instance.
- **FR-007:** AI proposals use a structured, versioned schema.
- **FR-008:** AI operations require approval before mutation.
- **FR-009:** AI operations are transactional and recoverable.
- **FR-010:** Provider integrations use a common adapter contract.
- **FR-011:** MCP tools expose only explicitly supported project operations.
- **FR-012:** Projects can be serialized into and restored from `.gsp`.
- **FR-013:** Assets are tracked and validated as project resources.
- **FR-014:** Preview and export use consistent runtime behavior.
- **FR-015:** Local autosave and recovery work without cloud connectivity.
- **FR-016:** Undo/redo and checkpoints preserve valid project state.
- **FR-017:** Exported applications own their runtime data and do not synchronize with the authoring project by default.

## 8. Quality Requirements

### Security

- Never execute arbitrary AI-generated JavaScript directly.
- Use a validated behavior schema and explicit action registry.
- Validate all project imports and MCP tool inputs.
- Restrict filesystem access to user-approved project locations.
- Keep API credentials out of project files and exported applications.
- Do not expose provider secrets to MCP clients or generated applications.
- Require explicit permission for operations that cross the local/cloud privacy boundary.

### Reliability

- Autosave must preserve the last valid project state.
- AI operations must use transactional changes or recoverable checkpoints.
- Partial failures must not corrupt the project.
- Missing assets must degrade gracefully.
- Import/export must validate data before replacing an existing project.

### Usability

- The default editor should remain understandable to new creators.
- Advanced functionality should be discoverable without overwhelming the canvas.
- AI plans must be readable and inspectable.
- The creator must understand which provider or agent is active.
- Workspace customization must not be required for ordinary editing.

### Compatibility

- The initial implementation targets modern desktop browsers.
- The architecture must allow a Tauri 2 desktop shell.
- The `.gsp` format must be independent of the editor's presentation layer.
- Exported applications must adapt to different viewport dimensions.

### Performance

- Basic editing should remain responsive during autosave.
- AI operations must not block ordinary editor navigation unnecessarily.
- Large or slow AI operations should expose progress and cancellation where supported.
- Project loading and export should provide feedback for larger projects.

## 9. Integrations and AI

### 9.1 Integration architecture

GhostStack must separate its editor, project model, runtime, AI provider adapters, and MCP interface.

The AI integration layer should not assume that all integrations behave identically.

**Provider adapters** handle model inference requests. Examples:
- Ollama-compatible local inference.
- vLLM or other OpenAI-compatible local endpoints.
- Hosted API providers.
- OpenRouter or other routing services.

**Agent integration** allows external agents to inspect and manipulate GhostStack through controlled interfaces. MCP is the primary planned interoperability mechanism.

**MCP server** exposes approved GhostStack tools to external MCP clients. It is not itself an inference provider.

### 9.2 AI operation lifecycle

1. Receive the user's request.
2. Gather permitted project context.
3. Generate a structured plan.
4. Validate the plan.
5. Display affected Cards, elements, behavior, and connections.
6. Allow revision, approval, or rejection.
7. Create a recovery checkpoint.
8. Execute the approved operations.
9. Validate the resulting project.
10. Commit the operation or roll it back.
11. Present a summary report.

### 9.3 Provider fallback policy

The long-term product supports configurable provider fallback.

Fallback order is determined by user configuration. A failure can include unavailable services, rate limits, exhausted quotas, or connection failures.

Fallback must:
- Respect the user's privacy configuration.
- Never silently transfer local project context to a cloud provider.
- Identify the active provider.
- Report why fallback occurred.
- Allow the creator to disable fallback.

### 9.4 AI security boundary

AI models and external agents propose changes. GhostStack validates and applies changes through its own controlled interfaces.

AI-generated behavior must not bypass the runtime action registry. Credentials must be stored separately from `.gsp` project data.

## 10. Project Format and Storage

### 10.1 GSP

`.gsp` is the proposed GhostStack Project extension.

The format should contain:
- Project metadata and format version.
- Stack and Card definitions.
- Element properties and layout information.
- Behavior definitions.
- Navigation references.
- Asset references and packaged assets.
- Relevant project-level settings.

The exact archive/container implementation is an architecture decision for Part 3.

### 10.2 Local persistence

- Browser implementation uses browser-accessible local persistence.
- Desktop implementation uses user-controlled local project files.
- `.gsp` is the interchange format across both targets.
- Cloud synchronization is not part of the MVP.

### 10.3 Exported application data

Exported applications maintain their own runtime state. They do not synchronize with the original authoring project by default. Login, cloud persistence, and cross-device synchronization are outside the MVP.

## 11. Constraints and Dependencies

- Kiro is the primary implementation environment.
- Antigravity IDE and Greg may be used as secondary development support.
- Kiro credits are reserved for implementation, not planning.
- The public GitHub repository must include `.kiro/` at its root.
- The repository must include an open-source license, source, assets, and instructions.
- The project must be newly built during the Kiroween submission period.
- The submission requires a working application URL, English project description, and public YouTube demo video under three minutes.
- The final project must include a clear explanation of how Kiro was used.
- The hackathon deadline is December 4, 2026, at 2:00 PM Pacific.

## 12. Definition of Done

The hackathon MVP is considered complete when a creator can:

1. Open GhostStack in a modern desktop browser.
2. Create a Stack and multiple Cards.
3. Add and arrange supported visual elements.
4. Define basic interactions through visual blocks and supported code-based behavior.
5. Connect an AI provider and use AI to propose a project change.
6. Review and approve an AI plan before execution.
7. Inspect the operation report and revert the operation.
8. Undo and redo supported edits.
9. Recover a locally saved project.
10. Export and re-import a `.gsp` project.
11. Preview the application.
12. Export a standalone web application that runs independently.

The MVP must also demonstrate a working MCP integration path with a limited, documented set of tools.

## 13. Assumptions, Risks, and Open Questions

### Assumptions

- GhostStack is primarily a desktop-oriented authoring environment, even when running in a browser.
- Local-first behavior is preferred over mandatory cloud services.
- Users may bring their own AI provider or agent.
- The first exported application target is the web.
- Tauri 2 is the preferred desktop shell.
- `.gsp` is the project extension.

### Risks

- Provider and agent interoperability can expand scope rapidly.
- MCP security and permission design require careful boundaries.
- A full AI planning and rollback workflow is more complex than a simple prompt-to-code feature.
- A flexible responsive canvas is more complex than a fixed-size card editor.
- Desktop packaging and browser compatibility can consume time better spent on the core editor.
- Supporting too many element types can delay the complete creation workflow.

### Open questions

- OQ-001: What exact schema and archive format should `.gsp` use?
- OQ-002: Which provider adapters will be implemented in the MVP?
- OQ-003: Which MCP tools are essential for the first external-agent workflow?
- OQ-004: What is the exact behavior DSL or constrained code syntax?
- OQ-005: Which browser storage mechanism best supports the project size and recovery requirements?
- OQ-006: What is the minimum viable responsive layout model?
- OQ-007: What is the exact structure of the AI operation transaction and rollback mechanism?
- OQ-008: Which asset types beyond images should be supported initially?
- OQ-009: What is the minimum desktop packaging target for the first Tauri release?


### Finalized Technical Decisions

The following decisions resolve OQ-001 through OQ-009:

| ID | Final decision |
|---|---|
| OQ-001 | `.gsp` uses a versioned ZIP archive containing `manifest.json`, `stack.json`, individual Card JSON files, and binary assets. |
| OQ-002 | P0 supports an OpenAI-compatible HTTP adapter, an Ollama adapter, and a deterministic offline demo adapter. |
| OQ-003 | P0 MCP tools: `get_stack_summary`, `get_card_details`, `list_registered_actions`, `propose_stack_patch`, `validate_project`, and `create_checkpoint`. |
| OQ-004 | Behaviors use a canonical JSON AST, editable through Visual Blocks and constrained GhostScript syntax. Arbitrary JavaScript execution is prohibited. |
| OQ-005 | Browser persistence uses IndexedDB; localStorage is reserved for UI preferences. |
| OQ-006 | Responsive layouts use reference-frame coordinates, configurable dimensions, anchoring, and scaling rules. The default 1280 × 720 frame is not a fixed output size. |
| OQ-007 | AI operations use immutable pre-execution snapshots, grouped patch commands, validation, atomic commit, and rollback. |
| OQ-008 | P0 supports image and audio assets. Video, custom fonts, and advanced vector paths are deferred. |
| OQ-009 | Tauri 2 is the selected P1 desktop framework, targeting Windows x64 and Linux x64 first. |

### AI Feasibility and Independence

AI integration is a high-risk capability and must be validated independently before full implementation.

GhostStack must remain fully usable without an AI provider, API key, MCP client, or network connection.

The AI subsystem is an optional capability. Its failure must never prevent users from creating, editing, saving, previewing, importing, or exporting applications.

Before implementing the complete AI subsystem, conduct a focused feasibility prototype to validate:

- OpenAI-compatible API communication.
- Local Ollama inference.
- MCP communication with an external agent.
- Structured AI plans and project patches.
- Approval and execution workflow.
- Checkpoint creation and rollback.
- Offline demonstration through the deterministic demo adapter.

The architecture must accommodate additional providers and agents through adapters, but the MVP only claims support for integrations that have been tested.

### AI Operation Safety

AI modifications must be treated as transactions:

1. Generate a structured plan.
2. Validate the proposed operations.
3. Obtain user approval.
4. Persist a recovery checkpoint.
5. Execute against an isolated project copy.
6. Validate the resulting project.
7. Commit atomically or discard the failed changes.
8. Record the operation and provide a rollback option.

Cloud fallback must respect explicit user privacy settings and must never silently transmit local project data to an external service.


## 14. Decision Log

- **D-001:** GhostStack is a modern card-based application authoring environment inspired by HyperCard.
- **D-002:** HyperCard's functional concepts are inspiration; its original UI will not be copied.
- **D-003:** The product is local-first and does not require accounts or cloud storage.
- **D-004:** The AI integration layer must be provider- and agent-agnostic.
- **D-005:** MCP is the planned interoperability mechanism for external AI agents.
- **D-006:** AI edits follow a plan, approval, execution, report, and rollback lifecycle.
- **D-007:** The `.gsp` extension is the portable GhostStack project format.
- **D-008:** Local autosave, undo/redo, and basic checkpoints are P0.
- **D-009:** Browser is the first implementation target; Tauri 2 desktop is a planned first-class target.
- **D-010:** The editor uses a responsive freeform canvas.
- **D-011:** Visual blocks and constrained code-based behavior authoring are both product requirements.
- **D-012:** Exported applications are standalone web applications with independent runtime data.
- **D-013:** Shared backgrounds, full layer management, and the Card relationship graph are P1.
- **D-014:** GhostStack's default visual theme is Halloween-inspired, with light and dark themes also available.
- **D-015:** Native packaging of user-created applications is a later-stage capability.

## 15. Related Documents

- `DESIGN.md` — User interface and interaction design.
- `ARCHITECTURE.md` — System architecture and component boundaries.
- `MILESTONE.md` — Development milestones and delivery plan.
