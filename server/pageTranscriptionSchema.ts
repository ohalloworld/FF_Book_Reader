import { z } from "zod";

// Schema Claude fills in when transcribing one PDF page of a gamebook into
// its numbered paragraphs, each with its own text and outgoing choices.

export const TranscribedChoiceSchema = z.object({
  text: z.string().describe("the choice text as written, e.g. 'If you wish to open the door, turn to 245'"),
  to: z.string().describe("the paragraph number this choice leads to, exactly as printed"),
});

export const TranscribedParagraphSchema = z.object({
  id: z.string().describe("the paragraph/section number as printed at its start, exactly as shown (e.g. '245')"),
  text: z
    .string()
    .describe("the full paragraph text, verbatim, excluding the printed number itself and excluding any 'turn to X' choice sentences already captured in choices[]"),
  choices: z
    .array(TranscribedChoiceSchema)
    .describe(
      "every numbered choice/turn-to this paragraph offers, in the order printed. Empty array if this paragraph has no choices (e.g. it leads into combat resolved elsewhere, or is an ending).",
    ),
});

export const PageTranscriptionSchema = z.object({
  paragraphs: z
    .array(TranscribedParagraphSchema)
    .describe(
      "every complete, numbered paragraph found on this page, in the order they appear. Skip a paragraph that is visibly cut off at the very top or bottom of the page with no readable number of its own.",
    ),
});
