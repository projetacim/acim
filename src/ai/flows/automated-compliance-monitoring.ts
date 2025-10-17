'use server';

/**
 * @fileOverview This file implements the automated compliance monitoring flow.
 *
 * It includes:
 * - `monitorDonationPatterns`: An AI-powered function to monitor donation patterns and flag unusual activity.
 * - `AutomatedComplianceMonitoringInput`: The input type for the `monitorDonationPatterns` function.
 * - `AutomatedComplianceMonitoringOutput`: The output type for the `monitorDonationPatterns` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AutomatedComplianceMonitoringInputSchema = z.object({
  donationData: z.string().describe('A JSON string containing the donation data, including member ID, donation amount, date, and region.'),
});
export type AutomatedComplianceMonitoringInput = z.infer<typeof AutomatedComplianceMonitoringInputSchema>;

const AutomatedComplianceMonitoringOutputSchema = z.object({
  isAnomalous: z.boolean().describe('Whether the donation pattern is flagged as anomalous.'),
  explanation: z.string().describe('Explanation of why the donation pattern is considered anomalous, including any relevant regional tax regulations.'),
  recommendedCerfaForm: z.string().optional().describe('Recommended CERFA form based on donation characteristics and regional regulations.'),
});
export type AutomatedComplianceMonitoringOutput = z.infer<typeof AutomatedComplianceMonitoringOutputSchema>;

export async function monitorDonationPatterns(input: AutomatedComplianceMonitoringInput): Promise<AutomatedComplianceMonitoringOutput> {
  return automatedComplianceMonitoringFlow(input);
}

const prompt = ai.definePrompt({
  name: 'automatedComplianceMonitoringPrompt',
  input: {schema: AutomatedComplianceMonitoringInputSchema},
  output: {schema: AutomatedComplianceMonitoringOutputSchema},
  prompt: `You are an AI assistant specializing in detecting anomalous donation patterns for non-profit organizations and ensuring compliance with tax regulations.

You will receive donation data as a JSON string. Your task is to analyze this data and determine if any donation pattern is unusual or potentially non-compliant based on donation size, frequency, region, and member history.

Based on your analysis and knowledge of regional tax regulations:
1.  Determine if the donation pattern is anomalous.
2.  Provide an explanation of why the pattern is considered anomalous.
3.  Recommend the appropriate CERFA form to be generated based on the donation characteristics and regional regulatory conditions.

Donation Data: {{{donationData}}}

Format your output as a JSON object conforming to the following schema:
${JSON.stringify(AutomatedComplianceMonitoringOutputSchema.shape, null, 2)}`,
});

const automatedComplianceMonitoringFlow = ai.defineFlow(
  {
    name: 'automatedComplianceMonitoringFlow',
    inputSchema: AutomatedComplianceMonitoringInputSchema,
    outputSchema: AutomatedComplianceMonitoringOutputSchema,
  },
  async input => {
    try {
      const donationData = JSON.parse(input.donationData);
      if (typeof donationData !== 'object') {
        throw new Error('Donation data must be a valid JSON object.');
      }
    } catch (e: any) {
      throw new Error(`Invalid donation data JSON: ${e.message}`);
    }
    const {output} = await prompt(input);
    return output!;
  }
);
