# Phase 3: Maps CRUD - Implementation Summary

## Overview

Phase 3 of the SamSyn backend implementation is now **100% complete**. All Maps CRUD functionality, collaborator management, and layer association features have been implemented, tested, and are ready for use. The implementation includes 13 REST API endpoints, comprehensive business logic, and 54 passing unit tests.

---

## What Was Implemented

### 1. Pydantic Schemas ✅

**File:** `/workspace/backend/app/schemas/map.py` (5.2KB)

Created comprehensive validation schemas:

**Enums:**
- `MapPermissionEnum` - private, collaborators, public
- `CollaboratorRoleEnum` - viewer, editor

**Base & CRUD Schemas:**
- `MapBase` - Base schema with name, description, viewport (center_lat, center_lng, zoom)
- `MapCreate` - For creating maps with permission level
- `MapUpdate` - For partial updates (all fields optional)

**Response Schemas:**
- `MapResponse` - Full map details with nested collaborators and layers
- `MapListResponse` - Optimized for list views with counts instead of full nested data

**Collaborator Schemas:**
- `MapCollaboratorCreate` - Add collaborator (user_id, role)
- `MapCollaboratorUpdate` - Update collaborator role
- `MapCollaboratorResponse` - Collaborator details with optional user object

**Map-Layer Association Schemas:**
- `MapLayerCreate` - Add layer to map (layer_id, order, visible, opacity)
- `MapLayerUpdate` - Update layer properties in map context
- `MapLayerResponse` - Layer in map context with optional layer object
- `MapLayerReorder` - Bulk reorder all layers with validation

**Updated:** `/workspace/backend/app/schemas/__init__.py` - Export all new schemas

**Validation Features:**
- UUID types for all IDs
- Zoom: 0-22 range
- Latitude: -90 to 90
- Longitude: -180 to 180
- Opacity: 0-100
- Name: 1-255 characters
- Field validators for complex validation

---

### 2. Map Service ✅

**File:** `/workspace/backend/app/services/map_service.py` (21KB, 742 lines)

Implemented MapService class with 16 methods:

**Core CRUD (5 methods):**
1. `list_user_maps(user_id)` - Get all maps owned by or shared with user
2. `get_map(map_id, user_id)` - Get map by ID with permission check
3. `create_map(map_data, creator_id)` - Create new map
4. `update_map(map_id, map_data, user_id)` - Update map with permission check
5. `delete_map(map_id, user_id)` - Delete map with permission check

**Permission Checks (3 methods):**
6. `can_view_map(map_id, user_id)` - Check if user can view map
7. `can_edit_map(map_id, user_id)` - Check if user can edit map
8. `get_user_role_in_map(map_id, user_id)` - Get user's role (owner/editor/viewer/none)

**Collaborator Management (4 methods):**
9. `list_collaborators(map_id, user_id)` - List map collaborators (requires view access)
10. `add_collaborator(map_id, user_id_to_add, role, requester_id)` - Add collaborator
11. `update_collaborator(map_id, user_id_to_update, role, requester_id)` - Update role (owner only)
12. `remove_collaborator(map_id, user_id_to_remove, requester_id)` - Remove collaborator (owner only)

**Layer Management (4 methods):**
13. `add_layer_to_map(map_id, layer_id, user_id, display_order, is_visible, opacity)` - Add layer
14. `remove_layer_from_map(map_id, layer_id, user_id)` - Remove layer
15. `update_map_layer(map_id, layer_id, updates, user_id)` - Update layer properties
16. `reorder_layers(map_id, layer_orders, user_id)` - Reorder all layers in map

**Permission Logic:**
- **Private**: Only creator can view/edit
- **Collaborators**: Creator + collaborators can view; only creator + editors can edit
- **Public**: Anyone can view; only creator + editors can edit
- Owner always has full access
- Editors can add/remove layers and update map properties
- Only owner can add/remove collaborators or delete map

**Edge Cases Handled:**
- Can't add duplicate collaborators
- Can't remove map owner as collaborator (owner isn't in collaborators table)
- Can't add duplicate layers to a map
- Only owner can add editors as collaborators
- Only owner can update collaborator roles
- Foreign key validation for maps/layers/users
- IntegrityError handling for race conditions
- Proper permission checks on all operations

---

### 3. Maps API Endpoints ✅

**File:** `/workspace/backend/app/api/v1/maps.py` (687 lines)

Created FastAPI router with 13 RESTful endpoints:

**Map CRUD (5 endpoints):**

1. **GET /api/v1/maps** → `list_user_maps()`
   - Lists all maps user owns or collaborates on
   - Returns `List[MapListResponse]` with collaborator/layer counts
   - Authentication: Required
   - Status: 200 OK

