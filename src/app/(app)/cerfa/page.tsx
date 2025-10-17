import { CerfaForm } from './components/cerfa-form';

export default function CerfaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">CERFA Assistant</h1>
        <p className="text-muted-foreground">
          Let our AI assistant help you determine the correct CERFA form.
        </p>
      </div>
      <CerfaForm />
    </div>
  );
}
