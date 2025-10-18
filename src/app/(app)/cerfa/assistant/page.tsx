import { CerfaForm } from '../components/cerfa-form';

export default function CerfaAssistantPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Assistant CERFA</h1>
        <p className="text-muted-foreground">
          Laissez notre assistant IA vous aider à déterminer le bon formulaire CERFA.
        </p>
      </div>
      <CerfaForm />
    </div>
  );
}
