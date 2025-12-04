# G-Code Tab Reorganization & Ripple Effect Implementation

## Objective

Reorganize the right panel tab structure by consolidating the G-Code editor into the Simulator panel as an accordion section, and implement a global ripple visual feedback effect for all clickable and touchable elements throughout the application.

## Background

The application currently uses a tab-based navigation system in the right panel with six distinct tabs: Design (Properties), Code (G-Code), Sim (Simulator), Control (Machine), GRBL, and Logs. The G-Code editor and Simulator are closely related functionalities that would benefit from being grouped together. Additionally, the application lacks tactile visual feedback for user interactions.

## Requirements

### 1. G-Code Tab Reorganization

#### 1.1 Tab Structure Modification

The current tab navigation structure must be modified to remove the standalone "Code" tab and integrate its functionality into the Simulator panel.

**Current Tab Order:**
- Design (Properties)
- Code (G-Code)
- Sim (Simulator)
- Control (Machine)
- GRBL
- Logs

**Target Tab Order:**
- Design (Properties)
- Sim (Simulator) - containing G-Code as collapsible section
- Control (Machine)
- GRBL
- Logs

#### 1.2 Accordion Component Design

The G-Code editor will be integrated into the Simulator panel as a collapsible accordion section positioned below the simulation viewport and controls.

**Accordion Characteristics:**
- Positioned as a distinct section within the Simulator panel
- Expandable and collapsible behavior controlled by a header click
- Maintains persistent expanded/collapsed state during the session
- Visual indicators (chevron icon or similar) to indicate collapse state
- Smooth expand/collapse animation transition
- Should not interfere with simulator functionality when collapsed
- When expanded, provides full G-Code editing capabilities

**Content Structure (Top to Bottom in Simulator Panel):**
1. Panel Header (existing - "Simulator & Job")
2. 3D/2D Visualization Canvas (existing)
3. Simulation Controls (existing - play/pause, progress bar, speed)
4. Job Control Section (existing - run on machine, pause, stop)
5. **NEW: G-Code Accordion Section**
   - Accordion Header (clickable, with expand/collapse indicator)
   - Accordion Content (G-Code editor when expanded)

#### 1.3 G-Code Editor Integration

The entire CodeEditor component functionality must be preserved and integrated into the accordion section.

**Required Features to Maintain:**
- G-Code text editing capability
- Manual mode indicator (yellow banner when manually edited)
- Toolbar actions:
  - Toggle "Generate Only Selected" filter
  - Upload G-Code file
  - Copy to clipboard
  - Explain with AI (if implemented)
  - Download G-Code file
  - Reset to Design (regenerate)
- Syntax highlighting preservation
- Scroll behavior for long G-Code files

#### 1.4 State Management Considerations

**State Variables to Consider:**
- Accordion expanded/collapsed state (new state required)
- Existing `isManualMode` state (preserved)
- Existing `generateOnlySelected` state (preserved)
- Existing `gcode` content state (preserved)

**Interaction Patterns:**
- When switching to Simulator tab, accordion should remember its previous state
- When switching away from Simulator tab and back, accordion state persists
- Manual edits in G-Code should still trigger the manual mode indicator
- Regenerating G-Code should work as before

### 2. Global Ripple Effect Implementation

#### 2.1 Ripple Effect Scope

The ripple effect must be applied universally across all interactive elements in the application.

**Target Elements:**
- All buttons (toolbar buttons, tab buttons, control buttons, action buttons)
- Tab navigation items
- Tool palette items
- Canvas shape selection (optional enhancement)
- All clickable icons
- Accordion headers
- Any custom interactive components

#### 2.2 Ripple Visual Specification

**Appearance:**
- Circular expanding wave originating from the click/touch point
- Color: Semi-transparent light color that contrasts with the element background
  - Suggested: `rgba(255, 255, 255, 0.3)` for dark backgrounds
  - Suggested: `rgba(0, 0, 0, 0.1)` for light backgrounds (if applicable)
