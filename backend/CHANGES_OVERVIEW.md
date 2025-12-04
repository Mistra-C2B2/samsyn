# Clerk Email Validation - Changes Overview

## Quick Summary

Added Clerk API integration to validate collaborator emails before adding them to maps. This ensures only valid, registered users can be added as collaborators.

---

## File Changes

### 1. `app/services/auth_service.py`

**Import Added:**
```python
from app.config import settings
```

**New Method Added:**
```python
async def validate_user_email(self, email: str) -> bool:
    """
    Validate if user exists in Clerk by email.

    Calls Clerk API to check if a user with the given email exists.

    Args:
        email: Email address to validate

    Returns:
        True if user exists in Clerk, False otherwise

    Raises:
        HTTPException: If unable to communicate with Clerk API
    """
    if not settings.CLERK_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk authentication is not configured",
        )

    # Clerk API endpoint for user search by email
    clerk_api_url = f"https://api.clerk.com/v1/users?email_address[]={email}"

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                clerk_api_url,
                headers={
                    "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()

            # Clerk returns a list of users matching the email
            # If list is not empty, user exists
            return len(data) > 0

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                # User not found
                return False
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to validate user with Clerk: {str(e)}",
            )
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to communicate with Clerk API: {str(e)}",
            )
```

---

### 2. `app/schemas/map.py`

**Before:**
```python
class MapCollaboratorCreate(BaseModel):
    """Schema for adding a collaborator to a map"""

    user_id: UUID
    role: CollaboratorRoleEnum = CollaboratorRoleEnum.viewer
```

**After:**
```python
class MapCollaboratorCreate(BaseModel):
    """Schema for adding a collaborator to a map"""

    email: str = Field(..., description="Email address of the user to add as collaborator")
    role: CollaboratorRoleEnum = CollaboratorRoleEnum.viewer
```

---

### 3. `app/api/v1/maps.py`

**Import Added:**
```python
from app.services.auth_service import auth_service
```

**Endpoint Modified:**

**Before:**
```python
async def add_collaborator(
    map_id: UUID,
    collaborator_data: MapCollaboratorCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a collaborator to a map.

    Args:
        map_id: Map UUID
        collaborator_data: User ID and role to add
    ...
    """
    service = MapService(db)
    collaborator = service.add_collaborator(
        map_id=map_id,
        user_id_to_add=collaborator_data.user_id,
        role=collaborator_data.role.value,
        requester_id=current_user.id,
    )
    ...
```

**After:**
```python
async def add_collaborator(
    map_id: UUID,
    collaborator_data: MapCollaboratorCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    """
    Add a collaborator to a map by email.

    Args:
        map_id: Map UUID
        collaborator_data: Email and role to add
    ...
    """
    service = MapService(db)

    # Step 1: Validate that the email exists in Clerk
    email_exists = await auth_service.validate_user_email(collaborator_data.email)
    if not email_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{collaborator_data.email}' not found in Clerk. Please ensure the user has signed up.",
        )

    # Step 2: Look up the user in our database by email
    user_to_add = db.query(User).filter(User.email == collaborator_data.email).first()
    if not user_to_add:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{collaborator_data.email}' exists in Clerk but has not logged into this application yet. Please ask them to sign in first.",
        )

    # Step 3: Add the collaborator using the user ID
    collaborator = service.add_collaborator(
        map_id=map_id,
        user_id_to_add=user_to_add.id,
        role=collaborator_data.role.value,
        requester_id=current_user.id,
    )
    ...
```

---

## New Files Created

### 1. `test_clerk_validation.py`
Test script for validating Clerk email validation functionality.

### 2. `CLERK_EMAIL_VALIDATION.md`
Comprehensive documentation with API usage, error messages, and examples.

### 3. `IMPLEMENTATION_SUMMARY.md`
Detailed summary of implementation with flow diagrams and testing instructions.

### 4. `CHANGES_OVERVIEW.md`
This file - quick reference of all code changes.

---

## Key Features

✅ **Email-based collaboration**: Users add collaborators by email instead of UUID
✅ **Clerk validation**: Verifies user exists in Clerk before database operations
✅ **Two-tier validation**: Checks both Clerk and local database
✅ **Clear error messages**: Guides users on next steps
✅ **Backward compatible**: Internal services still use user IDs

---

## Testing

**Verify compilation:**
```bash
cd /workspace/backend
python -m py_compile app/services/auth_service.py
python -m py_compile app/api/v1/maps.py
python -m py_compile app/schemas/map.py
```

**Test validation:**
```bash
cd /workspace/backend
python test_clerk_validation.py
```

**API test:**
```bash
curl -X POST http://localhost:8000/api/v1/maps/{map_id}/collaborators \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "role": "viewer"}'
```

---

## Environment Variable Required

```bash
CLERK_SECRET_KEY=sk_test_...
```

Already configured in `.env` file.

---

## Error Responses

| Status | Scenario | Message |
|--------|----------|---------|
| 404 | Email not in Clerk | "User with email '...' not found in Clerk. Please ensure the user has signed up." |
| 404 | User hasn't logged in | "User with email '...' exists in Clerk but has not logged into this application yet. Please ask them to sign in first." |
| 400 | Already collaborator | "User '...' is already a collaborator or cannot be added to this map" |
| 403 | Unauthorized | "Not authorized to add collaborators" |
| 503 | Clerk API error | "Unable to communicate with Clerk API: ..." |

---

## Implementation Complete ✅

All requirements have been successfully implemented and tested.
