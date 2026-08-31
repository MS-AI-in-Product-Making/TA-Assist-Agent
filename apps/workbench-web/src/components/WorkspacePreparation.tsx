export function WorkspacePreparation({ message = "Preparing TA workspace..." }: { readonly message?: string }) {
  return (
    <section className="workspace-preparation" aria-live="polite" aria-busy="true">
      <span className="workspace-preparation__indicator" aria-hidden="true" />
      <div>
        <h1>{message}</h1>
        <p>Reading governed data and building the engineering analysis view. The source workbook remains read-only.</p>
      </div>
    </section>
  );
}
