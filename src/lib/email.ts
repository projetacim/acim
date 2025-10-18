
'use server';

import { Resend } from 'resend';
import { CerfaReceiptEmail } from '@/emails/cerfa-receipt-email';
import type { Donation, Member } from '@/lib/types';
import { generateCerfaPdf } from '@/lib/pdf';
import { ReactElement } from 'react';

// The Resend instance will be initialized inside sendEmail.
let resend: Resend | null = null;

interface SendEmailOptions {
    to: string;
    subject: string;
    react: ReactElement;
    attachments?: {
        filename: string;
        content: Buffer;
    }[];
}

async function sendEmail(options: SendEmailOptions) {
    // --- Development Environment Logic ---
    if (process.env.NODE_ENV === 'development') {
        const devRecipient = process.env.DEV_EMAIL_RECIPIENT;
        if (devRecipient) {
            console.log(`\n--- DEVELOPMENT EMAIL ---`);
            console.log(`Redirecting email for [${options.to}] to [${devRecipient}]`);
            console.log(`Subject: ${options.subject}`);
            console.log(`Attachments: ${options.attachments?.map(a => a.filename).join(', ') || 'none'}`);
            console.log(`-----------------------\n`);
            options.to = devRecipient;
        } else {
            console.warn('\n--- Skipping Email Send ---');
            console.warn('DEV_EMAIL_RECIPIENT is not set in .env. Email was not sent.');
            console.log(`Intended recipient: ${options.to}`);
            console.log(`Subject: ${options.subject}`);
            console.warn('---------------------------\n');
            return { success: true, data: { id: 'dev-skipped' } };
        }
    }
    
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is not set. Skipping email sending.');
        return { success: false, error: 'La clé API Resend est manquante.' };
    }
    
    // Initialize Resend on first use if it hasn't been already.
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    
    try {
        const { data, error } = await resend.emails.send({
            from: 'ACIM <noreply@acim.fr>', // TODO: Make this configurable
            ...options
        });

        if (error) {
            console.error('Resend error:', error);
            return { success: false, error: error.message };
        }
        
        return { success: true, data };

    } catch (error: any) {
        console.error('Failed to send email:', error);
        return { success: false, error: error.message };
    }
}


export async function sendCerfaEmail(donation: Donation, member: Member) {
    const toEmail = donation.cerfaEmail || member.email;
    
    if (!toEmail) {
        return { success: false, error: "No recipient email address found for this donation." };
    }
    
    const pdfBuffer = await generateCerfaPdf(donation, member);
    
    const result = await sendEmail({
        to: toEmail,
        subject: `Votre reçu fiscal ACIM - Don n°${donation.cerfaNumber}`,
        react: CerfaReceiptEmail({ donation, member }),
        attachments: [
            {
                filename: `recu-fiscal-${donation.cerfaNumber}.pdf`,
                content: pdfBuffer,
            }
        ]
    });
    
    return result;
}
