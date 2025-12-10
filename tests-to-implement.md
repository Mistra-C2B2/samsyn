# SamSyn Frontend E2E Test Plan

This document outlines all E2E tests that need to be implemented for the SamSyn frontend application.

## Current Test Coverage

Existing tests in `tests/e2e/`:
- `panels.spec.ts` - Header visibility, navigation buttons, panel switching
- `map.spec.ts` - Map container, empty state, canvas rendering, map controls
- `layers.spec.ts` - Layer panel visibility, basemap selector, layer creator navigation
- `layers-authenticated.spec.ts` - Auth status, create layer (authenticated), layer creation tabs

---

## Tests To Implement

### 1. Layer Management (`layer-management.spec.ts`)

#### 1.1 Layer Visibility
- [x] Toggle layer visibility on
- [x] Toggle layer visibility off
- [x] Multiple layers can have different visibility states
- [x] Visibility persists after panel close/reopen
- [x] Map updates when layer visibility changes

#### 1.2 Layer Opacity
- [x] Adjust layer opacity via slider
- [x] Opacity value displays correctly (0-100%)
- [x] Map layer renders with correct opacity
- [x] Opacity persists after panel close/reopen

#### 1.3 Layer Reordering
- [x] Drag layer to new position
- [x] Layer order reflects on map (z-index)
- [x] Reorder persists after refresh
- [x] Cannot drag when only one layer exists

#### 1.4 Layer Removal
- [x] Remove layer via menu option
- [x] Layer disappears from list
- [x] Layer disappears from map
- [x] Confirmation before removal (if implemented)

#### 1.5 Layer Editing
- [x] Open layer editor from menu
- [x] Edit layer name
- [x] Edit layer description
- [x] Edit layer color
- [x] Save changes updates layer

#### 1.6 Add from Library
- [x] Open "Add from Library" dialog
- [x] Display available layers
- [x] Search/filter layers
- [x] Add layer to current map
- [x] Added layer appears in layer list

---

### 2. Layer Creation (`layer-creation.spec.ts`)

#### 2.1 Draw Tab
- [x] Select Point drawing mode
- [x] Select LineString drawing mode
- [x] Select Polygon drawing mode
- [x] Draw a point on map
- [x] Draw a line on map
- [x] Draw a polygon on map
- [x] Feature appears in feature list
- [x] Edit feature name
- [x] Edit feature description
- [x] Remove feature from list
- [x] Select feature icon (for points)
- [x] Select line style (for lines/polygons)
- [x] Clear all drawings

#### 2.2 Upload Tab
- [ ] Upload valid GeoJSON file
- [ ] Features populate from file
- [ ] Reject invalid GeoJSON
- [ ] Show error for non-GeoJSON files
- [ ] Handle empty GeoJSON

#### 2.3 WMS Tab
- [ ] Enter WMS URL
- [ ] Enter WMS layer name
- [ ] Validate required fields
- [ ] Preview WMS layer (if implemented)

#### 2.4 GeoJSON Tab
- [ ] Paste valid GeoJSON
- [ ] Features populate from pasted content
- [ ] Validate GeoJSON format
- [ ] Show error for invalid JSON
- [ ] Clear pasted content

#### 2.5 Layer Metadata
- [ ] Enter layer name (required)
- [ ] Enter layer description
- [ ] Select category from dropdown
- [ ] Create new category
- [ ] Select layer color
- [ ] Set permissions (creator-only / everyone)

#### 2.6 Layer Save
- [ ] Save button disabled without required fields
- [ ] Save creates new layer
- [ ] New layer appears in layer manager
- [ ] New layer visible on map
- [ ] Cancel discards changes

---

### 3. Map Management (`map-management.spec.ts`)

#### 3.1 Map Selection
- [ ] Open map selector panel
- [ ] Display list of user maps
- [ ] Current map is highlighted
- [ ] Click to select different map
- [ ] Layers update when map changes
- [ ] Map center/zoom updates

#### 3.2 Map Creation
- [ ] Open map creation wizard
- [ ] Enter map name (required)
- [ ] Enter map description
- [ ] Select edit access level
- [ ] Select visibility
- [ ] Create map successfully
- [ ] New map becomes current map

#### 3.3 Map Editing
- [ ] Edit button visible for owners
- [ ] Edit button hidden for non-owners
- [ ] Open edit dialog
- [ ] Modify map name
- [ ] Modify map description
- [ ] Save changes

#### 3.4 Map Deletion
- [ ] Delete button visible for owners
- [ ] Delete button hidden for non-owners
- [ ] Confirmation dialog appears
- [ ] Confirm deletes map
- [ ] Cancel keeps map
- [ ] After deletion, another map selected (or empty state)

#### 3.5 Collaborator Management
- [ ] Add collaborator by email
- [ ] Email validation
- [ ] Remove collaborator
- [ ] Collaborators list updates
- [ ] Only owners can manage collaborators