2. **GET /api/v1/maps/{map_id}** → `get_map()`
   - Returns full map details with collaborators and layers
   - Returns `MapResponse`
   - Authentication: Required
   - Permission: View access
   - Status: 200 OK, 404 Not Found, 403 Forbidden

3. **POST /api/v1/maps** → `create_map()`
   - Creates new map with current user as owner
   - Body: `MapCreate` schema
   - Returns `MapResponse`
   - Authentication: Required
   - Status: 201 Created

4. **PUT /api/v1/maps/{map_id}** → `update_map()`
   - Updates map properties (partial updates supported)
   - Body: `MapUpdate` schema
   - Returns `MapResponse`
   - Authentication: Required
   - Permission: Edit access (owner/editor)
   - Status: 200 OK, 404 Not Found, 403 Forbidden

5. **DELETE /api/v1/maps/{map_id}** → `delete_map()`
   - Deletes map (owner only)
   - Cascades to remove collaborators and layer associations
   - Returns status message
   - Authentication: Required
   - Permission: Owner only
   - Status: 200 OK, 404 Not Found, 403 Forbidden

**Collaborator Management (4 endpoints):**

6. **GET /api/v1/maps/{map_id}/collaborators** → `list_collaborators()`
   - Lists all collaborators for a map
   - Returns `List[MapCollaboratorResponse]`
   - Authentication: Required
   - Permission: View access
   - Status: 200 OK, 404 Not Found, 403 Forbidden

7. **POST /api/v1/maps/{map_id}/collaborators** → `add_collaborator()`
   - Adds collaborator to map
   - Body: `MapCollaboratorCreate` (user_id, role)
   - Permission: Owner/editors can add viewers, only owner can add editors
   - Returns `MapCollaboratorResponse`
   - Authentication: Required
   - Status: 201 Created, 404 Not Found, 403 Forbidden, 400 Bad Request (duplicate)

8. **PUT /api/v1/maps/{map_id}/collaborators/{user_id}** → `update_collaborator()`
   - Updates collaborator role
   - Body: `MapCollaboratorUpdate` (role)
   - Permission: Owner only
   - Returns `MapCollaboratorResponse`
   - Authentication: Required
   - Status: 200 OK, 404 Not Found, 403 Forbidden

9. **DELETE /api/v1/maps/{map_id}/collaborators/{user_id}** → `remove_collaborator()`
   - Removes collaborator from map
   - Permission: Owner only
   - Returns status message
   - Authentication: Required
   - Status: 200 OK, 404 Not Found, 403 Forbidden

**Layer Management (4 endpoints):**

10. **POST /api/v1/maps/{map_id}/layers** → `add_layer_to_map()`
    - Adds layer to map
    - Body: `MapLayerCreate` (layer_id, order, visible, opacity)
    - Permission: Edit access
    - Returns `MapLayerResponse`
    - Authentication: Required
    - Status: 201 Created, 404 Not Found, 403 Forbidden, 400 Bad Request (duplicate)

11. **DELETE /api/v1/maps/{map_id}/layers/{layer_id}** → `remove_layer_from_map()`
    - Removes layer from map (association only, layer itself remains)
    - Permission: Edit access
    - Returns status message
    - Authentication: Required
    - Status: 200 OK, 404 Not Found, 403 Forbidden

12. **PUT /api/v1/maps/{map_id}/layers/{layer_id}** → `update_map_layer()`
    - Updates layer display properties (visible, opacity, order)
    - Body: `MapLayerUpdate` (partial)
    - Permission: Edit access
    - Returns `MapLayerResponse`
    - Authentication: Required
    - Status: 200 OK, 404 Not Found, 403 Forbidden

13. **PUT /api/v1/maps/{map_id}/layers/reorder** → `reorder_map_layers()`
    - Reorders all layers in map
    - Body: `MapLayerReorder` (list of {layer_id, order})
    - Permission: Edit access
    - Returns `List[MapLayerResponse]` ordered by new positions
    - Authentication: Required
    - Status: 200 OK, 404 Not Found, 403 Forbidden

**Error Handling:**
- 404 Not Found: Map/layer/collaborator not found
- 403 Forbidden: Insufficient permissions
- 400 Bad Request: Invalid input or duplicate entries
- All errors use `HTTPException` with descriptive messages

---

### 4. API Router Integration ✅

**File:** `/workspace/backend/app/api/v1/router.py` - Updated

Added maps router to API:

```python
# Phase 3: Maps CRUD
from app.api.v1 import maps

api_router.include_router(maps.router)
```

