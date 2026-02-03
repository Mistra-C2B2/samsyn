"""
Layer service for database operations.

Handles all layer CRUD operations including:
- Layer listing with filtering (source_type, category, is_global, search)
- Layer retrieval with permission checks
- Layer creation, updates, and deletion
- Permission validation (creator-only vs everyone editable)
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy import and_, not_, or_
from sqlalchemy.orm import Session

from app.models.layer import Layer
from app.schemas.layer import LayerCreate, LayerUpdate


class LayerService:
    """Service for layer database operations"""

    def __init__(self, db: Session):
        self.db = db

    # ========================================================================
    # Core CRUD Operations
    # ========================================================================

    def list_layers(
        self,
        user_id: Optional[UUID] = None,
        source_type: Optional[str] = None,
        category: Optional[str] = None,
        is_global: Optional[bool] = None,
        search: Optional[str] = None,
        include_my_layers: Optional[bool] = None,
    ) -> List[Layer]:
        """
        Get layers accessible to user with optional filtering.

        Returns:
        - All global layers (is_global=True)
        - All layers created by the user (if user_id provided)
        - All public non-global layers from other users (visibility='public')

        Filters can be applied on top of this base set.

        Args:
            user_id: User's internal UUID (optional - if None, only returns
                global layers)
            source_type: Filter by source type (wms, geotiff, vector)
            category: Filter by category
            is_global: Filter by global status (True=only global,
                False=only non-global, None=all)
            search: Search in name and description (case-insensitive)
            include_my_layers: If True, return only user's own non-global
                layers (for "My Layers" section)

        Returns:
            List of Layer instances matching criteria
        """
        # Special case: "My Layers" section - only user's own non-global layers
        # created via the "Create Layer" button (creation_source = "layer_creator")
        if include_my_layers is True and user_id:
            query = self.db.query(Layer).filter(
                and_(
                    Layer.created_by == user_id,
                    not_(Layer.is_global),
                    Layer.creation_source == "layer_creator",
                )
            )
            # Skip other filters for "My Layers" section,
            # go directly to ordering
            query = query.order_by(Layer.created_at.desc())
            return query.all()

        # Build base query - global layers OR user's own layers
        # OR public non-global layers
        if user_id:
            query = self.db.query(Layer).filter(
                or_(
                    Layer.is_global,
                    Layer.created_by == user_id,
                    and_(Layer.visibility == "public", not_(Layer.is_global)),
                )
            )
        else:
            # Not authenticated - show global layers + public non-global layers
            query = self.db.query(Layer).filter(
                or_(Layer.is_global, Layer.visibility == "public")
            )

        # Apply filters
        if source_type is not None:
            query = query.filter(Layer.source_type == source_type)

        if category is not None:
            query = query.filter(Layer.category == category)

        if is_global is not None:
            query = query.filter(Layer.is_global == is_global)

        if search is not None and search.strip():
            # Case-insensitive search in name and description
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Layer.name.ilike(search_pattern),
                    Layer.description.ilike(search_pattern),
                )
            )

        # Order by creation date (newest first)
        query = query.order_by(Layer.created_at.desc())

        return query.all()

    def get_layer(self, layer_id: UUID) -> Optional[Layer]:
        """
        Get layer by ID.

        No permission check - layers are viewable by anyone.

        Args:
            layer_id: Layer UUID

        Returns:
            Layer if found, None otherwise
        """
        from sqlalchemy.orm import joinedload

        return (
            self.db.query(Layer)
            .options(joinedload(Layer.creator))
            .filter(Layer.id == layer_id)
            .first()
        )

    def create_layer(self, layer_data: LayerCreate, creator_id: UUID) -> Layer:
        """
        Create new layer.

        Args:
            layer_data: Layer creation schema
            creator_id: User UUID creating the layer

        Returns:
            Created Layer instance
        """
        layer = Layer(
            name=layer_data.name,
            source_type=layer_data.source_type.value,
            description=layer_data.description,
            category=layer_data.category,
            created_by=creator_id,
            editable=layer_data.editable.value,
            is_global=layer_data.is_global,
            visibility=(
                layer_data.visibility.value if layer_data.visibility else "private"
            ),
            creation_source=(
                layer_data.creation_source.value
                if layer_data.creation_source
                else "system"
            ),
            source_config=layer_data.source_config or {},
            style_config=layer_data.style_config or {},
            legend_config=layer_data.legend_config or {},
            layer_metadata=layer_data.metadata or {},
        )

        self.db.add(layer)
        self.db.commit()
        self.db.refresh(layer)

        return layer

    def update_layer(
        self, layer_id: UUID, layer_data: LayerUpdate, user_id: UUID
    ) -> Optional[Layer]:
        """
        Update layer with permission check.

        Only updates fields that are provided (partial update).

        Permission logic:
        - If editable is "creator-only": Only creator can update
        - If editable is "everyone": Anyone can update

        Args:
            layer_id: Layer UUID
            layer_data: Partial update schema
            user_id: User UUID requesting the update

        Returns:
            Updated Layer or None if not found/unauthorized
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return None

        # Check if user can edit this layer
        if not self.can_edit_layer(layer_id, user_id):
            return None

        # Update only provided fields
        update_dict = layer_data.model_dump(exclude_unset=True, by_alias=False)
        for field, value in update_dict.items():
            # Handle enum conversion
            if field == "source_type" and value is not None:
                value = value.value
            elif field == "editable" and value is not None:
                value = value.value
            elif field == "visibility" and value is not None:
                value = value.value
            # Handle metadata alias
            # (Pydantic uses 'metadata' but model uses 'layer_metadata')
            if field == "metadata":
                setattr(layer, "layer_metadata", value)
            else:
                setattr(layer, field, value)

        self.db.commit()
        self.db.refresh(layer)

        return layer

    def update_layer_as_admin(
        self, layer_id: UUID, layer_data: LayerUpdate
    ) -> Optional[Layer]:
        """
        Update layer without permission check (for admins).

        Only updates fields that are provided (partial update).
        This method should only be called after verifying admin privileges.

        Args:
            layer_id: Layer UUID
            layer_data: Partial update schema

        Returns:
            Updated Layer or None if not found
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return None

        # Update only provided fields
        update_dict = layer_data.model_dump(exclude_unset=True, by_alias=False)
        for field, value in update_dict.items():
            # Handle enum conversion
            if field == "source_type" and value is not None:
                value = value.value
            elif field == "editable" and value is not None:
                value = value.value
            elif field == "visibility" and value is not None:
                value = value.value
            # Handle metadata alias
            # (Pydantic uses 'metadata' but model uses 'layer_metadata')
            if field == "metadata":
                setattr(layer, "layer_metadata", value)
            else:
                setattr(layer, field, value)

        self.db.commit()
        self.db.refresh(layer)

        return layer

    def delete_layer(self, layer_id: UUID, user_id: UUID) -> bool:
        """
        Delete layer with permission check.

        Only the layer creator can delete the layer.
        This cascades to remove all features and map associations.

        Args:
            layer_id: Layer UUID
            user_id: User UUID requesting deletion

        Returns:
            True if deleted, False if not found/unauthorized
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return False

        # Only creator can delete layer
        if layer.created_by != user_id:
            return False

        self.db.delete(layer)
        self.db.commit()

        return True

    def delete_layer_as_admin(self, layer_id: UUID) -> bool:
        """
        Delete layer without permission check (for admins).

        This method should only be called after verifying admin privileges.
        Cascades to remove all features and map associations.

        Args:
            layer_id: Layer UUID

        Returns:
            True if deleted, False if not found
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return False

        self.db.delete(layer)
        self.db.commit()

        return True

    # ========================================================================
    # Permission Checks
    # ========================================================================

    def can_edit_layer(self, layer_id: UUID, user_id: UUID) -> bool:
        """
        Check if user can edit layer.

        Permission logic:
        - If editable is "creator-only": Only creator can edit
        - If editable is "everyone": Anyone can edit

        Args:
            layer_id: Layer UUID
            user_id: User UUID

        Returns:
            True if user can edit, False otherwise
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return False

        # Creator can always edit
        if layer.created_by == user_id:
            return True

        # If editable is "everyone", anyone can edit
        if layer.editable == "everyone":
            return True

        return False

    def can_delete_layer(self, layer_id: UUID, user_id: UUID) -> bool:
        """
        Check if user can delete layer.

        Permission logic:
        - Only creator can delete layers
        - editable="everyone" does NOT grant delete permission

        Args:
            layer_id: Layer UUID
            user_id: User UUID

        Returns:
            True if user can delete, False otherwise
        """
        layer = self.db.query(Layer).filter(Layer.id == layer_id).first()

        if not layer:
            return False

        # Only creator can delete
        return layer.created_by == user_id

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def get_user_layers(self, user_id: UUID) -> List[Layer]:
        """
        Get all layers created by a specific user.

        Args:
            user_id: User UUID

        Returns:
            List of Layer instances created by user
        """
        return (
            self.db.query(Layer)
            .filter(Layer.created_by == user_id)
            .order_by(Layer.created_at.desc())
            .all()
        )

    def get_global_layers(self) -> List[Layer]:
        """
        Get all global layers.

        Args:
            None

        Returns:
            List of global Layer instances
        """
        return (
            self.db.query(Layer)
            .filter(Layer.is_global)
            .order_by(Layer.created_at.desc())
            .all()
        )

    def search_layers(
        self,
        user_id: UUID,
        search_term: str,
        limit: int = 50,
    ) -> List[Layer]:
        """
        Search layers by name or description.

        Only returns layers accessible to user (global + own layers).

        Args:
            user_id: User UUID
            search_term: Search string
            limit: Maximum number of results (default 50)

        Returns:
            List of matching Layer instances
        """
        if not search_term or not search_term.strip():
            return []

        search_pattern = f"%{search_term}%"

        return (
            self.db.query(Layer)
            .filter(
                and_(
                    or_(Layer.is_global, Layer.created_by == user_id),
                    or_(
                        Layer.name.ilike(search_pattern),
                        Layer.description.ilike(search_pattern),
                    ),
                )
            )
            .order_by(Layer.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_layers_by_category(
        self,
        user_id: UUID,
        category: str,
    ) -> List[Layer]:
        """
        Get all layers in a specific category accessible to user.

        Args:
            user_id: User UUID
            category: Category name

        Returns:
            List of Layer instances in category
        """
        return (
            self.db.query(Layer)
            .filter(
                and_(
                    Layer.category == category,
                    or_(Layer.is_global, Layer.created_by == user_id),
                )
            )
            .order_by(Layer.created_at.desc())
            .all()
        )