---

### 4. Comments (`comments.spec.ts`)

#### 4.1 Comment Display
- [ ] Open comments panel
- [ ] Display map comments
- [ ] Switch to layer comments via dropdown
- [ ] Comments show author name
- [ ] Comments show timestamp
- [ ] Comments show relative time (e.g., "1h ago")

#### 4.2 Comment Threads
- [ ] Display threaded replies
- [ ] Expand/collapse threads
- [ ] Reply nesting displays correctly
- [ ] Parent comment reference visible

#### 4.3 Add Comment
- [ ] Comment input field visible
- [ ] Submit button disabled when empty
- [ ] Add new map comment
- [ ] Add new layer comment
- [ ] New comment appears in list
- [ ] Author and timestamp populated

#### 4.4 Reply to Comment
- [ ] Click reply button
- [ ] Reply input appears
- [ ] Submit reply
- [ ] Reply appears under parent

---

### 5. Map View (`map-view.spec.ts`)

#### 5.1 Map Interactions
- [ ] Pan map by dragging
- [ ] Zoom in with controls
- [ ] Zoom out with controls
- [ ] Zoom with scroll wheel
- [ ] Double-click to zoom
- [ ] Map bounds update on interaction

#### 5.2 Basemap
- [ ] Default basemap displays
- [ ] Switch basemap via selector
- [ ] All basemap options work
- [ ] Basemap persists after refresh

#### 5.3 Layer Rendering
- [ ] GeoJSON layer renders correctly
- [ ] Markers display at correct positions
- [ ] Polygons render with correct style
- [ ] Lines render with correct style
- [ ] Layer colors applied correctly
- [ ] Layer opacity applied correctly

#### 5.4 Feature Highlighting
- [ ] Click feature highlights it
- [ ] Highlighted layer in LayerManager
- [ ] Click elsewhere removes highlight
- [ ] Map zooms to highlighted feature

#### 5.5 Drawing Tools
- [ ] Drawing mode activates correctly
- [ ] Draw point creates point feature
- [ ] Draw line creates line feature
- [ ] Draw polygon creates polygon feature
- [ ] Select mode allows feature selection
- [ ] Delete mode removes features
- [ ] Cancel drawing clears current shape

---

### 6. Temporal Features (`temporal.spec.ts`)

#### 6.1 Time Slider
- [ ] Time slider appears for temporal layers
- [ ] Time slider hidden when no temporal layers
- [ ] Slider shows correct date range
- [ ] Drag handles to change range
- [ ] Map data updates with time selection

#### 6.2 Time Scale
- [ ] Days scale option
- [ ] Months scale option
- [ ] Years scale option
- [ ] Scale change snaps dates appropriately

#### 6.3 Custom Date Input
- [ ] Enter custom start date
- [ ] Enter custom end date
- [ ] Validate date format
- [ ] Reset to full range button

---

### 7. Admin Panel (`admin.spec.ts`)

#### 7.1 Panel Access
- [ ] Admin button visible for admins
- [ ] Admin button hidden for non-admins
- [ ] Open admin panel

#### 7.2 Layer Library Management
- [ ] View all layers in library
- [ ] Search/filter layers
- [ ] Add new layer
- [ ] Edit layer properties
- [ ] Delete layer with confirmation

#### 7.3 Layer Types
- [ ] Add WMS layer
- [ ] Add GeoTIFF layer
- [ ] Add vector layer

#### 7.4 Layer Metadata
- [ ] Edit name, description, author, DOI
- [ ] Edit category
- [ ] Configure gradient legend
- [ ] Configure categorical legend

---

### 8. Settings (`settings.spec.ts`)

#### 8.1 Settings Dialog
- [ ] Open settings dialog
- [ ] Close settings dialog
- [ ] Settings persist after close

#### 8.2 Preferences
- [ ] Change language setting
- [ ] Change text size
- [ ] Toggle dark mode
- [ ] Preferences applied to UI

#### 8.3 Data Management
- [ ] Export data button works
- [ ] Download as JSON works

#### 8.4 Account Management
- [ ] Delete account shows confirmation
- [ ] Cancel keeps account
- [ ] Confirm deletes account

---

### 9. Permissions & Roles (`permissions.spec.ts`)

#### 9.1 Role Display
- [ ] Owner badge displays correctly
- [ ] Editor badge displays correctly
- [ ] Viewer badge displays correctly
- [ ] Badge tooltip shows role description

#### 9.2 Owner Permissions
- [ ] Can edit map
- [ ] Can delete map
- [ ] Can manage collaborators
- [ ] Can create layers
- [ ] Can edit all layers

#### 9.3 Editor Permissions
- [ ] Cannot delete map
- [ ] Cannot manage collaborators
- [ ] Can create layers
- [ ] Can edit own layers
- [ ] Can edit "everyone" layers

