# Comments API - Usage Examples

## Overview

The Comments API provides 7 endpoints for managing threaded comments on maps and layers in the SamSyn application.

Base URL: `/api/v1/comments`

## Authentication

All endpoints require authentication via Clerk JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. List Comments

```http
GET /api/v1/comments
```

**Query Parameters:**
- `map_id` (UUID, optional): Filter comments on a specific map
- `layer_id` (UUID, optional): Filter comments on a specific layer
- `parent_id` (UUID, optional): Filter direct replies to a comment
- `include_resolved` (boolean, optional, default: true): Include resolved comments
- `limit` (integer, optional, default: 100, max: 1000): Max comments to return
- `offset` (integer, optional, default: 0): Number to skip (pagination)

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/comments?map_id=abc-123&limit=50" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
[
  {
    "id": "comment-uuid-1",
    "content": "This map looks great!",
    "author_id": "user-uuid-1",
    "author_name": "john_doe",
    "map_id": "map-uuid-1",
    "layer_id": null,
    "parent_id": null,
    "is_resolved": false,
    "reply_count": 3,
    "created_at": "2025-12-02T10:00:00Z",
    "updated_at": "2025-12-02T10:00:00Z"
  }
]
```

---

### 2. Get Single Comment

```http
GET /api/v1/comments/{comment_id}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/comments/comment-uuid-1" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": "comment-uuid-1",
  "content": "This map looks great!",
  "author_id": "user-uuid-1",
  "author_name": "john_doe",
  "map_id": "map-uuid-1",
  "layer_id": null,
  "parent_id": null,
  "is_resolved": false,
  "reply_count": 3,
  "created_at": "2025-12-02T10:00:00Z",
  "updated_at": "2025-12-02T10:00:00Z"
}
```

---

### 3. Get Comment Thread

```http
GET /api/v1/comments/{comment_id}/thread
```

**Query Parameters:**
- `max_depth` (integer, optional, default: 10, max: 20): Maximum nesting depth

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/comments/comment-uuid-1/thread?max_depth=5" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": "comment-uuid-1",
  "content": "This map looks great!",
  "author_id": "user-uuid-1",
  "author_name": "john_doe",
  "map_id": "map-uuid-1",
  "layer_id": null,
  "parent_id": null,
  "is_resolved": false,
  "reply_count": 2,
  "created_at": "2025-12-02T10:00:00Z",
  "updated_at": "2025-12-02T10:00:00Z",
  "replies": [
    {
      "id": "reply-uuid-1",
      "content": "Thanks! I agree.",
      "author_id": "user-uuid-2",
      "author_name": "jane_smith",
      "map_id": "map-uuid-1",
      "layer_id": null,
      "parent_id": "comment-uuid-1",
      "is_resolved": false,
      "reply_count": 0,
      "created_at": "2025-12-02T10:05:00Z",
      "updated_at": "2025-12-02T10:05:00Z"
    }
  ]
}
```

---

### 4. Create Comment

```http
POST /api/v1/comments
```

**Request Body:**
```json
{
  "content": "This is a new comment on the map",
  "map_id": "map-uuid-1",
  "layer_id": null,
  "parent_id": null
}
```

**Validation Rules:**
- `content`: Required, cannot be empty or whitespace
- Either `map_id` OR `layer_id` must be provided (not both, not neither)
- If `parent_id` provided, parent must exist and be on same target

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/comments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This layer needs more detail in the northeast region",
    "map_id": null,
    "layer_id": "layer-uuid-1",
    "parent_id": null
  }'
```

**Response (201 Created):**
```json
{
  "id": "new-comment-uuid",
  "content": "This layer needs more detail in the northeast region",
  "author_id": "current-user-uuid",
  "author_name": "john_doe",
  "map_id": null,
  "layer_id": "layer-uuid-1",
  "parent_id": null,
  "is_resolved": false,
  "reply_count": 0,
  "created_at": "2025-12-02T11:00:00Z",
  "updated_at": "2025-12-02T11:00:00Z"
}
```

---

### 5. Update Comment

```http
PUT /api/v1/comments/{comment_id}
```

**Authorization:** Only the comment author can update their comments.

**Request Body:**
```json
{
  "content": "Updated comment text"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/v1/comments/comment-uuid-1" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This map looks even better after the updates!"
  }'
