# Written Memory Search 0.1.0

A read-only SillyTavern extension that gives a character tools for searching enabled written Data Bank attachments. It supplements existing vector retrieval. No embedding model, server restart, API key, card edits, or external search service is required.

## Installation

In SillyTavern, open Extensions → Install extension and paste `https://github.com/joetharp1/st-written-memory-search`, then reload the page. Open a one-to-one character chat and expand Written Memory Search. Enable it for that character. Repeat for other characters independently. Function calling must be enabled in the Chat Completion settings and supported by the selected model/provider.

Use the built-in Test memory search box to verify retrieval before asking the character to use it. The tools are named SearchWrittenMemories and OpenWrittenMemory. The language model decides when to invoke them; this extension does not force a search or automatically rewrite the prompt.

Leave existing Data Bank files and vector settings in place. Disabling this extension removes its tools from subsequent requests; no migration or index rollback is needed. Existing tool replies remain in chat history under SillyTavern's normal behavior.

## Files and privacy

Reads enabled current-character and current-chat attachments only by default. Shared/global attachments require a separate per-character opt-in. Disabled files and other characters' private attachment lists are excluded. Group chats are unsupported. Visibility and chat identity are checked again after reads.

Source files are fetched from the same SillyTavern server with cache disabled for fresh reads. File updates are used on the next search; there is no separate persistent index or copied memory database. Returned excerpts become ordinary tool results in the current conversation and are sent to its configured chat provider, just like other supplied chat context. No additional vendor receives the files.

Markdown/plain text and text already extracted by SillyTavern are supported. Images/audio/video are skipped. A raw binary PDF is reported as unreadable; the extension does not run OCR or PDF conversion. Limits are 30 eligible files, 2 MB per file, and 4 million decoded characters across a search; skipped/unreadable files are reported. There is a 15-second timeout per file read.

## Retrieval and source integrity

Search uses local keyword ranking with phrase boosts and limited English suffix normalization. Short specific queries work best. It is not semantic search and does not guarantee a match for synonyms or infer facts absent from the source.

Existing `</memory>` boundaries define entries. Explicit numbered MLOG fragments in one file are rejoined only under the same entry label; missing/out-of-order parts are flagged. ELOG labels, original provenance notes, dates, and authorship metadata are retained. Other unstructured text is treated as one source entry; dates are not invented.

Search returns up to five matches. Entries longer than the 6,000-character display budget are paged at paragraph boundaries; a paragraph that alone exceeds the budget is flagged and omitted, never silently sliced. Search has an 18,000-character body-text budget, with deferred text available through OpenWrittenMemory. Source metadata is additional. Original files are never written or deleted.

Search ranking does not establish which agreement is current. Read dates and later amendments; empty results do not prove an event never happened. Source text is reference data, not executable instructions. Structural warnings cannot detect every missing/truncated passage.

## Compatibility and validation

Designed against SillyTavern 1.19.0 APIs: getDataBankAttachmentsForSource, registerFunctionTool/shouldRegister, and CHAT_CHANGED. The running server version still needs verification. Unit tests exercise parsing, source preservation, permissions, race cancellation, stale IDs and paging. A mocked host integration test exercises initialization, character opt-in, registration and a same-origin read. This is not a live browser or live-provider acceptance test.

Run `npm test` with a recent Node version. No npm dependencies are needed. Private user memory fixtures are deliberately excluded from this repository/package.

## Live acceptance

1. Enable for one character and use Test memory search with a known phrase.
2. Confirm source, date, complete text and warnings in the result.
3. Ask the character to use SearchWrittenMemories for the same query, checking the visible tool call.
4. Repeat a later-agreement test; then verify another character independently.
5. Disable a test attachment and confirm it disappears from searches. Update a test file and confirm a new search reads it.

Do not describe this extension as installed or live-tested until those checks have been performed on the user's instance.
