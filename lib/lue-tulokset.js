// Käsin kirjoitettujen tulosten luku ryhmälomakkeiden valokuvasta Clauden kuvantunnistuksella.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SCORES, rosterText } from "./tulokset-kuvasta.js";

export const MODEL = "claude-opus-5-5";

const SheetReading = z.object({
  sheets: z.array(z.object({
    group: z.string().describe("Group letter printed in the GROUP column header, e.g. \"A\""),
    players: z.array(z.object({
      number: z.number().int(),
      name: z.string().describe("Player name exactly as printed on the sheet"),
    })),
    results: z.array(z.object({
      match: z.string().describe("The MATCH cell, e.g. \"1-3\" (lower number first, as printed)"),
      score: z.enum(SCORES).describe("Sets written in the RESULT cell, from the first player's point of view"),
    })),
    unclear: z.array(z.object({
      match: z.string(),
      note: z.string().describe("Why the result was not read: crossed out, scribbled, illegible, not a valid score"),
    })),
  })),
});

const SYSTEM = `You read photos of printed table tennis group sheets from the OPT-86 club notice board.
Each sheet has a GROUP letter, a numbered NAME table and MATCH / RESULT tables. Players write the result by hand
in the RESULT cell next to the match, as sets from the first player's point of view: "1 - 3" with "3-1" means
player 1 beat player 3 three sets to one. Valid results are only ${SCORES.join(", ")}.

Report every sheet visible in the photo. For each sheet:
- group: the letter in the GROUP column header.
- players: the numbered names as printed.
- results: only RESULT cells with a clearly legible valid result. Leave out empty cells.
- unclear: cells that contain something you cannot read with confidence, are crossed out or scribbled over,
  or do not form a valid result. Never guess a result: put it here instead.`;

export async function readSheetPhoto({ client = new Anthropic({ timeout: 55_000, maxRetries: 1 }), image, mediaType, data }) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(SheetReading) },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
        { type: "text", text: `Groups and players in the database (numbered as on the printed sheets):\n\n${rosterText(data)}\n\nRead the results from the photo.` },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("The photo could not be read");
  if (!response.parsed_output) throw new Error(`No results were read (${response.stop_reason})`);
  return response.parsed_output;
}
