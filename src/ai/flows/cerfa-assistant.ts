'use server';

/**
 * @fileOverview A CERFA assistant AI agent.
 *
 * - cerfaAssistant - A function that handles the CERFA assistance process.
 * - CerfaAssistantInput - The input type for the cerfaAssistant function.
 * - CerfaAssistantOutput - The return type for the cerfaAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CerfaAssistantInputSchema = z.object({
  userLocation: z.string().describe('The location of the user.'),
  donationInformation: z.string().describe('The donation information provided by the user.'),
});
export type CerfaAssistantInput = z.infer<typeof CerfaAssistantInputSchema>;

const CerfaAssistantOutputSchema = z.object({
  cerfaFormType: z.string().describe('The type of CERFA form to produce.'),
  additionalInstructions: z.string().describe('Any additional instructions for generating the CERFA form.'),
});
export type CerfaAssistantOutput = z.infer<typeof CerfaAssistantOutputSchema>;

export async function cerfaAssistant(input: CerfaAssistantInput): Promise<CerfaAssistantOutput> {
  return cerfaAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cerfaAssistantPrompt',
  input: {schema: CerfaAssistantInputSchema},
  output: {schema: CerfaAssistantOutputSchema},
  prompt: `You are an AI assistant that helps determine the correct CERFA form to produce based on user location and donation information.

  User Location: {{{userLocation}}}
  Donation Information: {{{donationInformation}}}

  Determine the most appropriate CERFA form type and provide any additional instructions for generating the form.
  Ensure the output is accurate and complies with regional regulatory conditions.`,
});

const cerfaAssistantFlow = ai.defineFlow(
  {
    name: 'cerfaAssistantFlow',
    inputSchema: CerfaAssistantInputSchema,
    outputSchema: CerfaAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
