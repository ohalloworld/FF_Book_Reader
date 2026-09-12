import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { RuleSetExtractionSchema } from "./ruleSetSchema.js";

const EXTRACTION_SYSTEM_PROMPT = `You extract structured game rules from the rules section of a Fighting-Fantasy-style gamebook (the "How to fight the monsters" / "Adventure Sheet" / background rules pages a reader transcribes for you). Read the text the user provides and produce a structured rule set describing:
- every stat on the character sheet and how its starting value is generated
- every named dice test (Luck, Skill, or anything book-specific)
- how combat is resolved
- standard starting equipment, if mentioned
- any other rule or mechanic that doesn't fit those fields, as short reference notes

Use lowercase snake_case for machine keys. Base everything strictly on what the text actually says — don't invent mechanics it doesn't describe. If the text only covers part of the rules (e.g. no combat section), still fill in your best structural guess for the missing parts using standard Fighting Fantasy conventions (2D6 + SKILL combat, 2 STAMINA damage per lost round) and note the gap in specialRules.`;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Dev-only local API: POST /api/parse-rules { rulesText } -> { ruleSet }.
 * Runs entirely in this Node process, so ANTHROPIC_API_KEY never reaches
 * the browser. Only available under `npm run dev` (Vite dev middleware). */
export function rulesApiPlugin(): Plugin {
  return {
    name: "ff-rules-api",
    configureServer(server) {
      server.middlewares.use("/api/parse-rules", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        try {
          const body = (await readJsonBody(req)) as { rulesText?: unknown };
          const rulesText = typeof body.rulesText === "string" ? body.rulesText.trim() : "";
          if (!rulesText) {
            sendJson(res, 400, { error: "rulesText is required" });
            return;
          }
          if (!process.env.ANTHROPIC_API_KEY) {
            sendJson(res, 500, {
              error: "ANTHROPIC_API_KEY is not set. Add it to a .env file in the project root and restart the dev server.",
            });
            return;
          }

          const client = new Anthropic();
          const response = await client.messages.parse({
            model: "claude-opus-5",
            max_tokens: 8000,
            system: EXTRACTION_SYSTEM_PROMPT,
            messages: [{ role: "user", content: rulesText }],
            output_config: { format: zodOutputFormat(RuleSetExtractionSchema) },
          });

          if (!response.parsed_output) {
            sendJson(res, 502, { error: "Claude did not return a parseable rule set. Try again, or trim/simplify the pasted text." });
            return;
          }

          sendJson(res, 200, { ruleSet: response.parsed_output });
        } catch (err) {
          sendJson(res, 500, { error: err instanceof Error ? err.message : "Unknown error" });
        }
      });
    },
  };
}
