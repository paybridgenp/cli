# PayBridgeNP CLI

Official CLI for the [PayBridgeNP](https://paybridgenp.com) payment gateway. Accept eSewa, Khalti, and ConnectIPS through a single API.

## Install

```bash
npm install -g @paybridge-np/cli
```

## Usage

```bash
paybridgenp login                         # authenticate with your API key
paybridgenp status                        # show key info + project mode
paybridgenp test                          # fire a sandbox checkout session
paybridgenp payments list                 # list recent payments
paybridgenp payments list --watch         # live-poll every 5s
paybridgenp payments get <id>             # fetch a single payment
paybridgenp webhooks list                 # list registered webhook endpoints
paybridgenp webhooks listen               # start local listener with ngrok tunnel
paybridgenp webhooks test <url>           # send a test event to any endpoint
paybridgenp init                          # scaffold a starter project
paybridgenp update                        # check for a newer CLI version
```

## Quick start

```bash
paybridgenp login
paybridgenp init --name my-shop --framework nextjs
cd my-shop && npm install
paybridgenp webhooks listen --port 4242
```

## Environment

Set `PAYBRIDGE_API_KEY` to skip `login` in CI/scripts:

```bash
PAYBRIDGE_API_KEY=sk_test_... paybridgenp payments list
```

Override the API base URL for local development:

```bash
PAYBRIDGE_API_BASE=http://localhost:3000 paybridgenp status
```

## License

MIT