- Animation duration: 400-600ms
- Easing function: Ease-out for natural deceleration
- Maximum ripple radius: Should extend beyond the element boundaries or to element edges based on design preference

**Behavior:**
- Triggered on pointer down event (mouse click or touch)
- Position calculated from exact click/touch coordinates relative to the element
- Multiple ripples can occur simultaneously if user clicks rapidly
- Ripples should auto-remove after animation completes to prevent DOM bloat
- Should not interfere with element's primary interaction (e.g., button onClick still fires)

#### 2.3 Implementation Approach

Two primary implementation strategies are viable:

**Option A: Reusable Ripple Component (Recommended)**
- Create a standalone `Ripple` wrapper component or hook
- Applied to interactive elements via wrapper or composition
- Manages ripple lifecycle (creation, animation, cleanup)
- Configurable ripple color, duration, and size

**Option B: Global Event Listener**
- Attach event listener to document root
- Detect clicks on elements with specific class or attribute
- Dynamically inject ripple elements
- Less type-safe, more magical but simpler integration

**Recommendation:** Option A provides better control, type safety, and maintainability for a React/TypeScript codebase.

#### 2.4 Ripple Component Specifications

If implementing as a reusable component/hook:

**Component Interface:**
```
Ripple Component or Hook should accept:
- duration (optional): Animation duration in milliseconds
- color (optional): Ripple color in rgba or hex format
- children: The wrapped interactive element
```

**Rendering Strategy:**
- Container element with relative positioning to establish positioning context
- Ripple effects rendered as absolutely positioned elements
- Overflow hidden on container to constrain ripple boundaries (optional based on design)
- Z-index management to ensure ripple renders above element content but below foreground elements

**State Management:**
- Track active ripples (array of ripple objects with position and unique ID)
- Add ripple on pointer down
- Remove ripple after animation duration elapses

#### 2.5 Accessibility Considerations

**Non-Visual Impact:**
- Ripple is purely visual decoration
- Must not interfere with keyboard navigation
- Must not prevent screen reader functionality
- Must not block or delay primary interaction events

**Performance:**
- Ripples should use CSS transforms and opacity for hardware acceleration
- Limit maximum concurrent ripples per element if performance issues arise
- Use `will-change` CSS property cautiously for animation optimization

## Design Decisions

### Tab Consolidation Rationale

Consolidating the G-Code editor into the Simulator panel achieves:
- **Reduced cognitive load**: Fewer top-level tabs to navigate
- **Logical grouping**: G-Code and its visual simulation are tightly coupled workflows
- **Space efficiency**: Frees up tab bar space for potential future features
- **Workflow optimization**: Users can view simulation and edit G-Code in unified context

### Accordion vs. Tabs Within Simulator

An accordion approach is chosen over nested tabs because:
- **Visual hierarchy**: Accordion maintains clear primary/secondary relationship
- **Vertical space utilization**: Simulator benefits from vertical layout
- **Single focus**: Encourages sequential workflow (simulate, then edit if needed)
- **Simplicity**: Avoids nested tab complexity

### Ripple Implementation Strategy

Using a component-based ripple provides:
- **Consistency**: Ensures uniform ripple behavior across all elements
- **Maintainability**: Centralized logic for future adjustments
- **Flexibility**: Easy to enable/disable or customize per element
- **Type Safety**: Leverages TypeScript for prop validation

## Component Modification Scope

### Components Requiring Modification

1. **App.tsx**
   - Remove 'gcode' from Tab type union
   - Remove 'gcode' TabButton from tab navigation
   - Remove conditional rendering block for `activeTab === 'gcode'`
   - Pass G-Code related props to SimulatorPanel instead of CodeEditor

2. **SimulatorPanel.tsx**
   - Add accordion state management (expanded/collapsed)
   - Add accordion UI section below job controls
   - Integrate CodeEditor component within accordion content
   - Accept additional props: `onCodeChange`, `isManualMode`, `generateOnlySelected`, `onToggleGenerateOnlySelected`, `onRegenerate`

