
# Product Design Document — GhostStack

**Status:** Approved by Product Owner (Nov 15, 2026)  
**Related document:** `PRD.md`

## 1. Design Overview

GhostStack is a modern visual application editor inspired by the functional philosophy of HyperCard.

The interface should feel like a contemporary creative workstation: minimal, customizable, and capable of supporting increasingly complex projects without making the default workflow intimidating.

The design should not imitate HyperCard's original interface. It should preserve the useful concepts of Cards, shared content, navigation, and behavior while using modern interaction patterns.

### Design principles

- The Card canvas is the primary workspace.
- Panels are contextual and customizable.
- Important tools remain discoverable.
- Complex functionality should be progressively disclosed.
- AI operations must be visible and inspectable.
- The interface should remain usable without AI.
- The project should feel like an editor, not a chat application.
- The application being authored must remain visually distinct from the editor itself.

## 2. Navigation and Information Architecture

### Primary application areas

1. **Project Library** — Create, open, import, and manage projects.
2. **Workspace** — Edit the active Stack.
3. **Card Editor** — Arrange elements and define Card content.
4. **Behavior Editor** — Configure visual blocks or supported code-based behavior.
5. **AI Assistant** — Plan and execute project changes.
6. **Preview** — Run the application.
7. **Project History** — Recover previous states.
8. **Export** — Export `.gsp` projects and standalone web applications.
9. **Settings** — Manage themes, providers, agent connections, and workspace preferences.

### Workspace structure

The default workspace uses:

- A top toolbar for project and workspace actions.
- A left panel for Card navigation and element tools.
- A central canvas for the selected Card.
- A right-side contextual inspector.
- An optional bottom panel for logs, validation, and operation reports.

This is the default arrangement, not a permanent fixed layout.

## 3. Screen Inventory

| ID | Screen | Priority | Purpose |
|---|---|---|---|
| UI-01 | Project Library | P0 | Create, open, import, and manage projects |
| UI-02 | Stack Workspace | P0 | Navigate and manage Cards |
| UI-03 | Card Editor | P0 | Arrange and edit visual elements |
| UI-04 | Inspector and Behavior Editor | P0 | Edit element properties and behavior |
| UI-05 | AI Assistant and Operation Review | P0 | Plan, approve, execute, and revert AI operations |
| UI-06 | Preview Mode | P0 | Run the authored application |
| UI-07 | Project Import/Export | P0 | Manage `.gsp` files and web exports |
| UI-08 | Project History | P0 basic | Undo, redo, and restore checkpoints |
| UI-09 | Settings and Integrations | P0 basic | Configure themes and AI connections |
| UI-10 | Card Relationship Graph | P1 | Inspect navigation relationships |
| UI-11 | Workspace Customization | P1 | Arrange dockable panels |
| UI-12 | Device Preview | P1 | Test responsive layouts |
| UI-13 | Layer Panel | P1 | Manage element order and grouping |

## 4. Screen Specifications

### UI-01 — Project Library

Purpose: Provide a clear entry point to GhostStack projects.

Primary actions:
- Create project.
- Open recent project.
- Import `.gsp`.
- Export project.
- Rename project.
- Delete project.

States:
- Empty library.
- Existing projects.
- Import in progress.
- Invalid project file.
- Unsupported project version.
- Project recovery available.

Design notes:
- Keep project actions visible.
- Display project name and recent modification information.
- Do not require an account.
- Browser and desktop implementations should share the same project concepts.

### UI-02 — Stack Workspace

Purpose: Manage Cards and move through the project.

Primary elements:
- Card navigation list.
- Add Card.
- Rename Card.
- Duplicate Card.
- Delete Card.
- Reorder Cards.
- Switch to relationship graph when available.
- Preview and export actions.

Deletion behavior:
- When a Card is referenced by other Cards, show a warning identifying affected navigation references.
- After confirmation, remove references to the deleted Card.
- Do not leave invalid navigation targets.
- The creator can undo the deletion.

### UI-03 — Card Editor

Purpose: Provide the primary visual authoring environment.

Layout:
- Central responsive canvas.
- Element toolbox.
- Selection and transformation controls.
- Zoom and pan.
- Optional alignment and snapping controls.
- Contextual inspector.

Canvas behavior:
- Freeform element placement.
- Drag and resize.
- Select multiple elements where supported.
- Reorder overlapping elements.
- Support responsive layout constraints.
- Allow the author to inspect different viewport sizes in a later device-preview feature.

