# Operational Runbook: Vendor (Addis AI) Outage Mitigation

## Detection
- **Alert**: `Provider error rate > 5%` or 5xx responses from `/v1/commands`.
- **Degradation**: Total loss of voice command pipeline (STT, LLM, Amharic TTS share one vendor account).

## Action Steps
1. **Verify Vendor Status**: Check `https://status.addisassistant.com`.
2. **Pre-Synthesised Fallback**: The client will automatically fall back to pre-synthesised offline phrase:
   > "I can't reach the network right now" (Section 11 Failure Table)
3. **Circuit Breaker Check**: The API's breaker (`ADDIS_BREAKER_FAILURE_THRESHOLD`, `ADDIS_BREAKER_RESET_MS`) opens after 5 consecutive failures and half-opens after 30 seconds, letting one trial call through. Look for log event `addis.breaker` with `to: OPEN`; while open, `/v1/commands` answers 503 with `Retry-After` without contacting the vendor.
4. **Traffic Throttle**: The API rate-limits per user in Redis (`RATE_LIMIT_COMMANDS_MAX`); lower it if needed. Gateway limiting remains an extra layer.