**Verification:**
- ✅ 7 map endpoint paths registered in OpenAPI
- ✅ All endpoints accessible at `/api/v1/maps/*`
- ✅ Swagger UI displays all endpoints at http://localhost:8000/docs
- ✅ Backend starts without errors

---

### 5. Comprehensive Test Suite ✅

**File:** `/workspace/backend/tests/test_map_service.py` (54 tests)

Created comprehensive test coverage across 5 test classes:

**TestMapCRUD (7 tests)** - Core CRUD operations:
- `test_list_user_maps_owned` - User sees their own maps
- `test_list_user_maps_shared` - User sees maps shared with them
- `test_list_user_maps_empty` - Empty list when user has no maps
- `test_get_map_as_owner` - Owner can get their map
- `test_create_map` - Create new map successfully
- `test_update_map` - Update map properties
- `test_delete_map` - Delete map

**TestMapPermissions (9 tests)** - Permission validation:
- `test_get_map_private_as_non_owner` - Can't view private map
- `test_get_map_collaborators_with_access` - Collaborator can view
- `test_get_map_collaborators_without_access` - Non-collaborator can't view
- `test_get_map_public_anonymous` - Anyone can view public map
- `test_update_map_requires_edit_permission` - Editor can update
- `test_update_map_viewer_cannot` - Viewer can't edit
- `test_delete_map_owner_only` - Only owner can delete
- `test_can_view_map_permission_checks` - Test all permission levels
- `test_can_edit_map_permission_checks` - Test edit permissions

**TestCollaboratorManagement (10 tests)** - Collaborator operations:
- `test_add_collaborator` - Add collaborator successfully
- `test_add_collaborator_duplicate` - Can't add twice
- `test_add_editor_requires_owner` - Only owner can add editors
- `test_editor_can_add_viewer` - Editor can add viewers
- `test_update_collaborator_role` - Update role
- `test_update_collaborator_requires_owner` - Only owner can update roles
- `test_remove_collaborator` - Remove collaborator
- `test_remove_collaborator_requires_owner` - Only owner can remove
- `test_list_collaborators` - List all collaborators
- `test_list_collaborators_unauthorized` - Unauthorized can't list

**TestLayerManagement (7 tests)** - Layer operations:
- `test_add_layer_to_map` - Add layer successfully
- `test_add_layer_duplicate` - Can't add same layer twice
- `test_remove_layer_from_map` - Remove layer
- `test_update_map_layer` - Update layer properties (visibility, opacity)
- `test_reorder_layers` - Reorder all layers in map
- `test_layer_operations_require_edit_permission` - Editor can manage layers
- `test_editor_can_manage_layers` - Verify editor permissions

**TestEdgeCases (21 tests)** - Error handling and edge cases:
- Tests for nonexistent maps, layers, users
- Invalid operation attempts
- Role determination in all scenarios
- Cascade delete verification
- Partial updates
- Permission changes
- String UUID handling
- And more comprehensive edge case coverage

**Test Results:**
```
54 passed, 7 warnings in 0.77s
```

**Status:** ✅ All tests passing

---

## Files Created (3 new files)

1. `/workspace/backend/app/schemas/map.py` - Pydantic schemas (5.2KB)
2. `/workspace/backend/app/services/map_service.py` - Business logic (21KB)
3. `/workspace/backend/app/api/v1/maps.py` - API endpoints (687 lines)
4. `/workspace/backend/tests/test_map_service.py` - Unit tests (54 tests)

## Files Modified (2 files)

1. `/workspace/backend/app/schemas/__init__.py` - Added map schema exports
2. `/workspace/backend/app/api/v1/router.py` - Registered maps router

---

## API Endpoints Summary

### Base URL: `/api/v1/maps`

| Method | Endpoint | Description | Permission | Status Codes |
|--------|----------|-------------|------------|--------------|
| GET | `/maps` | List user's maps | Authenticated | 200 |
| GET | `/maps/{id}` | Get map details | View access | 200, 403, 404 |
| POST | `/maps` | Create map | Authenticated | 201 |
| PUT | `/maps/{id}` | Update map | Edit access | 200, 403, 404 |
| DELETE | `/maps/{id}` | Delete map | Owner only | 200, 403, 404 |
| GET | `/maps/{id}/collaborators` | List collaborators | View access | 200, 403, 404 |
| POST | `/maps/{id}/collaborators` | Add collaborator | Owner/Editor* | 201, 400, 403, 404 |
| PUT | `/maps/{id}/collaborators/{user_id}` | Update collaborator role | Owner only | 200, 403, 404 |
| DELETE | `/maps/{id}/collaborators/{user_id}` | Remove collaborator | Owner only | 200, 403, 404 |
| POST | `/maps/{id}/layers` | Add layer to map | Edit access | 201, 400, 403, 404 |
| DELETE | `/maps/{id}/layers/{layer_id}` | Remove layer from map | Edit access | 200, 403, 404 |
| PUT | `/maps/{id}/layers/{layer_id}` | Update layer properties | Edit access | 200, 403, 404 |
| PUT | `/maps/{id}/layers/reorder` | Reorder layers | Edit access | 200, 403, 404 |

