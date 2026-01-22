"""add_creation_source

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-01-05 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6g7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add creation_source column with default value 'system'
    # This is safe for existing layers - they default to 'system' which means
    # they won't appear in "My Layers" section
    op.add_column(
        "layers",
        sa.Column(
            "creation_source", sa.String(), nullable=False, server_default="system"
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("layers", "creation_source")
