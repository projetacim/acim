
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { format } from 'date-fns';
import type { Donation, Member } from '@/lib/types';
import { numberToWords } from '@/lib/number-to-words';


// PDF generation constants and helpers
const A4_HEIGHT_POINTS = 841.89;
const mmToPoints = (mm: number) => mm * 2.83465;

const cerfaCoordinates = {
    cerfaId:          { x: mmToPoints(174),  y: A4_HEIGHT_POINTS - mmToPoints(24) },
    donorName:        { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(51) },
    donorAddress:     { x: mmToPoints(35),   y: A4_HEIGHT_POINTS - mmToPoints(60) },
    paymentDate:      { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    amountInDigits:   { x: mmToPoints(41),   y: A4_HEIGHT_POINTS - mmToPoints(207) },
    amountInWords:    { x: mmToPoints(115),  y: A4_HEIGHT_POINTS - mmToPoints(207) },
    signatureDate:    { x: mmToPoints(163),  y: A4_HEIGHT_POINTS - mmToPoints(256) },
    signatureDate2:   { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(240) },
    paymentMethod:    { x: mmToPoints(55),   y: A4_HEIGHT_POINTS - mmToPoints(247.5)}
};


export async function generateCerfaPdf(donation: Donation, member: Member): Promise<Buffer> {
    if (!donation.cerfaNumber) {
        throw new Error('CERFA number is missing.');
    }

    // We fetch the template from the public folder. It needs to be a relative path for fetch.
    const templateBytes = await fetch(new URL('/cerfa_template.pdf', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002')).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const textColor = rgb(0, 0, 0);

    if (donation.paymentStatus === 'Annulé') {
        page.drawText('ANNULÉ', {
            x: width / 2 - 150,
            y: height / 2 + 100,
            font: boldFont,
            size: 100,
            color: rgb(1, 0, 0),
            opacity: 0.2,
            rotate: degrees(-45),
        });
    }

    const lastPayment = donation.payments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const paymentDate = new Date(lastPayment.date);
    const formattedDate = format(paymentDate, 'dd/MM/yyyy');
    
    const cerfaDate = donation.cerfaDate ? new Date(donation.cerfaDate) : new Date();
    const formattedCerfaDate = format(cerfaDate, 'dd/MM/yyyy');

    const paymentMethods = [...new Set(donation.payments.map(p => {
        if (p.paymentMethod === 'Carte de crédit') return 'CB';
        return p.paymentMethod;
    }))].join(', ');
    
    const donorName = donation.cerfaNom || member.nom;
    const donorAddress = donation.cerfaAdresse || member.adresse || '';

    page.drawText(donation.cerfaNumber, { ...cerfaCoordinates.cerfaId, font, size: 10, color: textColor });
    page.drawText(donorName, { ...cerfaCoordinates.donorName, font, size: 10, color: textColor });
    page.drawText(donorAddress, { ...cerfaCoordinates.donorAddress, font, size: 10, color: textColor });
    
    page.drawText(donation.totalAmount.toFixed(2), { ...cerfaCoordinates.amountInDigits, font, size: 10, color: textColor });
    page.drawText(numberToWords(donation.totalAmount) + ' euros', { ...cerfaCoordinates.amountInWords, font, size: 8, color: textColor });
    
    page.drawText(formattedDate, { ...cerfaCoordinates.paymentDate, font, size: 10, color: textColor });
    page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate, font, size: 10, color: textColor });
    page.drawText(formattedCerfaDate, { ...cerfaCoordinates.signatureDate2, font, size: 10, color: textColor });
    
    page.drawText(paymentMethods, { ...cerfaCoordinates.paymentMethod, font, size: 10, color: textColor });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

export async function openCerfaPdf(donation: Donation, member: Member) {
    try {
        const pdfBytes = await generateCerfaPdf(donation, member);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        console.error("Failed to generate or open PDF:", error);
        // You might want to show a toast to the user here
    }
}