*Note: Editors can add viewers, only owner can add editors

---

## Permission System

### Map Permission Levels:

**Private (default):**
- Only creator can view
- Only creator can edit
- Only creator can add collaborators
- Only creator can delete

**Collaborators:**
- Creator + collaborators can view
- Creator + editors can edit
- Only creator can add/remove collaborators
- Only creator can delete

**Public:**
- Anyone can view
- Creator + editors can edit
- Only creator can add/remove collaborators
- Only creator can delete

### Collaborator Roles:

**Owner (implicit, not in collaborators table):**
- Full access to everything
- Can add/remove/update any collaborators
- Can delete map
- Can change map permission level

**Editor:**
- Can view map
- Can edit map properties (name, description, viewport)
- Can add/remove/reorder layers
- Can add viewer collaborators
- Cannot add editor collaborators
- Cannot remove collaborators
- Cannot delete map

**Viewer:**
- Can view map
- Can view collaborators list
- Cannot edit anything
- Cannot add/remove collaborators
- Cannot add/remove layers

---

## Testing the API

### Prerequisites:
1. Backend running: `npm run dev:backend`
2. Database running: `docker-compose up -d db`
3. Migrations applied: `npm run migrate`
4. Valid Clerk JWT token (from frontend or test endpoint)

### Example API Calls:

**1. Create a map:**
```bash
curl -X POST http://localhost:8000/api/v1/maps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "North Sea Marine Planning",
    "description": "Planning for offshore wind farms",
    "center_lat": 54.5,
    "center_lng": 3.5,
    "zoom": 7,
    "permission": "private"
  }'
```

**2. List user's maps:**
```bash
curl http://localhost:8000/api/v1/maps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**3. Get map details:**
```bash
curl http://localhost:8000/api/v1/maps/{map_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**4. Add collaborator:**
```bash
curl -X POST http://localhost:8000/api/v1/maps/{map_id}/collaborators \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid-here",
    "role": "editor"
  }'
```

**5. Add layer to map:**
```bash
curl -X POST http://localhost:8000/api/v1/maps/{map_id}/layers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "layer_id": "layer-uuid-here",
    "display_order": 1,
    "is_visible": true,
    "opacity": 100
  }'
```

**6. Update map:**
```bash
curl -X PUT http://localhost:8000/api/v1/maps/{map_id} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Map Name",
    "zoom": 8
  }'
```

**7. Reorder layers:**
```bash
curl -X PUT http://localhost:8000/api/v1/maps/{map_id}/layers/reorder \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "layer_orders": [
      {"layer_id": "layer-1-uuid", "display_order": 1},
      {"layer_id": "layer-2-uuid", "display_order": 2},
      {"layer_id": "layer-3-uuid", "display_order": 3}
    ]
  }'
```

---

## Success Criteria

Phase 3 is complete when:

- ✅ Pydantic schemas created for all map operations
- ✅ MapService implemented with 16 methods
- ✅ Permission system fully implemented (private/collaborators/public)
- ✅ Collaborator management (add/update/remove)
- ✅ Layer management (add/remove/update/reorder)
- ✅ 13 REST API endpoints created
- ✅ API router updated to include maps endpoints
- ✅ 54 unit tests written and passing
- ✅ Backend starts without errors
- ✅ All endpoints registered in OpenAPI
- ✅ End-to-end testing completed

**Current Status:** 11/11 tasks completed (100%)

---

## Architecture Implemented

### Request Flow:

```
Frontend (React)
    ↓ API Request + JWT Token
Backend API Endpoint (/api/v1/maps/*)
    ↓ Extract current_user (get_current_user dependency)
MapService
    ↓ Permission check (can_view_map, can_edit_map)
Database (PostgreSQL)
    ↓ Query maps, collaborators, map_layers
MapService
    ↓ Return SQLAlchemy models
API Endpoint
    ↓ Convert to Pydantic schemas
Frontend (React)
    ↓ Render UI
```

### Database Relationships:

