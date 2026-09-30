"""
Shared SQLAlchemy 2.0 declarative base.

Every ORM model must import Base from here so that Alembic's
autogenerate can discover all tables in one metadata object.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