The editor canvas is not a fixed output resolution. It is an authoring surface for content that must adapt to its runtime viewport.

### UI-04 — Inspector and Behavior Editor

Purpose: Configure selected element properties and behavior.

Inspector sections:
- Properties.
- Appearance.
- Layout.
- Behavior.
- Asset reference.
- Advanced settings.

Behavior authoring modes:

**Visual block mode**
- Assemble supported actions and conditions.
- Configure parameters through controls.
- Connect supported blocks into a behavior flow.
- Validate the result.

**Code mode**
- Provide a constrained code-based editing surface.
- Expose supported runtime APIs and events.
- Validate code before it can run.
- Do not permit arbitrary AI-generated JavaScript to execute outside the controlled runtime.

The creator can switch between modes where a behavior can be represented in both forms.

### UI-05 — AI Assistant and Operation Review

Purpose: Let users work with AI without surrendering control of the project.

The AI experience should be integrated into the editor, not treated as a separate chatbot product.

#### Planning stage

The creator enters a natural-language request.

GhostStack displays a proposed plan containing:
- Summary of intended changes.
- Cards affected.
- Elements to add, modify, or remove.
- Properties to change.
- Behaviors to create or modify.
- Navigation connections to add or remove.
- Required assets or dependencies.
- Validation warnings.

The creator can:
- Approve the plan.
- Reject the plan.
- Revise the request.
- Ask for a revised plan.

#### Execution stage

After approval:
- Create a recoverable checkpoint.
- Display execution progress.
- Show completed and pending operations.
- Surface validation errors.
- Allow cancellation when supported.

The editor should reflect successful changes as they are committed. It must not display uncommitted partial state as if it were final.

#### Completion stage

Display a summary report:
- What changed.
- Which Cards and elements were affected.
- Which behaviors or connections were added or changed.
- Which operations failed or were skipped.
- Which provider or agent performed the operation.
- Whether the operation was fully committed.

Actions:
- Keep changes.
- Revert the entire operation.
- Inspect individual changes where supported.
- Continue with another request.

#### Provider and agent status

The UI should make the active connection visible:
- Provider or agent name.
- Local or hosted status.
- Connection state.
- Fallback status.
- Relevant error or quota information where available.

Cloud fallback must be clearly disclosed and must follow the creator's privacy settings.

### UI-06 — Preview Mode

Purpose: Run the Stack as an application.

Design:
- Remove editor-only controls.
- Display the authored application.
- Preserve Card navigation and runtime state.
- Provide a clear way to exit preview.
- Surface runtime errors without corrupting the project.

Preview should use the same runtime behavior as exported applications.

### UI-07 — Project Import/Export

Purpose: Manage project portability and application distribution.

Project operations:
- Export `.gsp`.
- Import `.gsp`.
- Validate project format.
- Package required assets.
- Display import/export progress.
- Report missing or invalid assets.

Application export:
- Generate a standalone web application.
- Include runtime resources and required assets.
- Keep exported application data independent from the authoring project.
- Provide a clear output location.

Native application packaging is not part of the initial export workflow.

### UI-08 — Project History

Purpose: Protect work and provide recovery.

P0 controls:
- Undo.
- Redo.
- Create checkpoint.
- Restore checkpoint.
- Indicate recoverable state after interruption.

P1 improvements:
- Browse named history entries.
- Compare changes.
- Inspect AI operation history.
- Restore selected changes where supported.

AI operations should be identifiable as grouped changes rather than appearing as dozens of unrelated individual edits.

### UI-09 — Settings and Integrations

Purpose: Configure application preferences and external services.

Sections:
- Appearance.
- Theme.
- AI providers.
- MCP and agent connections.
- Privacy and fallback preferences.
- Workspace preferences.
- Project defaults.

AI provider configuration should support:
- Provider type.
- Endpoint or service configuration.
- Model selection where applicable.
- Credential entry where required.
- Connection testing.
- Local/hosted classification.

Credentials must not be stored in exported projects.

## 5. Workspace Customization

GhostStack should use a dockable-panel model inspired by creative applications such as Photoshop.

Planned capabilities:
- Resize panels.
- Rearrange supported panels.
- Dock panels to workspace edges.
- Toggle panels on and off.
- Restore the default workspace.
- Save workspace arrangements.

The default layout should work well without customization. Advanced docking behavior is P1 so it does not delay the core editor.

## 6. Card Relationships and Navigation Visualization

The Card relationship graph is a separate view from the normal Card list.

