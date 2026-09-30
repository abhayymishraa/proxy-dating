import { z } from "zod/v4";

const Source = z.enum(["linkedin", "instagram", "both"]);
export const ProfileSchema = z.object({
  name: z.string(),
  headline: z.string().describe("One line: who they are, e.g. 'Robotics PhD turned climbing-obsessed founder'"),
  location: z.string(),
  age_range: z.string().describe("Best estimate from graduation years, e.g. '26-30', or 'unknown'"),
  summary: z.string().describe("3-4 sentence portrait of the person as a potential partner"),
  reading_notes: z.array(z.object({ source: Source, observation: z.string() }))
    .describe("8-15 concrete things you noticed while reading, in the order you read them"),
  needs: z.array(z.object({ need: z.string(), why: z.string(), source: Source }))
    .describe("What they need from a partner/relationship, inferred from evidence"),
  hobbies: z.array(z.object({ hobby: z.string(), evidence: z.string(), source: Source })),
  interests: z.array(z.object({ interest: z.string(), evidence: z.string(), source: Source })),
  values: z.array(z.object({ value: z.string(), evidence: z.string(), source: Source })),
  personality: z.object({
    openness: z.number(), conscientiousness: z.number(), extraversion: z.number(),
    agreeableness: z.number(), emotional_stability: z.number(),
    notes: z.string(),
  }).describe("Big Five estimates, each 1-10"),
  lifestyle: z.object({
    pace: z.string(), social_style: z.string(), ideal_weekend: z.string(), work_life_balance: z.string(),
  }),
  communication_style: z.string(),
  looking_for: z.string().describe("The kind of partner who would fit them"),
  green_flags: z.array(z.string()).describe("What would attract them in a partner"),
  dealbreakers: z.array(z.string()).describe("What would likely not work for them"),
  date_ideas: z.array(z.string()),
  conversation_starters: z.array(z.string()),
  identity_check: z.object({
    same_person: z.boolean(), confidence: z.number(), reason: z.string(),
  }).describe("Do the LinkedIn and Instagram belong to the same person? confidence 0-1"),
  data_quality: z.string().describe("How much signal each source gave; what is missing"),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ScreenSchema = z.object({
  ratings: z.array(z.object({ id: z.string(), score: z.number(), reason: z.string() })),
});

export const VenueSchema = z.object({
  venue: z.string().describe("Short venue name, max 8 words, e.g. 'Bouldering gym in Bushwick, then ramen'"),
  activity: z.string(),
  why: z.string().describe("Why this suits both people"),
  message: z.string().describe("What you say to the other agent when proposing"),
});

export const ReplySchema = z.object({
  accept: z.boolean(),
  counter: VenueSchema.omit({ message: true }).nullable(),
  message: z.string(),
});

export const DebriefSchema = z.object({
  score: z.number().describe("0-100 overall fit for YOUR person"),
  chemistry: z.number().describe("1-10"),
  values_fit: z.number().describe("1-10"),
  lifestyle_fit: z.number().describe("1-10"),
  green_flags: z.array(z.string()),
  red_flags: z.array(z.string()),
  best_moment: z.string(),
  would_see_again: z.boolean(),
  note_to_person: z.string().describe("2-3 sentence honest note to your human about this date"),
});
export type Debrief = z.infer<typeof DebriefSchema>;
