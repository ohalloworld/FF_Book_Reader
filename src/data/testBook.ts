import { standardRuleSet } from "../engine/standardRuleSet";
import type { Gamebook } from "../engine/types";

// Original demo content written to exercise the engine end to end
// (choices, gated items, a luck test, combat, flee, and both endings).
// Not derived from any published Fighting Fantasy book.
export const testBook: Gamebook = {
  id: "test-book",
  title: "The Crypt of Embers",
  author: "Engine Demo",
  startSection: "1",
  ruleSet: standardRuleSet,
  sections: {
    "1": {
      id: "1",
      text: `You stand before the iron door of an old crypt, sword in hand. The
villagers say a fire-demon has slept here for a hundred years, guarding a
hoard of gold. Torchlight flickers off the door's rusted hinges.`,
      choices: [
        { text: "Push the door open and enter.", to: "2" },
        { text: "Search the rubble beside the door first.", to: "3" },
      ],
    },
    "3": {
      id: "3",
      text: `Beneath a loose stone you find a small rusted key. You pocket it and
turn back to the door.`,
      onEnter: [{ type: "addItem", item: "rusted-key" }],
      choices: [{ text: "Push the door open and enter.", to: "2" }],
    },
    "2": {
      id: "2",
      text: `The door creaks open onto a narrow passage lit by dying torches. It
splits ahead: one way leads down toward a cold draught, the other toward a
faint orange glow.`,
      choices: [
        { text: "Follow the cold draught.", to: "4" },
        { text: "Follow the orange glow.", to: "6" },
      ],
    },
    "4": {
      id: "4",
      text: `The passage ends at a locked grate. A rusted key might turn in that
old lock.`,
      choices: [
        { text: "Use the rusted key.", to: "5", condition: { type: "hasItem", item: "rusted-key" } },
        { text: "Give up and turn back.", to: "2" },
      ],
    },
    "5": {
      id: "5",
      text: `The key turns with a groan. Beyond the grate, a chest sits untouched —
plainly missed by whoever else has passed this way. You take a handful of
gold before heading toward the glow you saw earlier.`,
      onEnter: [{ type: "adjustCounter", stat: "gold", delta: 15 }],
      choices: [{ text: "Head toward the glow.", to: "6" }],
    },
    "6": {
      id: "6",
      text: `You edge along a ledge above a sunken chamber. The stone crumbles
underfoot. Test your luck to keep your footing.`,
      test: { testKey: "luck", passGoTo: "7", failGoTo: "8" },
      choices: [],
    },
    "7": {
      id: "7",
      text: `You catch yourself against the wall and steady your nerve before
dropping down into the chamber ahead.`,
      choices: [{ text: "Drop down into the chamber.", to: "9" }],
    },
    "8": {
      id: "8",
      text: `Your footing gives way and you fall hard into the chamber below,
bruised and winded.`,
      onEnter: [{ type: "adjustPool", stat: "stamina", delta: -3 }],
      choices: [{ text: "Pick yourself up.", to: "9" }],
    },
    "9": {
      id: "9",
      text: `A FIRE-DEMON uncoils from a bed of embers, eyes blazing. There is
nowhere left to run but the passage behind you.`,
      encounter: {
        monsters: [{ id: "fire-demon", name: "Fire-Demon", stats: { skill: 9, stamina: 12 } }],
        fleeGoTo: "10",
        onDefeatGoTo: "10",
      },
      choices: [{ text: "Step past the smouldering embers toward the chamber beyond.", to: "11" }],
    },
    "10": {
      id: "10",
      text: `You flee back down the passage, the demon's roar echoing behind you.
Whatever gold it guarded, it isn't worth your life.`,
      ending: "death",
      choices: [],
    },
    "11": {
      id: "11",
      text: `The fire-demon collapses into a pile of ash and cooling embers. Behind
where it slept, the promised hoard of gold glitters in the firelight. You
have won through the Crypt of Embers.`,
      ending: "victory",
      onEnter: [{ type: "adjustCounter", stat: "gold", delta: 50 }],
      choices: [],
    },
  },
};