#### 9.4 Viewer Permissions
- [ ] Cannot edit map
- [ ] Cannot delete map
- [ ] Cannot create layers
- [ ] Cannot edit layers
- [ ] Can view and comment only

---

### 10. Error Handling (`error-handling.spec.ts`)

#### 10.1 API Errors
- [ ] Network failure shows error toast
- [ ] 401 error redirects to login
- [ ] 403 error shows permission denied
- [ ] 404 error shows not found message
- [ ] 500 error shows generic error

#### 10.2 Validation Errors
- [ ] Required field validation
- [ ] Email format validation
- [ ] Invalid GeoJSON validation
- [ ] Invalid URL validation

#### 10.3 Optimistic Updates
- [ ] Failed update rolls back UI
- [ ] Error message displayed
- [ ] User can retry action

---

### 11. Edge Cases (`edge-cases.spec.ts`)

#### 11.1 Empty States
- [ ] No maps - empty state message
- [ ] No layers - empty layer list
- [ ] No comments - empty comments message
- [ ] No search results - empty results message

#### 11.2 Boundary Conditions
- [ ] Very long layer names truncated
- [ ] Very long descriptions handled
- [ ] Many layers (50+) performance
- [ ] Many features in single layer
- [ ] Deep comment threads

#### 11.3 Special Characters
- [ ] Layer name with special characters
- [ ] Description with emojis
- [ ] Comments with unicode
- [ ] GeoJSON with special properties

---

### 12. Accessibility (`accessibility.spec.ts`)

#### 12.1 Keyboard Navigation
- [ ] Tab through controls
- [ ] Enter to activate buttons
- [ ] Escape to close dialogs/panels
- [ ] Arrow keys in dropdowns

#### 12.2 Screen Reader Support
- [ ] Buttons have accessible labels
- [ ] Form inputs have labels
- [ ] Error messages announced
- [ ] Panel state changes announced

---

## Priority Matrix

### High Priority (Core Functionality)
1. Layer visibility toggle
2. Layer creation (draw mode)
3. Map selection
4. Map creation
5. Comments - add comment
6. Permissions - viewer restrictions

### Medium Priority (Important Features)
1. Layer opacity
2. Layer reordering
3. Layer removal
4. Upload GeoJSON
5. Comment threads
6. Time slider

### Low Priority (Edge Cases & Polish)
1. Special characters handling
2. Performance with many items
3. Accessibility features
4. Error handling edge cases

---

## Test File Organization

```
tests/e2e/
├── pages/
│   ├── AppPage.ts          (existing)
│   ├── LayersPage.ts       (existing)
│   ├── MapsPage.ts         (existing)
│   ├── LayerCreatorPage.ts (new)
│   ├── CommentsPage.ts     (new)
│   ├── AdminPage.ts        (new)
│   └── SettingsPage.ts     (new)
├── fixtures/
│   ├── sample.geojson      (new)
│   ├── invalid.json        (new)
│   └── large-dataset.geojson (new)
├── layers.spec.ts          (existing)
├── layers-authenticated.spec.ts (existing)
├── panels.spec.ts          (existing)
├── map.spec.ts             (existing)
├── layer-management.spec.ts (new)
├── layer-creation.spec.ts  (new)
├── map-management.spec.ts  (new)
├── comments.spec.ts        (new)
├── map-view.spec.ts        (new)
├── temporal.spec.ts        (new)
├── admin.spec.ts           (new)
├── settings.spec.ts        (new)
├── permissions.spec.ts     (new)
├── error-handling.spec.ts  (new)
├── edge-cases.spec.ts      (new)
└── accessibility.spec.ts   (new)
```

---

## Estimated Test Count

| Category | Test Count |
|----------|------------|
| Layer Management | 20 |
| Layer Creation | 35 |
| Map Management | 22 |
| Comments | 16 |
| Map View | 22 |
| Temporal Features | 10 |
| Admin Panel | 14 |
| Settings | 10 |
| Permissions & Roles | 14 |
| Error Handling | 12 |
| Edge Cases | 12 |
| Accessibility | 8 |
| **Total** | **195** |

---

## Implementation Notes

1. **Page Objects**: Create page object classes for each major component to encapsulate selectors and common actions.

2. **Test Data**: Use fixtures for GeoJSON data, mock API responses where needed.

3. **Authentication**: Many tests require authenticated users with specific roles. Use test fixtures to set up authenticated state.

4. **Parallel Execution**: Tests should be independent and support parallel execution.

5. **Cleanup**: Each test should clean up created resources (maps, layers, comments).

6. **Flaky Test Prevention**:
   - Use proper waits for async operations
   - Avoid hard-coded delays
   - Use data-testid attributes for stable selectors
