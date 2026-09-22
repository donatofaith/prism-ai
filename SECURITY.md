# Security

PRISM analyzes public market and blockchain data. It does not connect wallets, sign transactions, request seed phrases, or take custody of funds.

## Current safeguards

- RPC credentials are read only on the server.
- Query parameters and supported networks are validated.
- Token and address inputs are normalized before provider calls.
- API responses use normalized fields rather than exposing complete provider payloads.
- Controlled error responses avoid returning credentials or internal stack traces.
- Unknown account attribution remains unknown.
- The watchlist stays in the user's browser.

## Secrets

The following values must remain server-side:

- `ALCHEMY_API_KEY`
- `PRISM_SOLANA_RPC_URL`
- `PRISM_<CHAIN>_RPC_URL`

Never prefix these with `NEXT_PUBLIC_` and never commit production credentials.

## Production requirements

Before operating at production scale:

- Add server-side distributed rate limiting.
- Use stricter limits for wallet, replay, unlock, and market-mover routes.
- Add provider timeouts and circuit breakers consistently.
- Monitor unusual request volume and repeated large investigations.
- Keep dependencies updated and run automated security checks.
- Review the public attribution registry and its sources regularly.

## Responsible use

Public blockchain data can be sensitive when combined with external information. PRISM must not present an unknown address as belonging to a person or organization without reliable public evidence.

To report a sensitive issue, use a private GitHub security advisory.
