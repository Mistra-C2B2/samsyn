# Phase 6 Implementation Plan: Comments System

**Status**: ✅ **COMPLETED**
**Date**: December 2, 2025
**Phase**: Threaded Comments on Maps and Layers

---

## Overview

Phase 6 implements a complete threaded commenting system for the SamSyn backend. Users can comment on maps or individual layers, reply to comments (threading), and mark comments as resolved.

---

## Current State

### Already Implemented
- ✅ **Comment Model** (`backend/app/models/comment.py`)
  - Self-referential relationship for threading (parent_id)
  - Links to maps and layers (map_id, layer_id)
  - Resolution status tracking (is_resolved)
  - Proper relationships to User, Map, and Layer models

### Files to Create
1. `backend/app/schemas/comment.py` - Pydantic schemas
2. `backend/app/services/comment_service.py` - Business logic
3. `backend/app/api/v1/comments.py` - REST API endpoints
4. `backend/tests/test_comment_service.py` - Unit tests

### Files to Modify
1. `backend/app/api/v1/router.py` - Add comments router
2. Check migration for comments table

---

## Implementation Tasks

### Task 1: Create Comment Schemas
**File**: `backend/app/schemas/comment.py`

**Schemas to create**:
- `CommentCreate` - For creating new comments
  - content: str (required)
  - map_id: Optional[UUID]
  - layer_id: Optional[UUID]
  - parent_id: Optional[UUID]
  - Validation: Either map_id OR layer_id must be provided (not both, not neither)

- `CommentUpdate` - For updating comments
  - content: Optional[str]

- `CommentResponse` - For API responses
  - id: UUID
  - content: str
  - author_id: UUID
  - author_name: Optional[str] (from User relationship)
  - map_id: Optional[UUID]
  - layer_id: Optional[UUID]
  - parent_id: Optional[UUID]
  - is_resolved: bool
  - created_at: datetime
  - updated_at: datetime
  - reply_count: Optional[int]

- `CommentWithReplies` - For threaded view
  - Extends CommentResponse
  - replies: List[CommentResponse]

**Validation Rules**:
- Content must not be empty
- Either map_id OR layer_id must be set (XOR logic)
- Parent comment must exist if parent_id is provided
- Parent comment must be on the same target (map/layer)

---

### Task 2: Create Comment Service
**File**: `backend/app/services/comment_service.py`

**Methods to implement**:

```python
class CommentService:
    def __init__(self, db: Session):
        self.db = db

    def create_comment(
        self,
        comment_data: CommentCreate,
        author_id: UUID
    ) -> Comment:
        """Create a new comment with validation"""
        # Validate map/layer exists
        # Validate parent comment if parent_id provided
        # Create and return comment

    def get_comment(self, comment_id: UUID) -> Optional[Comment]:
        """Get single comment by ID"""

    def list_comments(
        self,
        map_id: Optional[UUID] = None,
        layer_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        include_resolved: bool = True,
        limit: int = 100,
        offset: int = 0
    ) -> List[Comment]:
        """List comments with filters"""
        # Support filtering by map, layer, parent
        # Option to exclude resolved comments
        # Pagination support

    def count_comments(
        self,
        map_id: Optional[UUID] = None,
        layer_id: Optional[UUID] = None,
        parent_id: Optional[UUID] = None,
        include_resolved: bool = True
    ) -> int:
        """Count comments matching filters"""

    def get_comment_thread(
        self,
        comment_id: UUID,
        max_depth: int = 10
    ) -> Optional[Comment]:
        """Get comment with all nested replies"""
        # Load comment with eager loading of replies
        # Recursively load nested replies up to max_depth

    def update_comment(
        self,
        comment_id: UUID,
        comment_update: CommentUpdate
    ) -> Comment:
        """Update comment content"""

    def delete_comment(self, comment_id: UUID) -> bool:
        """Delete comment and optionally cascade to replies"""
        # Consider: soft delete vs hard delete
        # Consider: delete replies or orphan them

    def resolve_comment(
        self,
        comment_id: UUID,
        is_resolved: bool
    ) -> Comment:
        """Mark comment as resolved/unresolved"""

    def get_replies(
        self,
        parent_id: UUID,
        limit: int = 100,
        offset: int = 0
    ) -> List[Comment]:
        """Get direct replies to a comment"""
```

**Business Logic**:
- Validate target (map/layer) exists before creating comment
- Validate parent comment exists and is on same target
- Enforce permissions (only author can edit/delete)
- Handle cascading deletes for threaded comments

---

### Task 3: Create Comments API Endpoints
**File**: `backend/app/api/v1/comments.py`

**Endpoints**:

