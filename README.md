# PlugRight

**Check the connection before you buy the adapter.**

PlugRight is a reuse-first USB-C shopping prototype. Describe one computer, one monitor, the target display mode, the connection item and the equipment already owned. Browser AI extracts a proposed setup with quotes. Review it, run the documented compatibility checks, and apply a cart change only if you agree. Sometimes the best checkout is no checkout.

## Run locally

Requirements: Node.js 24, npm, Git, and a current desktop Chrome or Edge with WebGPU and hardware acceleration. Browser AI uses **Qwen3-4B-q4f16_1-MLC** through **WebLLM 0.2.86**. Allow roughly 3.5 GB GPU memory. The first run downloads about 2.2 GB of model weights plus runtime files; subsequent runs use the browser cache. Download and inference time depend on the machine and connection. Manual equipment controls work without WebGPU.

```sh
npm ci --prefer-offline --no-audit --no-fund
npm run dev -- --port 8789
```

Open **http://127.0.0.1:8789/**. No AI API key or paid inference service is required. Model files are fetched from Hugging Face and the WebLLM runtime hosting service; equipment text is processed locally after loading. Applying a proposed setup sends the structured equipment IDs to this application's own compatibility server when you click **Check connection**. It does not send the original description to a hosted AI provider.

For production compilation use `npm run build`; `npm start -- --port 8790` previews the built Worker locally. The hosted demo currently has owner-only access; use these local instructions for independent judging.

## Try it

1. Click **Use an example description**, then **Read with browser AI**. Wait for the first model download. Review the exact quotes and selected equipment. Click **Use these details**, then **Check connection**. Apply the reuse proposal: the owned Thunderbolt cable replaces the planned hub, the cart becomes $0, and no payment is offered.
2. Click **Repair a 4K 60Hz cart**. The checker identifies a charge-only cable and a 4K 30Hz hub. Apply its proposed cable: the fictional test total becomes $24.00 and sandbox checkout can be enabled.
3. Click **When USB-C cannot work**. A data-only Lenovo USB-C port is not fixed by purchasing another native video adapter.
4. Try `I have a MacBook and a USB-C cable. Can I connect a Dell monitor?` in browser AI. Missing details must block applying the result. Unknown models and absent refresh rates must be clarified.

AI extraction can be wrong. The model extracts text spans; a deterministic resolver matches model names and an explicit complete-inventory statement. The validator requires quoted input evidence, known IDs and matching model names, but this is not a proof that every interpretation is semantically correct. Review the output. No model response can set prices, authorize payment or bypass the server's checks.

## PayPal Sandbox setup

Create your own **sandbox** application at [PayPal Developer](https://developer.paypal.com/dashboard/applications/sandbox). Use a separate sandbox personal buyer account for approval. Never use a real card or bank account in this prototype.

Copy `.env.example` to `.env.local`, then privately set:

- `PAYPAL_SANDBOX_CLIENT_ID`
- `PAYPAL_SANDBOX_CLIENT_SECRET`
- `PAYPAL_CHECKOUT_SIGNING_KEY` — a random secret of at least 32 characters

Restart the local server. Local environment files are ignored by Git. Hosted deployments need server-side runtime secrets separately; never commit them or expose the client secret/signing key in browser code. Without credentials, compatibility and browser AI still run; checkout visibly remains disabled.

The PayPal JavaScript SDK opens buyer approval. Server code calls only `https://api-m.sandbox.paypal.com`. It recomputes the cart and fictional prices, binds the checked setup to an HMAC-signed 15-minute ticket, compares remote order items/amount/currency before capture, and reuses the completed capture on retry. There is no live endpoint override. An empty cart cannot create an order.

A previous hosted end-to-end SDK test completed one USD 24.00 sandbox payment on October 22, 2026. Server integration testing also confirmed completed-capture retry behavior. These are sandbox records, not revenue or real customer purchases.

## Checks

```sh
npm test
npx tsc --noEmit
PLUGRIGHT_TEST_URL=http://127.0.0.1:8789 node --test tests/http.test.ts
```

Unit checks cover the compatibility rules, synthetic model-response validation and mocked payment HTTP. They do not measure real-model accuracy or physical hardware performance. Browser inference is tested separately through actual UI interactions. On October 30, seven real-model descriptions were checked on one Mac in Chrome 153: six matched the expected apply/block behavior. One already-owned-cable description unnecessarily requested the computer model again, so it was safely blocked. This small, development-time set is not an independent accuracy benchmark. The AI-to-rule reuse and cart-repair flows were also exercised through the UI. The HTTP suite expects a local server without PayPal credentials; its configuration test deliberately verifies checkout is disabled.

## Scope

- 20 selected documented models/revisions across six brands; one external SDR monitor.
- Manufacturer specification summaries and links live in `lib/products.json`. Original documents are not bundled. Model/revision, port and display mode matter.
- No guarantee of physical operation, charging safety, HDR or HDCP. No automatic validation of multi-monitor arrangements, DisplayLink driver permissions or every timing.
- No live prices, inventory, affiliate store, real shipping or live payments. All prices are fictional USD amounts.
- Browser GPU/network failures show an error; they do not silently turn deterministic rules into an AI response.
- No comparative accuracy or conversion improvement has been established. The original 60 pre-development examples were authored cases, not an independent holdout study.

## Source map

- `components/EquipmentIntake.tsx` — real browser model loading and inference, review UI
- `lib/intake.ts` — extraction schema, prompt and validation
- `lib/engine.ts` / `lib/products.json` — deterministic checks, quoted manufacturer sources, cart proposals
- `lib/paypal.ts` / `app/api/paypal/route.ts` — sandbox order creation and capture
- `app/page.tsx` — buyer-controlled workflow and SDK button
- `tests/` — assertions for the implemented boundaries

This project was built during the October–November 2026 hackathon period. AI coding assistance was used for research, implementation and review. Runtime AI is Qwen3 in the browser; compatibility rules are not presented as a language model.

## License and dependencies

Original PlugRight code is MIT licensed; see `LICENSE`. Third-party dependencies, model weights and bundled starter components retain their own licenses; see `THIRD_PARTY_NOTICES.txt`. No endorsement by a manufacturer or PayPal is implied.
