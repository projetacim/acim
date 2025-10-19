
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';

async function addPageWithHeaderAndFooter(pdfDoc: PDFDocument, title: string, pageNum: number) {
    const page = pdfDoc.addPage(PageSizes.A4);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Header
    page.drawText(title, {
        x: 50,
        y: height - 50,
        font: boldFont,
        size: 18,
        color: rgb(0.1, 0.1, 0.4),
    });

    // Footer
    page.drawText(`Page ${pageNum}`, {
        x: width - 100,
        y: 40,
        font: font,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
    });

    return { page, font, boldFont, width, height, y: height - 90 };
}

function drawSectionTitle(page: any, y: number, text: string, font: any) {
    page.drawText(text, {
        x: 50,
        y,
        font,
        size: 14,
        color: rgb(0.1, 0.1, 0.4),
    });
    return y - 25;
}

function drawText(page: any, y: number, text: string, font: any, options: { isBullet?: boolean, isCode?: boolean } = {}) {
    const x = options.isBullet ? 70 : 50;
    const size = 11;
    let newY = y;
    
    if (options.isBullet) {
        page.drawText('•', { x: 55, y, font, size });
    }

    const lines = text.split('\n');
    for (const line of lines) {
        const maxWidth = 500;
        let currentLine = '';
        const words = line.split(' ');
        for(const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (font.widthOfTextAtSize(testLine, size) > maxWidth) {
                 if (options.isCode) {
                    page.drawRectangle({ x: 48, y: newY - 15, width: font.widthOfTextAtSize(currentLine, size) + 4, height: 15, color: rgb(0.9, 0.9, 0.9), opacity: 0.5 });
                 }
                page.drawText(currentLine, { x, y: newY, font, size });
                newY -= 15;
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (options.isCode) {
            page.drawRectangle({ x: 48, y: newY - 15, width: font.widthOfTextAtSize(currentLine, size) + 4, height: 15, color: rgb(0.9, 0.9, 0.9), opacity: 0.5 });
        }
        page.drawText(currentLine, { x, y: newY, font, size });
        newY -= 15;
    }
    
    return newY;
}

export async function generateGuidePdf(): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();

    // --- Page 1: Sauvegarde ---
    let { page, font, boldFont, y } = await addPageWithHeaderAndFooter(pdfDoc, 'Guide de Sauvegarde et Restauration', 1);

    y = drawSectionTitle(page, y, '1. Comment Sauvegarder Vos Données', boldFont);

    y = drawText(page, y, "Il est crucial de sauvegarder régulièrement vos données. Le système vous permet d'exporter trois types d'informations.", font);
    y -= 10;
    y = drawText(page, y, "Accédez à Paramètres > Sauvegardes & Restauration.", font);
    y -= 15;
    
    y = drawText(page, y, "Sauvegarde Complète des Données", boldFont);
    y = drawText(page, y, "Cette action télécharge un fichier JSON (sauvegarde-complete-....json) contenant toutes les données de votre association : membres, dons, transactions et catégories. C'est la sauvegarde la plus importante.", font, { isBullet: true });
    y -= 10;

    y = drawText(page, y, "Exporter la Configuration", boldFont);
    y = drawText(page, y, "Ceci télécharge le fichier backend.json. Ce fichier est le 'plan' de votre base de données. Il est surtout utile pour le développeur (ou l'IA) en cas de reconstruction majeure de l'application.", font, { isBullet: true });
    y -= 10;

    y = drawText(page, y, "Exporter une Collection Individuelle", boldFont);
    y = drawText(page, y, "Permet de télécharger uniquement les membres, les dons, etc. Utile pour des analyses externes ou des migrations partielles.", font, { isBullet: true });
    y -= 20;

    y = drawSectionTitle(page, y, 'Fréquence Recommandée', boldFont);
    y = drawText(page, y, "Nous recommandons d'effectuer une sauvegarde complète au moins une fois par semaine, et avant toute opération d'import ou de suppression massive.", font);


    // --- Page 2: Restauration ---
    let { page: page2, y: y2 } = await addPageWithHeaderAndFooter(pdfDoc, 'Guide de Sauvegarde et Restauration', 2);
    
    y2 = drawSectionTitle(page2, y2, '2. Comment Restaurer Vos Données', boldFont);

    y2 = drawText(page2, y2, "La restauration est une opération DANGEREUSE qui écrase toutes les données existantes. N'utilisez cette fonction qu'en cas de problème majeur et après avoir sauvegardé vos données actuelles.", font);
    y2 -= 10;
    y2 = drawText(page2, y2, "La restauration ne concerne que les données de l'application (membres, dons...). Le code de l'application (l'interface, les fonctionnalités) doit être restauré depuis une sauvegarde externe comme GitHub.", font);
    y2 -= 15;

    y2 = drawSectionTitle(page2, y2, "Étapes de la Restauration", boldFont);
    y2 = drawText(page2, y2, "1. Allez dans Paramètres > Sauvegardes & Restauration.", font);
    y2 = drawText(page2, y2, "2. Dans la section 'Restaurer depuis une sauvegarde', cliquez sur 'Choisir un fichier'.", font);
    y2 = drawText(page2, y2, "3. Sélectionnez le fichier de sauvegarde complète (sauvegarde-complete-....json) que vous souhaitez restaurer.", font);
    y2 = drawText(page2, y2, "4. Cliquez sur le bouton 'Lancer la Restauration'.", font);
    y2 = drawText(page2, y2, "5. Une fenêtre d'alerte apparaîtra. Lisez attentivement l'avertissement. Vous devez confirmer pour continuer.", font);
    y2 = drawText(page2, y2, "6. Le système va effacer toutes les données actuelles et les remplacer par celles du fichier. L'application se rechargera automatiquement à la fin du processus.", font);
    y2 -= 15;

    y2 = drawSectionTitle(page2, y2, "Restauration du Code et de la Configuration", boldFont);
    y2 = drawText(page2, y2, "Code de l'Application : Si l'application elle-même est corrompue, le code doit être restauré depuis votre système de contrôle de version (ex: GitHub). Contactez votre support technique.", font, { isBullet: true });
    y2 = drawText(page2, y2, "Fichier de Configuration (backend.json) : Ce fichier ne peut pas être restauré via l'interface. Si vous devez le restaurer, il faut remplacer le fichier src/docs/backend.json dans le code source de l'application, puis redéployer.", font, { isBullet: true });


    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