```python
# GET /api/v1/comments
@router.get("", response_model=List[CommentResponse])
def list_comments(
    map_id: Optional[UUID] = Query(None),
    layer_id: Optional[UUID] = Query(None),
    parent_id: Optional[UUID] = Query(None),
    include_resolved: bool = Query(True),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List comments with optional filters"""

# GET /api/v1/comments/{comment_id}
@router.get("/{comment_id}", response_model=CommentResponse)
def get_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single comment by ID"""

# GET /api/v1/comments/{comment_id}/thread
@router.get("/{comment_id}/thread", response_model=CommentWithReplies)
def get_comment_thread(
    comment_id: UUID,
    max_depth: int = Query(10, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get comment with all nested replies"""

# POST /api/v1/comments
@router.post("", response_model=CommentResponse, status_code=201)
def create_comment(
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new comment"""

# PUT /api/v1/comments/{comment_id}
@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: UUID,
    comment_update: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update comment (author only)"""

# DELETE /api/v1/comments/{comment_id}
@router.delete("/{comment_id}")
def delete_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete comment (author only)"""

# PUT /api/v1/comments/{comment_id}/resolve
@router.put("/{comment_id}/resolve", response_model=CommentResponse)
def resolve_comment(
    comment_id: UUID,
    is_resolved: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark comment as resolved/unresolved"""
```

**Authorization Rules**:
- All endpoints require authentication (Clerk JWT)
- Only comment author can update/delete their own comments
- Anyone with access to the map/layer can create comments
- Anyone with access to the map/layer can resolve comments

---

### Task 4: Update Router
**File**: `backend/app/api/v1/router.py`

**Changes**:
```python
# Add to imports
from app.api.v1 import comments

# Add to router includes
api_router.include_router(comments.router)
```

---

### Task 5: Write Comprehensive Tests
**File**: `backend/tests/test_comment_service.py`

**Test Categories**:

1. **Comment Creation** (8 tests)
   - Create comment on map
   - Create comment on layer
   - Create reply to comment
   - Reject comment without target
   - Reject comment with both map and layer
   - Reject comment with invalid parent
   - Reject reply on different target

2. **Comment Retrieval** (6 tests)
   - Get single comment
   - List all comments
   - List comments by map
   - List comments by layer
   - List replies to comment
   - Get comment thread with nested replies

3. **Comment Updates** (4 tests)
   - Update comment content
   - Reject empty content
   - Test updated_at timestamp
   - Test permissions (only author can update)

4. **Comment Deletion** (3 tests)
   - Delete comment
   - Test cascade to replies
   - Test permissions (only author can delete)

5. **Resolution Status** (3 tests)
   - Resolve comment
   - Unresolve comment
   - Filter by resolution status

6. **Pagination & Counting** (3 tests)
   - Paginate comment list
   - Count comments with filters
   - Count replies

**Total**: ~27 tests minimum

---

### Task 6: Verify Database Migration
**File**: Check `backend/alembic/versions/*.py`

**Action**:
- Verify comments table exists in migration
- If not, create new migration:
  ```bash
  cd backend
  alembic revision --autogenerate -m "add_comments_table"
  alembic upgrade head
  ```

---

## Expected Deliverables

1. ✅ Comment schemas with validation
2. ✅ Comment service with full CRUD
3. ✅ REST API endpoints (7 endpoints)
4. ✅ Comprehensive unit tests (27+ tests, 100% pass rate)
5. ✅ Database migration verified/created
6. ✅ Router updated
7. ✅ Documentation (this plan + summary doc)

---

## API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/comments` | List comments with filters |
| GET | `/api/v1/comments/{id}` | Get single comment |
| GET | `/api/v1/comments/{id}/thread` | Get comment with replies |
| POST | `/api/v1/comments` | Create comment |
| PUT | `/api/v1/comments/{id}` | Update comment |
| DELETE | `/api/v1/comments/{id}` | Delete comment |
| PUT | `/api/v1/comments/{id}/resolve` | Toggle resolution status |

---

## Integration Points

### Frontend Integration (Phase 7)
- Comment section in LayerManager
- Comment threads on map features
- Reply UI for threaded discussions
- Resolution status indicators
- Real-time comment counts

### Database Schema
```sql
-- Already exists in migration
CREATE TABLE comments (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    author_id UUID REFERENCES users(id),
    map_id UUID REFERENCES maps(id),
    layer_id UUID REFERENCES layers(id),
    parent_id UUID REFERENCES comments(id),
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_comments_map_id ON comments(map_id);
CREATE INDEX idx_comments_layer_id ON comments(layer_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
```

---

## Success Criteria

- ✅ All unit tests pass (27+ tests)
- ✅ API endpoints documented in OpenAPI
- ✅ Threaded comments work correctly
- ✅ Resolution status tracking functional
- ✅ Authorization enforced correctly
- ✅ No N+1 query issues (use eager loading)
- ✅ Follows existing code patterns from Phases 1-5

---

## Estimated Effort

- Schema creation: 30 minutes
- Service implementation: 1.5 hours
- API endpoints: 1 hour
- Testing: 1.5 hours
- Documentation: 30 minutes

**Total**: ~4-5 hours

---

## Next Phase Preview: Phase 7 - Frontend Integration

After Phase 6, the final phase will:
1. Create API client service in React frontend
2. Replace mock comments with real API calls
3. Add loading states and error handling
4. Implement real-time updates (optional)
5. Complete end-to-end testing