```
User ──┬── creates → Map
       ├── creates → Layer
       └── collaborates → MapCollaborator

Map ──┬── has → MapCollaborator (many)
      ├── contains → MapLayer (many)
      └── created by → User

MapCollaborator ──┬── belongs to → Map
                  └── user → User

MapLayer ──┬── belongs to → Map
           └── references → Layer
```

---

## Key Implementation Decisions

1. **Three-tier architecture:**
   - API Layer (FastAPI endpoints) - HTTP handling, auth, validation
   - Service Layer (MapService) - Business logic, permissions
   - Model Layer (SQLAlchemy) - Database operations

2. **Permission checks in service layer:**
   - All permission logic centralized in MapService
   - API endpoints call service methods which enforce permissions
   - Clear separation of concerns

3. **Owner vs Collaborator:**
   - Owner is NOT in collaborators table (implicit from created_by)
   - Only explicit collaborators stored in map_collaborators
   - Owner always has full access (checked first)

4. **Partial updates supported:**
   - MapUpdate schema has all fields optional
   - Only provided fields are updated
   - SQLAlchemy handles partial updates automatically

5. **Cascade deletes:**
   - Deleting map removes all collaborators (cascade)
   - Deleting map removes all map_layer associations (cascade)
   - Layers themselves are NOT deleted (reusable across maps)

6. **Layer reordering:**
   - Bulk operation to reorder all layers at once
   - Validates all layer_ids belong to the map
   - Atomic update (all or nothing)

7. **Role-based permissions:**
   - Owner: Full access
   - Editor: Can edit map and manage layers
   - Viewer: Can only view
   - Clear hierarchy and capabilities

---

## Next Steps

### Phase 4: Layers API

From the implementation plan, Phase 4 will add:

1. **Layer CRUD endpoints:**
   - GET /api/v1/layers - Get layer library
   - POST /api/v1/layers - Create layer
   - PUT /api/v1/layers/{id} - Update layer
   - DELETE /api/v1/layers/{id} - Delete layer

2. **Layer types:**
   - WMS layers (external services)
   - GeoTIFF layers (raster data)
   - Vector layers (user-drawn features)

3. **Global layer library:**
   - is_global flag for shared layers
   - Filter by source_type, category
   - Permission system (creator-only vs everyone editable)

4. **Layer features (for vector layers):**
   - Store GeoJSON features in database
   - PostGIS spatial queries
   - Feature-level CRUD

### Integration with Frontend (Phase 7)

The Maps API is ready for frontend integration:

1. Replace mock data in `src/App.tsx` with API calls
2. Create API client service (`src/services/api.ts`)
3. Add loading states and error handling
4. Connect authentication (Clerk JWT → API calls)
5. Update map/layer management UI to call backend

---

## Known Issues

### Minor warnings (non-blocking):

1. **Pydantic deprecation warnings:**
   - Using `class Config:` instead of `ConfigDict`
   - Affects: config.py, user.py, map.py schemas
   - Fix: Update to Pydantic v2 ConfigDict syntax
   - Impact: None (will be addressed in future cleanup)

2. **SQLAlchemy transaction warning:**
   - Warning in test fixture cleanup
   - Only appears in specific edge case tests
   - Impact: Tests still pass correctly

---

## Documentation

- **API Documentation:** http://localhost:8000/docs (Swagger UI)
- **OpenAPI Spec:** http://localhost:8000/openapi.json
- **Implementation Plan:** `/workspace/implementation-plan.md`
- **Database Schema:** `/workspace/database-schema.md`
- **Phase 2 Summary:** `/workspace/PHASE2_IMPLEMENTATION_SUMMARY.md`
- **This Document:** `/workspace/PHASE3_IMPLEMENTATION_SUMMARY.md`

---

## Testing Commands Quick Reference

```bash
# Run all map service tests
cd /workspace/backend && source .venv/bin/activate && pytest tests/test_map_service.py -v

# Run specific test class
pytest tests/test_map_service.py::TestMapCRUD -v

# Run with coverage
pytest tests/test_map_service.py --cov=app.services.map_service --cov-report=term-missing

# Start backend
npm run dev:backend

# View API docs
open http://localhost:8000/docs

# Check OpenAPI spec
curl http://localhost:8000/openapi.json | python3 -m json.tool

# List all maps endpoints
curl -s http://localhost:8000/openapi.json | \
  python3 -c "import sys, json; data = json.load(sys.stdin); \
  [print(p) for p in data['paths'].keys() if '/maps' in p]"
```

---

**Phase 3 Status:** ✅ Implementation Complete | ✅ All Tests Passing | ✅ Production Ready

**Next Phase:** Phase 4 - Layers API (Layer CRUD, layer library, vector features)
