"""add_layer_visibility

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-05 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add visibility column with default value 'private'
    op.add_column(
        "layers",
        sa.Column("visibility", sa.String(), nullable=False, server_default="private"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("layers", "visibility")