3. **CodeEditor.tsx**
   - Remove `onExplain` prop (or handle if explain feature exists)
   - Ensure component works within accordion container
   - Maintain all existing functionality unchanged

4. **New Component: Ripple Wrapper or Hook**
   - Create `Ripple.tsx` component or `useRipple.ts` hook
   - Implement ripple rendering and animation logic
   - Export for use across application

5. **All Interactive Components**
   - Wrap buttons and interactive elements with Ripple component
   - Apply ripple to: ToolPalette buttons, TabButton components, Toolbar buttons, MachineControl buttons, LogsPanel buttons, GrblSettingsPanel buttons, PropertiesPanel buttons, etc.

### Data Flow Changes

**Before:**
```
App.tsx
  ├─ activeTab state
  ├─ gcode state
  ├─ Tab navigation (6 tabs including 'gcode')
  └─ Conditional rendering
       ├─ activeTab === 'gcode' → CodeEditor
       └─ activeTab === 'simulator' → SimulatorPanel
```

**After:**
```
App.tsx
  ├─ activeTab state (5 tabs, no 'gcode')
  ├─ gcode state (passed to SimulatorPanel)
  └─ Conditional rendering
       └─ activeTab === 'simulator' → SimulatorPanel
            └─ Contains Accordion
                 └─ CodeEditor (when expanded)
```

## User Interaction Flow

### G-Code Editing Workflow (After Changes)

1. User clicks "Sim" tab in right panel
2. Simulator panel displays with visualization, simulation controls, and job controls
3. User sees collapsed G-Code accordion header at bottom
4. User clicks accordion header to expand
5. G-Code editor reveals with full editing capabilities
6. User can edit G-Code, upload files, copy, download as before
7. User clicks accordion header again to collapse
8. Accordion collapses, providing more space for simulation view

### Ripple Interaction Pattern

1. User hovers over a button (existing hover state)
2. User presses down (click or touch)
3. Ripple effect emanates from exact touch point
4. Ripple expands and fades simultaneously
5. Button's primary action executes (onClick handler)
6. Ripple completes animation and self-removes from DOM

## Visual Design Specifications

### Accordion Header Style

**Recommended Visual Treatment:**
- Background color: Distinct from panel background (e.g., `bg-slate-900` if panel is `bg-slate-800`)
- Border: Top border to separate from job controls section
- Padding: Consistent with other panel section headers (e.g., `p-4`)
- Typography: Medium font weight, slightly smaller than main panel header
- Icon: Chevron or caret icon indicating expand/collapse state
  - Collapsed state: Chevron pointing right or down
  - Expanded state: Chevron pointing down or up
  - Icon rotation animation on state change
- Hover state: Subtle background color change to indicate interactivity
- Cursor: Pointer to indicate clickability

### Accordion Content Style

**Recommended Visual Treatment:**
- No additional padding (CodeEditor component already has padding)
- Smooth height transition animation
  - Duration: 250-350ms
  - Easing: Ease-in-out
- Height calculation: Auto-calculate based on content or set maximum height with scroll

### Ripple Animation Keyframes

**Visual Progression:**
- **T=0ms (Start)**: Ripple opacity 0.4-0.5, scale 0, positioned at click coordinates
- **T=200ms (Mid)**: Ripple opacity 0.2-0.3, scale 0.5-0.7
- **T=400-600ms (End)**: Ripple opacity 0, scale 1.0-1.5

**CSS Pseudo-implementation Concept:**
```
Animation properties to apply:
- Transform: scale(0) to scale(1.5)
- Opacity: 0.4 to 0
- Transform-origin: center
- Border-radius: 50% (circular shape)
```

## State Management Details

### New State Variables

**SimulatorPanel Component:**
- `isGCodeExpanded`: boolean - tracks accordion expanded state (default: false)

