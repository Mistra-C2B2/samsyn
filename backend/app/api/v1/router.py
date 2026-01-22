from fastapi import APIRouter

api_router = APIRouter()

# Phase 2: Authentication endpoints
from app.api.v1 import test_auth, test_webhooks, webhooks  # noqa: E402

api_router.include_router(webhooks.router)
api_router.include_router(test_auth.router)
api_router.include_router(
    test_webhooks.router
)  # For local testing without signatures  # TODO: Remove after Phase 2 testing

# Phase 3: Maps CRUD
from app.api.v1 import maps  # noqa: E402

api_router.include_router(maps.router)

# Phase 3: Layers CRUD
from app.api.v1 import layers  # noqa: E402

api_router.include_router(layers.router)

# Phase 4: Features CRUD
from app.api.v1 import features  # noqa: E402

api_router.include_router(features.router)

# Phase 6: Comments System
from app.api.v1 import comments  # noqa: E402

api_router.include_router(comments.router)

# WMS Proxy (dev mode only)
from app.api.v1 import wms  # noqa: E402

api_router.include_router(wms.router)

# TiTiler Proxy (dev mode only) - for COG/GeoTIFF tile serving
from app.api.v1 import titiler  # noqa: E402

api_router.include_router(titiler.router)

# WMS Servers
from app.api.v1 import wms_servers  # noqa: E402

api_router.include_router(wms_servers.router)

# User account management
from app.api.v1 import users  # noqa: E402

api_router.include_router(users.router)
