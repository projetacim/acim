'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cerfaAssistant, type CerfaAssistantOutput } from '@/ai/flows/cerfa-assistant';
import { Loader2, Sparkles, FileText, Info } from 'lucide-react';

const cerfaSchema = z.object({
  userLocation: z.string().min(2, 'Location is required.'),
  donationInformation: z.string().min(10, 'Donation information must be at least 10 characters.'),
});

type CerfaFormValues = z.infer<typeof cerfaSchema>;

export function CerfaForm() {
  const [result, setResult] = useState<CerfaAssistantOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CerfaFormValues>({
    resolver: zodResolver(cerfaSchema),
  });

  const onSubmit: SubmitHandler<CerfaFormValues> = async (data) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await cerfaAssistant(data);
      setResult(response);
    } catch (e) {
      console.error(e);
      setError('An error occurred while communicating with the AI assistant. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Provide Details</CardTitle>
          <CardDescription>
            Enter the user's location and donation details below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="userLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Location / Region</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Paris, France" {...field} />
                    </FormControl>
                    <FormDescription>
                      The geographical location to determine regional regulations.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="donationInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Donation Information</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Donation of 100 EUR made on 2024-05-10 by an individual."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Describe the donation, including amount, date, and donor type.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Get Assistance
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>AI Assistant Recommendation</CardTitle>
          <CardDescription>
            The recommended CERFA form and instructions will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          {isLoading && (
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Our AI is thinking...</p>
            </div>
          )}
          {error && <p className="text-destructive">{error}</p>}
          {!isLoading && !error && result && (
            <div className="w-full space-y-4 rounded-lg bg-secondary/50 p-6">
              <div>
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold">Recommended Form</h3>
                </div>
                <p className="mt-1 text-xl font-bold text-primary">{result.cerfaFormType}</p>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <Info className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-semibold">Additional Instructions</h3>
                </div>
                <p className="mt-1 text-muted-foreground">{result.additionalInstructions}</p>
              </div>
            </div>
          )}
          {!isLoading && !error && !result && (
            <div className="text-center text-muted-foreground">
              <p>Your results will be displayed here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
