<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0cd7a7dd-984d-4e36-91f1-f54fe3b02ed0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in the root `.env` file. Keep it server-side; do not use a `VITE_` prefix.
3. Run the app:
   `npm run dev`

## Voice ordering

Voice uses the browser's native Web Speech recognition and synthesis first. A shared speech controller owns the microphone, pauses recognition while speaking, and supports English, Tamil, and Hindi. Step-specific local parsers handle confirmations, order type, time, quantity, and PIN; unmatched or ambiguous speech must not trigger an action.

Free-form item requests can use Gemini through the backend `POST /api/voice/nlu` endpoint. The API key stays in the server environment. If Gemini is unavailable or returns invalid/low-confidence data, the app falls back to local catalog matching. The endpoint has an application-side limit of 20 requests per IP per minute; this is not Google's free-tier quota. Check current model availability and account quotas in Google AI Studio and the Gemini API documentation.

The optional MediaRecorder/audio-transcription fallback is not implemented. Web Speech support and quality depend on the user's browser, microphone, and installed speech services; Chrome is the supported manual-test target.

### Voice regression tests

Run the focused voice and PIN parser tests with:

```sh
npx vitest run src/services/__tests__/voiceIntentReliability.test.ts src/services/pinVoiceParserService.test.ts src/services/__tests__/speechReliability.test.ts
```

### Manual Chrome checklist

For each language (English, Tamil, Hindi):

1. Select the language and search for a catalog item by voice; also try an item request with quantity.
2. Try unrelated speech and a catalog name that does not exist; verify the app asks again and does not substitute another item.
3. Choose Order Now, verify the confirmation question, and answer yes on the first try. Repeat with no, then try Schedule.
4. For Schedule, choose a supported time or slot by voice and by tap. Verify the bill and PIN steps, enter a four-digit PIN by voice and by tap, and verify a final yes/no confirmation appears before saving.
5. At each question, try the Retry mic button and the visible tap alternative. Test repeat, stop, cancel, and go back.
6. Leave the microphone silent: verify one repeat prompt, then a stopped microphone with tap guidance. Confirm the app does not listen while its prompt is speaking.
7. Test with Gemini unavailable (for example, no server key): verify local catalog matching still works and no item is silently changed.
