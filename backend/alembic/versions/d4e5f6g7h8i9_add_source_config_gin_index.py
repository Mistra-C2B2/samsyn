"""add_source_config_gin_index

Revision ID: d4e5f6g7h8i9
Revises: c3d4e5f6g7h8
Create Date: 2026-02-02 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6g7h8i9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6g7h8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create GIN index on source_config JSONB column for fast URL lookups
    # This significantly improves performance for TiTiler URL whitelist validation
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_layers_source_config_gin
        ON layers USING gin (source_config)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop GIN index on source_config
    op.drop_index("idx_layers_source_config_gin", table_name="layers")