### Ripple State (Per Component Instance)

**Ripple Component or Hook:**
- `ripples`: Array of ripple objects
  - Each object contains: `id` (unique), `x` (position), `y` (position), `timestamp`

## Accessibility Requirements

### Accordion Accessibility

- Header must be keyboard accessible (focusable, Enter/Space to toggle)
- ARIA attributes:
  - `aria-expanded`: boolean reflecting current state
  - `aria-controls`: ID reference to accordion content
  - `role="button"` on header if not using semantic button element
- Content region should have appropriate `role="region"` or semantic element
- Focus management: Maintain logical tab order

### Ripple Accessibility

- Ripple container must not interfere with focus outline
- Ripple must not capture pointer events (should be `pointer-events: none`)
- Ripple animations should respect `prefers-reduced-motion` media query
  - When user prefers reduced motion: Disable ripple or use instant fade instead of animation

## Testing Considerations

### Functional Testing Scope

**G-Code Accordion:**
- Verify accordion expands and collapses on header click
- Verify G-Code editing functionality works within accordion
- Verify manual mode indicator appears when editing
- Verify file upload, copy, download actions work
- Verify state persistence when switching tabs
- Verify regenerate action works correctly
- Verify accordion state does not affect simulation functionality

**Ripple Effect:**
- Verify ripple appears on all targeted interactive elements
- Verify ripple position matches click/touch coordinates
- Verify ripple animation completes and element is removed
- Verify multiple rapid clicks create multiple ripples
- Verify ripple does not block underlying button actions
- Verify ripple respects prefers-reduced-motion setting
- Test on touch devices for touch event handling

### Edge Cases

**Accordion:**
- Rapid expand/collapse clicks (should handle gracefully without animation conflict)
- Very long G-Code content (should scroll properly within accordion)
- Switching tabs while accordion animation is in progress

**Ripple:**
- Click on element edge or corner (ripple should still be visible)
- Very small buttons (ripple should scale appropriately)
- High-frequency clicking (should not cause performance degradation or memory leak)

## Performance Considerations

### Accordion Performance

- Height animation should use CSS transitions for hardware acceleration
- Avoid layout thrashing by batching DOM measurements if calculating dynamic heights
- Consider using `max-height` transition instead of `height: auto` for smoother animation

### Ripple Performance

- Use CSS transforms (scale, translateX, translateY) instead of width/height for animation
- Use opacity transitions for fade effect
- Apply `will-change: transform, opacity` only during animation, not permanently
- Ensure ripple elements are removed from DOM after animation to prevent memory accumulation
- Limit concurrent ripples per element (e.g., maximum 3) if performance issues detected
- Use requestAnimationFrame for ripple cleanup if needed

## Migration Strategy

### Phase 1: Accordion Integration

1. Create accordion UI structure in SimulatorPanel
2. Integrate CodeEditor into accordion content
3. Update App.tsx to remove standalone G-Code tab
4. Update prop passing from App to SimulatorPanel
5. Test accordion functionality thoroughly

### Phase 2: Ripple Implementation

1. Create Ripple component or useRipple hook
2. Test ripple on a single button type
3. Progressively apply ripple to all button categories
4. Test across different components
5. Verify accessibility and performance

### Phase 3: Polish and Refinement

1. Fine-tune animation timings and visual appearance
2. Ensure consistent styling across all components
3. Address any edge cases discovered during testing
4. Optimize performance if needed

## Future Enhancements

### Potential Future Improvements

- **Accordion Persistence**: Save accordion state to localStorage for persistence across sessions
- **Multiple Accordion Sections**: If additional content needs to be added to Simulator panel
- **Ripple Customization**: Per-element ripple color/size customization based on context
- **Ripple Sound Effect**: Optional subtle click sound for enhanced feedback (accessibility consideration)
- **Smart Accordion Behavior**: Auto-expand G-Code accordion when manual edit is detected from external source
