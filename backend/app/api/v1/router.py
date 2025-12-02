from fastapi import APIRouter

api_router = APIRouter()

# Phase 2: Authentication endpoints
from app.api.v1 import webhooks, test_auth, test_webhooks

api_router.include_router(webhooks.router)
api_router.include_router(test_auth.router)
api_router.include_router(test_webhooks.router)  # For local testing without signatures  # TODO: Remove after Phase 2 testing

# Phase 3: Maps CRUD
from app.api.v1 import maps

api_router.include_router(maps.router)

# Phase 3: Layers CRUD
from app.api.v1 import layers

api_router.include_router(layers.router)

# Phase 4: Features CRUD
from app.api.v1 import features

api_router.include_router(features.router)

# Phase 6: Comments System
from app.api.v1 import comments

api_router.include_router(comments.router)

# Future routers will be added in later phases
# from app.api.v1 import users
# api_router.include_router(users.router)
