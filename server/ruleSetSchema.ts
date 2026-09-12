import { z } from "zod";

// Schema Claude fills in when extracting a book's rules section into a
// structured RuleSet. Kept separate from the runtime RuleSet type (see
// src/engine/types.ts) because the model only produces the parts a human
// wrote in the book's text — `id` and `source` get set by the server after.

export const StatDefinitionSchema = z.object({
  key: z
    .string()
    .describe("machine-safe key, lowercase snake_case, e.g. 'skill', 'magic_points', 'fear'"),
  label: z.string().describe("display label as printed in the book, e.g. 'SKILL', 'Magic Points'"),
  kind: z
    .enum(["pool", "counter"])
    .describe(
      "'pool' for a stat with a starting value and a current value that can rise and fall up to that start (SKILL, STAMINA, LUCK, Magic Points, Fear...); 'counter' for a flat running total with no cap (Gold, Provisions...)",
    ),
  generation: z
    .string()
    .describe(
      "dice formula for the starting value exactly as the book states it, e.g. '1D6+6', '2D6+12', or a fixed number like '0' or '10' if there's no roll",
    ),
});

export const TestDefinitionSchema = z.object({
  key: z.string().describe("machine-safe key for this test, e.g. 'luck', 'skill'"),
  label: z.string().describe("as named in the book, e.g. 'Test your Luck'"),
  statKey: z.string().describe("which stat key (from stats[]) this test rolls against"),
  rollFormula: z.string().describe("dice rolled for the test, e.g. '2D6'"),
  successWhen: z
    .enum(["lte", "gte"])
    .describe(
      "'lte' if success means rolling less than or equal to the stat (standard FF Luck/Skill tests), 'gte' if the book instead requires rolling greater than or equal",
    ),
  decrementStatOnUse: z
    .number()
    .optional()
    .describe("how much the tested stat permanently drops each time this test is used, if the book says so (classic FF: Luck drops by 1 every time it's tested)"),
});

export const CombatRulesSchema = z.object({
  rollFormula: z.string().describe("dice rolled each combat round to get Attack Strength, e.g. '2D6'"),
  attackStat: z.string().describe("stat key added to the roll to get Attack Strength, typically 'skill'"),
  damageStat: z.string().describe("stat key reduced when a combat round is lost, typically 'stamina'"),
  damagePerHit: z.number().describe("how much the damage stat drops per lost round, typically 2"),
  luckTestKey: z
    .string()
    .optional()
    .describe("key of the test (from tests[]) usable after a combat round to modify damage via a luck roll, if this book has that mechanic"),
  luckExtraDamage: z
    .number()
    .optional()
    .describe("extra damage dealt (or spared) on a lucky/unlucky combat luck test, typically 1"),
});

export const RuleSetExtractionSchema = z.object({
  bookTitle: z.string().describe("the book's title if mentioned in the text, otherwise 'Unknown'"),
  stats: z.array(StatDefinitionSchema).describe("every stat on this book's character/adventure sheet"),
  tests: z.array(TestDefinitionSchema).describe("every named dice test this book defines"),
  combat: CombatRulesSchema,
  startingInventory: z
    .array(z.string())
    .optional()
    .describe("standard starting equipment every character begins with, if the text mentions it"),
  specialRules: z
    .array(z.string())
    .describe(
      "any other rule or mechanic mentioned in the text that doesn't fit the structured fields above, summarized as short reference notes (e.g. unique potion rules, special abilities). Empty array if none.",
    ),
});

export type RuleSetExtraction = z.infer<typeof RuleSetExtractionSchema>;