Design direction:
- Cards are represented as nodes.
- Navigation actions are represented as directed connections.
- Selecting a node opens the Card.
- Selecting a connection reveals the behavior that created it.
- Invalid references are visually identifiable.

This should resemble a readable node relationship or blueprint view rather than a database administration screen.

The graph is P1. The Card list remains the default navigation method.

## 7. Element Layout, Layers, and Backgrounds

### Element layout

Use a responsive freeform canvas.

Creators should be able to position elements freely while configuring layout behavior for different viewport sizes.

The authoring model should distinguish:
- Element position.
- Element dimensions.
- Alignment.
- Anchoring or constraints.
- Responsive behavior.

### Layers

P0:
- Basic z-order.
- Bring forward.
- Send backward.
- Select overlapping elements.

P1:
- Dedicated layer panel.
- Hide/show.
- Lock/unlock.
- Group/ungroup.
- Improved hierarchy management.

### Background editing

Recommendation: use a reusable background/template system rather than copying HyperCard's original background interface.

P1 design:
- A Card can use its own background or a shared background.
- Shared backgrounds can be reused across Cards.
- Background editing is performed through a dedicated background context.
- The creator can detach a Card from a shared background.

## 8. Visual Elements and Assets

P0 elements:
- Text.
- Buttons.
- Input fields.
- Images.
- Geometric shapes.
- Lines.

P1:
- More advanced shape properties.
- Grouped elements.
- Richer asset management.
- Expanded layout controls.

P2:
- Brush and freehand drawing.
- Advanced animation.
- Timeline-based editing.
- Complex visual effects.

### Missing assets

If an asset cannot be found:
- Display a visible placeholder.
- Allow the creator to relink the asset.
- Use a configured fallback background or solid color where appropriate.
- Do not crash the editor or exported application.

## 9. Visual Direction and Theme System

### Overall style

Modern, minimal, and editor-oriented.

Characteristics:
- Rounded corners.
- Restrained glass-like surfaces.
- Clear panel boundaries.
- Minimal decorative elements.
- Readable typography.
- Subtle transitions.
- Strong visual distinction between the editor and the application being authored.

The glass effect should be restrained. It must not reduce readability or make the interface visually noisy.

### Theme system

GhostStack launches with three theme families:

**Halloween — Default**
- Pumpkin orange.
- Ghost white.
- Dark charcoal.
- Muted purple accents.
- Subtle Halloween identity without excessive decorative imagery.

**Light**
- A bright, neutral workspace.
- Preset accent options such as red, green, blue, cyan, and pastel variants.

**Dark**
- A dark neutral workspace.
- Preset accent options such as purple and terminal-inspired variants.

Creators can change the accent color independently of the selected theme family where supported.

Theme settings affect the GhostStack editor. They do not automatically dictate the appearance of the applications users create.

## 10. Interaction and Feedback States

The interface should provide consistent feedback for:

- Saving and autosaving.
- Unsaved changes.
- Importing and exporting.
- Invalid project files.
- Missing assets.
- Validation errors.
- AI connection status.
- AI planning.
- Approval required.
- AI execution.
- Execution failure.
- Cancellation.
- Successful completion.
- Rollback.
- Recovery available.

Important operations should provide clear status text and actionable error messages.

## 11. Responsive and Device Preview

The editor is desktop-oriented.

The authored applications should support responsive layouts.

P0:
- Responsive layout properties.
- Canvas-based authoring.
- Basic preview at the current viewport.

P1:
- Device and viewport presets.
- Resizable preview frame.
- Comparison across common viewport sizes.

The editor itself does not need to become a fully featured mobile authoring interface for the MVP.

## 12. Approved Design Directions

- HyperCard-inspired functionality without a one-to-one UI reproduction.
- Card-based application structure.
- Freeform responsive authoring canvas.
- Visual blocks and constrained code-based behavior editing.
- Contextual inspector.
- AI planning and approval before execution.
- AI progress and completion report.
- Recoverable AI operations.
- Local-first project workflow.
- `.gsp` project import/export.
- Standalone web application preview and export.
- Halloween as the default GhostStack theme.
- Light and dark theme families.
- Browser-first implementation with a planned Tauri desktop application.

## 13. Open Design Questions

- DQ-001: Exact panel docking and workspace persistence behavior.
- DQ-002: Final visual-block editor interaction model.
- DQ-003: Exact presentation of the constrained code editor.
- DQ-004: How AI plans display complex changes across multiple Cards.
- DQ-005: How much of an AI operation can be reverted individually versus as a whole.
- DQ-006: Exact responsive layout controls and breakpoint editing.
- DQ-007: Shared background editing and inheritance details.
- DQ-008: Final visual design of the Card relationship graph.
- DQ-009: Exact layer panel hierarchy and grouping behavior.
- DQ-010: Final theme palettes, typography, and component styling.
- DQ-011: Which panels are dockable in the first customizable workspace release.
- DQ-012: How missing assets are presented in preview and export.


