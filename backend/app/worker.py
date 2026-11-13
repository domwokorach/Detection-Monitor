"""Outbox worker: PostgreSQL lock + transaction is durable; Redis is a wakeup optimisation."""
import logging
import time
from .db import SessionLocal
from .services.screening import drain
from .config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run():
    while True:
        try:
            with SessionLocal() as db:
                n = drain(db, limit=25)
            if n:
                logger.info("Screening batch processed: %s events", n)
                continue
        except Exception:
            logger.exception("Outbox worker batch failed, retrying")
            time.sleep(2)
            continue
        try:
            import redis
            redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=3).blpop(
                "fraud:screening:wakeup", timeout=2
            )
        except Exception:
            # Still works in a Redis outage; polling is the recovery path.
            time.sleep(2)


if __name__ == "__main__":
    run()
