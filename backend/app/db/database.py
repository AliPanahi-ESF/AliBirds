"""
Database engine, session factory, and initialization.
"""
from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.models import Base


# ─── Engine ───────────────────────────────────────────────────────────────────

def _make_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        # SQLite: use StaticPool for single-file, enable WAL and foreign keys
        engine = create_async_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=False,
        )

        @event.listens_for(engine.sync_engine, "connect")
        def set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    else:
        return create_async_engine(url, echo=False, pool_pre_ping=True)


engine = _make_engine()

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


# ─── Dependency ───────────────────────────────────────────────────────────────

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ─── Table creation (dev / first-run) ─────────────────────────────────────────

async def init_db() -> None:
    """Create all tables if they don't exist and seed default BusinessSettings."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed a default BusinessSettings row if none exists
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from app.db.models import BusinessSettings

        result = await session.execute(select(BusinessSettings).limit(1))
        if not result.scalar_one_or_none():
            session.add(BusinessSettings(company_name="My Studio"))
            await session.commit()
