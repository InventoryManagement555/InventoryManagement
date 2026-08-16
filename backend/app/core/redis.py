import redis
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = None

if settings.REDIS_URL:
    try:
        # Connect to Redis. Set a small socket timeout (e.g. 2s) so we fail fast and don't block requests
        redis_client = redis.from_url(
            settings.REDIS_URL, 
            decode_responses=True, 
            socket_timeout=2.0, 
            socket_connect_timeout=2.0
        )
        redis_client.ping()
        logger.info("Connected to Redis successfully.")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis at {settings.REDIS_URL}: {e}. Stock caching is disabled.")
        redis_client = None
