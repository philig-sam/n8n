# Send Tech Newsletter — Power Automate skeleton

This package is a hand-translated **skeleton** of the n8n workflow
`Send Tech Newsletter`. It is **not** a one-click drop-in replacement.
Some n8n nodes have no native Power Automate equivalent, so they have
been replaced with HTTP-action stubs that expect an Azure Function
endpoint you must provide.

## What's in the zip

```
manifest.json
Microsoft.Flow/
  flows/
    00000000-0000-0000-0000-000000000001/
      definition.json      <- the WDL flow (the meaningful part)
      apisMap.json
      connectionsMap.json
```

The flow definition uses the same Workflow Definition Language as Azure
Logic Apps, so you can also paste `definition.json` into a Logic App if
the legacy Power Automate import path gives you trouble.

## How to import

1. In https://make.powerautomate.com, open **My flows -> Import ->
   Import Package (legacy)**.
2. Upload this zip.
3. On the import-review screen, select an existing Office 365 connection
   (or create one) for the approval action.
4. Click **Import**. Power Automate will report any schema problems
   inline — fix and re-import, or open the flow in the designer and
   replace the offending action.

If the legacy importer refuses the package (Microsoft tightens its
validator periodically), fall back to:

- Create a new blank flow with an **HTTP request** trigger,
- Use the designer's **Peek code** view on each action and paste the
  corresponding action JSON from `definition.json`.

## n8n node -> Power Automate action mapping

| n8n node | Power Automate action | Notes |
|----------|----------------------|-------|
| Notion Webhook (trigger) | `Request` trigger | URL is generated on save; update Notion to point at it. |
| If Media Recommendation | `If` | Direct port. |
| Get Media Recommendation | `Http GET` | Direct port. |
| Extract Open Graph metadata | `Http POST` -> **Azure Function (STUB)** | Needs a function that does regex/HTML parsing. |
| Set Media Recommendation | `Set variable` | Stored in `media_recommendation` variable. |
| Get all Tech News of Issue | `Http POST` to Notion REST API | Uses `data_sources/{id}/query`. Verify the Notion-Version header matches your integration. |
| Clean URLs | `Http POST` -> **Azure Function (STUB)** | Strips utm_* and _bhlid params. |
| Create Template Data | `Http POST` -> **Azure Function (STUB)** | Performs grouping/ordering/fast-five extraction. |
| Get Template | `Http GET` to GitHub Contents API | Returns base64 in `content`. |
| Base64 Decode | `Compose` with `base64ToString()` | Strips embedded newlines that GitHub adds. |
| Generate final HTMLs | `Http POST` -> **Azure Function (STUB)** | Runs `mustache.render` for website + Mailjet variants. |
| Create Campaign Draft | `Http POST` to Mailjet | Uses Basic auth (key:secret). |
| Add Content to Campaign | `Http POST` to Mailjet | Direct port. |
| Test Campaign | `Http POST` to Mailjet | Direct port. |
| Set status to waiting | `Http PATCH` to Notion pages API | `onError: continueErrorOutput` in n8n is represented by `runAfter` accepting `Failed`. |
| Get Approval | `ApiConnectionWebhook` (Outlook approval) | **STUB**: open in designer and replace with the real `Send approval email` action so it produces a callback URL. |
| If Approved | `If` | Branches map to the same downstream nodes. |
| Send Campaign | `Http POST` to Mailjet | Direct port. |
| Upload issue as HTML | `Http PUT` to GitHub Contents API | Body is base64-encoded HTML. |
| Set status to sent | `Http PATCH` to Notion pages API | Direct port. |
| Archive Campaign Draft | `Http PUT` to Mailjet | Direct port. |

## Stubs you must implement

The four `STUB` rows above all call out to Azure Function URLs declared
as parameters in `definition.json`:

- `CleanUrlsFunctionUrl`
- `CreateTemplateDataFunctionUrl`
- `OpenGraphFunctionUrl`
- `TemplateRendererFunctionUrl`

Each function takes/returns JSON. The original JavaScript from the n8n
Code nodes can be lifted into a Node.js Azure Function more or less
verbatim — the only change is reading from `req.body` instead of
`$input` and using the `mustache` npm package.

If your company forbids hosting custom code at all, the next-best path
is to push the rendering work into your Notion automation (so Notion
sends pre-rendered HTML in the webhook payload) and let Power Automate
just route it. That sidesteps the missing-runtime problem entirely.

## Parameters to fill in

Open `definition.json` and replace every `REPLACE_WITH_*` value, or set
them via the import-review UI:

- Notion: `NotionApiToken`, `NotionDataSourceId`
- Mailjet: `MailjetApiKey`, `MailjetApiSecret`, `MailjetContactsListId`
- GitHub: `GitHubApiToken`, `GitHubOwner`, `GitHubRepo`
- Azure Functions: the four `*FunctionUrl` parameters above
- Approval: `ApproverEmail`

Treat the API tokens as secrets — store them in Azure Key Vault and
reference via Power Automate's secure-input feature rather than
hard-coding them in the definition for production use.

## Known gaps vs. the n8n original

- The `executionOrder: v1` semantics and per-node `executeOnce` flags
  from n8n don't have direct equivalents; the flow runs in standard WDL
  order based on the `runAfter` graph.
- The trigger here is a generic HTTP request, not Notion's official
  webhook — you'll lose Notion's automation_id/event_id headers unless
  you forward them in the request body.
- Error handling is minimal. Add `Scope` actions with `runAfter`
  branches if you want try/catch-style behavior similar to n8n's
  `continueErrorOutput`.
