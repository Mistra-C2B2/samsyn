# Clerk Email Validation for Collaborators

## Overview

This document describes the implementation of Clerk API integration to validate collaborator emails before adding them to maps.

## Changes Made

### 1. Auth Service Enhancement (`app/services/auth_service.py`)

Added a new method `validate_user_email(email: str) -> bool` to the `ClerkAuthService` class:

**Purpose**: Validate if a user exists in Clerk by checking their email address via the Clerk API.

**Implementation Details**:
- Calls Clerk API endpoint: `GET https://api.clerk.com/v1/users?email_address[]={email}`
- Uses `CLERK_SECRET_KEY` from environment for authentication
- Returns `True` if user exists, `False` otherwise
- Handles errors gracefully with appropriate HTTP exceptions

**Error Handling**:
- Returns `False` for 404 responses (user not found)
- Raises `HTTPException` (503) for API communication errors
- Raises `HTTPException` (503) if `CLERK_SECRET_KEY` is not configured

### 2. Schema Update (`app/schemas/map.py`)

Modified `MapCollaboratorCreate` schema:

**Before**:
```python
class MapCollaboratorCreate(BaseModel):
    user_id: UUID
    role: CollaboratorRoleEnum = CollaboratorRoleEnum.viewer
```

**After**:
```python
class MapCollaboratorCreate(BaseModel):
    email: str = Field(..., description="Email address of the user to add as collaborator")
    role: CollaboratorRoleEnum = CollaboratorRoleEnum.viewer
```

**Rationale**:
- More user-friendly - users typically know collaborator emails, not UUIDs
- Enables validation against Clerk before database operations
- Maintains backward compatibility with internal user ID usage

### 3. Maps API Endpoint Update (`app/api/v1/maps.py`)

Updated the `add_collaborator` endpoint with a 3-step validation process:

#### Step 1: Validate Email with Clerk
```python
email_exists = await auth_service.validate_user_email(collaborator_data.email)
if not email_exists:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"User with email '{collaborator_data.email}' not found in Clerk..."
    )
```

#### Step 2: Lookup User in Database
```python
user_to_add = db.query(User).filter(User.email == collaborator_data.email).first()
if not user_to_add:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"User with email '{collaborator_data.email}' exists in Clerk but has not logged in..."
    )
```

#### Step 3: Add Collaborator
```python
collaborator = service.add_collaborator(
    map_id=map_id,
    user_id_to_add=user_to_add.id,
    role=collaborator_data.role.value,
    requester_id=current_user.id,
)
```

## Error Messages

The implementation provides clear, actionable error messages:

1. **Email not in Clerk**:
   - Status: 404
   - Message: "User with email '{email}' not found in Clerk. Please ensure the user has signed up."

2. **Email in Clerk but not in app database**:
   - Status: 404
   - Message: "User with email '{email}' exists in Clerk but has not logged into this application yet. Please ask them to sign in first."

3. **User already a collaborator**:
   - Status: 400
   - Message: "User '{email}' is already a collaborator or cannot be added to this map"

## API Usage

### Request

```bash
POST /api/v1/maps/{map_id}/collaborators
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "email": "collaborator@example.com",
  "role": "viewer"  // or "editor"
}
```

### Response (Success - 201)

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "role": "viewer",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Response (Error - 404)

```json
{
  "detail": "User with email 'collaborator@example.com' not found in Clerk. Please ensure the user has signed up."
}
```

## Testing

A test script is provided at `/workspace/backend/test_clerk_validation.py`:

```bash
cd /workspace/backend
python test_clerk_validation.py
```

**Note**: Update the test script with actual email addresses from your Clerk instance for proper testing.

## Dependencies

- `httpx`: Async HTTP client for Clerk API calls (already in use)
- `CLERK_SECRET_KEY`: Environment variable (required)

## Security Considerations

1. **API Key Protection**: The `CLERK_SECRET_KEY` is stored in environment variables and never exposed in responses
2. **Rate Limiting**: Consider implementing rate limiting on the add_collaborator endpoint to prevent abuse
3. **Email Validation**: Email is validated at two levels:
   - Clerk API (does user exist?)
   - Local database (has user logged in?)

## Future Enhancements

1. **Caching**: Cache Clerk validation results for frequently checked emails (with short TTL)
2. **Batch Validation**: Add endpoint to validate multiple emails at once
3. **Invitation System**: Allow adding collaborators who haven't signed up yet (send invitation email)
4. **User Search**: Add endpoint to search for users by email/name for autocomplete in UI

## Rollback Instructions

If you need to revert these changes:

1. Restore `MapCollaboratorCreate` schema to use `user_id: UUID`
2. Remove `validate_user_email` method from `auth_service.py`
3. Revert `add_collaborator` endpoint to accept `user_id` directly
4. Remove import of `auth_service` from `maps.py`
