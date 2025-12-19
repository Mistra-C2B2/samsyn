"""add_wms_servers_table

Revision ID: a1b2c3d4e5f6
Revises: e2b9f20fdac0
Create Date: 2025-12-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e2b9f20fdac0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('wms_servers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('base_url', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('version', sa.String(), nullable=True),
        sa.Column('service_title', sa.String(), nullable=True),
        sa.Column('service_provider', sa.String(), nullable=True),
        sa.Column('layer_count', sa.Integer(), nullable=True, default=0),
        sa.Column('capabilities_cache', postgresql.JSONB(astext_type=sa.Text()), nullable=True, default={}),
        sa.Column('cached_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('base_url')
    )
    op.create_index('idx_wms_servers_created_by', 'wms_servers', ['created_by'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_wms_servers_created_by', table_name='wms_servers')
    op.drop_table('wms_servers')
