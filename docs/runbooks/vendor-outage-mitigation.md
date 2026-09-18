# Operational Runbook: Vendor (Addis AI) Outage Mitigation

## Detection
- **Alert**: `Provider error rate > 5%` or 5xx responses from `/v1/commands`.
- **Degradation**: Total loss of voice command pipeline (STT, LLM, Amharic TTS share one vendor account).

## Action Steps
1. **Verify Vendor Status**: Check `https://status.addisassistant.com`.
2. **Pre-Synthesised Fallback**: The client will automatically fall back to pre-synthesised offline phrase:
   > "I can't reach the network right now" (Section 11 Failure Table)
3. **Circuit Breaker Check**: Ensure circuit breaker opens after 5 consecutive failures and half-opens after 30 seconds.
4. **Traffic Throttle**: Enable rate limiting on API gateway to prevent socket exhaustion.