```

**Response:**
```json
{
  "id": "comment-uuid-1",
  "content": "This map looks even better after the updates!",
  "author_id": "user-uuid-1",
  "author_name": "john_doe",
  "map_id": "map-uuid-1",
  "layer_id": null,
  "parent_id": null,
  "is_resolved": false,
  "reply_count": 3,
  "created_at": "2025-12-02T10:00:00Z",
  "updated_at": "2025-12-02T11:30:00Z"
}
```

**Error Responses:**
- `403 Forbidden`: User is not the comment author
- `404 Not Found`: Comment doesn't exist

---

### 6. Delete Comment

```http
DELETE /api/v1/comments/{comment_id}
```

**Authorization:** Only the comment author can delete their comments.

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/comments/comment-uuid-1" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "status": "deleted"
}
```

**Notes:**
- Deletion cascades to all nested replies
- This is a hard delete (permanent)

**Error Responses:**
- `403 Forbidden`: User is not the comment author
- `404 Not Found`: Comment doesn't exist

---

### 7. Resolve Comment

```http
PUT /api/v1/comments/{comment_id}/resolve
```

**Authorization:** Any authenticated user can resolve/unresolve comments.

**Query Parameters:**
- `is_resolved` (boolean, required): New resolution status

**Example Request:**
```bash
# Mark as resolved
curl -X PUT "http://localhost:8000/api/v1/comments/comment-uuid-1/resolve?is_resolved=true" \
  -H "Authorization: Bearer <token>"

# Mark as unresolved
curl -X PUT "http://localhost:8000/api/v1/comments/comment-uuid-1/resolve?is_resolved=false" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "id": "comment-uuid-1",
  "content": "This map looks great!",
  "author_id": "user-uuid-1",
  "author_name": "john_doe",
  "map_id": "map-uuid-1",
  "layer_id": null,
  "parent_id": null,
  "is_resolved": true,
  "reply_count": 3,
  "created_at": "2025-12-02T10:00:00Z",
  "updated_at": "2025-12-02T12:00:00Z"
}
```

---

## Common Use Cases

### 1. Get all unresolved comments on a map
```bash
curl -X GET "http://localhost:8000/api/v1/comments?map_id=<map-uuid>&include_resolved=false" \
  -H "Authorization: Bearer <token>"
```

### 2. Reply to a comment
```bash
curl -X POST "http://localhost:8000/api/v1/comments" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I agree with your assessment",
    "map_id": "<map-uuid>",
    "parent_id": "<parent-comment-uuid>"
  }'
```

### 3. Get comment thread with limited depth
```bash
curl -X GET "http://localhost:8000/api/v1/comments/<comment-uuid>/thread?max_depth=3" \
  -H "Authorization: Bearer <token>"
```

### 4. Get comments on a specific layer
```bash
curl -X GET "http://localhost:8000/api/v1/comments?layer_id=<layer-uuid>" \
  -H "Authorization: Bearer <token>"
```

### 5. Paginate through comments
```bash
# First page (comments 0-99)
curl -X GET "http://localhost:8000/api/v1/comments?map_id=<map-uuid>&limit=100&offset=0" \
  -H "Authorization: Bearer <token>"

# Second page (comments 100-199)
curl -X GET "http://localhost:8000/api/v1/comments?map_id=<map-uuid>&limit=100&offset=100" \
  -H "Authorization: Bearer <token>"
```

---

## Error Handling

All endpoints follow consistent error response format:

**400 Bad Request:**
```json
{
  "detail": "Either map_id or layer_id must be provided"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "detail": "Only the comment author can update this comment"
}
```

**404 Not Found:**
```json
{
  "detail": "Comment not found"
}
```

---

## Response Fields

### CommentResponse

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Comment unique identifier |
| `content` | string | Comment text content |
| `author_id` | UUID | User ID who created the comment |
| `author_name` | string | Username of comment author (computed) |
| `map_id` | UUID \| null | Map this comment is on (if applicable) |
| `layer_id` | UUID \| null | Layer this comment is on (if applicable) |
| `parent_id` | UUID \| null | Parent comment ID (if this is a reply) |
| `is_resolved` | boolean | Resolution status |
| `reply_count` | integer | Number of direct replies (computed) |
| `created_at` | datetime | When comment was created |
| `updated_at` | datetime | When comment was last updated |

### CommentWithReplies

Extends `CommentResponse` with:

| Field | Type | Description |
|-------|------|-------------|
| `replies` | CommentResponse[] | Array of direct replies (nested structure) |

---

## OpenAPI Documentation

Interactive API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