### Finalized Design Decisions

The following decisions resolve DQ-001 through DQ-012:

| ID | Final decision |
|---|---|
| DQ-001 | P0 uses a four-zone CSS Grid workspace with resizable panels, collapse controls, and persisted layout preferences. P1 introduces advanced docking and named workspace layouts. |
| DQ-002 | Visual behavior editing uses a vertical, slot-based action stack with triggers, conditions, and ordered actions. |
| DQ-003 | GhostScript editing uses CodeMirror 6 with syntax highlighting, autocomplete, and live validation diagnostics. |
| DQ-004 | AI plans use a Card-grouped collapsible diff interface with before/after changes and navigation to affected Cards. |
| DQ-005 | P0 supports whole-operation atomic rollback. P1 introduces selective operation restoration. |
| DQ-006 | Responsive controls include numeric position and dimension inputs, a nine-point anchor matrix, scaling modes, and viewport presets. |
| DQ-007 | P1 shared backgrounds use reusable background definitions referenced by Cards, with dedicated editing and detachment workflows. |
| DQ-008 | P1 Card relationship visualization uses a directed node graph, implemented with React Flow (`@xyflow/react`). |
| DQ-009 | P1 layer management uses a hierarchical layer tree with visibility, locking, ordering, and grouping. |
| DQ-010 | The visual system uses Inter and JetBrains Mono, restrained glass effects, rounded surfaces, and three theme families: Spectral Workstation, Studio Paper, and Midnight Terminal. |
| DQ-011 | The central Card canvas remains anchored. Surrounding panels can be resized, collapsed, and eventually docked. |
| DQ-012 | Missing assets display editable placeholders in the editor and graceful fallback content in preview and exported applications. |

### Visual Theme Specifications

**Spectral Workstation — Default Halloween Theme**
- Base: `#111017`
- Panels: `#191724`
- Text: `#F4F3F8`
- Primary accent: `#FF6B2B`
- Secondary accent: `#9D6BFF`

**Studio Paper — Light Theme**
- Canvas: `#F5F6F8`
- Panels: `#FFFFFF`
- Text: `#18181B`
- Default accent: `#2563EB`

**Midnight Terminal — Dark Theme**
- Base: `#0E1014`
- Panels: `#171A21`
- Text: `#E4E4E7`
- Accent presets: `#8B5CF6` and `#10B981`

Themes affect the GhostStack editor, not automatically the applications being authored.

### Workspace Layout

P0:
- Stack and Card Navigator.
- Elements and Assets Toolbox.
- Central Card Canvas.
- Inspector and Behavior Editor.
- AI Assistant and Operation Review.
- Collapsible Console and Validation Drawer.

P1:
- Advanced docking.
- Tabbed panels.
- Named workspace layouts.
- Persistent panel arrangements.

### Responsive Authoring

The default authoring reference frame is 1280 × 720, but creators can customize the dimensions.

The canvas must support:
- Freeform positioning.
- Configurable dimensions.
- Horizontal and vertical anchoring.
- Scaling behavior.
- Viewport preview presets.

The reference frame is an editing aid, not a fixed output restriction.


## 14. Design-to-PRD Mapping

| Design area | Related PRD requirements |
|---|---|
| Project Library | F-001, F-018 |
| Stack Workspace | F-002, F-005 |
| Card Editor | F-003, F-004 |
| Inspector and Behavior Editor | F-006, F-007, F-008, F-013 |
| AI Assistant | F-009, F-010, F-011, F-012 |
| Preview | F-014 |
| Project History | F-015, F-016, F-017 |
| Import/Export | F-018, F-019, F-020 |
| Desktop Application | F-021 |
| Workspace Customization | F-022 |
| Relationship Graph | F-023 |
| Shared Backgrounds | F-024 |
| Layer Panel | F-025 |
| Device Preview | F-026 |

## 15. Prototype Record

**Status:** Not started.

The first prototype should validate:
1. The overall editor workspace.
2. Freeform Card editing.
3. The inspector and behavior authoring experience.
4. The AI plan-review-execute workflow.
5. Project history and rollback interaction.

A polished visual system should follow validation of these core workflows rather than precede them.
